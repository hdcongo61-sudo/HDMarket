import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import Rating from '../models/ratingModel.js';
import Comment from '../models/commentModel.js';
import ShopReview from '../models/shopReviewModel.js';
import { createNotification } from '../utils/notificationService.js';
import { invalidateAdminCache, invalidateSellerCache, invalidateUserCache } from '../utils/cache.js';
import { getManyRuntimeConfigs } from './configService.js';

const TERMINAL_STATUSES = ['cancelled', 'completed', 'confirmed_by_client'];
const DELIVERED_LIKE_STATUSES = ['delivery_proof_submitted', 'delivered', 'picked_up_confirmed', 'confirmed_by_client', 'completed'];
const ACTIVE_FLOW_STATUSES = [
  'pending_payment',
  'paid',
  'ready_for_pickup',
  'picked_up_confirmed',
  'ready_for_delivery',
  'out_for_delivery',
  'pending',
  'pending_installment',
  'installment_active',
  'overdue_installment',
  'confirmed',
  'delivering'
];

const ORDER_AUTOMATION_DEFAULTS = Object.freeze({
  maxRemindersPerOrder: Math.max(1, Number(process.env.ORDER_REMINDER_MAX_PER_ORDER || 2)),
  minReminderIntervalHours: Math.max(1, Number(process.env.ORDER_REMINDER_INTERVAL_HOURS || 12)),
  sellerReminderDelayHours: Math.max(2, Number(process.env.ORDER_SELLER_REMINDER_AFTER_HOURS || 24)),
  buyerConfirmationDelayHours: Math.max(2, Number(process.env.ORDER_BUYER_CONFIRMATION_REMINDER_AFTER_HOURS || 24)),
  reviewReminderDelayDays: Math.max(1, Number(process.env.ORDER_REVIEW_REMINDER_AFTER_DAYS || 3)),
  experienceReminderDelayDays: Math.max(1, Number(process.env.ORDER_EXPERIENCE_REMINDER_AFTER_DAYS || 7)),
  escalationDelayHours: Math.max(6, Number(process.env.ORDER_ESCALATION_AFTER_HOURS || 48)),
  highValueOrderAmount: Math.max(50000, Number(process.env.ORDER_HIGH_VALUE_THRESHOLD || 200000))
});

const ORDER_AUTOMATION_CONFIG_KEYS = Object.freeze({
  maxRemindersPerOrder: 'max_reminder_count',
  minReminderIntervalHours: 'order_reminder_interval_hours',
  sellerReminderDelayHours: 'seller_reminder_delay_hours',
  buyerConfirmationDelayHours: 'buyer_confirmation_reminder_hours',
  reviewReminderDelayDays: 'review_delay_days',
  experienceReminderDelayDays: 'experience_reminder_delay_days',
  escalationDelayHours: 'order_escalation_delay_hours',
  highValueOrderAmount: 'high_value_order_threshold'
});

const toThresholdNumber = (value, fallback, min = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
};

const getOrderAutomationThresholds = async () => {
  const configKeys = Object.values(ORDER_AUTOMATION_CONFIG_KEYS);
  const raw = await getManyRuntimeConfigs(configKeys);

  return {
    maxRemindersPerOrder: toThresholdNumber(
      raw[ORDER_AUTOMATION_CONFIG_KEYS.maxRemindersPerOrder],
      ORDER_AUTOMATION_DEFAULTS.maxRemindersPerOrder,
      1
    ),
    minReminderIntervalHours: toThresholdNumber(
      raw[ORDER_AUTOMATION_CONFIG_KEYS.minReminderIntervalHours],
      ORDER_AUTOMATION_DEFAULTS.minReminderIntervalHours,
      1
    ),
    sellerReminderDelayHours: toThresholdNumber(
      raw[ORDER_AUTOMATION_CONFIG_KEYS.sellerReminderDelayHours],
      ORDER_AUTOMATION_DEFAULTS.sellerReminderDelayHours,
      2
    ),
    buyerConfirmationDelayHours: toThresholdNumber(
      raw[ORDER_AUTOMATION_CONFIG_KEYS.buyerConfirmationDelayHours],
      ORDER_AUTOMATION_DEFAULTS.buyerConfirmationDelayHours,
      2
    ),
    reviewReminderDelayDays: toThresholdNumber(
      raw[ORDER_AUTOMATION_CONFIG_KEYS.reviewReminderDelayDays],
      ORDER_AUTOMATION_DEFAULTS.reviewReminderDelayDays,
      1
    ),
    experienceReminderDelayDays: toThresholdNumber(
      raw[ORDER_AUTOMATION_CONFIG_KEYS.experienceReminderDelayDays],
      ORDER_AUTOMATION_DEFAULTS.experienceReminderDelayDays,
      1
    ),
    escalationDelayHours: toThresholdNumber(
      raw[ORDER_AUTOMATION_CONFIG_KEYS.escalationDelayHours],
      ORDER_AUTOMATION_DEFAULTS.escalationDelayHours,
      6
    ),
    highValueOrderAmount: toThresholdNumber(
      raw[ORDER_AUTOMATION_CONFIG_KEYS.highValueOrderAmount],
      ORDER_AUTOMATION_DEFAULTS.highValueOrderAmount,
      50000
    )
  };
};

const PRIORITY_SCORE = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

const toObjectId = (value) => {
  if (!value) return null;
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
};

const toDate = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const clampPercent = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
};

const getExpectedDeliveryDate = (order) => toDate(order?.expectedDeliveryDate || order?.deliveryDate || null);

const isTerminalStatus = (status) => TERMINAL_STATUSES.includes(String(status || ''));

const collectSellerIdsFromOrder = (order) => {
  const ids = new Set();
  const items = Array.isArray(order?.items) ? order.items : [];
  items.forEach((item) => {
    const sellerId =
      item?.snapshot?.shopId ||
      item?.product?.user ||
      item?.product?.user?._id ||
      null;
    if (sellerId) ids.add(String(sellerId));
  });
  return Array.from(ids);
};

const computeDaysLate = (expectedDate, now = new Date()) => {
  if (!expectedDate) return 0;
  const diffMs = now.getTime() - expectedDate.getTime();
  if (diffMs <= 0) return 0;
  return Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
};

const computeDelaySeverity = (daysLate) => {
  if (daysLate >= 6) return 'critical';
  if (daysLate >= 3) return 'moderate';
  if (daysLate >= 1) return 'slight';
  return 'none';
};

