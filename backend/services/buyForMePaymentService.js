import Checkout from '../models/pawapayCheckoutModel.js';
import ShoppingOrder from '../models/buyForMeOrderModel.js';
import User from '../models/userModel.js';
import { quoteBuyForMe } from './buyForMeService.js';
import { withCommerceOperation } from './commerceOperationService.js';
import { isFeatureEnabled } from './configService.js';
import { assertShoppingCountry, shoppingError, shoppingId } from './buyForMeAccessService.js';
import { isRestricted } from '../utils/restrictionCheck.js';

const activeCheckout = checkout => checkout && !['FAILED', 'CANCELLED', 'EXPIRED'].includes(checkout.status);
const paymentUser = async userId => {
  const user = await User.findById(userId).lean();
  if (!user || user.isActive === false || user.isLocked || isRestricted(user, 'canOrder')) throw shoppingError('Ce compte ne peut pas effectuer cet achat.', 403);
  return user;
};

export const quoteShoppingCheckout = async ({ userId, countryId, amount, action, featureContext = {} }) => {
  const user = await paymentUser(userId);
  if (action.kind === 'BUY_FOR_ME_ADDITIONAL_PAYMENT') {
    const order = await ShoppingOrder.findOne({ _id: action.orderId, customerId: userId }).lean();
    if (!order || !order.countryId) throw shoppingError('Demande introuvable ou pays à rapprocher.', 404);
    if (order.status !== 'WAITING_CUSTOMER_APPROVAL' || !['REQUIRED', 'PENDING'].includes(order.additionalPayment?.status) || order.disputeOpen) throw shoppingError('Ce complément ne peut pas être payé.', 409);
    if (order.additionalPayment.amount !== amount) throw shoppingError('Le montant du complément a changé. Actualisez la demande.', 409);
    return { countryId: order.countryId, currency: order.currency, amount };
  }
  const country = await assertShoppingCountry(countryId);
  const access = await isFeatureEnabled('enable_buy_for_me', { ...featureContext, userId, countryId,
    role: user.role, accountType: user.accountType, country: user.country, city: user.city,
    isBetaTester: Boolean(user.betaTester), isDeveloper: ['admin', 'founder'].includes(user.role) });
  if (!access.enabled) throw shoppingError('Cette fonctionnalité n’est pas disponible.', 404);
  const payload = {
    storeType: action.storeType, preferredStore: action.preferredStore, pickup: action.pickup, dropoff: action.dropoff,
    items: action.items, authorizationMode: action.authorizationMode, shoppingBudget: action.shoppingBudget,
    specialInstructions: action.specialInstructions,
    balancePreference: ['DRIVER_TIP', 'PLATFORM_DONATION'].includes(action.balancePreference) ? action.balancePreference : 'ORIGINAL_PAYMENT'
  };
  const quote = await quoteBuyForMe({ ...payload, countryId });
  if (quote.total !== amount) throw shoppingError('Le prix a changé. Actualisez le montant avant de payer.', 409);
  return { countryId, currency: country.currency.code, quote, payload, capturedAt: new Date() };
};

export const reserveShoppingCheckout = async (data, options = {}) => {
  const action = data.actionContext;
  if (action.kind === 'BUY_FOR_ME_ORDER') {
    // Calculated from server configuration, never from a browser-supplied snapshot.
    const snapshot = await quoteShoppingCheckout({ userId: data.user, countryId: data.countryId, amount: data.amount, action, ...options });
    const checkout = await Checkout.create({ ...data, buyForMeSnapshot: snapshot });
    return { checkout, reused: false };
  }
  return withCommerceOperation(`shopping:${action.orderId}`, async session => {
    await paymentUser(data.user);
    const order = await ShoppingOrder.findOne({ _id: action.orderId, customerId: data.user }).session(session);
    if (!order || !order.countryId) throw shoppingError('Demande introuvable.', 404);
    if (order.additionalPayment?.checkoutId) {
      const existing = await Checkout.findOne({ checkoutId: order.additionalPayment.checkoutId }).session(session);
      if (existing && (activeCheckout(existing) || existing.paymentState === 'CONFIRMED' || ['AMOUNT_MISMATCH', 'CURRENCY_MISMATCH'].includes(existing.failureReason?.failureCode))) {
        return { checkout: existing, reused: true };
      }
    }
    if (order.status !== 'WAITING_CUSTOMER_APPROVAL' || order.disputeOpen || !['REQUIRED', 'PENDING'].includes(order.additionalPayment?.status) || order.additionalPayment.amount !== data.amount || shoppingId(order.countryId) !== shoppingId(data.countryId) || order.currency !== data.currency) {
      throw shoppingError('Le complément a changé ou ne peut plus être payé.', 409);
    }
    const [checkout] = await Checkout.create([{ ...data, buyForMeSnapshot: { orderId: String(order._id), amount: data.amount,
      requestedAt: order.additionalPayment.requestedAt, countryId: order.countryId, currency: order.currency } }], { session });
    order.additionalPayment.status = 'PENDING'; order.additionalPayment.checkoutId = checkout.checkoutId;
    await order.save({ session });
    return { checkout, reused: false };
  });
};

export const releaseShoppingCheckout = async checkout => {
  if (checkout?.actionContext?.kind !== 'BUY_FOR_ME_ADDITIONAL_PAYMENT' || checkout.paymentState === 'CONFIRMED' ||
      !['FAILED', 'CANCELLED', 'EXPIRED'].includes(checkout.status) || ['AMOUNT_MISMATCH', 'CURRENCY_MISMATCH'].includes(checkout.failureReason?.failureCode)) return;
  const orderId = checkout.actionContext.orderId;
  await withCommerceOperation(`shopping:${orderId}`, async session => {
    const current = await Checkout.findById(checkout._id).session(session);
    if (current.paymentState === 'CONFIRMED' || !['FAILED', 'CANCELLED', 'EXPIRED'].includes(current.status)) return;
    await ShoppingOrder.updateOne({ _id: orderId, status: 'WAITING_CUSTOMER_APPROVAL', 'additionalPayment.status': 'PENDING', 'additionalPayment.checkoutId': checkout.checkoutId },
      { $set: { 'additionalPayment.status': 'REQUIRED' }, $inc: { __v: 1 } }, { session });
  });
};
