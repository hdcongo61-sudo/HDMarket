import Notification from '../models/notificationModel.js';
import { enqueueNotificationJob } from '../queues/notificationQueue.js';
import { dispatchNotificationPayload } from './notificationDispatcher.js';
import { initRedis, getRedisClient, isRedisReady } from '../config/redisClient.js';

const GROUP_WINDOW_MINUTES = Math.max(1, Number(process.env.NOTIFICATION_GROUP_WINDOW_MINUTES || 20));

const TYPE_PRIORITY_MAP = Object.freeze({
  account_restriction: 'CRITICAL',
  dispute_deadline_near: 'CRITICAL',
  dispute_under_review: 'HIGH',
  dispute_resolved: 'HIGH',
  dispute_created: 'HIGH',
  payment_pending: 'HIGH',
  order_received: 'HIGH',
  order_reminder: 'HIGH',
  order_cancellation_window_skipped: 'HIGH',
  order_delivered: 'HIGH',
  delivery_request_created: 'HIGH',
  delivery_request_accepted: 'HIGH',
  delivery_request_rejected: 'HIGH',
  delivery_request_assigned: 'HIGH',
  delivery_request_in_progress: 'HIGH',
  delivery_request_delivered: 'HIGH',
  installment_overdue_warning: 'HIGH',
  installment_due_reminder: 'HIGH',
  order_message: 'NORMAL',
  product_comment: 'NORMAL',
  favorite: 'LOW',
  promotional: 'LOW'
});

const GROUPABLE_TYPES = new Set([
  'order_message',
  'order_received',
  'payment_pending',
  'admin_broadcast',
  'order_reminder'
]);

const PRIORITY_RANK = Object.freeze({
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4
});

const SPAM_WINDOW_SECONDS = Math.max(10, Number(process.env.NOTIFICATION_SPAM_WINDOW_SECONDS || 60));
const SPAM_LIMIT_PER_WINDOW = Math.max(20, Number(process.env.NOTIFICATION_SPAM_LIMIT_PER_WINDOW || 120));

const sanitizePriority = (priority) => {
  const normalized = String(priority || '').toUpperCase();
  if (Object.prototype.hasOwnProperty.call(PRIORITY_RANK, normalized)) return normalized;
  return 'NORMAL';
};

const withRedis = async () => {
  if (isRedisReady()) return getRedisClient();
  return initRedis();
};

const isRateLimited = async ({ userId, actorId, type, priority }) => {
  const resolvedPriority = sanitizePriority(priority);
  if (['HIGH', 'CRITICAL'].includes(resolvedPriority)) return false;

  const client = await withRedis();
  if (!client) return false;

  const key = `notifications:rate:${String(userId)}:${String(actorId)}:${String(type)}`;
  const count = await client.incr(key);
  if (Number(count || 0) === 1) {
    await client.expire(key, SPAM_WINDOW_SECONDS);
  }
  return Number(count || 0) > SPAM_LIMIT_PER_WINDOW;
};

const resolvePriority = ({ type, explicitPriority, metadata = {} }) => {
  const explicit = sanitizePriority(explicitPriority);
  if (explicitPriority && explicit) return explicit;
  if (metadata?.critical === true) return 'CRITICAL';
  if (TYPE_PRIORITY_MAP[type]) return TYPE_PRIORITY_MAP[type];
  return 'NORMAL';
};

const mergePriority = (currentPriority, nextPriority) => {
  const current = sanitizePriority(currentPriority);
  const next = sanitizePriority(nextPriority);
  return PRIORITY_RANK[next] > PRIORITY_RANK[current] ? next : current;
};

const buildGroupingKey = ({ userId, type, metadata = {}, productId, shopId }) => {
  if (!GROUPABLE_TYPES.has(type)) return '';
  const orderId = metadata?.orderId ? String(metadata.orderId) : '';
  const threadId = metadata?.threadId ? String(metadata.threadId) : '';
  const scope = orderId || threadId || String(productId || shopId || '');
  if (!scope) return '';
  return `${type}:${String(userId)}:${scope}`;
};