const mapSeverityToPriority = (severity) => {
  switch (String(severity || '').toLowerCase()) {
    case 'critical':
      return 'CRITICAL';
    case 'moderate':
      return 'HIGH';
    case 'slight':
      return 'MEDIUM';
    default:
      return 'LOW';
  }
};

const sortAlertsByPriority = (alerts = []) => {
  return [...alerts].sort((a, b) => {
    const ap = PRIORITY_SCORE[String(a?.priority || 'LOW').toUpperCase()] || 1;
    const bp = PRIORITY_SCORE[String(b?.priority || 'LOW').toUpperCase()] || 1;
    if (ap !== bp) return bp - ap;
    return new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime();
  });
};

const appendTimelineEvent = (order, { type, label, actor = null, metadata = {}, at = new Date() }) => {
  if (!order) return;
  if (!Array.isArray(order.timeline)) order.timeline = [];
  order.timeline.push({
    type: String(type || '').trim() || 'system',
    label: String(label || '').trim() || 'Event',
    actor: actor || null,
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    at
  });
  if (order.timeline.length > 250) {
    order.timeline = order.timeline.slice(order.timeline.length - 250);
  }
};

const markReminderMetadata = (order, reminderType, now = new Date()) => {
  order.reminderSentCount = Number(order.reminderSentCount || 0) + 1;
  order.lastReminderDate = now;

  if (!order.reminderState || typeof order.reminderState !== 'object') {
    order.reminderState = {};
  }
  const keyMap = {
    seller: 'sellerReminderSentAt',
    buyer_confirmation: 'buyerConfirmationReminderSentAt',
    review: 'reviewReminderSentAt',
    experience: 'experienceReminderSentAt',
    escalation: 'escalationReminderSentAt',
    delay_detected: 'delayReminderSentAt',
    manual: 'manualReminderSentAt'
  };
  const key = keyMap[reminderType] || 'manualReminderSentAt';
  order.reminderState[key] = now;
};

const canSendReminder = (order, reminderType, now = new Date(), thresholds = ORDER_AUTOMATION_DEFAULTS) => {
  if (!order) return false;
  if (Number(order.reminderSentCount || 0) >= Number(thresholds.maxRemindersPerOrder || 0)) return false;

  const minIntervalMs = Number(thresholds.minReminderIntervalHours || 0) * 60 * 60 * 1000;
  if (order.lastReminderDate) {
    const diffMs = now.getTime() - new Date(order.lastReminderDate).getTime();
    if (Number.isFinite(diffMs) && diffMs < minIntervalMs) return false;
  }

  const reminderState = order.reminderState || {};
  const keyMap = {
    seller: 'sellerReminderSentAt',
    buyer_confirmation: 'buyerConfirmationReminderSentAt',
    review: 'reviewReminderSentAt',
    experience: 'experienceReminderSentAt',
    escalation: 'escalationReminderSentAt',
    delay_detected: 'delayReminderSentAt',
    manual: 'manualReminderSentAt'
  };
  const key = keyMap[reminderType] || 'manualReminderSentAt';
  if (reminderState[key]) {
    const diffMs = now.getTime() - new Date(reminderState[key]).getTime();
    if (Number.isFinite(diffMs) && diffMs < minIntervalMs) return false;
  }

  return true;
};

const resolveActorId = ({ explicitActorId = null, fallbackActorId = null, recipientId = null }) => {
  if (explicitActorId && mongoose.Types.ObjectId.isValid(explicitActorId)) return explicitActorId;
  if (fallbackActorId && mongoose.Types.ObjectId.isValid(fallbackActorId)) return fallbackActorId;
  if (recipientId && mongoose.Types.ObjectId.isValid(recipientId)) return recipientId;
  return null;
};

const getAdminAndManagerIds = async () => {
  const recipients = await User.find({ role: { $in: ['admin', 'manager'] } }).select('_id').lean();
  return recipients.map((entry) => String(entry._id));
};

const sendOrderReminderNotification = async ({
  order,
  reminderType,
  actorId = null,
  recipients = [],
  priority = 'NORMAL',
  title = '',
  message = ''
}) => {
  const validRecipients = Array.from(new Set((recipients || []).map((id) => String(id || '')).filter(Boolean)));
  if (!order || !validRecipients.length) return 0;

  let sent = 0;
  for (const recipientId of validRecipients) {
    const resolvedActor = resolveActorId({
      explicitActorId: actorId,
      fallbackActorId: order.customer,
      recipientId
    });
    if (!resolvedActor) continue;

    const isAdminReminder = reminderType === 'escalation';
    const type = isAdminReminder ? 'admin_broadcast' : 'order_reminder';

    const result = await createNotification({
      userId: recipientId,
      actorId: resolvedActor,
      type,
      priority,
      metadata: {
        orderId: String(order._id),
        reminderType,
        status: order.status,
        deliveryCity: order.deliveryCity,
        deliveryAddress: order.deliveryAddress,
        totalAmount: Number(order.totalAmount || 0),
        delaySeverity: order.delaySeverity || 'none',
        delayDays: Number(order.delayDays || 0),
        title,
        message
      },
      allowSelf: true
    });
    if (result) sent += 1;
  }

  return sent;
};

const resolveReminderRecipients = async (order, reminderType) => {
  const sellerIds = collectSellerIdsFromOrder(order);
  const customerId = order?.customer ? String(order.customer) : null;

  switch (reminderType) {
    case 'seller':
    case 'delay_detected':
      return sellerIds;
    case 'buyer_confirmation':
    case 'review':
    case 'experience':
      return customerId ? [customerId] : [];
    case 'escalation':
      return getAdminAndManagerIds();
    case 'manual':
    default:
      return Array.from(new Set([...(customerId ? [customerId] : []), ...sellerIds]));
  }
};

const refreshOrderReviewFlags = async (order) => {
  if (!order) return false;
  const customerId = order.customer ? String(order.customer) : '';
  if (!customerId) return false;

  const productIds = Array.isArray(order.items)
    ? order.items
        .map((item) => item?.product)
        .filter(Boolean)
        .map((id) => String(id))
    : [];

  if (!productIds.length) return false;

  const objectIds = productIds.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
  if (!objectIds.length) return false;

  const [ratingExists, commentExists] = await Promise.all([
    Rating.exists({ user: customerId, product: { $in: objectIds } }),
    Comment.exists({ user: customerId, product: { $in: objectIds } })
  ]);

  const reviewed = Boolean(ratingExists || commentExists);
  if (reviewed && order.reviewGiven !== true) {
    order.reviewGiven = true;
    appendTimelineEvent(order, {
      type: 'review_detected',
      label: 'Review detected from buyer',
      metadata: { source: 'automation' }
    });
    return true;
  }

  return false;
};

