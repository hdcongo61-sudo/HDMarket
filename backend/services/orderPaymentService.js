import crypto from 'node:crypto';
import Order from '../models/orderModel.js';
import Checkout from '../models/pawapayCheckoutModel.js';
import { withCommerceOperation } from './commerceOperationService.js';
import { orderConflict, orderOperationKey, recoverCancellationRefund } from './orderCancellationService.js';
import { rollbackConsumedMarketplacePromo } from '../utils/marketplacePromoCodeService.js';

const active = { $or: [
  { status: { $in: ['CREATED', 'WAITING_PAYMENT', 'PROCESSING'] } },
  { paymentState: 'CONFIRMED', autoValidationState: { $ne: 'COMPLETED' } },
  { 'failureReason.failureCode': { $in: ['AMOUNT_MISMATCH', 'CURRENCY_MISMATCH'] } }
] };
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const orderReservationKey = action => action.kind === 'ORDER_PAYMENT' ? String(action.orderId) :
  crypto.createHash('sha256').update(JSON.stringify((action.items || []).map(item => canonical({
    productId: item.productId, quantity: Number(item.quantity), selectedAttributes: item.selectedAttributes || []
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))).digest('hex');
export const findActiveOrderPayment = (userId, action, session = null) => Checkout.findOne({ user: userId,
  orderReservationKey: orderReservationKey(action), ...active }).session(session);

export const assertNegotiatedPayable = (order, userId, amount) => {
  if (!order || String(order.customer) !== String(userId)) throw orderConflict('Commande introuvable.', 404);
  if (!order.quotationSnapshot?.applied || order.paymentType === 'installment' ||
    !['pending', 'pending_payment', 'awaiting_payment'].includes(order.status) || order.disputeOpened ||
    ['ON_HOLD', 'RELEASED', 'REFUNDED'].includes(order.escrowStatus) || order.cancellationRefundRequired ||
    ['pending', 'processed'].includes(order.refundStatus) || Number(order.paidAmount) > 0 || Number(order.cashCollectedAmount) > 0) throw orderConflict('Cette commande ne peut plus recevoir ce paiement.');
  if (Math.round(Number(order.remainingAmount ?? order.totalAmount)) !== amount) throw orderConflict('Le montant de la commande a changé.');
};

export const reserveOrderPayment = async (data, quote) => {
  const key = data.actionContext.kind === 'ORDER_PAYMENT' ? orderOperationKey(data.actionContext.orderId) : `order-buyer:${data.user}`;
  return withCommerceOperation(key, async session => {
    const existing = await findActiveOrderPayment(data.user, data.actionContext, session);
    if (existing) return { checkout: existing, reused: true };
    let snapshot;
    if (data.actionContext.kind === 'ORDER_PAYMENT') {
      const order = await Order.findById(data.actionContext.orderId).session(session);
      assertNegotiatedPayable(order, data.user, data.amount);
      // Touch the order so address/price/status document writes conflict too.
      order.paymentCheckoutId = data.checkoutId;
      await order.save({ session });
      snapshot = { amount: data.amount, countryId: order.countryId, currency: order.currency, orderId: String(order._id) };
    } else {
      snapshot = await quote({ userId: data.user, action: data.actionContext, amount: data.amount,
        countryId: data.countryId, session, preview: false });
    }
    const [checkout] = await Checkout.create([{ ...data, orderSnapshot: snapshot,
      orderReservationKey: orderReservationKey(data.actionContext), orderPromosReserved: Boolean(snapshot.consumedPromos?.length) }], { session });
    return { checkout, reused: false };
  });
};

export const releaseOrderPromos = async checkout => {
  if (!checkout?.orderPromosReserved || !['FAILED', 'EXPIRED', 'CANCELLED'].includes(checkout.status) ||
    checkout.paymentState === 'CONFIRMED' || ['AMOUNT_MISMATCH', 'CURRENCY_MISMATCH'].includes(checkout.failureReason?.failureCode)) return;
  await withCommerceOperation(`order-buyer:${checkout.user}`, async session => {
    const reserved = await Checkout.findOneAndUpdate({ _id: checkout._id, orderPromosReserved: true,
      status: { $in: ['FAILED', 'EXPIRED', 'CANCELLED'] }, paymentState: { $ne: 'CONFIRMED' } },
    { $set: { orderPromosReserved: false } }, { session, new: true });
    if (!reserved) return;
    for (const promo of reserved.orderSnapshot?.consumedPromos || []) await rollbackConsumedMarketplacePromo({ ...promo, session });
  });
};

export const completeNegotiatedPayment = async checkout => {
  const order = await withCommerceOperation(orderOperationKey(checkout.actionContext.orderId), async session => {
    const current = await Order.findOne({ _id: checkout.actionContext.orderId, customer: checkout.user }).session(session);
    if (!current) throw orderConflict('Commande introuvable.');
    if (current.paymentCheckoutId === checkout.checkoutId && Number(current.paidAmount) === Number(checkout.amount)) return current;
    if (Number(current.paidAmount) > 0) throw orderConflict('Paiement supplémentaire à vérifier avant affectation.');
    const canFulfil = ['pending', 'pending_payment', 'awaiting_payment'].includes(current.status) &&
      !current.disputeOpened && !['RELEASED', 'REFUNDED', 'ON_HOLD'].includes(current.escrowStatus) &&
      Number(current.totalAmount) === Number(checkout.amount);
    current.paymentSource = 'pawapay';
    current.paymentCheckoutId = checkout.checkoutId;
    current.paymentTransactionCode = checkout.checkoutId;
    current.paymentDepositId = checkout.depositId || '';
    current.paidAmount = Number(checkout.amount);
    current.escrowAmount = Number(checkout.amount);
    current.escrowStatus = 'IN_ESCROW';
    if (canFulfil) current.status = 'paid';
    else {
      // A late success settles into a durable refund, never reopens the sale.
      current.cancellationRefundRequired = true;
      current.refundStatus = 'pending';
      current.refundRequestedBy = current.cancelledBy || current.customer;
      current.refundRequestedAt = new Date();
      current.autoReleaseAt = null;
    }
    await current.save({ session });
    return current;
  });
  if (order.cancellationRefundRequired) await recoverCancellationRefund(order._id).catch(() => {});
  return order;
};
