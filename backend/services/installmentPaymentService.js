import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import Checkout from '../models/pawapayCheckoutModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import Cart from '../models/cartModel.js';
import City from '../models/cityModel.js';
import Commune from '../models/communeModel.js';
import { isFeatureEnabled } from './configService.js';
import { resolveCountryContext } from './countryService.js';
import { withCommerceOperation } from './commerceOperationService.js';
import { getWholesalePricing } from '../utils/wholesaleUtils.js';
import { resolveSelectedAttributesPrice, resolveSelectedAttributesImage, validateSelectedAttributesForProduct } from '../utils/productAttributes.js';
import { generateInstallmentSchedule, isProductInstallmentActive, getRiskLevelByScore } from '../utils/installmentUtils.js';
import { calculateInstallmentEligibilityScore } from './installmentEligibilityService.js';
import { getVerifiedProductIds } from '../utils/publicProductVisibility.js';
import { isRestricted } from '../utils/restrictionCheck.js';
import { resolveDeliveryPricing } from '../utils/deliveryPricing.js';
import { installmentIsClosed, installmentRefundBlocksPayment, syncInstallmentAmounts, calculateInstallmentPenalty, forwardPenaltyToNextInstallment, isScheduleEntrySettled } from './installmentPolicyService.js';

export const installmentError = (message, status = 409) => Object.assign(new Error(message), { status, statusCode: status });
const fail = (message, status) => { throw installmentError(message, status); };
const validId = value => mongoose.isValidObjectId(value);
export const installmentOrderKey = id => `installment-order:${id}`;
const pendingCheckout = { $or: [
  { status: { $in: ['CREATED', 'WAITING_PAYMENT', 'PROCESSING'] } },
  { paymentState: 'CONFIRMED', autoValidationState: { $ne: 'COMPLETED' } }
] };
const money = value => Math.round(Number(value || 0));

export const assertInstallmentFeature = async (user, countryId, context = {}) => {
  const access = await isFeatureEnabled('enable_installments', { ...context, userId: user._id,
    countryId, role: user.role, accountType: user.accountType, city: user.city });
  if (!access.enabled) fail('Le paiement par tranche est désactivé pour les nouveaux achats.', 403);
};

