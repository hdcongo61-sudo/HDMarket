import Order from '../models/orderModel.js';
import Checkout from '../models/pawapayCheckoutModel.js';
import User from '../models/userModel.js';
import { getRuntimeConfig } from './configService.js';
import { ensureDefaultCountry } from './countryService.js';
import { withCommerceOperation } from './commerceOperationService.js';
import { allocatePayment } from '../utils/paymentAllocation.js';
import { isRestricted } from '../utils/restrictionCheck.js';

const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
const statesFor = (kind) => kind === 'SPONSORSHIP_ACCEPT' ? ['pending'] : ['declined', 'expired'];
const actorField = (kind) => kind === 'SPONSORSHIP_ACCEPT' ? 'payer' : 'requester';
const paidStatus = (kind) => kind === 'SPONSORSHIP_ACCEPT' ? 'accepted' : 'self_paid';
const isReserved = (checkout) => checkout && (checkout.paymentState === 'CONFIRMED' ||
  !['FAILED', 'EXPIRED', 'CANCELLED'].includes(checkout.status));

export const sponsorshipAmounts = (orders, paymentOption = 'full') => {
  if (!['deposit', 'full'].includes(paymentOption)) fail('Option de paiement invalide.', 400);
  const entries = orders.map(order => ({ key: String(order._id), amount: paymentOption === 'full'
    ? Number(order.totalAmount || 0)
    : Math.max(0, Number(order.totalAmount || 0) - Number(order.deliveryFeeTotal || 0)) }));
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const amount = Math.round(total * (paymentOption === 'deposit' ? 0.25 : 1));
  return { amount, allocations: allocatePayment(amount, entries) };
};

const groupOrders = (groupId, session = null) => Order.find({
  'sponsoredPayment.isSponsored': true, 'sponsoredPayment.requestGroupId': groupId
}).sort({ _id: 1 }).session(session);

export const quoteSponsoredCheckout = async ({ groupId, kind, userId, paymentOption = 'full', amount, session = null }) => {
  if (typeof groupId !== 'string' || !groupId.trim() || groupId !== groupId.trim() || groupId.length > 200 ||
    !['SPONSORSHIP_ACCEPT', 'SPONSORSHIP_PAY_SELF'].includes(kind)) fail('Demande invalide.', 400);
  const orders = await groupOrders(groupId, session);
  if (!orders.length || orders.some(order => String(order.sponsoredPayment[actorField(kind)]) !== String(userId))) {
    fail('Demande introuvable.', 404);
  }
  if (orders.some(order => !statesFor(kind).includes(order.sponsoredPayment.status) || Number(order.paidAmount) > 0)) {
    fail('Cette demande est déjà traitée.');
  }
  if (orders.some(order => !(kind === 'SPONSORSHIP_ACCEPT' ? ['pending'] : ['pending', 'cancelled']).includes(order.status))) {
    fail('Une commande de cette demande a été modifiée.');
  }
  const countryId = String(orders[0].countryId || (await ensureDefaultCountry())._id);
  const currency = orders[0].currency || 'XAF';
  if (orders.some(order => String(order.countryId || countryId) !== countryId || (order.currency || 'XAF') !== currency)) {
    fail('La demande contient plusieurs pays ou devises.');
  }
  if (!await getRuntimeConfig('enable_pay_for_other', { countryId, fallback: false })) {
    fail('Le paiement par un proche est désactivé.', 403);
  }
  const payer = await User.findById(userId).select('isBlocked isActive restrictions').session(session);
  if (!payer || payer.isBlocked || payer.isActive === false || isRestricted(payer, 'canOrder')) {
    fail('Ce compte ne peut pas régler de commande.', 403);
  }
  // An existing reservation may outlive the request's original expiry.
  const reservationIds = [...new Set(orders.map(order => order.sponsoredPayment.checkoutId).filter(Boolean))];
  let existingCheckout = null;
  for (const checkoutId of reservationIds) {
    const checkout = await Checkout.findOne({ checkoutId }).session(session);
    if (isReserved(checkout)) {
      if (existingCheckout && existingCheckout.checkoutId !== checkoutId) fail('Plusieurs paiements nécessitent une vérification.');
      existingCheckout = checkout;
    }
  }
  if (!existingCheckout && kind === 'SPONSORSHIP_ACCEPT' && orders.some(order =>
    order.sponsoredPayment.expiresAt && order.sponsoredPayment.expiresAt <= new Date())) {
    fail('Cette demande a expiré.', 410);
  }
  const pricing = sponsorshipAmounts(orders, paymentOption);
  if (!Number.isSafeInteger(amount) || amount !== pricing.amount || amount < 10) {
    fail('Le montant de cette demande a changé. Actualisez la page.');
  }
  if (existingCheckout && (String(existingCheckout.user) !== String(userId) || existingCheckout.amount !== amount ||
    existingCheckout.actionContext?.kind !== kind || (existingCheckout.actionContext?.paymentOption || 'full') !== paymentOption)) {
    fail('Un paiement est déjà en cours pour cette demande. Reprenez cette tentative.');
  }
  return { orders, countryId, currency, ...pricing, existingCheckout };
};

