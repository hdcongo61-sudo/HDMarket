import Notification from '../models/notificationModel.js';
import { randomUUID } from 'node:crypto';
import { shouldRespectUserPreference, userAllowsNotificationType } from './notificationPreferences.js';
import User from '../models/userModel.js';
import { emitNotification } from './notificationEmitter.js';
import { sendPushNotification } from './pushService.js';
import { syncUnreadCount } from './notificationUnreadCounter.js';
import { emitSocketNotification } from '../sockets/notificationSocket.js';
import { invalidateUserCache } from './cache.js';
import { getRuntimeConfig } from '../services/configService.js';
import { getUserPresenceContext } from '../services/presenceService.js';

const DELIVERY_RULES = Object.freeze({
  LOW: { socketWhenOnline: false, pushWhenOnline: false, pushWhenOffline: false },
  NORMAL: { socketWhenOnline: true, pushWhenOnline: false, pushWhenOffline: true },
  HIGH: { socketWhenOnline: true, pushWhenOnline: false, pushWhenOffline: true },
  CRITICAL: { socketWhenOnline: true, pushWhenOnline: true, pushWhenOffline: true }
});

const resolvePriority = (value) => {
  const normalized = String(value || 'NORMAL').toUpperCase();
  if (Object.prototype.hasOwnProperty.call(DELIVERY_RULES, normalized)) return normalized;
  return 'NORMAL';
};

const resolveDeliveryChannels = ({
  priority,
  online,
  allowPushWhenOnlineFallback = false,
  pushEnabled = true,
  socketEnabled = true,
  pushWhenOnline = false,
  pushForPriorityHighOnly = false,
  channels = ['IN_APP', 'PUSH']
}) => {
  const rules = DELIVERY_RULES[resolvePriority(priority)] || DELIVERY_RULES.NORMAL;
  const normalizedChannels = Array.isArray(channels)
    ? channels.map((item) => String(item || '').trim().toUpperCase())
    : ['IN_APP'];
  const supportsInApp = normalizedChannels.includes('IN_APP');
  const supportsPush = normalizedChannels.includes('PUSH');
  const priorityKey = resolvePriority(priority);
  const pushByPriorityAllowed = pushForPriorityHighOnly
    ? ['HIGH', 'CRITICAL'].includes(priorityKey)
    : true;

  const viaSocket = Boolean(socketEnabled && supportsInApp && online && rules.socketWhenOnline);
  const rawPush = Boolean(
    pushEnabled &&
      supportsPush &&
      (online
        ? rules.pushWhenOnline || allowPushWhenOnlineFallback
        : rules.pushWhenOffline)
  );
  const viaPush = Boolean(
    rawPush &&
      pushByPriorityAllowed &&
      (!online || pushWhenOnline === true || allowPushWhenOnlineFallback === true)
  );
  return { viaSocket, viaPush };
};

const loadNotificationForDelivery = async (notificationId) => {
  return Notification.findById(notificationId).populate([
    { path: 'actor', select: 'name' },
    { path: 'product', select: 'title slug' },
    { path: 'shop', select: 'shopName name slug' }
  ]);
};