const refreshOrderConfirmationFlags = (order) => {
  if (!order) return false;
  const isConfirmed =
    Boolean(order.clientDeliveryConfirmedAt) ||
    ['confirmed_by_client', 'completed', 'picked_up_confirmed'].includes(String(order.status || ''));
  if (isConfirmed && order.confirmationGiven !== true) {
    order.confirmationGiven = true;
    appendTimelineEvent(order, {
      type: 'confirmation_detected',
      label: 'Buyer confirmation detected',
      metadata: { source: 'automation' }
    });
    return true;
  }
  return false;
};

const maybeComputeRiskScore = (order, thresholds = ORDER_AUTOMATION_DEFAULTS) => {
  const delayDays = Number(order?.delayDays || 0);
  const reminderCount = Number(order?.reminderSentCount || 0);
  const amount = Number(order?.totalAmount || 0);
  const stuckSince = toDate(order?.statusStuckSince);
  const now = new Date();
  const stuckHours = stuckSince ? (now.getTime() - stuckSince.getTime()) / (60 * 60 * 1000) : 0;

  let score = 0;
  score += Math.min(40, delayDays * 6);
  score += Math.min(20, reminderCount * 8);
  if (amount >= Number(thresholds.highValueOrderAmount || 0)) score += 20;
  if (stuckHours >= 48) score += 20;
  return Math.max(0, Math.min(100, Math.round(score)));
};

const invalidateOrderScopeCaches = async (order) => {
  if (!order) return;
  const customerId = order.customer ? String(order.customer) : null;
  const sellerIds = collectSellerIdsFromOrder(order);

  if (customerId) {
    await invalidateUserCache(customerId, ['orders', 'notifications']);
  }
  if (sellerIds.length) {
    await Promise.all(sellerIds.map((sellerId) => invalidateSellerCache(sellerId, ['orders', 'dashboard', 'analytics'])));
  }
  await invalidateAdminCache(['orders', 'dashboard', 'analytics', 'admin']);
};

const ensureOrderTimelineSeed = (order) => {
  if (!Array.isArray(order.timeline)) order.timeline = [];
  if (!order.timeline.length) {
    appendTimelineEvent(order, {
      type: 'order_created',
      label: 'Order created',
      actor: order.customer || null,
      metadata: { source: 'bootstrap' },
      at: toDate(order.createdAt) || new Date()
    });
  }
};

export const buildAdminOrderFilter = async (query = {}) => {
  const {
    status,
    search = '',
    orderId,
    city,
    shop,
    shopId,
    dateFrom,
    dateTo,
    deliveryMode,
    paymentType,
    delayed,
    priority
  } = query || {};

  const filter = { isDraft: false };

  if (status) {
    filter.status = String(status);
  }

  const orderObjectId = toObjectId(orderId);
  if (orderObjectId) {
    filter._id = orderObjectId;
  }

  if (city && String(city).trim()) {
    filter.deliveryCity = new RegExp(`^${String(city).trim()}$`, 'i');
  }

  const shopObjectId = toObjectId(shopId || shop);
  if (shopObjectId) {
    filter['items.snapshot.shopId'] = shopObjectId;
  } else if (shop && String(shop).trim()) {
    filter['items.snapshot.shopName'] = new RegExp(String(shop).trim(), 'i');
  }

  if (deliveryMode && ['PICKUP', 'DELIVERY'].includes(String(deliveryMode))) {
    filter.deliveryMode = String(deliveryMode);
  }

  if (paymentType && ['full', 'installment'].includes(String(paymentType))) {
    filter.paymentType = String(paymentType);
  }

  const from = toDate(dateFrom);
  const to = toDate(dateTo);
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (String(delayed || '').toLowerCase() === 'true') {
    filter.delayStatus = 'delayed';
  }

  if (priority && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(priority).toUpperCase())) {
    filter.adminPriority = String(priority).toUpperCase();
  }

  const term = String(search || '').trim();
  if (term) {
    const regex = new RegExp(term, 'i');
    const customerIds = await User.find({
      $or: [{ name: regex }, { email: regex }, { phone: regex }]
    })
      .limit(100)
      .select('_id')
      .lean();

    const or = [
      { deliveryCode: regex },
      { paymentTransactionCode: regex },
      { 'items.snapshot.title': regex },
      { 'items.snapshot.shopName': regex },
      { deliveryAddress: regex },
      { trackingNote: regex }
    ];

    if (customerIds.length) {
      or.push({ customer: { $in: customerIds.map((entry) => entry._id) } });
    }

    const maybeObjectId = toObjectId(term);
    if (maybeObjectId) {
      or.push({ _id: maybeObjectId });
      or.push({ 'items.snapshot.shopId': maybeObjectId });
    }

    filter.$or = or;
  }

  return filter;
};

const delayedExpr = (now = new Date()) => ({
  $and: [
    { $not: [{ $in: ['$status', TERMINAL_STATUSES] }] },
    { $ne: [{ $ifNull: ['$expectedDeliveryDate', '$deliveryDate'] }, null] },
    { $lt: [{ $ifNull: ['$expectedDeliveryDate', '$deliveryDate'] }, now] }
  ]
});

const buildAlertScopeFilter = (baseFilter = {}) => ({
  $and: [baseFilter || {}, { status: { $ne: 'delivered' } }]
});

export const getOrderCommandCenterSnapshot = async (query = {}) => {
  const filter = await buildAdminOrderFilter(query);
  const now = new Date();

  const [
    total,
    totalActive,
    inProgress,
    delivered,
    cancelled,
    dispute,
    pendingConfirmation,
    awaitingReview,
    delayedCount,
    statusAgg,
    timelineAgg
  ] = await Promise.all([
    Order.countDocuments(filter),
    Order.countDocuments({
      ...filter,
      status: { $nin: ['cancelled', 'completed'] }
    }),
    Order.countDocuments({
      ...filter,
      status: { $in: ACTIVE_FLOW_STATUSES }
    }),
    Order.countDocuments({
      ...filter,
      status: { $in: DELIVERED_LIKE_STATUSES }
    }),
    Order.countDocuments({
      ...filter,
      status: 'cancelled'
    }),
    Order.countDocuments({
      ...filter,
      status: 'dispute_opened'
    }),
    Order.countDocuments({
      ...filter,
      status: { $in: ['delivery_proof_submitted', 'delivered', 'picked_up_confirmed'] },
      $or: [{ confirmationGiven: { $ne: true } }, { clientDeliveryConfirmedAt: null }]
    }),
    Order.countDocuments({
      ...filter,
      status: { $in: DELIVERED_LIKE_STATUSES },
      reviewGiven: { $ne: true }
    }),
    Order.aggregate([
      { $match: filter },
      {
        $match: {
          $expr: {
            $or: [
              { $eq: ['$delayStatus', 'delayed'] },
              delayedExpr(now)
            ]
          }
        }
      },
      { $count: 'count' }
    ]),
    Order.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 }
    ])
  ]);

  const delayed = Number(delayedCount?.[0]?.count || 0);

  const statusCounts = statusAgg.reduce((acc, item) => {
    acc[item._id || 'unknown'] = Number(item.count || 0);
    return acc;
  }, {});

  const timeline = timelineAgg.map((item) => ({ label: item._id, count: Number(item.count || 0) }));

  return {
    filterApplied: filter,
    metrics: {
      total,
      totalActive,
      inProgress,
      delivered,
      delayed,
      cancelled,
      dispute,
      pendingConfirmation,
      awaitingReview
    },
    statusCounts,
    timeline
  };
};