export const quoteNewInstallment = async ({ userId, action, amount, session = null, confirmed = false, featureContext = {} }) => {
  if (!validId(action.productId) || !Number.isSafeInteger(Number(action.quantity ?? 1)) || Number(action.quantity ?? 1) < 1) fail('Produit ou quantité invalide.', 400);
  const user = await User.findById(userId).session(session);
  if (!user || user.isBlocked || user.isActive === false || isRestricted(user, 'canOrder')) fail('Ce compte ne peut pas commander.', 403);
  const product = await Product.findById(action.productId).populate('user', 'shopName name slug accountType shopAddress phone city commune freeDeliveryEnabled').session(session);
  if (!product || product.status !== 'approved' || !(await getVerifiedProductIds()).some(id => String(id) === String(product._id))) fail('Produit indisponible.', 404);
  const country = await resolveCountryContext({ resourceCountryId: product.countryId, user, historical: confirmed });
  if ((product.currency || country.currency.code) !== 'XAF') fail('Le paiement par tranche nécessite des montants en FCFA XAF.', 400);
  if (!confirmed) {
    await assertInstallmentFeature(user, country.countryId, featureContext);
    if (!isProductInstallmentActive(product)) fail('Le paiement par tranche n’est pas disponible pour ce produit.', 400);
  }
  const attrs = validateSelectedAttributesForProduct({ productAttributes: product.attributes, selectedAttributes: action.selectedAttributes });
  if (!attrs.valid) fail(attrs.message, 400);
  const qty = Number(action.quantity ?? 1);
  const variant = resolveSelectedAttributesPrice({ productAttributes: product.attributes, selectedAttributes: attrs.selectedAttributes, basePrice: product.price });
  const pricing = variant.applied ? { unitPrice: variant.unitPrice, lineTotal: variant.unitPrice * qty } : getWholesalePricing(product, qty);
  const subtotal = money(pricing.lineTotal);
  if (!Number.isSafeInteger(subtotal) || subtotal < 10) fail('Montant du produit invalide.', 400);
  const mode = String(action.deliveryMode || 'PICKUP').toUpperCase();
  if (!['PICKUP', 'DELIVERY'].includes(mode) || (mode === 'PICKUP' ? product.pickupAvailable === false : product.deliveryAvailable === false)) fail('Ce mode de réception n’est pas disponible pour ce produit.', 400);
  const address = action.shippingAddress || {};
  const phone = String(address.phone || user.phone || '').trim().slice(0, 30);
  let city, commune;
  if (mode === 'DELIVERY') {
    if (!validId(address.cityId) || !validId(address.communeId) || !String(address.addressLine || '').trim() || !phone) fail('Adresse de livraison complète requise.', 400);
    city = await City.findOne({ _id: address.cityId, countryId: country.countryId, isActive: true }).session(session).lean();
    commune = await Commune.findOne({ _id: address.communeId, countryId: country.countryId, cityId: address.cityId, isActive: true }).session(session).lean();
    if (!city || !commune) fail('La ville et la commune doivent appartenir au pays du produit.', 400);
  }
  const delivery = resolveDeliveryPricing({ deliveryMode: mode, commune, shop: product.user, items: [product] });
  const totalAmount = subtotal + money(delivery.deliveryFeeTotal);
  const minimum = Math.min(subtotal, Math.max(10, money(product.installmentMinAmount)));
  const firstPayment = Number(action.firstPaymentAmount ?? minimum);
  if (!Number.isSafeInteger(firstPayment) || firstPayment < minimum || firstPayment > totalAmount || firstPayment > 1000000) fail(`Le premier paiement doit être un montant entier entre ${minimum} et ${Math.min(totalAmount, 1000000)} FCFA.`, 400);
  if (totalAmount - firstPayment > 0 && totalAmount - firstPayment < 10) fail('Réglez le total pour éviter une dernière tranche inférieure à 10 FCFA.', 400);
  if (amount != null && firstPayment !== amount) fail('Le premier versement ne correspond pas au montant demandé.', 400);
  const guarantor = typeof action.guarantor === 'object' && action.guarantor ? action.guarantor : {};
  if (product.installmentRequireGuarantor && ['fullName', 'phone', 'relation', 'address'].some(key => !String(guarantor[key] || '').trim())) fail('Les coordonnées complètes du garant sont requises.', 400);
  const cleanGuarantor = Object.fromEntries(['fullName', 'phone', 'relation', 'nationalId', 'address'].map(key => [key, String(guarantor[key] || '').trim().slice(0, 250)]));
  const image = resolveSelectedAttributesImage({ productAttributes: product.attributes, selectedAttributes: attrs.selectedAttributes, images: product.images });
  const now = new Date();
  const schedule = generateInstallmentSchedule({ remainingAmount: totalAmount - firstPayment, durationDays: Number(product.installmentDuration || 30), firstPaymentDate: now });
  if (schedule.some(entry => entry.amount > 1000000)) fail('Le montant d’une tranche dépasse la limite de paiement.', 400);
  const eligibilityScore = await calculateInstallmentEligibilityScore(userId, session);
  const snapshot = {
    countryId: String(country.countryId), currency: 'XAF', firstPaymentAmount: firstPayment, selectionKey: attrs.selectionKey,
    order: {
      customer: user._id, createdBy: user._id, countryId: country.countryId, currency: 'XAF',
      status: 'pending_installment', paymentType: 'installment', paymentMode: 'INSTALLMENT',
      deliveryMode: mode, deliveryAddress: mode === 'PICKUP' ? 'Retrait en boutique' : String(address.addressLine).trim(),
      deliveryCity: city?.name || user.city || '',
      shippingAddressSnapshot: { cityId: city?._id || null, cityName: city?.name || user.city || '', communeId: commune?._id || null,
        communeName: commune?.name || '', addressLine: mode === 'PICKUP' ? 'Retrait en boutique' : String(address.addressLine).trim(), phone },
      itemsSubtotal: subtotal, totalAmount, deliveryFeeTotal: money(delivery.deliveryFeeTotal), deliveryFeeSource: delivery.deliveryFeeSource,
      items: [{ product: product._id, quantity: qty, unitPrice: money(pricing.unitPrice), lineTotal: subtotal, selectedAttributes: attrs.selectedAttributes,
        snapshot: { title: product.title, price: money(pricing.unitPrice), basePrice: product.price, image: image.image || product.images?.[0] || null,
          shopId: product.user?._id, shopName: product.user?.shopName || product.user?.name || '', shopPhone: product.user?.phone || '',
          shopAddress: product.user?.shopAddress || '', shopCity: product.user?.city || '', shopCommune: product.user?.commune || '',
          deliveryAvailable: product.deliveryAvailable !== false, pickupAvailable: product.pickupAvailable !== false,
          deliveryFee: product.deliveryFee || 0, deliveryFeeEnabled: product.deliveryFeeEnabled !== false,
          wholesaleEnabled: Boolean(product.wholesaleEnabled), wholesaleApplied: Boolean(pricing.tierApplied), wholesaleTierMinQty: pricing.tierApplied?.minQty || 0,
          warrantyEnabled: Boolean(product.warrantyEnabled), warrantyPeriodValue: product.warrantyPeriodValue, warrantyPeriodUnit: product.warrantyPeriodUnit || 'months', slug: product.slug } }],
      installmentPlan: { principalAmount: totalAmount, totalAmount, eligibilityScore, riskLevel: getRiskLevelByScore(eligibilityScore), firstPaymentMinAmount: minimum, schedule: [{ dueDate: now, amount: firstPayment, status: 'pending' }, ...schedule],
        latePenaltyRate: product.installmentLatePenaltyRate || 0, guarantor: { required: Boolean(product.installmentRequireGuarantor), ...cleanGuarantor } }
    }
  };
  return snapshot;
};

