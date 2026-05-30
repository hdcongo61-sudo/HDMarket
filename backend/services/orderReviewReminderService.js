import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import Rating from '../models/ratingModel.js';
import Comment from '../models/commentModel.js';
import Notification from '../models/notificationModel.js';
import User from '../models/userModel.js';
import { createNotification } from '../utils/notificationService.js';
import {
  enqueueOrderAutomationJob,
  getOrderAutomationJob,
  removeOrderAutomationJob
} from '../queues/orderAutomationQueue.js';
import { getManyRuntimeConfigs } from './configService.js';
import {
  invalidateAdminCache,
  invalidateSellerCache,
  invalidateUserCache
} from '../utils/cache.js';

export const ORDER_REVIEW_STATUS = Object.freeze({
  PENDING: 'PENDING',
  DONE: 'DONE',
  SKIPPED: 'SKIPPED'
});

const REVIEW_ELIGIBLE_STATUSES = new Set([
  'delivery_proof_submitted',
  'delivered',
  'picked_up_confirmed',
  'confirmed_by_client',
  'completed'
]);

const DEFAULT_REVIEW_REMINDER_SETTINGS = Object.freeze({
  enabled: true,
  delayHours: Math.max(1, Number(process.env.ORDER_REVIEW_REMINDER_AFTER_HOURS || 24)),
  maxCount: Math.max(1, Number(process.env.ORDER_REVIEW_REMINDER_MAX_COUNT || 1))
});

const toObjectIds = (values = []) =>
  (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => new mongoose.Types.ObjectId(value));

const uniqueIds = (values = []) =>
  Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value || '')).filter(Boolean)));

const getOrderSellerIds = (order = {}) =>
  uniqueIds(
    (Array.isArray(order.items) ? order.items : []).map(
      (item) => item?.snapshot?.shopId || item?.product?.user || item?.product?.user?._id || ''
    )
  );

const getOrderProductIds = (order = {}) =>
  uniqueIds((Array.isArray(order.items) ? order.items : []).map((item) => item?.product?._id || item?.product || ''));

const getReminderBaseline = (order = {}) => order?.deliveredAt || order?.completedAt || null;

export const buildReviewReminderJobId = (orderId) =>
  `review-reminder:order:${String(orderId || '').trim()}`;

export const getReviewReminderSettings = async () => {
  const raw = await getManyRuntimeConfigs([
    'review_reminder_enabled',
    'review_reminder_delay_hours',
    'review_reminder_after_hours',
    'review_reminder_max_count'
  ]);

  const enabledRaw =
    raw.review_reminder_enabled ?? DEFAULT_REVIEW_REMINDER_SETTINGS.enabled;
  const delayRaw =
    raw.review_reminder_delay_hours ??
    raw.review_reminder_after_hours ??
    DEFAULT_REVIEW_REMINDER_SETTINGS.delayHours;
  const maxRaw = raw.review_reminder_max_count ?? DEFAULT_REVIEW_REMINDER_SETTINGS.maxCount;

  return {
    enabled: Boolean(enabledRaw),
    delayHours: Math.max(1, Number(delayRaw) || DEFAULT_REVIEW_REMINDER_SETTINGS.delayHours),
    maxCount: Math.max(1, Math.min(2, Number(maxRaw) || DEFAULT_REVIEW_REMINDER_SETTINGS.maxCount))
  };
};

export const isOrderEligibleForReviewReminder = (order = {}) => {
  if (!order || order.isDraft) return false;
  return REVIEW_ELIGIBLE_STATUSES.has(String(order.status || ''));
};

const loadReviewEvidenceFlags = async (order) => {
  const customerId = String(order?.customer || '').trim();
  const productIds = toObjectIds(getOrderProductIds(order));
  if (!customerId || !productIds.length) {
    return { reviewed: false, ratingExists: false, commentExists: false };
  }

  const [ratingExists, commentExists] = await Promise.all([
    Rating.exists({ user: customerId, product: { $in: productIds } }),
    Comment.exists({ user: customerId, product: { $in: productIds } })
  ]);

  return {
    reviewed: Boolean(ratingExists || commentExists),
    ratingExists: Boolean(ratingExists),
    commentExists: Boolean(commentExists)
  };
};

const updateReminderNotificationsForOrder = async ({
  orderId,
  userId,
  actionStatus = 'DONE',
  outcome = ''
}) => {
  const query = {
    user: userId,
    type: 'review_reminder',
    entityType: 'order',
    entityId: String(orderId || '').trim()
  };

  await Notification.updateMany(query, {
    $set: {
      actionStatus,
      'metadata.reviewReminderOutcome': outcome,
      'metadata.reviewResolvedAt': new Date().toISOString()
    }
  }).catch(() => {});
};