export const dispatchNotificationPayload = async ({
  notificationId,
  deliveryId = '',
  userId,
  priority = 'NORMAL',
  pushEnabled = true,
  socketEnabled = true,
  queueJobId = ''
}) => {
  const notification = await loadNotificationForDelivery(notificationId);
  if (!notification) return { delivered: false, reason: 'notification_not_found' };
  const targetUserId = String(notification.user || '');
  if (userId && String(userId) !== targetUserId) return { delivered: false, reason: 'recipient_mismatch' };
  if (deliveryId !== String(notification.delivery?.id || '')) return { delivered: false, reason: 'stale_delivery' };
  if (notification.delivery?.status === 'delivered') return { delivered: true, reason: 'already_delivered' };
  const now = new Date();
  if (notification.deletedAt || (notification.expiresAt && notification.expiresAt <= now) ||
      (notification.snoozedUntil && notification.snoozedUntil > now)) {
    return { delivered: false, reason: 'notification_hidden' };
  }
  const deliveryFilter = {
    _id: notificationId,
    ...(deliveryId ? { 'delivery.id': deliveryId } : { 'delivery.id': { $in: ['', null] } })
  };
  const recipientUser = await User.findById(targetUserId)
    .select('notificationPreferences')
    .lean()
    .catch(() => null);
  if (
    recipientUser &&
    shouldRespectUserPreference(notification) &&
    !userAllowsNotificationType(recipientUser, notification.type)
  ) {
    await Notification.updateOne(deliveryFilter, { $set: {
      'delivery.status': 'suppressed',
      'delivery.suppressedByPreference': true,
      'delivery.suppressedAt': now
    } });
    await syncUnreadCount(targetUserId);
    await invalidateUserCache(targetUserId, ['notifications']).catch(() => {});
    return { delivered: false, reason: 'suppressed_by_preference' };
  }
  // Serialize duplicate queue/fallback attempts for this event. A new grouped
  // event receives a new delivery id, so old workers cannot overwrite it.
  const lockId = randomUUID();
  const claimed = await Notification.findOneAndUpdate({
    ...deliveryFilter,
    'delivery.status': { $ne: 'delivered' },
    $or: [{ 'delivery.lockUntil': null }, { 'delivery.lockUntil': { $lte: now } }]
  }, { $set: { 'delivery.lockId': lockId, 'delivery.lockUntil': new Date(now.getTime() + 60_000) } }, { new: true });
  if (!claimed) throw new Error('notification_delivery_busy');
  const ownedFilter = { ...deliveryFilter, 'delivery.lockId': lockId };
  try {
  const presence = await getUserPresenceContext(targetUserId);
  const online = Boolean(presence?.online);
  const allowPushWhenOnlineFallback = Boolean(
    online && presence?.hasDesktopSession && !presence?.hasMobileSession
  );
  const [pushEnabledGlobal, pushWhenOnline, pushForPriorityHighOnly] = await Promise.all([
    getRuntimeConfig('push_enabled', { countryId: notification.countryId, fallback: true }),
    getRuntimeConfig('push_when_online', { countryId: notification.countryId, fallback: false }),
    getRuntimeConfig('push_for_priority_high_only', { countryId: notification.countryId, fallback: false })
  ]);
  const channels = resolveDeliveryChannels({
    priority,
    online,
    pushEnabled: Boolean(pushEnabled) && Boolean(pushEnabledGlobal),
    socketEnabled,
    pushWhenOnline: Boolean(pushWhenOnline),
    allowPushWhenOnlineFallback,
    pushForPriorityHighOnly: Boolean(pushForPriorityHighOnly),
    channels: notification?.channels || ['IN_APP', 'PUSH']
  });

  await syncUnreadCount(targetUserId);

  const refreshPayload = {
    type: 'refresh',
    event: notification.type,
    notificationId: String(notification._id),
    priority: resolvePriority(priority),
    grouped: Number(notification.groupCount || 1) > 1,
    groupCount: Number(notification.groupCount || 1)
  };

  const inAppEnabled = Array.isArray(notification?.channels)
    ? notification.channels.map((item) => String(item || '').toUpperCase()).includes('IN_APP')
    : true;

  if (inAppEnabled && !claimed.delivery?.inAppDelivered) {
    // Persist before push: a push retry must not emit the in-app event again.
    const updated = await Notification.updateOne(ownedFilter, { $set: {
      'delivery.inAppDelivered': true,
      'delivery.socketDelivered': Boolean(channels.viaSocket)
    } });
    if (!updated.matchedCount) return { delivered: false, reason: 'stale_delivery' };
    emitNotification(targetUserId, refreshPayload);
    if (channels.viaSocket) emitSocketNotification(targetUserId, refreshPayload);
  }

  await invalidateUserCache(targetUserId, ['notifications']).catch(() => {});

  let pushSent = Boolean(claimed.delivery?.pushDelivered);
  let pushError = '';
  if (channels.viaPush && !pushSent) {
    try {
      const actorName = notification?.actor?.name || 'Quelqu’un';
      const productTitle = notification?.product?.title || '';
      const shopName = notification?.shop?.shopName || notification?.shop?.name || '';
      const response = await sendPushNotification({
        notification,
        actorName,
        productTitle,
        shopName
      });
      pushSent = Boolean(response);
    } catch (error) {
      pushError = error?.message || 'push_failed';
    }
  }
  const webOnlineFallbackUsed = Boolean(allowPushWhenOnlineFallback && channels.viaPush);

  await Notification.updateOne(ownedFilter, {
    $set: {
      'delivery.queueJobId': queueJobId || claimed.delivery?.queueJobId || '',
      'delivery.lastAttemptAt': new Date(),
      'delivery.deliveredAt': pushError ? null : new Date(),
      'delivery.pushDelivered': pushSent,
      'delivery.pushFallbackWebOnline': webOnlineFallbackUsed,
      'delivery.pushFallbackReason': webOnlineFallbackUsed ? 'web_online_without_mobile_session' : '',
      'delivery.pushError': pushError,
      'delivery.status': pushError ? 'failed' : 'delivered'
    },
    $inc: { 'delivery.queueAttempts': 1 }
  });

  return {
    delivered: !pushError,
    online,
    presence,
    channels,
    pushError
  };
  } finally {
    await Notification.updateOne(ownedFilter, { $set: { 'delivery.lockId': '', 'delivery.lockUntil': null } });
  }
};
