import Notification from '../models/notificationModel.js';
import { emitNotification } from './notificationEmitter.js';
import { sendPushNotification } from './pushService.js';

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

    notification
      .populate([
        { path: 'actor', select: 'name' },
        { path: 'product', select: 'title' },
        { path: 'shop', select: 'shopName name' }
      ])
      .then((populated) => {
        const actorName = populated?.actor?.name || 'Quelqu’un';
        const productTitle = populated?.product?.title || '';
        const shopName = populated?.shop?.shopName || populated?.shop?.name || '';
        return sendPushNotification({
          notification: populated,
          actorName,
          productTitle,
          shopName
        });
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Push notification failed', error);
      });

    return notification;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Notification creation failed', error);
    return null;
  }
};
