/**
 * Referral program / parrainage (Taobao gap analysis B.3).
 * Invite code is captured at registration (`User.referredBy`); the reward is
 * only granted once the invitee's first order has been delivered AND stayed
 * undisputed past the existing 72h dispute window — never at registration,
 * to avoid fake-account farming. Reward = HDPoints for both sides.
 */
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import Dispute from '../models/disputeModel.js';
import { getRuntimeConfig } from './configService.js';
import { awardPoints } from './rewardPointsService.js';
import { createNotification } from '../utils/notificationService.js';

const DISPUTE_WINDOW_MS = 72 * 60 * 60 * 1000;
const QUALIFYING_ORDER_STATUSES = [
  'delivery_proof_submitted',
  'delivered',
  'picked_up_confirmed',
  'confirmed_by_client',
  'completed'
];
const ACTIVE_DISPUTE_STATUSES = ['OPEN', 'SELLER_RESPONDED', 'UNDER_REVIEW'];

export const resolveReferrerForRegistration = async ({ referralCode, newUserPhone }) => {
  const enabled = await getRuntimeConfig('enable_referral_program', { fallback: false });
  const code = String(referralCode || '').trim().toUpperCase();
  if (!enabled || !code) return null;

  const referrer = await User.findOne({ referralCode: code }).select('_id phone').lean();
  if (!referrer) return null;

  // Same-phone-digits guard: block a trivial self-referral via an alt number.
  const referrerDigits = String(referrer.phone || '').replace(/\D/g, '');
  const newUserDigits = String(newUserPhone || '').replace(/\D/g, '');
  if (referrerDigits && newUserDigits && referrerDigits === newUserDigits) return null;

  return referrer;
};

const orderQualifiesForReward = (order) => {
  const finalizedAt = order.clientDeliveryConfirmedAt || order.deliveredAt;
  if (!finalizedAt) return false;
  return Date.now() - new Date(finalizedAt).getTime() >= DISPUTE_WINDOW_MS;
};

/**
 * Periodic sweep (see engagementQueue/'sweep-referral-rewards'): finds
 * referred users whose first qualifying order has cleared the dispute
 * window undisputed, and credits both the referrer and the referee once.
 */
export const sweepReferralRewards = async ({ limit = 200 } = {}) => {
  const enabled = await getRuntimeConfig('enable_referral_program', { fallback: false });
  if (!enabled) return { rewarded: 0, checked: 0 };

  const candidates = await User.find({
    referredBy: { $ne: null },
    referralRewardGranted: false
  })
    .select('_id referredBy name')
    .limit(limit)
    .lean();

  let rewarded = 0;
  for (const invitee of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const order = await Order.findOne({
      customer: invitee._id,
      status: { $in: QUALIFYING_ORDER_STATUSES }
    })
      .sort({ createdAt: 1 })
      .select('_id status deliveredAt clientDeliveryConfirmedAt')
      .lean();

    if (!order || !orderQualifiesForReward(order)) continue;

    // eslint-disable-next-line no-await-in-loop
    const activeDispute = await Dispute.findOne({
      orderId: order._id,
      status: { $in: ACTIVE_DISPUTE_STATUSES }
    })
      .select('_id')
      .lean();
    if (activeDispute) continue;

    // eslint-disable-next-line no-await-in-loop
    const claimed = await User.updateOne(
      { _id: invitee._id, referralRewardGranted: false },
      { $set: { referralRewardGranted: true } }
    );
    if (!claimed.modifiedCount) continue; // another sweep tick already claimed it

    // eslint-disable-next-line no-await-in-loop
    const rewardPoints = Number(await getRuntimeConfig('referral_reward_points', { fallback: 500 }));
    if (rewardPoints > 0) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.all([
        awardPoints({
          userId: invitee.referredBy,
          amount: rewardPoints,
          reason: 'referral',
          note: 'Récompense de parrainage — filleul livré',
          metadata: { inviteeId: String(invitee._id) }
        }),
        awardPoints({
          userId: invitee._id,
          amount: rewardPoints,
          reason: 'referral',
          note: 'Récompense de bienvenue — première commande livrée',
          metadata: { referrerId: String(invitee.referredBy) }
        })
      ]);
    }

    // eslint-disable-next-line no-await-in-loop
    await Promise.all([
      createNotification({
        userId: invitee.referredBy,
        actorId: invitee._id,
        type: 'referral_reward_earned',
        allowSelf: false,
        priority: 'HIGH',
        pushEnabled: true,
        metadata: {
          title: 'Récompense de parrainage reçue',
          message: `${invitee.name} a reçu sa première commande. Vos HDPoints ont été crédités.`,
          points: rewardPoints
        },
        entityType: 'user',
        entityId: String(invitee._id),
        deepLink: '/rewards',
        actionLink: '/rewards'
      }).catch(() => {}),
      createNotification({
        userId: invitee._id,
        actorId: invitee._id,
        type: 'referral_reward_earned',
        allowSelf: true,
        priority: 'HIGH',
        pushEnabled: true,
        metadata: {
          title: 'Récompense de bienvenue reçue',
          message: 'Merci pour votre première commande ! Vos HDPoints ont été crédités.',
          points: rewardPoints
        },
        entityType: 'user',
        entityId: String(invitee._id),
        deepLink: '/rewards',
        actionLink: '/rewards'
      }).catch(() => {})
    ]);

    rewarded += 1;
  }

  return { rewarded, checked: candidates.length };
};