// Repair only unsettled, unsubmitted legacy amounts, keeping their indices so
// bookmarks, receipts and callbacks still refer to the same installment.
export const normalizeOpenInstallments = order => {
  const entries = (order.installmentPlan?.schedule || []).filter(entry => ['pending', 'overdue'].includes(entry.status) && !entry.transactionProof?.transactionCode && !entry.paymentCheckoutId);
  if (!entries.some(entry => !Number.isInteger(entry.amount) || entry.amount < 10)) return;
  const total = money(entries.reduce((sum, entry) => sum + entry.amount, 0));
  let left = total;
  entries.forEach((entry, index) => {
    const amount = index === entries.length - 1 ? left : Math.min(left, money(entry.amount));
    entry.amount = amount;
    left -= amount;
  });
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (entry.amount >= 10) continue;
    const target = entries.find(other => other !== entry && other.amount >= 10);
    if (target) { target.amount += entry.amount; entry.amount = 0; entry.status = 'waived'; }
  }
};

export const quoteExistingInstallment = async ({ userId, action, amount, session = null }) => {
  if (!validId(action.orderId) || !Number.isInteger(Number(action.scheduleIndex)) || Number(action.scheduleIndex) < 0) fail('Tranche invalide.', 400);
  const order = await Order.findOne({ _id: action.orderId, customer: userId, paymentType: 'installment', isDraft: { $ne: true } }).session(session);
  if (!order) fail('Commande introuvable.', 404);
  if (installmentIsClosed(order) || installmentRefundBlocksPayment(order)) fail('Cette commande ne peut plus recevoir de paiement.');
  if (!order.installmentPlan?.saleConfirmationConfirmedAt) fail('Attendez la confirmation de vente du vendeur.');
  normalizeOpenInstallments(order);
  const index = Number(action.scheduleIndex);
  const entry = order.installmentPlan.schedule[index];
  if (!entry || !['pending', 'overdue'].includes(entry.status)) fail('Cette tranche est déjà payée ou en cours de validation.');
  if (order.installmentPlan.schedule.some((previous, i) => i < index && !isScheduleEntrySettled(previous))) fail('Réglez la tranche précédente avant de continuer.');
  const due = Number(entry.amount);
  if (!Number.isSafeInteger(due) || due < 10 || due > 1000000 || (amount != null && amount !== due) || (action.amount != null && Number(action.amount) !== due)) fail('Le montant de la tranche a changé. Actualisez la commande.', 400);
  if (order.currency !== 'XAF') fail('Devise de la commande invalide.', 400);
  return { order, countryId: String(order.countryId), currency: order.currency, amount: due, scheduleIndex: index };
};

