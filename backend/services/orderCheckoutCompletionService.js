import Order from '../models/orderModel.js';
import { withCommerceOperation } from './commerceOperationService.js';

export const completeOrderCheckoutOnce = async ({ checkout, userId, createOrders }) => {
  if (!checkout?.checkoutId || checkout.status !== 'COMPLETED') {
    throw Object.assign(new Error('Confirmation PawaPay requise.'), { status: 403 });
  }
  return withCommerceOperation(`checkout:${checkout.checkoutId}`, async (session, operation) => {
    const existing = await Order.find({ customer: userId, paymentSource: 'pawapay',
      $or: [{ paymentCheckoutId: checkout.checkoutId }, { paymentTransactionCode: checkout.checkoutId }]
    }).session(session);
    if (existing.length || operation.orderIds.length) {
      if (existing.length !== (operation.orderIds.length || existing.length) ||
        Math.abs(existing.reduce((sum, order) => sum + Number(order.paidAmount), 0) - Number(checkout.amount)) > 0.01) {
        throw Object.assign(new Error('Cette commande payée nécessite une vérification avant finalisation.'), { status: 409 });
      }
      return { orders: existing, created: false };
    }
    const orders = await createOrders(session);
    operation.orderIds = orders.map(order => order._id);
    await operation.save({ session });
    return { orders, created: true };
  });
};
