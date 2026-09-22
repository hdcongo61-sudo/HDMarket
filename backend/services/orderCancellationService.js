import Order from '../models/orderModel.js';
import { withCommerceOperation } from './commerceOperationService.js';
import { cancelInstallmentOrder } from './installmentPaymentService.js';

export const orderConflict = (message, status = 409) => Object.assign(new Error(message), { status, statusCode: status });
export const orderOperationKey = id => `order:${id}`;

// Persist the refund obligation with the cancellation. Provider availability
// must never determine whether a cancelled order is eligible for a payout.
export const cancelOrderSafely = async ({ orderId, actorId, reason, buyer = false, sellerId = null }) => {
  const current = await Order.findById(orderId).select('paymentType');
  if (current?.paymentType === 'installment') return cancelInstallmentOrder({ orderId, actorId, reason, buyer, sellerId });
  return withCommerceOperation(orderOperationKey(orderId), async session => {
    const order = await Order.findById(orderId).session(session);
    if (!order || (buyer && String(order.customer) !== String(actorId)) ||
      (sellerId && !order.items.some(item => String(item.snapshot.shopId) === String(sellerId)))) throw orderConflict('Commande introuvable.', 404);
    if (order.status === 'cancelled') return order;
    if (order.sponsoredPayment?.isSponsored && order.sponsoredPayment.status === 'pending') throw orderConflict('Annulez la demande depuis Paiement par un proche.');
    if (['RELEASED', 'REFUNDED', 'ON_HOLD'].includes(order.escrowStatus) || order.disputeOpened || Number(order.cashCollectedAmount) > 0 ||
      ['delivered', 'completed', 'confirmed_by_client', 'picked_up_confirmed', 'delivery_proof_submitted', 'dispute_opened'].includes(order.status)) throw orderConflict('Cette commande ne peut plus être annulée.');
    if (buyer && (order.cancellationWindowSkippedAt || Date.now() - new Date(order.createdAt).getTime() > 30 * 60 * 1000)) throw orderConflict('Le délai d’annulation est expiré.', 403);
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelledBy = actorId;
    order.cancellationReason = reason || 'Commande annulée.';
    order.autoReleaseAt = null;
    if (order.paymentSource === 'pawapay' && order.paidAmount > 0) {
      order.cancellationRefundRequired = true;
      order.refundStatus = 'pending';
      order.refundRequestedBy = actorId;
      order.refundRequestedAt = new Date();
      order.refundMethod = 'pawapay';
    }
    await order.save({ session });
    return order;
  });
};

export const recoverCancellationRefund = async orderId => {
  const order = await Order.findById(orderId);
  if (!order?.cancellationRefundRequired) return;
  if (order.refundStatus === 'processed' && Number(order.refundAmount) >= Number(order.paidAmount)) {
    await Order.updateOne({ _id: orderId, refundStatus: 'processed' }, { $set: { cancellationRefundRequired: false } });
    return;
  }
  const { initiateOrderRefund } = await import('./refundService.js');
  return initiateOrderRefund({ order, requestedBy: order.refundRequestedBy || order.cancelledBy || order.customer,
    amount: Number(order.paidAmount), source: 'ORDER_CANCELLATION' });
};

export const reconcileCancellationRefunds = async ({ limit = 25 } = {}) => {
  const orders = await Order.find({ cancellationRefundRequired: true }).sort({ refundRequestedAt: 1 }).limit(limit).select('_id');
  for (const order of orders) {
    await recoverCancellationRefund(order._id).catch(() => {});
  }
};
