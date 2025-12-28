import Notification from '../models/notificationModel.js';
import { emitNotification } from './notificationEmitter.js';

export const createNotification = async ({
  userId,
  actorId,
  productId,
  shopId,
  type,
  metadata = {},
  allowSelf = false
}) => {
  if (!userId || !actorId) return null;
  if (!allowSelf && String(userId) === String(actorId)) return null;

  try {
    const doc = {
      user: userId,
      actor: actorId,
      type,
      metadata
    };
    if (productId) {
      doc.product = productId;
    }
    if (shopId) {
      doc.shop = shopId;
    }

    const notification = await Notification.create(doc);

    emitNotification(userId, {
      type: 'refresh',
      event: type,
      notificationId: notification._id
    });

    return notification;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Notification creation failed', error);
    return null;
  }
};
