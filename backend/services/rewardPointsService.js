/**
 * HDPoints — buyer rewards program (Taobao gap analysis B.2).
 * Points ledger sibling to walletModel: daily check-in (with streak bonus),
 * points per 1000 XAF spent on a delivered order, points per verified review,
 * points per answered product question (feeds B.4). Spendable at checkout,
 * capped at a runtime-configured % of order value.
 */
import RewardPoints from '../models/rewardPointsModel.js';
import Order from '../models/orderModel.js';
import { getRuntimeConfig } from './configService.js';
import { createNotification } from '../utils/notificationService.js';

const MAX_STREAK_BONUS_DAYS = 7;
const QUALIFYING_ORDER_STATUSES = [
  'delivery_proof_submitted',
  'delivered',
  'picked_up_confirmed',
  'confirmed_by_client',
  'completed'
];

export const getOrCreateRewardPoints = async (userId) => {
  let record = await RewardPoints.findOne({ user: userId });
  if (!record) {
    record = await RewardPoints.create({ user: userId, balance: 0, transactions: [] });
  }
  return record;
};

const isSameCalendarDay = (a, b) =>
  a &&
  b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isPreviousCalendarDay = (previous, now) => {
  if (!previous) return false;
  const next = new Date(previous);
  next.setDate(next.getDate() + 1);
  return isSameCalendarDay(next, now);
};

/**
 * Credits points to a user's balance. No-op (returns null) if the program is
 * disabled or the computed point amount is <= 0 — callers should always
 * `.catch(() => {})` this since earning points must never block the action
 * that triggered it (an order, a review, a Q&A answer).
 */
export const awardPoints = async ({ userId, reason, amount = null, note = '', metadata = {} }) => {
  const enabled = await getRuntimeConfig('enable_reward_points', { fallback: false });
  if (!enabled || !userId || !reason) return null;

  let points = Number(amount);
  if (!Number.isFinite(points)) {
    if (reason === 'review') {
      points = Number(await getRuntimeConfig('reward_points_review', { fallback: 20 }));
    } else if (reason === 'qa_answer') {
      points = Number(await getRuntimeConfig('reward_points_qa_answer', { fallback: 15 }));
    } else {
      points = 0;
    }
  }
  points = Math.round(points);
  if (points <= 0) return null;

  const record = await getOrCreateRewardPoints(userId);
  record.balance = Math.max(0, record.balance + points);
  record.lifetimeEarned = Math.max(0, record.lifetimeEarned + points);
  record.transactions.push({
    reason,
    points,
    balanceAfter: record.balance,
    note,
    metadata
  });
  await record.save();

  createNotification({
    userId,
    actorId: userId,
    type: 'points_earned',
    allowSelf: true,
    priority: 'LOW',
    pushEnabled: false,
    metadata: {
      title: 'HDPoints gagnés',
      message: `Vous avez gagné ${points} HDPoints.`,
      points,
      balance: record.balance
    },
    entityType: 'reward_points',
    entityId: String(record._id),
    deepLink: '/rewards',
    actionLink: '/rewards'
  }).catch(() => {});

  return { balance: record.balance, pointsAwarded: points };
};

/**
 * Awards purchase points for a delivered order's subtotal. Idempotent per
 * order via metadata.orderId de-dup check — call once per order transition
 * to a delivered/completed status.
 */
export const awardPurchasePoints = async ({ userId, orderId, subtotal }) => {
  const enabled = await getRuntimeConfig('enable_reward_points', { fallback: false });
  if (!enabled || !userId || !orderId) return null;

  const record = await getOrCreateRewardPoints(userId);
  const alreadyAwarded = record.transactions.some(
    (txn) => txn.reason === 'purchase' && String(txn.metadata?.orderId || '') === String(orderId)
  );
  if (alreadyAwarded) return null;

  const perThousand = Number(await getRuntimeConfig('reward_points_per_1000_xaf', { fallback: 10 }));
  const points = Math.round((Math.max(0, Number(subtotal) || 0) / 1000) * perThousand);
  if (points <= 0) return null;

  return awardPoints({
    userId,
    reason: 'purchase',
    amount: points,
    note: 'Points pour commande livrée',
    metadata: { orderId: String(orderId) }
  });
};

/**
 * Daily check-in. Throttled to once per calendar day; streak resets if a day
 * is missed. Returns null (no-op) if already checked in today.
 */
