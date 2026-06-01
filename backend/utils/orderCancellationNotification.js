import { createNotification } from './notificationService.js';

export const buildOrderCancellationMetadata = ({
  order,
  cancelledBy = 'system',
  reason = '',
  extraMetadata = {}
} = {}) => ({
  orderId: order?._id,
  deliveryAddress: order?.deliveryAddress || '',
  deliveryCity: order?.deliveryCity || '',
  status: 'cancelled',
  cancelledBy,
  reason: reason || order?.cancellationReason || '',
  ...extraMetadata
});

export const notifyBuyerOrderCancelled = ({
  order,
  actorId,
  cancelledBy = 'system',
  reason = '',
  extraMetadata = {},
  productId = null
} = {}) => {
  if (!order?._id || !order?.customer || !actorId) return Promise.resolve(null);

  return createNotification({
    userId: order.customer,
    actorId,
    productId,
    type: 'order_cancelled',
    metadata: buildOrderCancellationMetadata({
      order,
      cancelledBy,
      reason,
      extraMetadata
    }),
    allowSelf: true
  });
};