export const quoteInstallmentCheckout = args => args.action.kind === 'INSTALLMENT_CHECKOUT' ? quoteNewInstallment(args) : quoteExistingInstallment(args);

export const reserveInstallmentCheckout = async (data, featureContext = {}) => {
  const action = data.actionContext;
  const initial = action.kind === 'INSTALLMENT_CHECKOUT';
  const key = initial ? `installment-cart:${data.user}:${action.productId}` : installmentOrderKey(action.orderId);
  return withCommerceOperation(key, async session => {
    const reservationKey = initial ? key : `${key}:${Number(action.scheduleIndex)}`;
    const existing = await Checkout.findOne({ installmentReservationKey: reservationKey, ...pendingCheckout }).select('+requestFingerprint').session(session);
    if (existing) {
      if (String(existing.user) !== String(data.user)) fail('Ce paiement appartient à un autre client.', 403);
      if (existing.amount !== data.amount || existing.requestFingerprint && existing.requestFingerprint !== data.requestFingerprint) fail('Un paiement est déjà en cours. Reprenez cette tentative.');
      return { checkout: existing, reused: true };
    }
    const quote = await quoteInstallmentCheckout({ userId: data.user, action, amount: data.amount, session, featureContext });
    if (String(quote.countryId) !== String(data.countryId) || quote.currency !== data.currency) fail('Pays ou devise du paiement invalide.', 400);
    const snapshot = initial ? quote : { countryId: quote.countryId, currency: quote.currency, orderId: String(quote.order._id), scheduleIndex: quote.scheduleIndex, amount: quote.amount };
    const [checkout] = await Checkout.create([{ ...data, installmentSnapshot: snapshot, installmentReservationKey: reservationKey }], { session });
    if (!initial) {
      quote.order.installmentPlan.schedule[quote.scheduleIndex].paymentCheckoutId = checkout.checkoutId;
      await quote.order.save({ session });
    }
    return { checkout, reused: false };
  });
};

export const recordInstallmentReceipt = (order, checkout, index, allocatedAmount) => {
  if (!order.installmentPayments) order.installmentPayments = [];
  if (order.installmentPayments.some(receipt => receipt.checkoutId === checkout.checkoutId)) return false;
  order.installmentPayments.push({ checkoutId: checkout.checkoutId, depositId: checkout.depositId || '', amount: checkout.amount,
    allocatedAmount, scheduleIndex: index, receivedAt: checkout.confirmedAt || new Date() });
  order.paymentSource = 'pawapay';
  return true;
};

export const importLegacyInstallmentReceipts = async (order, session = null) => {
  for (const [index, entry] of (order.installmentPlan?.schedule || []).entries()) {
    if (entry.status !== 'paid') continue;
    const reference = entry.transactionProof?.paymentMethod === 'pawapay' ? entry.transactionProof.transactionCode
      : index === 0 && order.paymentSource === 'pawapay' ? order.paymentCheckoutId || order.paymentTransactionCode : '';
    if (!reference || order.installmentPayments.some(receipt => receipt.checkoutId === reference)) continue;
    const checkout = await Checkout.findOne({ checkoutId: reference, user: order.customer, paymentState: 'CONFIRMED' }).session(session);
    if (checkout) recordInstallmentReceipt(order, checkout, index, Number(entry.transactionProof?.amount || entry.amount));
  }
};

export const settleInstallmentEntry = (order, index, actorId, now = new Date()) => {
  const entry = order.installmentPlan.schedule[index];
  if (!entry || isScheduleEntrySettled(entry)) fail('Cette tranche est déjà finalisée.');
  const penalty = calculateInstallmentPenalty({ order, scheduleEntry: entry, now });
  entry.status = 'paid';
  entry.validatedBy = actorId;
  entry.validatedAt = now;
  entry.paidAt = entry.transactionProof?.submittedAt || now;
  entry.penaltyAmount = penalty;
  entry.paymentCheckoutId = '';
  entry.overdueAt = null;
  if (penalty) forwardPenaltyToNextInstallment({ schedule: order.installmentPlan.schedule, fromIndex: index, penalty, now });
  order.installmentPlan.totalPenaltyAccrued = money(Number(order.installmentPlan.totalPenaltyAccrued || 0) + penalty);
  syncInstallmentAmounts(order);
  return { penalty, baseAmount: entry.amount };
};