const findGroupedNotification = async ({ userId, type, groupingKey }) => {
  if (!groupingKey) return null;
  const since = new Date(Date.now() - GROUP_WINDOW_MINUTES * 60_000);
  return Notification.findOne({
    user: userId,
    type,
    groupingKey,
    readAt: null,
    createdAt: { $gte: since }
  }).sort({ createdAt: -1 });
};

const buildGroupedMetadata = ({ current = {}, incoming = {}, actorId }) => {
  const baseCount = Number(current?.groupCount || current?.count || 1);
  const nextCount = baseCount + 1;
  const previousActors = Array.isArray(current?.recentActorIds) ? current.recentActorIds : [];
  const actorValue = actorId ? String(actorId) : '';
  const nextActors = Array.from(new Set([...previousActors, actorValue].filter(Boolean))).slice(-5);

  return {
    ...current,
    ...incoming,
    grouped: true,
    groupCount: nextCount,
    lastGroupedAt: new Date(),
    recentActorIds: nextActors
  };
};

const enqueueOrFallback = async ({
  notification,
  userId,
  priority,
  pushEnabled,
  socketEnabled,
  incrementUnread,
  delayMs = 0
}) => {
  const payload = {
    notificationId: String(notification._id),
    userId: String(userId),
    priority,
    pushEnabled: Boolean(pushEnabled),
    socketEnabled: Boolean(socketEnabled),
    incrementUnread: Boolean(incrementUnread),
    delayMs: Math.max(0, Number(delayMs || 0))
  };

  const job = await enqueueNotificationJob(payload);
  if (job) {
    notification.delivery = {
      ...(notification.delivery || {}),
      queueJobId: String(job.id || ''),
      status: 'queued'
    };
    await notification.save();
    return notification;
  }

  await dispatchNotificationPayload(payload);
  return notification;
};

export const createNotification = async ({
  userId,
  actorId,
  productId,
  shopId,
  type,
  metadata = {},
  allowSelf = false,
  priority = null,
  pushEnabled = true,
  socketEnabled = true,
  delayMs = 0
}) => {
  if (!userId || !actorId || !type) return null;
  if (!allowSelf && String(userId) === String(actorId)) return null;

  try {
    const resolvedPriority = resolvePriority({ type, explicitPriority: priority, metadata });
    let effectivePushEnabled = Boolean(pushEnabled);
    let effectiveSocketEnabled = Boolean(socketEnabled);
    let effectiveMetadata = metadata || {};

    if (await isRateLimited({ userId, actorId, type, priority: resolvedPriority })) {
      effectivePushEnabled = false;
      effectiveSocketEnabled = false;
      effectiveMetadata = {
        ...(effectiveMetadata || {}),
        throttled: true
      };
    }
    const groupingKey = buildGroupingKey({ userId, type, metadata, productId, shopId });

    let notification = await findGroupedNotification({ userId, type, groupingKey });
    if (notification) {
      notification.metadata = buildGroupedMetadata({
        current: notification.metadata || {},
        incoming: effectiveMetadata || {},
        actorId
      });
      notification.groupCount = Number(notification.metadata?.groupCount || notification.groupCount || 1);
      notification.priority = mergePriority(notification.priority, resolvedPriority);
      notification.readAt = null;
      notification.delivery = {
        ...(notification.delivery || {}),
        status: 'pending'
      };
      await notification.save();
    } else {
      const doc = {
        user: userId,
        actor: actorId,
        type,
        metadata: { ...(effectiveMetadata || {}), groupCount: 1 },
        priority: resolvedPriority,
        groupingKey,
        groupCount: 1,
        delivery: { status: 'pending' }
      };
      if (productId) doc.product = productId;
      if (shopId) doc.shop = shopId;
      notification = await Notification.create(doc);
    }

    await enqueueOrFallback({
      notification,
      userId,
      priority: notification.priority || resolvedPriority,
      pushEnabled: effectivePushEnabled,
      socketEnabled: effectiveSocketEnabled,
      incrementUnread: !Boolean(notification?.metadata?.grouped),
      delayMs
    });
    return notification;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Notification creation failed', error);
    return null;
  }
};