const invalidateOrderReviewScopes = async (order) => {
  const customerId = String(order?.customer || '').trim();
  const sellerIds = getOrderSellerIds(order);

  if (customerId) {
    await invalidateUserCache(customerId, ['orders', 'notifications']);
  }
  if (sellerIds.length) {
    await Promise.all(
      sellerIds.map((sellerId) =>
        invalidateSellerCache(sellerId, ['orders', 'dashboard', 'analytics'])
      )
    );
  }
  await invalidateAdminCache(['orders', 'dashboard', 'analytics']);
};

export const syncOrderReviewReminderState = async (order, options = {}) => {
  if (!order) return { changed: false, reviewed: false };
  const now = options.now instanceof Date ? options.now : new Date();
  let changed = false;

  if (!order.reviewStatus) {
    order.reviewStatus = ORDER_REVIEW_STATUS.PENDING;
    changed = true;
  }

  const evidence = await loadReviewEvidenceFlags(order);
  if (evidence.reviewed) {
    if (order.reviewGiven !== true) {
      order.reviewGiven = true;
      changed = true;
    }
    if (order.reviewStatus !== ORDER_REVIEW_STATUS.DONE) {
      order.reviewStatus = ORDER_REVIEW_STATUS.DONE;
      changed = true;
    }
    if (!order.reviewCompletedAt) {
      order.reviewCompletedAt = now;
      changed = true;
    }
  }

  return { changed, reviewed: evidence.reviewed };
};

const shouldSendReminderForOrder = ({ order, settings }) => {
  if (!isOrderEligibleForReviewReminder(order)) return false;
  if (!settings.enabled) return false;
  if (order.reviewReminderDisabled === true) return false;
  if (order.reviewStatus === ORDER_REVIEW_STATUS.DONE) return false;
  if (order.reviewStatus === ORDER_REVIEW_STATUS.SKIPPED) return false;
  if (Number(order.reviewReminderCount || 0) >= Number(settings.maxCount || 1)) return false;

  const baseline = getReminderBaseline(order);
  if (!baseline) return false;
  const dueAt = new Date(
    new Date(baseline).getTime() + Number(settings.delayHours || 0) * 60 * 60 * 1000
  );
  return dueAt.getTime() <= Date.now();
};

const buildReviewReminderDeepLink = (order) => {
  const orderId = String(order?._id || '').trim();
  const firstProductId = String(getOrderProductIds(order)[0] || '').trim();
  if (!orderId) return '/orders';
  const query = new URLSearchParams();
  if (firstProductId) query.set('productId', firstProductId);
  return `/orders/${encodeURIComponent(orderId)}/review${query.toString() ? `?${query.toString()}` : ''}`;
};

const sendReviewReminderNotification = async (order, settings) => {
  const customerId = String(order?.customer || '').trim();
  if (!customerId) return { sent: false, reason: 'missing_customer' };

  const user = await User.findById(customerId)
    .select('notificationPreferences')
    .lean();
  const preferenceEnabled = user?.notificationPreferences?.review_reminder !== false;
  if (!preferenceEnabled) {
    return { sent: false, reason: 'preference_disabled' };
  }

  const productId = String(getOrderProductIds(order)[0] || '').trim();
  const shopId = String(getOrderSellerIds(order)[0] || '').trim();
  const deepLink = buildReviewReminderDeepLink(order);

  const notification = await createNotification({
    userId: customerId,
    actorId: customerId,
    productId: productId || undefined,
    shopId: shopId || undefined,
    type: 'review_reminder',
    allowSelf: true,
    priority: 'NORMAL',
    actionRequired: true,
    actionType: 'REVIEW',
    actionStatus: 'PENDING',
    deepLink,
    actionLink: deepLink,
    entityType: 'order',
    entityId: String(order._id),
    metadata: {
      orderId: String(order._id),
      productId: productId || '',
      shopId: shopId || '',
      productIds: getOrderProductIds(order),
      shopIds: getOrderSellerIds(order),
      reviewReminderDelayHours: Number(settings.delayHours || 0),
      deepLink
    }
  });

  if (!notification) {
    return { sent: false, reason: 'notification_not_created' };
  }

  order.reviewRequested = true;
  order.reviewReminderSentAt = new Date();
  order.reviewReminderCount = Number(order.reviewReminderCount || 0) + 1;

  return { sent: true, reason: 'sent' };
};

const queueNextReminderAttempt = async (order, settings) => {
  if (Number(order.reviewReminderCount || 0) >= Number(settings.maxCount || 1)) return null;
  return enqueueOrderAutomationJob(
    'review-reminder-order',
    {
      orderId: String(order._id),
      source: 'followup'
    },
    {
      delay: Number(settings.delayHours || 0) * 60 * 60 * 1000,
      jobId: buildReviewReminderJobId(order._id)
    }
  );
};