const assertConfirmed = (checkout, userId, kind) => {
  if (!checkout?.checkoutId || checkout.status !== 'COMPLETED' || checkout.paymentState !== 'CONFIRMED' ||
    String(checkout.user) !== String(userId) || checkout.actionContext?.kind !== kind) fail('Confirmation PawaPay requise.', 403);
};

export const completeInstallmentCheckout = async ({ checkout, userId, action, manualProof = null }) => {
  if (checkout) assertConfirmed(checkout, userId, 'INSTALLMENT_CHECKOUT');
  const key = checkout ? `checkout:${checkout.checkoutId}` : `installment-proof:${manualProof.transactionCode}`;
  return withCommerceOperation(key, async (session, operation) => {
    const existing = await Order.findOne({ customer: userId, paymentType: 'installment', paymentTransactionCode: checkout?.checkoutId || manualProof.transactionCode }).session(session);
    if (existing) {
      if (checkout) {
        await importLegacyInstallmentReceipts(existing, session);
        if (existing.isModified('installmentPayments')) await existing.save({ session });
      }
      return { order: existing, created: false };
    }
    if (operation.orderIds.length) fail('Cette opération nécessite une vérification.');
    const snapshot = checkout?.installmentSnapshot || await quoteNewInstallment({ userId, action, amount: checkout?.amount, session, confirmed: Boolean(checkout) });
    if (checkout && (snapshot.firstPaymentAmount !== checkout.amount || snapshot.currency !== checkout.currency || String(snapshot.countryId) !== String(checkout.countryId))) fail('Le montant confirmé ne correspond pas au devis.');
    const order = new Order({ ...snapshot.order, paymentName: checkout ? 'PawaPay' : manualProof.senderName,
      paymentSource: checkout ? 'pawapay' : 'mobile_money', paymentTransactionCode: checkout?.checkoutId || manualProof.transactionCode,
      paymentCheckoutId: checkout?.checkoutId || '', paymentDepositId: checkout?.depositId || '', deliveryCode: String(crypto.randomInt(100000, 1000000)) });
    const entry = order.installmentPlan.schedule[0];
    const now = checkout?.confirmedAt || new Date();
    // Repayment dates begin with the actual initial payment, not checkout opening.
    const shift = now.getTime() - new Date(entry.dueDate).getTime();
    order.installmentPlan.schedule.forEach(item => { item.dueDate = new Date(new Date(item.dueDate).getTime() + shift); });
    entry.status = checkout ? 'paid' : 'proof_uploaded';
    entry.transactionProof = { ...(manualProof || {}), senderName: checkout ? 'PawaPay' : manualProof.senderName,
      transactionCode: checkout?.checkoutId || manualProof.transactionCode, paymentMethod: checkout ? 'pawapay' : 'mobile_money',
      amount: entry.amount, submittedAt: now, submittedBy: userId };
    if (checkout) { entry.paidAt = now; entry.validatedAt = now; recordInstallmentReceipt(order, checkout, 0, entry.amount); }
    await order.save({ session });
    operation.orderIds = [order._id];
    await operation.save({ session });
    await Cart.updateOne({ user: userId }, { $pull: { items: { product: order.items[0].product, selectionKey: snapshot.selectionKey } } }, { session });
    return { order, created: true };
  });
};

