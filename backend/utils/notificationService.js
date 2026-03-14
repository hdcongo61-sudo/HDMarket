import Notification from '../models/notificationModel.js';
import Order from '../models/orderModel.js';
import { enqueueNotificationJob } from '../queues/notificationQueue.js';
import { dispatchNotificationPayload } from './notificationDispatcher.js';
import { initRedis, getRedisClient, isRedisReady } from '../config/redisClient.js';
import {
  decrementTaskCounters,
  deriveTaskRolesFromNotification,
  incrementTaskCounters,
  normalizeValidationTaskType
} from './notificationTaskCounter.js';
import { createAuditLogEntry } from '../services/auditLogService.js';

const GROUP_WINDOW_MINUTES = Math.max(1, Number(process.env.NOTIFICATION_GROUP_WINDOW_MINUTES || 20));

const TYPE_PRIORITY_MAP = Object.freeze({
  account_restriction: 'CRITICAL',
  dispute_deadline_near: 'CRITICAL',
  dispute_under_review: 'HIGH',
  dispute_resolved: 'HIGH',
  dispute_created: 'HIGH',
  payment_pending: 'HIGH',
  order_received: 'HIGH',
  order_full_payment_waived: 'HIGH',
  order_full_payment_received: 'HIGH',
  order_full_payment_ready: 'HIGH',
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
  order_message: 'HIGH',
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
const TASK_ACTION_TYPES = new Set(['APPROVE', 'REJECT', 'REVIEW', 'ASSIGN', 'VERIFY', 'RESPOND', 'NONE']);
const TASK_ACTION_STATUSES = new Set(['PENDING', 'DONE', 'EXPIRED']);
const NOTIFICATION_CHANNELS = new Set(['IN_APP', 'PUSH', 'EMAIL']);
const NOTIFICATION_AUDIENCES = new Set(['USER', 'ADMIN', 'FOUNDER', 'ROLE_GROUP']);
const ENTITY_TYPES = new Set([
  'order',
  'product',
  'shop',
  'boost',
  'deliveryRequest',
  'dispute',
  'user',
  'payment',
  'refund',
  'shopConversionRequest'
]);
const ORDER_CONTEXT_NOTIFICATION_TYPES = new Set([
  'review_reminder',
  'order_created',
  'order_received',
  'order_full_payment_waived',
  'order_full_payment_received',
  'order_full_payment_ready',
  'order_reminder',
  'order_cancellation_window_skipped',
  'order_delivering',
  'order_delivered',
  'order_address_updated',
  'order_delivery_fee_updated',
  'order_message',
  'order_cancelled',
  'installment_due_reminder',
  'installment_overdue_warning',
  'installment_payment_submitted',
  'installment_payment_validated',
  'installment_sale_confirmation_required',
  'installment_sale_confirmed',
  'installment_completed',
  'installment_product_suspended'
]);

const sanitizePriority = (priority) => {
  const normalized = String(priority || '').toUpperCase();
  if (Object.prototype.hasOwnProperty.call(PRIORITY_RANK, normalized)) return normalized;
  return 'NORMAL';
};

const sanitizeAudience = (audience = 'USER') => {
  const normalized = String(audience || 'USER').trim().toUpperCase();
  if (NOTIFICATION_AUDIENCES.has(normalized)) return normalized;
  return 'USER';
};

const sanitizeTargetRole = (value) => {
  const list = Array.isArray(value) ? value : [];
  return Array.from(new Set(list.map((role) => String(role || '').trim()).filter(Boolean)));
};

const sanitizeActionType = (value = 'NONE') => {
  const normalized = String(value || 'NONE').trim().toUpperCase();
  if (TASK_ACTION_TYPES.has(normalized)) return normalized;
  return 'NONE';
};

const sanitizeActionStatus = (value = 'DONE') => {
  const normalized = String(value || 'DONE').trim().toUpperCase();
  if (TASK_ACTION_STATUSES.has(normalized)) return normalized;
  return 'DONE';
};

const sanitizeEntityType = (value = '') => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (ENTITY_TYPES.has(normalized)) return normalized;
  return '';
};

const sanitizeChannels = (channels = []) => {
  const raw = Array.isArray(channels) && channels.length ? channels : ['IN_APP', 'PUSH'];
  const sanitized = Array.from(
    new Set(
      raw
        .map((channel) => String(channel || '').trim().toUpperCase())
        .filter((channel) => NOTIFICATION_CHANNELS.has(channel))
    )
  );
  return sanitized.length ? sanitized : ['IN_APP', 'PUSH'];
};

const extractOrderProductTitles = (order = null) => {
  if (!order) return [];
  const items = Array.isArray(order.items) ? order.items : [];
  const titles = items
    .map((item) => String(item?.snapshot?.title || '').trim())
    .filter(Boolean);
  return Array.from(new Set(titles)).slice(0, 5);
};

const enrichOrderContextMetadata = async ({ type, metadata = {} }) => {
  const baseMetadata =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  if (!ORDER_CONTEXT_NOTIFICATION_TYPES.has(String(type || ''))) {
    return baseMetadata;
  }

  const existingProductTitleCandidates = [
    baseMetadata.orderProductTitle,
    baseMetadata.productTitle,
    baseMetadata.primaryProductTitle
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  if (existingProductTitleCandidates.length) {
    return {
      ...baseMetadata,
      orderProductTitle: existingProductTitleCandidates[0]
    };
  }

  const rawTitles = Array.isArray(baseMetadata.productTitles) ? baseMetadata.productTitles : [];
  const normalizedTitles = rawTitles
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  if (normalizedTitles.length) {
    return {
      ...baseMetadata,
      orderProductTitle: normalizedTitles[0],
      productTitles: normalizedTitles
    };
  }

  const orderId = String(baseMetadata.orderId || '').trim();
  if (!orderId) return baseMetadata;

  try {
    const order = await Order.findById(orderId).select('items.snapshot.title').lean();
    const orderTitles = extractOrderProductTitles(order);
    if (!orderTitles.length) return baseMetadata;
    return {
      ...baseMetadata,
      orderProductTitle: orderTitles[0],
      productTitles: orderTitles
    };
  } catch {
    return baseMetadata;
  }
};

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolveValidationTypeFromPayload = ({ type, metadata = {}, validationType = '' }) => {
  const explicitType = normalizeValidationTaskType(validationType || metadata?.validationType || '');
  if (explicitType && explicitType !== 'other') return explicitType;

  switch (String(type || '').trim()) {
    case 'payment_pending':
      return 'productValidation';
    case 'delivery_request_created':
    case 'delivery_request_assigned':
      return 'deliveryOps';
    case 'dispute_created':
    case 'dispute_under_review':
      return 'disputes';
    case 'shop_conversion_request':
      return 'shopConversion';
    case 'validation_required':
      return normalizeValidationTaskType(metadata?.validationType || 'other');
    default:
      return 'other';
  }
};

const withRedis = async () => {
  if (isRedisReady()) return getRedisClient();
  return initRedis();
};

const isRateLimited = async ({ userId, actorId, type, priority, actionRequired = false }) => {
  if (actionRequired) return false;
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

const buildGroupingKey = ({ userId, type, metadata = {}, productId, shopId, actionRequired = false }) => {
  if (actionRequired) return '';
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
  delayMs = 0,
  audience = 'USER',
  targetRole = [],
  channels = ['IN_APP', 'PUSH'],
  actionRequired = false,
  actionType = 'NONE',
  actionStatus = undefined,
  actionDueAt = null,
  deepLink = '',
  actionLink = '',
  entityType = '',
  entityId = '',
  validationType = '',
  expiresAt = null
}) => {
  if (!userId || !actorId || !type) return null;
  if (!allowSelf && String(userId) === String(actorId)) return null;

  try {
    const enrichedMetadata = await enrichOrderContextMetadata({ type, metadata });
    const resolvedPriority = resolvePriority({ type, explicitPriority: priority, metadata: enrichedMetadata });
    const resolvedAudience = sanitizeAudience(audience);
    const resolvedTargetRole = sanitizeTargetRole(targetRole);
    const resolvedActionRequired = Boolean(actionRequired);
    const resolvedActionType = sanitizeActionType(actionType);
    const resolvedActionStatus = sanitizeActionStatus(
      actionStatus ?? (resolvedActionRequired ? 'PENDING' : 'DONE')
    );
    const resolvedEntityType = sanitizeEntityType(entityType || enrichedMetadata?.entityType || '');
    const resolvedEntityId = String(entityId || enrichedMetadata?.entityId || '').trim();
    const resolvedValidationType = resolveValidationTypeFromPayload({
      type,
      metadata: enrichedMetadata,
      validationType
    });
    const resolvedChannels = sanitizeChannels(channels);
    const normalizedDeepLink = String(deepLink || enrichedMetadata?.deepLink || '').trim();
    const normalizedActionLink = String(actionLink || normalizedDeepLink || '').trim();
    const normalizedActionDueAt = toDateOrNull(actionDueAt || enrichedMetadata?.actionDueAt);
    const normalizedExpiresAt = toDateOrNull(expiresAt || enrichedMetadata?.expiresAt);

    let effectivePushEnabled = Boolean(pushEnabled);
    let effectiveSocketEnabled = Boolean(socketEnabled);
    let effectiveMetadata = enrichedMetadata || {};

    if (
      await isRateLimited({
        userId,
        actorId,
        type,
        priority: resolvedPriority,
        actionRequired: resolvedActionRequired
      })
    ) {
      effectivePushEnabled = false;
      effectiveSocketEnabled = false;
      effectiveMetadata = {
        ...(effectiveMetadata || {}),
        throttled: true
      };
    }
    const groupingKey = buildGroupingKey({
      userId,
      type,
      metadata: enrichedMetadata,
      productId,
      shopId,
      actionRequired: resolvedActionRequired
    });

    let notification = await findGroupedNotification({ userId, type, groupingKey });
    let shouldIncrementTaskCounters = false;
    let shouldDecrementTaskCounters = false;
    let previousNotificationSnapshot = null;

    if (notification) {
      previousNotificationSnapshot = {
        actionRequired: Boolean(notification.actionRequired),
        actionStatus: String(notification.actionStatus || 'DONE').toUpperCase(),
        validationType: String(notification.validationType || 'other'),
        roles: deriveTaskRolesFromNotification(notification)
      };

      notification.metadata = buildGroupedMetadata({
        current: notification.metadata || {},
        incoming: effectiveMetadata || {},
        actorId
      });
      notification.groupCount = Number(notification.metadata?.groupCount || notification.groupCount || 1);
      notification.priority = mergePriority(notification.priority, resolvedPriority);
      notification.readAt = null;
      notification.audience = resolvedAudience;
      notification.targetRole = resolvedTargetRole;
      notification.channels = resolvedChannels;
      notification.actionRequired = resolvedActionRequired;
      notification.actionType = resolvedActionType;
      notification.actionStatus = resolvedActionStatus;
      notification.actionDueAt = normalizedActionDueAt;
      notification.deepLink = normalizedDeepLink;
      notification.actionLink = normalizedActionLink;
      notification.entityType = resolvedEntityType;
      notification.entityId = resolvedEntityId;
      notification.validationType = resolvedValidationType;
      notification.expiresAt = normalizedExpiresAt;
      notification.delivery = {
        ...(notification.delivery || {}),
        status: 'pending'
      };
      await notification.save();
    } else {
      const doc = {
        user: userId,
        actor: actorId,
        audience: resolvedAudience,
        targetRole: resolvedTargetRole,
        type,
        metadata: { ...(effectiveMetadata || {}), groupCount: 1 },
        priority: resolvedPriority,
        groupingKey,
        groupCount: 1,
        channels: resolvedChannels,
        actionRequired: resolvedActionRequired,
        actionType: resolvedActionType,
        actionStatus: resolvedActionStatus,
        actionDueAt: normalizedActionDueAt,
        deepLink: normalizedDeepLink,
        actionLink: normalizedActionLink,
        entityType: resolvedEntityType,
        entityId: resolvedEntityId,
        validationType: resolvedValidationType,
        expiresAt: normalizedExpiresAt,
        delivery: { status: 'pending' }
      };
      if (productId) doc.product = productId;
      if (shopId) doc.shop = shopId;
      notification = await Notification.create(doc);
      shouldIncrementTaskCounters =
        Boolean(notification.actionRequired) &&
        String(notification.actionStatus || '').toUpperCase() === 'PENDING';
    }

    if (previousNotificationSnapshot) {
      const wasPending =
        previousNotificationSnapshot.actionRequired &&
        previousNotificationSnapshot.actionStatus === 'PENDING';
      const isPending =
        Boolean(notification.actionRequired) &&
        String(notification.actionStatus || '').toUpperCase() === 'PENDING';
      shouldIncrementTaskCounters = !wasPending && isPending;
      shouldDecrementTaskCounters = wasPending && !isPending;
    }

    if (shouldIncrementTaskCounters || shouldDecrementTaskCounters) {
      const roles = deriveTaskRolesFromNotification(notification);
      const taskType = String(notification.validationType || 'other');
      if (shouldIncrementTaskCounters) {
        await incrementTaskCounters({ roles, type: taskType, delta: 1 }).catch(() => {});
      } else if (shouldDecrementTaskCounters) {
        await decrementTaskCounters({ roles, type: taskType, delta: 1 }).catch(() => {});
      }
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

    if (Boolean(notification.actionRequired) && String(notification.actionStatus || '').toUpperCase() === 'PENDING') {
      await createAuditLogEntry({
        performedBy: actorId,
        targetUser: userId,
        actionType: 'NOTIFICATION_TASK_CREATED',
        newValue: {
          notificationId: String(notification._id),
          validationType: notification.validationType || 'other',
          audience: notification.audience,
          deepLink: notification.deepLink,
          entityType: notification.entityType,
          entityId: notification.entityId
        },
        meta: {
          module: 'notifications',
          type: notification.type
        }
      });
    }
    return notification;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Notification creation failed', error);
    return null;
  }
};

export const createValidationTaskNotification = async ({
  recipients = [],
  actorId,
  title = '',
  message = '',
  deepLink = '',
  actionType = 'REVIEW',
  actionDueAt = null,
  validationType = 'other',
  entityType = '',
  entityId = '',
  priority = 'HIGH',
  audience = 'ROLE_GROUP',
  targetRole = ['ADMIN', 'FOUNDER'],
  metadata = {}
}) => {
  if (!actorId) return [];
  const uniqueRecipients = Array.from(
    new Set((Array.isArray(recipients) ? recipients : []).map((entry) => String(entry || '')).filter(Boolean))
  );
  if (!uniqueRecipients.length) return [];

  const ops = uniqueRecipients.map((userId) =>
    createNotification({
      userId,
      actorId,
      type: 'validation_required',
      priority,
      audience,
      targetRole,
      actionRequired: true,
      actionType,
      actionStatus: 'PENDING',
      actionDueAt,
      deepLink,
      actionLink: deepLink,
      entityType,
      entityId,
      validationType,
      metadata: {
        title,
        message,
        deepLink,
        validationType,
        entityType,
        entityId,
        ...metadata
      },
      allowSelf: true
    })
  );
  const created = await Promise.all(ops);
  return created.filter(Boolean);
};

export const resolveValidationTaskNotifications = async ({
  entityType,
  entityId,
  actionStatus = 'DONE',
  actorId = null,
  validationType = null
}) => {
  const normalizedEntityType = sanitizeEntityType(entityType || '');
  const normalizedEntityId = String(entityId || '').trim();
  if (!normalizedEntityType || !normalizedEntityId) return { updated: 0 };

  const filter = {
    actionRequired: true,
    actionStatus: 'PENDING',
    entityType: normalizedEntityType,
    entityId: normalizedEntityId
  };

  if (validationType) {
    filter.validationType = normalizeValidationTaskType(validationType);
  }

  const pending = await Notification.find(filter)
    .select('_id validationType targetRole audience user')
    .lean();

  if (!pending.length) return { updated: 0 };

  const normalizedStatus = sanitizeActionStatus(actionStatus || 'DONE');
  await Notification.updateMany(
    { _id: { $in: pending.map((item) => item._id) } },
    {
      $set: {
        actionStatus: normalizedStatus
      }
    }
  );

  const counterByRoleAndType = new Map();
  pending.forEach((item) => {
    const roles = deriveTaskRolesFromNotification(item);
    const itemType = normalizeValidationTaskType(item?.validationType || 'other');
    roles.forEach((role) => {
      const key = `${role}:${itemType}`;
      counterByRoleAndType.set(key, Number(counterByRoleAndType.get(key) || 0) + 1);
    });
  });

  for (const [key, delta] of counterByRoleAndType.entries()) {
    const [role, type] = key.split(':');
    await decrementTaskCounters({ roles: [role], type, delta }).catch(() => {});
  }

  if (actorId) {
    await createAuditLogEntry({
      performedBy: actorId,
      actionType: 'NOTIFICATION_TASK_RESOLVED',
      newValue: {
        entityType: normalizedEntityType,
        entityId: normalizedEntityId,
        actionStatus: normalizedStatus,
        updated: pending.length
      },
      meta: {
        module: 'notifications',
        validationType: validationType || null
      }
    });
  }

  return { updated: pending.length };
};

export const expireValidationTaskNotifications = async ({ now = new Date() } = {}) => {
  const expired = await Notification.find({
    actionRequired: true,
    actionStatus: 'PENDING',
    actionDueAt: { $ne: null, $lte: now }
  })
    .select('_id validationType targetRole audience')
    .lean();
  if (!expired.length) return { expired: 0 };

  await Notification.updateMany(
    { _id: { $in: expired.map((item) => item._id) } },
    { $set: { actionStatus: 'EXPIRED' } }
  );

  const counterByRoleAndType = new Map();
  expired.forEach((item) => {
    const roles = deriveTaskRolesFromNotification(item);
    const itemType = normalizeValidationTaskType(item?.validationType || 'other');
    roles.forEach((role) => {
      const key = `${role}:${itemType}`;
      counterByRoleAndType.set(key, Number(counterByRoleAndType.get(key) || 0) + 1);
    });
  });

  for (const [key, delta] of counterByRoleAndType.entries()) {
    const [role, type] = key.split(':');
    await decrementTaskCounters({ roles: [role], type, delta }).catch(() => {});
  }

  return { expired: expired.length };
};