export const scheduleOrderReviewReminder = async (orderOrId) => {
  const orderId = String(orderOrId?._id || orderOrId || '').trim();
  if (!mongoose.Types.ObjectId.isValid(orderId)) return null;

  const order =
    orderOrId && typeof orderOrId === 'object' && orderOrId._id
      ? orderOrId
      : await Order.findById(orderId).select(
          '_id status customer items isDraft deliveredAt completedAt reviewStatus reviewReminderDisabled reviewReminderCount reviewGiven reviewCompletedAt'
        );
  if (!order) return null;

  const settings = await getReviewReminderSettings();
  if (!settings.enabled || !isOrderEligibleForReviewReminder(order)) {
    await cancelOrderReviewReminder(orderId);
    return null;
  }

  const syncResult = await syncOrderReviewReminderState(order);
  if (syncResult.changed) {
    await order.save();
    await invalidateOrderReviewScopes(order);
  }
  if (
    order.reviewStatus === ORDER_REVIEW_STATUS.DONE ||
    order.reviewStatus === ORDER_REVIEW_STATUS.SKIPPED ||
    order.reviewReminderDisabled === true ||
    Number(order.reviewReminderCount || 0) >= Number(settings.maxCount || 1)
  ) {
    await cancelOrderReviewReminder(orderId);
    return null;
  }

  const baseline = getReminderBaseline(order);
  if (!baseline) return null;
  const dueAt = new Date(
    new Date(baseline).getTime() + Number(settings.delayHours || 0) * 60 * 60 * 1000
  );
  const delay = Math.max(0, dueAt.getTime() - Date.now());

  return enqueueOrderAutomationJob(
    'review-reminder-order',
    { orderId, source: 'schedule' },
    { delay, jobId: buildReviewReminderJobId(orderId), priority: 2 }
  );
};

export const cancelOrderReviewReminder = async (orderId) => {
  const normalizedId = String(orderId || '').trim();
  if (!normalizedId) return false;

  const jobId = buildReviewReminderJobId(normalizedId);
  const existingJob = await getOrderAutomationJob(jobId);
  if (!existingJob) return false;
  await removeOrderAutomationJob(jobId);
  return true;
};

export const processOrderReviewReminderJob = async ({ orderId, source = 'job' } = {}) => {
  const normalizedId = String(orderId || '').trim();
  if (!mongoose.Types.ObjectId.isValid(normalizedId)) {
    return { sent: false, skipped: true, reason: 'invalid_order_id' };
  }

  const order = await Order.findById(normalizedId).select(
    '_id status customer items isDraft deliveredAt completedAt reviewRequested reviewGiven reviewStatus reviewReminderDisabled reviewReminderSentAt reviewCompletedAt reviewReminderCount'
  );
  if (!order) {
    return { sent: false, skipped: true, reason: 'order_not_found' };
  }

  const settings = await getReviewReminderSettings();
  const syncResult = await syncOrderReviewReminderState(order);
  if (syncResult.changed) {
    await order.save();
    await invalidateOrderReviewScopes(order);
  }

  if (!shouldSendReminderForOrder({ order, settings })) {
    await cancelOrderReviewReminder(order._id);
    return { sent: false, skipped: true, reason: 'not_due_or_ineligible' };
  }

  const result = await sendReviewReminderNotification(order, settings);
  if (!result.sent) {
    if (result.reason === 'preference_disabled') {
      await cancelOrderReviewReminder(order._id);
    }
    return { sent: false, skipped: true, reason: result.reason };
  }

  await order.save();
  await invalidateOrderReviewScopes(order);
  await queueNextReminderAttempt(order, settings);

  return {
    sent: true,
    skipped: false,
    source,
    orderId: String(order._id),
    reviewReminderCount: Number(order.reviewReminderCount || 0)
  };
};

export const runReviewReminderSweep = async ({ limit = 200, source = 'sweep' } = {}) => {
  const orders = await Order.find({
    isDraft: false,
    status: { $in: Array.from(REVIEW_ELIGIBLE_STATUSES) },
    reviewReminderDisabled: { $ne: true },
    reviewStatus: { $ne: ORDER_REVIEW_STATUS.DONE }
  })
    .sort({ updatedAt: 1 })
    .limit(Math.max(1, Number(limit) || 200))
    .select('_id');

  let processed = 0;
  let sent = 0;

  for (const order of orders) {
    processed += 1;
    const result = await processOrderReviewReminderJob({
      orderId: order._id,
      source
    });
    if (result?.sent) sent += 1;
  }

  return { processed, sent };
};