export const completeInstallmentPayment = async ({ checkout, userId, action }) => {
  assertConfirmed(checkout, userId, 'INSTALLMENT_PAYMENT');
  return withCommerceOperation(installmentOrderKey(action.orderId), async session => {
    const order = await Order.findOne({ _id: action.orderId, customer: userId, paymentType: 'installment' }).session(session);
    if (!order) fail('Commande introuvable.', 404);
    await importLegacyInstallmentReceipts(order, session);
    if (order.installmentPayments.some(receipt => receipt.checkoutId === checkout.checkoutId)) {
      if (order.isModified('installmentPayments')) await order.save({ session });
      return { order, changed: false };
    }
    const index = Number(action.scheduleIndex);
    const entry = order.installmentPlan?.schedule[index];
    // A callback from before this release may already have updated the schedule.
    if (entry?.status === 'paid' && entry.transactionProof?.transactionCode === checkout.checkoutId) {
      recordInstallmentReceipt(order, checkout, index, checkout.amount);
      await order.save({ session });
      return { order, changed: false };
    }
    const applicable = !installmentIsClosed(order) && !installmentRefundBlocksPayment(order) &&
      order.installmentPlan?.saleConfirmationConfirmedAt && entry && ['pending', 'overdue'].includes(entry.status) &&
      money(entry.amount) === checkout.amount && String(order.countryId) === String(checkout.countryId) && order.currency === checkout.currency &&
      (!entry.paymentCheckoutId || entry.paymentCheckoutId === checkout.checkoutId) &&
      order.installmentPlan.schedule.every((previous, i) => i >= index || isScheduleEntrySettled(previous));
    recordInstallmentReceipt(order, checkout, index, applicable ? checkout.amount : 0);
    if (applicable) {
      entry.transactionProof = { senderName: 'PawaPay', transactionCode: checkout.checkoutId, paymentMethod: 'pawapay', amount: checkout.amount,
        submittedAt: checkout.confirmedAt || new Date(), submittedBy: userId };
      settleInstallmentEntry(order, index, userId);
    } else {
      // Keep cancelled/closed orders closed and return late or duplicate funds.
      order.installmentRefundRequired = true;
      order.refundStatus = 'pending';
    }
    await order.save({ session });
    return { order, changed: true, refundRequired: !applicable };
  });
};

export const assertNoInstallmentPaymentPending = async (order, session = null) => {
  const checkout = await Checkout.findOne({ 'actionContext.kind': 'INSTALLMENT_PAYMENT', 'actionContext.orderId': String(order._id), ...pendingCheckout }).session(session);
  if (checkout) fail('Un paiement est en cours de vérification. Attendez sa confirmation.');
};

export const cancelInstallmentOrder = async ({ orderId, actorId, reason, buyer = false, sellerId = null }) => {
  return withCommerceOperation(installmentOrderKey(orderId), async session => {
    const order = await Order.findById(orderId).session(session);
    if (!order || order.paymentType !== 'installment' || (buyer && String(order.customer) !== String(actorId)) ||
      (sellerId && !order.items.some(item => String(item.snapshot.shopId) === String(sellerId)))) fail('Commande introuvable.', 404);
    if (order.status === 'cancelled' || order.installmentSaleStatus === 'cancelled') return order;
    if (['RELEASED', 'REFUNDED', 'ON_HOLD'].includes(order.escrowStatus) || ['completed', 'delivered', 'delivery_proof_submitted', 'dispute_opened'].includes(order.status) ||
      ['delivering', 'delivered', 'picked_up_confirmed', 'delivery_proof_submitted'].includes(order.installmentSaleStatus)) fail('Cette commande ne peut plus être annulée.');
    if (buyer && (order.cancellationWindowSkippedAt || Date.now() - order.createdAt.getTime() > 30 * 60 * 1000)) fail('Le délai d’annulation est expiré.', 403);
    order.status = 'cancelled';
    order.installmentSaleStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelledBy = actorId;
    order.cancellationReason = reason || 'Vente refusée par le vendeur.';
    if (order.paymentSource === 'pawapay' && order.paidAmount > 0) {
      order.installmentRefundRequired = true;
      order.refundStatus = 'pending';
      order.refundRequestedBy = actorId;
    }
    await order.save({ session });
    return order;
  });
};

export const refreshInstallmentOrder = async id => withCommerceOperation(installmentOrderKey(id), async session => {
  const order = await Order.findById(id).session(session);
  if (!order?.installmentPlan) return;
  const before = JSON.stringify(order.toObject());
  await importLegacyInstallmentReceipts(order, session);
  if (!installmentIsClosed(order) && !(await Checkout.exists({ 'actionContext.orderId': String(id), ...pendingCheckout }).session(session))) {
    for (const entry of order.installmentPlan.schedule) entry.paymentCheckoutId = '';
    normalizeOpenInstallments(order);
  }
  syncInstallmentAmounts(order);
  if (before !== JSON.stringify(order.toObject())) await order.save({ session });
});