export const reserveSponsoredCheckout = async (data) => withCommerceOperation(
  `sponsor:${data.actionContext.groupId}`, async (session) => {
    const quote = await quoteSponsoredCheckout({ ...data.actionContext, userId: data.user, amount: data.amount, session });
    if (quote.existingCheckout) return { checkout: quote.existingCheckout, reused: true };
    if (quote.countryId !== String(data.countryId) || quote.currency !== data.currency) fail('Pays ou devise du paiement invalide.');
    const sponsorshipSnapshot = {
      kind: data.actionContext.kind, paymentOption: data.actionContext.paymentOption,
      countryId: quote.countryId, currency: quote.currency,
      orders: quote.orders.map(order => ({ orderId: String(order._id), totalAmount: order.totalAmount, paidAmount: quote.allocations.get(String(order._id)) }))
    };
    const [checkout] = await Checkout.create([{ ...data, sponsorshipSnapshot }], { session });
    await Order.updateMany({ _id: { $in: quote.orders.map(order => order._id) } }, {
      $set: { 'sponsoredPayment.checkoutId': checkout.checkoutId }
    }, { session });
    return { checkout, reused: false };
  }
);

// Cancellation, refusal, expiry and retry use the same group lock as payment.
export const changeSponsoredGroup = (groupId, change) => withCommerceOperation(`sponsor:${groupId}`, async session => {
  const orders = await groupOrders(groupId, session);
  const ids = [...new Set(orders.map(order => order.sponsoredPayment.checkoutId).filter(Boolean))];
  for (const checkoutId of ids) {
    const checkout = await Checkout.findOne({ checkoutId }).session(session);
    if (isReserved(checkout)) fail('Un paiement est en cours de vérification. Attendez sa confirmation.');
  }
  return change(orders, session);
});

export const completeSponsoredCheckout = async ({ checkout, groupId, kind, userId }) => {
  if (!checkout?.checkoutId || checkout.status !== 'COMPLETED' || checkout.paymentState !== 'CONFIRMED' ||
    String(checkout.user) !== String(userId) || checkout.actionContext?.groupId !== groupId ||
    checkout.actionContext?.kind !== kind) fail('Confirmation PawaPay requise.', 403);
  return withCommerceOperation(`sponsor:${groupId}`, async session => {
    const orders = await groupOrders(groupId, session);
    if (!orders.length || orders.some(order => String(order.sponsoredPayment[actorField(kind)]) !== String(userId))) {
      fail('Demande introuvable.', 404);
    }
    if (orders.every(order => order.paymentCheckoutId === checkout.checkoutId && order.sponsoredPayment.status === paidStatus(kind))) {
      return { orders, changed: false };
    }
    if (orders.some(order => Number(order.paidAmount) > 0 ||
      (order.sponsoredPayment.checkoutId && order.sponsoredPayment.checkoutId !== checkout.checkoutId))) {
      fail('Cette demande possède déjà un autre paiement.');
    }
    const snapshot = checkout.sponsorshipSnapshot;
    const option = snapshot?.paymentOption || checkout.actionContext?.paymentOption || 'full';
    const pricing = sponsorshipAmounts(orders, option);
    if (Math.abs(Number(checkout.amount) - pricing.amount) > 0.01) fail('Le montant confirmé par PawaPay est invalide.', 400);
    if (snapshot && (snapshot.kind !== kind || String(snapshot.countryId) !== String(checkout.countryId) ||
      snapshot.currency !== checkout.currency || snapshot.orders.length !== orders.length || orders.some(order =>
        !snapshot.orders.some(entry => entry.orderId === String(order._id) && entry.totalAmount === order.totalAmount && entry.paidAmount === pricing.allocations.get(String(order._id)))))) {
      fail('La demande a changé depuis le début du paiement.');
    }
    for (const order of orders) {
      // A reserved payment remains payable even if its original expiry passes.
      if (!statesFor(kind).includes(order.sponsoredPayment.status) &&
        !(snapshot && order.sponsoredPayment.checkoutId === checkout.checkoutId)) fail('Cette demande a été annulée ou modifiée.');
      const paid = pricing.allocations.get(String(order._id));
      order.status = paid >= order.totalAmount ? 'paid' : 'pending';
      order.cancelledAt = undefined;
      order.cancelledBy = undefined;
      order.cancellationReason = '';
      order.paymentSource = 'pawapay';
      order.paymentName = 'PawaPay';
      order.paymentCheckoutId = checkout.checkoutId;
      order.paymentTransactionCode = checkout.checkoutId;
      order.paymentDepositId = checkout.depositId || '';
      order.paidAmount = paid;
      order.remainingAmount = Math.max(0, order.totalAmount - paid);
      order.paymentStatus = paid >= order.totalAmount ? 'PAID_FULL' : 'PARTIAL';
      order.paymentCompletedAt = paid >= order.totalAmount ? new Date() : null;
      order.sponsoredPayment.status = paidStatus(kind);
      order.sponsoredPayment.checkoutId = checkout.checkoutId;
      order.sponsoredPayment.paidBy = userId;
      order.sponsoredPayment.respondedAt = new Date();
      await order.save({ session });
    }
    return { orders, changed: true };
  });
};