export const markOrderReviewReminderAction = async ({
  orderId,
  userId,
  action = 'done'
}) => {
  const order = await Order.findOne({
    _id: orderId,
    customer: userId,
    isDraft: false
  }).select(
    '_id status customer items reviewRequested reviewGiven reviewStatus reviewReminderDisabled reviewReminderSentAt reviewCompletedAt reviewReminderCount'
  );

  if (!order) {
    const error = new Error('Commande introuvable.');
    error.status = 404;
    throw error;
  }

  const normalizedAction = String(action || '').trim().toLowerCase();
  const now = new Date();

  if (normalizedAction === 'done') {
    order.reviewGiven = true;
    order.reviewStatus = ORDER_REVIEW_STATUS.DONE;
    order.reviewCompletedAt = now;
  } else if (normalizedAction === 'skip') {
    order.reviewStatus = ORDER_REVIEW_STATUS.SKIPPED;
  } else if (normalizedAction === 'disable') {
    order.reviewReminderDisabled = true;
  } else {
    const error = new Error('Action review invalide.');
    error.status = 400;
    throw error;
  }

  await order.save();
  await cancelOrderReviewReminder(order._id);
  await updateReminderNotificationsForOrder({
    orderId: order._id,
    userId,
    actionStatus: 'DONE',
    outcome: normalizedAction
  });
  await invalidateOrderReviewScopes(order);

  return order;
};

export const markOrdersReviewedByProduct = async ({
  userId,
  productId,
  reviewedAt = new Date()
}) => {
  const normalizedUserId = String(userId || '').trim();
  const normalizedProductId = String(productId || '').trim();
  if (
    !mongoose.Types.ObjectId.isValid(normalizedUserId) ||
    !mongoose.Types.ObjectId.isValid(normalizedProductId)
  ) {
    return { updated: 0 };
  }

  const orders = await Order.find({
    customer: normalizedUserId,
    isDraft: false,
    'items.product': normalizedProductId,
    status: { $in: Array.from(REVIEW_ELIGIBLE_STATUSES) },
    reviewStatus: { $ne: ORDER_REVIEW_STATUS.DONE }
  }).select(
    '_id customer items status reviewGiven reviewStatus reviewReminderDisabled reviewCompletedAt'
  );

  let updated = 0;
  for (const order of orders) {
    order.reviewGiven = true;
    order.reviewStatus = ORDER_REVIEW_STATUS.DONE;
    if (!order.reviewCompletedAt) {
      order.reviewCompletedAt = reviewedAt;
    }
    await order.save();
    await cancelOrderReviewReminder(order._id);
    await updateReminderNotificationsForOrder({
      orderId: order._id,
      userId: normalizedUserId,
      actionStatus: 'DONE',
      outcome: 'done'
    });
    await invalidateOrderReviewScopes(order);
    updated += 1;
  }

  return { updated };
};

export const getBuyerOrderReviewPageData = async ({ orderId, userId }) => {
  const order = await Order.findOne({
    _id: orderId,
    customer: userId,
    isDraft: false
  })
    .populate({
      path: 'items.product',
      select: 'title slug images user',
      populate: {
        path: 'user',
        select: 'name shopName slug shopLogo'
      }
    })
    .select(
      '_id status customer items deliveredAt completedAt reviewRequested reviewGiven reviewStatus reviewReminderDisabled reviewReminderSentAt reviewCompletedAt reviewReminderCount createdAt'
    );

  if (!order) {
    const error = new Error('Commande introuvable.');
    error.status = 404;
    throw error;
  }

  await syncOrderReviewReminderState(order);
  await order.save();

  return {
    orderId: String(order._id),
    status: order.status,
    deliveredAt: order.deliveredAt || null,
    completedAt: order.completedAt || null,
    reviewState: {
      status: order.reviewStatus || ORDER_REVIEW_STATUS.PENDING,
      disabled: Boolean(order.reviewReminderDisabled),
      sentAt: order.reviewReminderSentAt || null,
      completedAt: order.reviewCompletedAt || null,
      reminderCount: Number(order.reviewReminderCount || 0)
    },
    items: (Array.isArray(order.items) ? order.items : []).map((item) => ({
      _id: String(item._id || ''),
      quantity: Number(item.quantity || 1),
      productId: String(item.product?._id || item.product || ''),
      title: item.snapshot?.title || item.product?.title || 'Produit',
      image:
        item.snapshot?.image ||
        (Array.isArray(item.product?.images) ? item.product.images[0] : '') ||
        '',
      slug: item.snapshot?.slug || item.product?.slug || '',
      shopId:
        String(item.snapshot?.shopId || item.product?.user?._id || item.product?.user || ''),
      shopName:
        item.snapshot?.shopName ||
        item.product?.user?.shopName ||
        item.product?.user?.name ||
        'Boutique',
      shopLogo: item.product?.user?.shopLogo || '',
      selectedAttributes: Array.isArray(item.selectedAttributes) ? item.selectedAttributes : []
    }))
  };
};
