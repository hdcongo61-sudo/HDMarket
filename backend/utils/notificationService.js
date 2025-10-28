import Notification from '../models/notificationModel.js';
import { emitNotification } from './notificationEmitter.js';

export const createNotification = async ({
  userId,
  actorId,
  productId,
  type,
  metadata = {}
}) => {
  if (!userId || !actorId || String(userId) === String(actorId)) return null;

  try {
    const notification = await Notification.create({
      user: userId,
      actor: actorId,
      product: productId,
      type,
      metadata
    });

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
