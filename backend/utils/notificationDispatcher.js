import Notification from '../models/notificationModel.js';
import { emitNotification } from './notificationEmitter.js';
import { sendPushNotification } from './pushService.js';
import {
  incrementUnreadCount,
  syncUnreadCount
} from './notificationUnreadCounter.js';
import { emitSocketNotification, isUserOnline } from '../sockets/notificationSocket.js';
import { invalidateUserCache } from './cache.js';

const DELIVERY_RULES = Object.freeze({
  LOW: { socketWhenOnline: false, pushWhenOnline: false, pushWhenOffline: false },
  NORMAL: { socketWhenOnline: true, pushWhenOnline: false, pushWhenOffline: false },
  HIGH: { socketWhenOnline: true, pushWhenOnline: false, pushWhenOffline: true },
  CRITICAL: { socketWhenOnline: true, pushWhenOnline: true, pushWhenOffline: true }
});

const resolvePriority = (value) => {
  const normalized = String(value || 'NORMAL').toUpperCase();
  if (Object.prototype.hasOwnProperty.call(DELIVERY_RULES, normalized)) return normalized;
  return 'NORMAL';
};

const resolveDeliveryChannels = ({ priority, online, pushEnabled = true, socketEnabled = true }) => {
  const rules = DELIVERY_RULES[resolvePriority(priority)] || DELIVERY_RULES.NORMAL;
  const viaSocket = Boolean(socketEnabled && online && rules.socketWhenOnline);
  const viaPush = Boolean(
    pushEnabled && (online ? rules.pushWhenOnline : rules.pushWhenOffline)
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
  const online = await isUserOnline(targetUserId);
  const channels = resolveDeliveryChannels({
    priority,
    online,
    pushEnabled,
    socketEnabled
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

  emitNotification(targetUserId, refreshPayload);

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

  notification.delivery = {
    ...(notification.delivery || {}),
    queueJobId: queueJobId || notification.delivery?.queueJobId || '',
    queueAttempts: Number(notification.delivery?.queueAttempts || 0) + 1,
    lastAttemptAt: new Date(),
    deliveredAt: new Date(),
    socketDelivered: Boolean(channels.viaSocket),
    pushDelivered: Boolean(pushSent),
    pushError: pushError || '',
    status: pushError ? 'failed' : 'delivered'
  };
  await notification.save();

  return {
    delivered: !pushError,
    online,
    channels,
    pushError
  };
};
