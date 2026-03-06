import Notification from '../models/notificationModel.js';
import { emitNotification } from './notificationEmitter.js';
import { sendPushNotification } from './pushService.js';
import {
  incrementUnreadCount,
  syncUnreadCount
} from './notificationUnreadCounter.js';
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
  userId,
  priority = 'NORMAL',
  pushEnabled = true,
  socketEnabled = true,
  incrementUnread = true,
  queueJobId = ''
}) => {
  const notification = await loadNotificationForDelivery(notificationId);
  if (!notification) return { delivered: false, reason: 'notification_not_found' };

  const targetUserId = String(userId || notification.user || '');
  const presence = await getUserPresenceContext(targetUserId);
  const online = Boolean(presence?.online);
  const allowPushWhenOnlineFallback = Boolean(
    online && presence?.hasDesktopSession && !presence?.hasMobileSession
  );
  const [pushEnabledGlobal, pushWhenOnline, pushForPriorityHighOnly] = await Promise.all([
    getRuntimeConfig('push_enabled', { fallback: true }),
    getRuntimeConfig('push_when_online', { fallback: false }),
    getRuntimeConfig('push_for_priority_high_only', { fallback: false })
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

  if (incrementUnread) {
    await incrementUnreadCount(targetUserId, 1).catch(() => syncUnreadCount(targetUserId));
  }

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

  if (inAppEnabled) {
    emitNotification(targetUserId, refreshPayload);
  }

  if (channels.viaSocket) {
    emitSocketNotification(targetUserId, refreshPayload);
  }

  await invalidateUserCache(targetUserId, ['notifications']).catch(() => {});

  let pushSent = false;
  let pushError = '';
  if (channels.viaPush) {
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

  notification.delivery = {
    ...(notification.delivery || {}),
    queueJobId: queueJobId || notification.delivery?.queueJobId || '',
    queueAttempts: Number(notification.delivery?.queueAttempts || 0) + 1,
    lastAttemptAt: new Date(),
    deliveredAt: new Date(),
    socketDelivered: Boolean(channels.viaSocket),
    pushDelivered: Boolean(pushSent),
    pushFallbackWebOnline: webOnlineFallbackUsed,
    pushFallbackReason: webOnlineFallbackUsed ? 'web_online_without_mobile_session' : '',
    pushError: pushError || '',
    status: pushError ? 'failed' : 'delivered'
  };
  await notification.save();

  return {
    delivered: !pushError,
    online,
    presence,
    channels,
    pushError
  };
};