export const checkIn = async (userId) => {
  const enabled = await getRuntimeConfig('enable_reward_points', { fallback: false });
  if (!enabled) return null;

  const record = await getOrCreateRewardPoints(userId);
  const now = new Date();
  if (isSameCalendarDay(record.lastCheckinAt, now)) {
    return { alreadyCheckedIn: true, balance: record.balance, streak: record.checkinStreak };
  }

  const [basePoints, streakBonus] = await Promise.all([
    getRuntimeConfig('reward_points_checkin_base', { fallback: 5 }),
    getRuntimeConfig('reward_points_checkin_streak_bonus', { fallback: 2 })
  ]);

  const continuesStreak = isPreviousCalendarDay(record.lastCheckinAt, now);
  const nextStreak = continuesStreak ? record.checkinStreak + 1 : 1;
  const bonusDays = Math.min(MAX_STREAK_BONUS_DAYS, Math.max(0, nextStreak - 1));
  const points = Math.round(Number(basePoints) + bonusDays * Number(streakBonus));

  record.checkinStreak = nextStreak;
  record.lastCheckinAt = now;
  record.balance += points;
  record.lifetimeEarned += points;
  record.transactions.push({
    reason: 'checkin',
    points,
    balanceAfter: record.balance,
    note: `Check-in quotidien (série ${nextStreak}j)`,
    metadata: { streak: nextStreak }
  });
  await record.save();

  return { alreadyCheckedIn: false, balance: record.balance, streak: nextStreak, pointsAwarded: points };
};

/**
 * Server-side redemption at checkout: validates the requested point spend
 * against balance and the runtime-configured max % of order value, then
 * deducts and returns the XAF value to subtract from the order total. Never
 * trust a client-computed discount — call this during order creation only.
 */
export const redeemPointsForOrder = async ({ userId, requestedPoints, orderSubtotal }) => {
  const enabled = await getRuntimeConfig('enable_reward_points', { fallback: false });
  const points = Math.max(0, Math.round(Number(requestedPoints) || 0));
  if (!enabled || !userId || points <= 0) {
    return { pointsRedeemed: 0, xafValue: 0 };
  }

  const record = await getOrCreateRewardPoints(userId);
  const [conversionXaf, maxPercent] = await Promise.all([
    getRuntimeConfig('reward_points_conversion_xaf', { fallback: 1 }),
    getRuntimeConfig('reward_points_max_order_percent', { fallback: 20 })
  ]);

  const maxXafFromCap = Math.floor((Math.max(0, Number(orderSubtotal) || 0) * Number(maxPercent)) / 100);
  const maxPointsFromCap = Math.floor(maxXafFromCap / Math.max(1, Number(conversionXaf)));
  const redeemablePoints = Math.min(points, record.balance, maxPointsFromCap);

  if (redeemablePoints <= 0) {
    return { pointsRedeemed: 0, xafValue: 0 };
  }

  const xafValue = redeemablePoints * Number(conversionXaf);
  record.balance -= redeemablePoints;
  record.transactions.push({
    reason: 'redeem',
    points: -redeemablePoints,
    balanceAfter: record.balance,
    note: 'Points utilisés au paiement',
    metadata: { xafValue }
  });
  await record.save();

  return { pointsRedeemed: redeemablePoints, xafValue };
};

/**
 * Periodic sweep (see engagementQueue/'sweep-purchase-points'): awards
 * purchase points for orders that reached a delivered/completed status,
 * using Order.rewardPointsAwarded as the idempotency flag (cheaper than
 * scanning wallet-style transaction history per order). Deliberately kept
 * out of orderController.js's status-transition call sites — this file is
 * ~5,700 lines and edited surgically per project convention.
 */
export const sweepPurchasePoints = async ({ limit = 300 } = {}) => {
  const orders = await Order.find({
    status: { $in: QUALIFYING_ORDER_STATUSES },
    rewardPointsAwarded: { $ne: true }
  })
    .select('_id customer itemsSubtotal totalAmount')
    .limit(limit)
    .lean();

  let processed = 0;
  for (const order of orders) {
    const subtotal = Number(order.itemsSubtotal ?? order.totalAmount ?? 0);
    // eslint-disable-next-line no-await-in-loop
    await awardPurchasePoints({ userId: order.customer, orderId: order._id, subtotal });
    // eslint-disable-next-line no-await-in-loop
    await Order.updateOne({ _id: order._id }, { $set: { rewardPointsAwarded: true } });
    processed += 1;
  }

  return { processed, checked: orders.length };
};