export const getOrderAlertCenter = async (query = {}) => {
  const thresholds = await getOrderAutomationThresholds();
  const filter = await buildAdminOrderFilter(query);
  const alertScopeFilter = buildAlertScopeFilter(filter);
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  const [delayedOrders, highValueAtRisk, repeatedSellerDelay, repeatedBuyerNoConfirm, stuckOrders] = await Promise.all([
    Order.aggregate([
      { $match: alertScopeFilter },
      {
        $addFields: {
          expectedAt: { $ifNull: ['$expectedDeliveryDate', '$deliveryDate'] }
        }
      },
      {
        $match: {
          $expr: {
            $and: [
              { $not: [{ $in: ['$status', TERMINAL_STATUSES] }] },
              { $ne: ['$expectedAt', null] },
              { $lt: ['$expectedAt', now] }
            ]
          }
        }
      },
      {
        $project: {
          _id: 1,
          status: 1,
          totalAmount: 1,
          expectedAt: 1,
          delayDays: {
            $max: [1, { $floor: { $divide: [{ $subtract: [now, '$expectedAt'] }, 86400000] } }]
          }
        }
      },
      { $sort: { delayDays: -1, totalAmount: -1 } },
      { $limit: 120 }
    ]),
    Order.find({
      ...alertScopeFilter,
      totalAmount: { $gte: Number(thresholds.highValueOrderAmount || ORDER_AUTOMATION_DEFAULTS.highValueOrderAmount) },
      status: { $nin: TERMINAL_STATUSES },
      updatedAt: { $lte: twoDaysAgo }
    })
      .select('_id status totalAmount updatedAt deliveryCity')
      .sort({ totalAmount: -1 })
      .limit(60)
      .lean(),
    Order.aggregate([
      { $match: { ...alertScopeFilter, delayStatus: 'delayed' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.snapshot.shopId',
          delayedCount: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      { $match: { _id: { $ne: null }, delayedCount: { $gte: 3 } } },
      { $sort: { delayedCount: -1 } },
      { $limit: 40 }
    ]),
    Order.aggregate([
      {
        $match: {
          ...alertScopeFilter,
          status: { $in: ['delivery_proof_submitted', 'picked_up_confirmed'] },
          $or: [{ confirmationGiven: { $ne: true } }, { clientDeliveryConfirmedAt: null }]
        }
      },
      {
        $group: {
          _id: '$customer',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      { $match: { _id: { $ne: null }, count: { $gte: 3 } } },
      { $sort: { count: -1 } },
      { $limit: 40 }
    ]),
    Order.find({
      ...alertScopeFilter,
      status: { $nin: TERMINAL_STATUSES },
      statusStuckSince: {
        $lte: new Date(
          now.getTime() -
            Number(thresholds.escalationDelayHours || ORDER_AUTOMATION_DEFAULTS.escalationDelayHours) * 60 * 60 * 1000
        )
      }
    })
      .select('_id status statusStuckSince totalAmount deliveryCity')
      .sort({ statusStuckSince: 1 })
      .limit(80)
      .lean()
  ]);

  const alerts = [];

  delayedOrders.forEach((order) => {
    const severity = computeDelaySeverity(Number(order.delayDays || 0));
    alerts.push({
      id: `delay:${order._id}`,
      type: 'delayed_order',
      priority: mapSeverityToPriority(severity),
      orderId: String(order._id),
      title: 'Delayed order detected',
      message: `Order is ${order.delayDays} day(s) late.`,
      createdAt: now,
      payload: {
        status: order.status,
        delayDays: Number(order.delayDays || 0),
        severity,
        totalAmount: Number(order.totalAmount || 0)
      }
    });
  });

  highValueAtRisk.forEach((order) => {
    alerts.push({
      id: `risk:high-value:${order._id}`,
      type: 'high_value_at_risk',
      priority: 'HIGH',
      orderId: String(order._id),
      title: 'High-value order at risk',
      message: `Order has no progress while amount is ${Number(order.totalAmount || 0).toLocaleString('fr-FR')} FCFA.`,
      createdAt: order.updatedAt || now,
      payload: {
        status: order.status,
        totalAmount: Number(order.totalAmount || 0),
        deliveryCity: order.deliveryCity || ''
      }
    });
  });

  repeatedSellerDelay.forEach((entry) => {
    alerts.push({
      id: `seller:delay:${entry._id}`,
      type: 'repeated_seller_delay',
      priority: entry.delayedCount >= 8 ? 'CRITICAL' : 'HIGH',
      sellerId: String(entry._id),
      title: 'Seller delay pattern detected',
      message: `Seller has ${entry.delayedCount} delayed order item(s).`,
      createdAt: now,
      payload: {
        delayedCount: Number(entry.delayedCount || 0),
        totalAmount: Number(entry.totalAmount || 0)
      }
    });
  });

  repeatedBuyerNoConfirm.forEach((entry) => {
    alerts.push({
      id: `buyer:no-confirm:${entry._id}`,
      type: 'repeated_buyer_no_confirmation',
      priority: entry.count >= 6 ? 'CRITICAL' : 'MEDIUM',
      customerId: String(entry._id),
      title: 'Buyer confirmation pattern detected',
      message: `Buyer has ${entry.count} delivery confirmation(s) pending.`,
      createdAt: now,
      payload: {
        count: Number(entry.count || 0),
        totalAmount: Number(entry.totalAmount || 0)
      }
    });
  });

  stuckOrders.forEach((order) => {
    const stuckSince = toDate(order.statusStuckSince);
    const hours = stuckSince
      ? Math.max(1, Math.floor((now.getTime() - stuckSince.getTime()) / (60 * 60 * 1000)))
      : Number(thresholds.escalationDelayHours || ORDER_AUTOMATION_DEFAULTS.escalationDelayHours);
    alerts.push({
      id: `stuck:${order._id}`,
      type: 'status_stuck',
      priority: hours >= 96 ? 'CRITICAL' : hours >= 48 ? 'HIGH' : 'MEDIUM',
      orderId: String(order._id),
      title: 'Order status stuck too long',
      message: `Order stayed in status ${order.status} for ~${hours}h.`,
      createdAt: stuckSince || now,
      payload: {
        status: order.status,
        stuckHours: hours,
        totalAmount: Number(order.totalAmount || 0)
      }
    });
  });

  const sorted = sortAlertsByPriority(alerts);
  return {
    total: sorted.length,
    byPriority: sorted.reduce(
      (acc, alert) => {
        const key = String(alert.priority || 'LOW').toUpperCase();
        acc[key] = Number(acc[key] || 0) + 1;
        return acc;
      },
      { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
    ),
    items: sorted.slice(0, 200)
  };
};

export const getSellerPerformanceSnapshot = async (query = {}) => {
  const filter = await buildAdminOrderFilter(query);

  const rows = await Order.aggregate([
    { $match: filter },
    { $unwind: '$items' },
    {
      $project: {
        orderId: '$_id',
        shopId: '$items.snapshot.shopId',
        status: 1,
        createdAt: 1,
        deliveredAt: 1,
        totalAmount: 1,
        delayStatus: 1,
        reviewGiven: 1,
        confirmationGiven: 1
      }
    },
    { $match: { shopId: { $ne: null } } },
    {
      $group: {
        _id: { orderId: '$orderId', shopId: '$shopId' },
        status: { $first: '$status' },
        createdAt: { $first: '$createdAt' },
        deliveredAt: { $first: '$deliveredAt' },
        totalAmount: { $max: '$totalAmount' },
        delayStatus: { $first: '$delayStatus' },
        reviewGiven: { $first: '$reviewGiven' },
        confirmationGiven: { $first: '$confirmationGiven' }
      }
    },
    {
      $group: {
        _id: '$_id.shopId',
        totalOrders: { $sum: 1 },
        deliveredOrders: {
          $sum: {
            $cond: [{ $in: ['$status', DELIVERED_LIKE_STATUSES] }, 1, 0]
          }
        },
        completedOrders: {
          $sum: {
            $cond: [{ $in: ['$status', ['completed', 'confirmed_by_client']] }, 1, 0]
          }
        },
        cancelledOrders: {
          $sum: {
            $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
          }
        },
        delayedOrders: {
          $sum: {
            $cond: [{ $eq: ['$delayStatus', 'delayed'] }, 1, 0]
          }
        },
        reviewedOrders: {
          $sum: {
            $cond: [{ $eq: ['$reviewGiven', true] }, 1, 0]
          }
        },
        confirmedByBuyerOrders: {
          $sum: {
            $cond: [{ $eq: ['$confirmationGiven', true] }, 1, 0]
          }
        },
        avgDeliveryMs: {
          $avg: {
            $cond: [
              {
                $and: [
                  { $in: ['$status', DELIVERED_LIKE_STATUSES] },
                  { $ne: ['$deliveredAt', null] }
                ]
              },
              { $subtract: ['$deliveredAt', '$createdAt'] },
              null
            ]
          }
        }
      }
    },
    { $sort: { delayedOrders: -1, totalOrders: -1 } },
    { $limit: 500 }
  ]);

  const sellerIds = rows.map((row) => row._id).filter(Boolean);
  const sellers = await User.find({ _id: { $in: sellerIds } })
    .select('_id shopName name phone city shopVerified followersCount')
    .lean();
  const sellerMap = new Map(sellers.map((seller) => [String(seller._id), seller]));

  const items = rows.map((row) => {
    const totalOrders = Number(row.totalOrders || 0);
    const deliveredOrders = Number(row.deliveredOrders || 0);
    const completedOrders = Number(row.completedOrders || 0);
    const delayedOrders = Number(row.delayedOrders || 0);
    const cancelledOrders = Number(row.cancelledOrders || 0);
    const reviewedOrders = Number(row.reviewedOrders || 0);

    const completionRate = totalOrders > 0 ? clampPercent((completedOrders / totalOrders) * 100) : 0;
    const delayPercentage = totalOrders > 0 ? clampPercent((delayedOrders / totalOrders) * 100) : 0;
    const cancellationRate = totalOrders > 0 ? clampPercent((cancelledOrders / totalOrders) * 100) : 0;
    const reviewRate = deliveredOrders > 0 ? clampPercent((reviewedOrders / deliveredOrders) * 100) : 0;

    const avgDeliveryHoursRaw = Number(row.avgDeliveryMs || 0) / (60 * 60 * 1000);
    const avgDeliveryHours = Number.isFinite(avgDeliveryHoursRaw)
      ? Number(avgDeliveryHoursRaw.toFixed(2))
      : null;

    const seller = sellerMap.get(String(row._id)) || null;

    return {
      sellerId: String(row._id),
      seller,
      metrics: {
        totalOrders,
        deliveredOrders,
        completedOrders,
        delayedOrders,
        cancelledOrders,
        reviewRate,
        completionRate,
        delayPercentage,
        cancellationRate,
        avgDeliveryHours,
        responseTimeHours: null
      }
    };
  });

  return {
    total: items.length,
    items
  };
};

const computeUserRiskScore = ({
  totalOrders,
  noConfirmationCount,
  cancelledCount,
  disputeCount,
  noReviewCount
}) => {
  let score = 0;
  score += Math.min(30, noConfirmationCount * 8);
  score += Math.min(25, cancelledCount * 6);
  score += Math.min(30, disputeCount * 10);
  score += Math.min(15, noReviewCount * 3);
  if (totalOrders <= 1) score = Math.max(0, score - 10);
  return Math.max(0, Math.min(100, Math.round(score)));
};

export const getUserRiskSnapshot = async (query = {}) => {
  const filter = await buildAdminOrderFilter(query);

  const rows = await Order.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$customer',
        totalOrders: { $sum: 1 },
        cancelledCount: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        disputeCount: {
          $sum: { $cond: [{ $eq: ['$status', 'dispute_opened'] }, 1, 0] }
        },
        noConfirmationCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ['$status', ['delivery_proof_submitted', 'delivered', 'picked_up_confirmed']] },
                  { $ne: ['$confirmationGiven', true] }
                ]
              },
              1,
              0
            ]
          }
        },
        noReviewCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ['$status', DELIVERED_LIKE_STATUSES] },
                  { $ne: ['$reviewGiven', true] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    },
    { $match: { _id: { $ne: null } } },
    { $sort: { totalOrders: -1 } },
    { $limit: 800 }
  ]);

  const userIds = rows.map((row) => row._id).filter(Boolean);
  const users = await User.find({ _id: { $in: userIds } })
    .select('_id name phone city accountType reputationScore')
    .lean();
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  const items = rows
    .map((row) => {
      const totalOrders = Number(row.totalOrders || 0);
      const cancelledCount = Number(row.cancelledCount || 0);
      const disputeCount = Number(row.disputeCount || 0);
      const noConfirmationCount = Number(row.noConfirmationCount || 0);
      const noReviewCount = Number(row.noReviewCount || 0);
      const riskScore = computeUserRiskScore({
        totalOrders,
        noConfirmationCount,
        cancelledCount,
        disputeCount,
        noReviewCount
      });

      return {
        userId: String(row._id),
        user: userMap.get(String(row._id)) || null,
        riskScore,
        stats: {
          totalOrders,
          cancelledCount,
          disputeCount,
          noConfirmationCount,
          noReviewCount
        }
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);

  return {
    total: items.length,
    highRisk: items.filter((entry) => entry.riskScore >= 70).length,
    mediumRisk: items.filter((entry) => entry.riskScore >= 40 && entry.riskScore < 70).length,
    lowRisk: items.filter((entry) => entry.riskScore < 40).length,
    items: items.slice(0, 300)
  };
};

export const getOrderTimelineData = async (orderId) => {
  const objectId = toObjectId(orderId);
  if (!objectId) return null;

  const order = await Order.findById(objectId)
    .select(
      '_id status customer createdAt confirmedAt readyForPickupAt outForDeliveryAt shippedAt deliveredAt completedAt cancelledAt clientDeliveryConfirmedAt lastReminderDate reminderSentCount expectedDeliveryDate delayStatus delaySeverity delayDays statusStuckSince timeline adminNotes reviewGiven reviewRequested confirmationGiven'
    )
    .lean();

  if (!order) return null;

  const baseEvents = [];
  const pushBase = (type, label, at) => {
    const date = toDate(at);
    if (!date) return;
    baseEvents.push({ type, label, at: date, metadata: { source: 'system_timestamp' } });
  };

  pushBase('order_created', 'Order created', order.createdAt);
  pushBase('order_confirmed', 'Order confirmed', order.confirmedAt);
  pushBase('ready_for_pickup', 'Ready for pickup', order.readyForPickupAt);
  pushBase('out_for_delivery', 'Out for delivery', order.outForDeliveryAt || order.shippedAt);
  pushBase('delivered', 'Delivered', order.deliveredAt);
  pushBase('confirmed_by_client', 'Confirmed by client', order.clientDeliveryConfirmedAt);
  pushBase('completed', 'Completed', order.completedAt);
  pushBase('cancelled', 'Cancelled', order.cancelledAt);

  if (order.lastReminderDate) {
    pushBase('reminder_sent', 'Reminder sent', order.lastReminderDate);
  }

  const customEvents = Array.isArray(order.timeline) ? order.timeline : [];

  const merged = [...baseEvents, ...customEvents]
    .map((entry, index) => ({
      id: `${String(entry.type || 'event')}-${index}`,
      type: String(entry.type || 'event'),
      label: String(entry.label || 'Event'),
      at: toDate(entry.at) || new Date(order.createdAt),
      actor: entry.actor || null,
      metadata: entry.metadata || {}
    }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  return {
    orderId: String(order._id),
    status: order.status,
    expectedDeliveryDate: order.expectedDeliveryDate || null,
    delayStatus: order.delayStatus || 'on_time',
    delaySeverity: order.delaySeverity || 'none',
    delayDays: Number(order.delayDays || 0),
    reminderSentCount: Number(order.reminderSentCount || 0),
    reviewRequested: Boolean(order.reviewRequested),
    reviewGiven: Boolean(order.reviewGiven),
    confirmationGiven: Boolean(order.confirmationGiven),
    events: merged,
    adminNotes: Array.isArray(order.adminNotes) ? order.adminNotes : []
  };
};

export const runDelayedOrderDetection = async ({ limit = 250, actorId = null } = {}) => {
  const thresholds = await getOrderAutomationThresholds();
  const now = new Date();
  const candidates = await Order.find({
    isDraft: false,
    status: { $nin: TERMINAL_STATUSES }
  })
    .sort({ updatedAt: -1 })
    .limit(Math.max(1, Number(limit) || 250))
    .select(
      '_id status customer items expectedDeliveryDate deliveryDate delayStatus delayDays delaySeverity delayDetectedAt reminderSentCount lastReminderDate reminderState timeline totalAmount statusStuckSince adminRiskScore adminPriority reviewGiven reviewRequested confirmationGiven createdAt'
    );

  let scanned = 0;
  let delayedMarked = 0;
  let remindersSent = 0;

  for (const order of candidates) {
    scanned += 1;
    ensureOrderTimelineSeed(order);
    refreshOrderConfirmationFlags(order);
    await refreshOrderReviewFlags(order);

    const expectedDate = getExpectedDeliveryDate(order);
    if (!expectedDate) {
      if (order.delayStatus === 'delayed') {
        order.delayStatus = 'on_time';
        order.delaySeverity = 'none';
        order.delayDays = 0;
      }
      order.adminRiskScore = maybeComputeRiskScore(order, thresholds);
      await order.save();
      continue;
    }

    const daysLate = computeDaysLate(expectedDate, now);
    const severity = computeDelaySeverity(daysLate);

    if (daysLate <= 0) {
      const wasDelayed = order.delayStatus === 'delayed';
      if (wasDelayed) {
        order.delayStatus = 'resolved';
        order.delaySeverity = 'none';
        order.delayDays = 0;
        appendTimelineEvent(order, {
          type: 'delay_resolved',
          label: 'Delay resolved',
          actor: actorId,
          metadata: { expectedDeliveryDate: expectedDate }
        });
      }
      order.adminPriority = 'LOW';
      order.adminRiskScore = maybeComputeRiskScore(order, thresholds);
      await order.save();
      continue;
    }

    const shouldUpdateDelayState =
      order.delayStatus !== 'delayed' ||
      Number(order.delayDays || 0) !== daysLate ||
      String(order.delaySeverity || 'none') !== severity;

    if (shouldUpdateDelayState) {
      order.delayStatus = 'delayed';
      order.delayDays = daysLate;
      order.delaySeverity = severity;
      order.delayDetectedAt = order.delayDetectedAt || now;
      order.adminPriority = mapSeverityToPriority(severity);
      order.adminRiskScore = maybeComputeRiskScore(order, thresholds);
      delayedMarked += 1;

      appendTimelineEvent(order, {
        type: 'delay_detected',
        label: 'Order marked as delayed',
        actor: actorId,
        metadata: {
          delayDays: daysLate,
          delaySeverity: severity,
          expectedDeliveryDate: expectedDate
        }
      });

      if (canSendReminder(order, 'delay_detected', now, thresholds)) {
        const recipients = await resolveReminderRecipients(order, 'delay_detected');
        const sent = await sendOrderReminderNotification({
          order,
          reminderType: 'delay_detected',
          actorId,
          recipients,
          priority: mapSeverityToPriority(severity),
          title: 'Delayed order',
          message: `Order delay detected (${daysLate} day(s)).`
        });
        if (sent > 0) {
          markReminderMetadata(order, 'delay_detected', now);
          remindersSent += sent;
        }
      }
    }

    await order.save();
  }

  await invalidateAdminCache(['orders', 'dashboard', 'analytics', 'admin']);
  return { scanned, delayedMarked, remindersSent };
};

const shouldEscalateOrder = (order, now = new Date(), thresholds = ORDER_AUTOMATION_DEFAULTS) => {
  const escalationDelayHours = Number(thresholds.escalationDelayHours || ORDER_AUTOMATION_DEFAULTS.escalationDelayHours);
  const statusStuckSince = toDate(order?.statusStuckSince || order?.updatedAt || null);
  if (!statusStuckSince) return false;
  const elapsedMs = now.getTime() - statusStuckSince.getTime();
  return elapsedMs >= escalationDelayHours * 60 * 60 * 1000;
};

const shouldRunReminderTypeForOrder = async ({ order, reminderType, now, thresholds = ORDER_AUTOMATION_DEFAULTS }) => {
  if (!order || isTerminalStatus(order.status)) return false;

  const createdAt = toDate(order.createdAt);
  const deliveredAt = toDate(order.deliveredAt);
  const completedAt = toDate(order.completedAt);

  switch (reminderType) {
    case 'seller': {
      if (!ACTIVE_FLOW_STATUSES.includes(String(order.status || ''))) return false;
      if (!createdAt) return false;
      const threshold = new Date(now.getTime() - Number(thresholds.sellerReminderDelayHours || 0) * 60 * 60 * 1000);
      const expectedDate = getExpectedDeliveryDate(order);
      return Boolean(
        (expectedDate && expectedDate <= now) ||
          createdAt <= threshold ||
          order.delayStatus === 'delayed'
      );
    }
    case 'buyer_confirmation': {
      if (!['delivery_proof_submitted', 'delivered', 'picked_up_confirmed'].includes(String(order.status || ''))) return false;
      if (order.confirmationGiven === true || order.clientDeliveryConfirmedAt) return false;
      if (!deliveredAt) return false;
      const threshold = new Date(now.getTime() - Number(thresholds.buyerConfirmationDelayHours || 0) * 60 * 60 * 1000);
      return deliveredAt <= threshold;
    }
    case 'review': {
      if (!DELIVERED_LIKE_STATUSES.includes(String(order.status || ''))) return false;
      if (!order.reviewRequested) order.reviewRequested = true;
      await refreshOrderReviewFlags(order);
      if (order.reviewGiven === true) return false;
      const baseline = deliveredAt || completedAt || createdAt;
      if (!baseline) return false;
      const threshold = new Date(now.getTime() - Number(thresholds.reviewReminderDelayDays || 0) * 24 * 60 * 60 * 1000);
      return baseline <= threshold;
    }
    case 'experience': {
      if (!DELIVERED_LIKE_STATUSES.includes(String(order.status || ''))) return false;
      const threshold = new Date(
        now.getTime() - Number(thresholds.experienceReminderDelayDays || 0) * 24 * 60 * 60 * 1000
      );
      const baseline = completedAt || deliveredAt || createdAt;
      if (!baseline || baseline > threshold) return false;

      const sellerId = collectSellerIdsFromOrder(order)[0];
      if (!sellerId || !order.customer) return false;
      const hasShopReview = await ShopReview.exists({
        shop: sellerId,
        user: order.customer
      });
      return !hasShopReview;
    }
    case 'escalation':
      return shouldEscalateOrder(order, now, thresholds);
    default:
      return false;
  }
};

export const runAutomatedReminderSweep = async ({ reminderType = 'seller', limit = 120, actorId = null } = {}) => {
  const thresholds = await getOrderAutomationThresholds();
  const now = new Date();
  const candidates = await Order.find({
    isDraft: false,
    status: { $nin: ['cancelled'] }
  })
    .sort({ updatedAt: 1 })
    .limit(Math.max(1, Number(limit) || 120))
    .select(
      '_id status customer items totalAmount expectedDeliveryDate deliveryDate createdAt updatedAt deliveredAt completedAt clientDeliveryConfirmedAt reminderSentCount lastReminderDate reminderState reviewRequested reviewGiven confirmationGiven delayStatus delaySeverity delayDays statusStuckSince timeline adminRiskScore adminPriority'
    );

  let scanned = 0;
  let sent = 0;
  let updated = 0;

  for (const order of candidates) {
    scanned += 1;
    ensureOrderTimelineSeed(order);
    const confirmedUpdated = refreshOrderConfirmationFlags(order);
    const reviewedUpdated = await refreshOrderReviewFlags(order);

    const shouldRun = await shouldRunReminderTypeForOrder({ order, reminderType, now, thresholds });
    if (!shouldRun || !canSendReminder(order, reminderType, now, thresholds)) {
      if (confirmedUpdated || reviewedUpdated) {
        order.adminRiskScore = maybeComputeRiskScore(order, thresholds);
        await order.save();
        updated += 1;
      }
      continue;
    }

    const recipients = await resolveReminderRecipients(order, reminderType);
    if (!recipients.length) {
      continue;
    }

    const titleMap = {
      seller: 'Seller reminder',
      buyer_confirmation: 'Buyer confirmation reminder',
      review: 'Review reminder',
      experience: 'Experience feedback reminder',
      escalation: 'Order escalation alert',
      manual: 'Manual reminder'
    };

    const messageMap = {
      seller: 'Please update this order status.',
      buyer_confirmation: 'Please confirm if delivery is completed.',
      review: 'Please rate your order experience.',
      experience: 'Share your experience with this seller.',
      escalation: 'Order appears stuck and requires admin attention.',
      manual: 'Manual reminder triggered by admin.'
    };

    const priorityMap = {
      seller: 'HIGH',
      buyer_confirmation: 'MEDIUM',
      review: 'LOW',
      experience: 'LOW',
      escalation: 'CRITICAL',
      manual: 'NORMAL'
    };

    const reminderSent = await sendOrderReminderNotification({
      order,
      reminderType,
      actorId,
      recipients,
      priority: priorityMap[reminderType] || 'NORMAL',
      title: titleMap[reminderType] || 'Order reminder',
      message: messageMap[reminderType] || 'Please check this order.'
    });

    if (reminderSent > 0) {
      markReminderMetadata(order, reminderType, now);
      appendTimelineEvent(order, {
        type: `reminder_${reminderType}`,
        label: `Reminder sent (${reminderType})`,
        actor: actorId,
        metadata: {
          recipientCount: reminderSent,
          source: 'automation'
        }
      });
      order.adminRiskScore = maybeComputeRiskScore(order, thresholds);
      await order.save();
      sent += reminderSent;
      updated += 1;
    }
  }

  await invalidateAdminCache(['orders', 'dashboard', 'analytics', 'admin']);

  return {
    reminderType,
    scanned,
    sent,
    updated
  };
};

export const applyAdminOrderAction = async ({
  orderId,
  action,
  actorId,
  note = '',
  reminderType = 'manual',
  delaySeverity = 'none'
}) => {
  const thresholds = await getOrderAutomationThresholds();
  const objectId = toObjectId(orderId);
  if (!objectId) {
    return { ok: false, status: 400, message: 'Unknown order id.' };
  }

  const order = await Order.findById(objectId);
  if (!order) {
    return { ok: false, status: 404, message: 'Order not found.' };
  }

  ensureOrderTimelineSeed(order);

  const normalizedAction = String(action || '').trim().toLowerCase();
  const now = new Date();
  let reminderSent = 0;

  if (!order.adminNotes || !Array.isArray(order.adminNotes)) {
    order.adminNotes = [];
  }

  switch (normalizedAction) {
    case 'force_mark_delivered':
    case 'force_delivered': {
      order.status = 'delivered';
      if (!order.deliveredAt) order.deliveredAt = now;
      order.delayStatus = 'resolved';
      order.delaySeverity = 'none';
      order.delayDays = 0;
      appendTimelineEvent(order, {
        type: 'admin_force_delivered',
        label: 'Admin force-marked order as delivered',
        actor: actorId,
        metadata: { note: String(note || '') }
      });
      break;
    }
    case 'force_close_order':
    case 'force_close': {
      order.status = 'completed';
      if (!order.completedAt) order.completedAt = now;
      order.confirmationGiven = true;
      order.delayStatus = 'resolved';
      order.delaySeverity = 'none';
      order.delayDays = 0;
      appendTimelineEvent(order, {
        type: 'admin_force_closed',
        label: 'Admin force-closed order',
        actor: actorId,
        metadata: { note: String(note || '') }
      });
      break;
    }
    case 'trigger_manual_reminder':
    case 'manual_reminder': {
      if (!canSendReminder(order, 'manual', now, thresholds)) {
        return {
          ok: false,
          status: 429,
          message: 'Reminder limit reached or reminder interval not elapsed.'
        };
      }
      const recipients = await resolveReminderRecipients(order, reminderType || 'manual');
      reminderSent = await sendOrderReminderNotification({
        order,
        reminderType: reminderType || 'manual',
        actorId,
        recipients,
        priority: 'NORMAL',
        title: 'Manual reminder',
        message: note || 'An admin sent a reminder for this order.'
      });
      if (reminderSent > 0) {
        markReminderMetadata(order, 'manual', now);
      }
      appendTimelineEvent(order, {
        type: 'admin_manual_reminder',
        label: 'Admin manual reminder sent',
        actor: actorId,
        metadata: { reminderType: reminderType || 'manual', recipientCount: reminderSent, note: String(note || '') }
      });
      break;
    }
    case 'override_delay_status':
    case 'override_delay': {
      const normalizedSeverity = ['none', 'slight', 'moderate', 'critical'].includes(String(delaySeverity))
        ? String(delaySeverity)
        : 'none';
      order.delayStatus = normalizedSeverity === 'none' ? 'overridden' : 'delayed';
      order.delaySeverity = normalizedSeverity;
      order.delayDays = normalizedSeverity === 'none' ? 0 : Number(order.delayDays || 0);
      order.adminPriority = mapSeverityToPriority(normalizedSeverity);
      order.delayOverride = {
        by: actorId || null,
        at: now,
        note: String(note || '').trim()
      };
      appendTimelineEvent(order, {
        type: 'admin_delay_override',
        label: 'Admin delay override applied',
        actor: actorId,
        metadata: {
          delaySeverity: normalizedSeverity,
          note: String(note || '')
        }
      });
      break;
    }
    case 'add_admin_note':
    case 'add_note': {
      if (!String(note || '').trim()) {
        return { ok: false, status: 400, message: 'Admin note cannot be empty.' };
      }
      order.adminNotes.push({
        note: String(note).trim(),
        actor: actorId || null,
        createdAt: now
      });
      if (order.adminNotes.length > 120) {
        order.adminNotes = order.adminNotes.slice(order.adminNotes.length - 120);
      }
      appendTimelineEvent(order, {
        type: 'admin_note',
        label: 'Admin note added',
        actor: actorId,
        metadata: { note: String(note).trim() }
      });
      break;
    }
    default:
      return { ok: false, status: 400, message: 'Unknown admin action.' };
  }

  if (order.isModified('status')) {
    order.statusStuckSince = now;
  }

  order.adminRiskScore = maybeComputeRiskScore(order, thresholds);
  await order.save();
  await invalidateOrderScopeCaches(order);

  return {
    ok: true,
    status: 200,
    message: 'Admin action applied successfully.',
    data: {
      orderId: String(order._id),
      action: normalizedAction,
      reminderSent,
      status: order.status,
      delayStatus: order.delayStatus,
      delaySeverity: order.delaySeverity,
      delayDays: Number(order.delayDays || 0),
      reminderSentCount: Number(order.reminderSentCount || 0),
      lastReminderDate: order.lastReminderDate || null,
      adminRiskScore: Number(order.adminRiskScore || 0)
    }
  };
};
