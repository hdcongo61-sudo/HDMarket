// Run only against an explicitly selected disposable local replica set.
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import Order from '../models/orderModel.js';
import Checkout from '../models/pawapayCheckoutModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import City from '../models/cityModel.js';
import Commune from '../models/communeModel.js';
import Refund from '../models/refundModel.js';
import DeliveryRequest from '../models/deliveryRequestModel.js';
import MarketplacePromo from '../models/marketplacePromoCodeModel.js';
import { reconcileCancellationRefunds } from './orderCancellationService.js';
import Settlement from '../models/sellerSettlementModel.js';
import { pawaPayCheckoutOrder, userUpdateOrderStatus, adminUpdateOrder, sellerUpdateOrderStatus,
  userUpdateOrderAddress, previewOrderAddress, sellerRecordCashCollection, sellerCancelOrder, sellerUpdateOrderDeliveryFee, sellerSubmitDeliveryProof, clientConfirmDelivery } from '../controllers/orderController.js';
import { createPawaPayCheckout, receivePawaPayCallback, reconcilePendingPawaPayCheckouts } from '../controllers/pawapayController.js';
import { processEscrowAutoReleases } from './escrowService.js';
import { assertSellerCanSubmitDeliveryProof } from './orderStatusFlowService.js';
import * as provider from './pawapayService.js';
import * as payments from './paymentService.js';
import * as config from './configService.js';
import * as promos from '../utils/marketplacePromoCodeService.js';

const ids = vi.hoisted(() => ({ country: 'cccccccccccccccccccccccc', buyer: 'bbbbbbbbbbbbbbbbbbbbbbbb', seller: 'aaaaaaaaaaaaaaaaaaaaaaaa', product: '111111111111111111111111' }));
vi.mock('./countryService.js', async original => ({ ...await original(), ensureDefaultCountry: vi.fn(async () => ({ _id: ids.country, currency: { code: 'XAF' } })) }));
vi.mock('./configService.js', () => ({ getRuntimeConfig: vi.fn(), getManyRuntimeConfigs: vi.fn(async () => ({})), isFeatureEnabled: vi.fn(async () => ({ enabled: true })) }));
vi.mock('../utils/cloudinaryUploader.js', () => ({ isCloudinaryConfigured: vi.fn(() => false), uploadToCloudinary: vi.fn() }));
vi.mock('./paymentService.js', async original => ({ ...await original(), resolvePaymentProvider: vi.fn() }));
vi.mock('./pawapayService.js', async original => ({ ...await original(), initiatePawaPayCheckout: vi.fn(), getPawaPayCheckoutStatus: vi.fn(), initiatePawaPayRefund: vi.fn(), getPawaPayRefundStatus: vi.fn(), initiatePawaPayPayout: vi.fn() }));
vi.mock('../utils/notificationService.js', async original => ({ ...await original(), createNotification: vi.fn(async () => {}) }));
vi.mock('../utils/twilioMessaging.js', () => ({ isTwilioMessagingConfigured: vi.fn(() => false), sendSms: vi.fn() }));
vi.mock('../utils/dispatchSideEffect.js', () => ({ dispatchSideEffect: vi.fn(async () => {}) }));
vi.mock('./orderReviewReminderService.js', async original => ({ ...await original(), scheduleOrderReviewReminder: vi.fn(async () => {}), cancelOrderReviewReminder: vi.fn(async () => {}) }));
vi.mock('./socialCommerce/attributionService.js', () => ({ resolveAttributionForOrder: vi.fn(async () => ({})) }));
vi.mock('./bundleService.js', () => ({ applyBundleDiscountsForSellers: vi.fn(async () => {}) }));
vi.mock('../utils/marketplacePromoCodeService.js', async original => ({ ...await original(), consumeMarketplacePromoForOrder: vi.fn(async () => ({ applied: false })) }));

const oid = value => new mongoose.Types.ObjectId(value);
const invoke = async (handler, req) => {
  const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  let error;
  await handler({ headers: {}, body: {}, ...req }, res, value => { error = value; });
  if (error) return { statusCode: error.status || error.statusCode || 500, body: { message: error.message } };
  return res;
};
const seedProduct = async (extra = {}) => {
  const product = { _id: oid(ids.product), user: oid(ids.seller), countryId: oid(ids.country), currency: 'XAF', title: 'Audit order', slug: 'audit-order', price: 10000,
    status: 'approved', listingFeeSettled: true, images: [], attributes: [], deliveryAvailable: true, pickupAvailable: true, deliveryFeeEnabled: false, ...extra };
  await Product.collection.insertOne(product);
  return product;
};
const action = () => ({ kind: 'ORDER_CHECKOUT', deliveryMode: 'PICKUP', paymentPercent: 100, items: [{ productId: ids.product, quantity: 1 }] });
const seedCheckout = extra => Checkout.create({ checkoutId: crypto.randomUUID(), user: ids.buyer, countryId: ids.country, currency: 'XAF', amount: 10000,
  status: 'COMPLETED', paymentState: 'CONFIRMED', depositId: crypto.randomUUID(), purpose: 'CHECKOUT_FUNDING', actionContext: action(), autoValidationState: 'PENDING', ...extra });
const finish = checkout => invoke(pawaPayCheckoutOrder, { user: { _id: ids.buyer }, body: checkout.actionContext, pawaPayCheckout: checkout });
const callback = checkout => invoke(receivePawaPayCallback('checkout'), { body: { checkoutId: checkout.checkoutId, status: 'COMPLETED', amount: String(checkout.amount), currency: checkout.currency } });
const start = (context = action(), amount = 10000) => invoke(createPawaPayCheckout, { user: { _id: ids.buyer }, headers: { 'idempotency-key': crypto.randomUUID() },
  body: { amount, purpose: 'CHECKOUT_FUNDING', actionContext: context } });
const paidOrder = async (extra = {}) => {
  await seedProduct();
  expect((await finish(await seedCheckout())).statusCode).toBe(201);
  const order = await Order.findOne({});
  Object.assign(order, extra);
  await order.save();
  return order;
};
const seller = { _id: ids.seller, accountType: 'shop' };
const admin = { id: ids.seller, _id: ids.seller, role: 'admin' };
const uri = process.env.ORDER_PROCESS_MONGO_URI;
describe.skipIf(!uri)('order process safety regressions', () => {
  beforeAll(async () => {
    if (uri !== 'mongodb://127.0.0.1:28764/hdmarket_order_process_test') throw new Error('Only disposable audit database allowed');
    await mongoose.connect(uri, { autoIndex: false });
    await Checkout.collection.createIndex({ checkoutId: 1 }, { unique: true });
    await Refund.collection.createIndex({ refundId: 1 }, { unique: true });
  });
  afterAll(async () => { if (mongoose.connection.readyState) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } });
  beforeEach(async () => {
    vi.clearAllMocks();
    await Promise.all(Object.values(mongoose.connection.collections).map(collection => collection.deleteMany({})));
    await User.collection.insertMany([
      { _id: oid(ids.buyer), name: 'Client', phone: '+242060000001', city: 'Brazzaville', countryId: oid(ids.country), isActive: true },
      { _id: oid(ids.seller), name: 'Boutique', slug: 'boutique', accountType: 'shop', isActive: true }
    ]);
    config.getRuntimeConfig.mockImplementation(async (key, { fallback } = {}) => fallback);
    payments.resolvePaymentProvider.mockResolvedValue({ currency: 'XAF', countryContext: { iso3: 'COG', countryId: ids.country } });
    provider.initiatePawaPayCheckout.mockResolvedValue({ status: 'ACCEPTED', redirectUrl: 'https://provider.example.invalid/checkout' });
    promos.consumeMarketplacePromoForOrder.mockResolvedValue({ applied: false });
    provider.initiatePawaPayRefund.mockResolvedValue({ status: 'ACCEPTED' });
    provider.getPawaPayRefundStatus.mockResolvedValue({ status: 'NOT_FOUND' });
  });
  afterEach(() => vi.restoreAllMocks());


  const destination = async (country = ids.country, fee = 0) => {
    const city = oid(), commune = oid();
    await City.collection.insertOne({ _id: city, name: 'Pointe-Noire', countryId: oid(country), isActive: true });
    await Commune.collection.insertOne({ _id: commune, name: 'Centre', cityId: city, countryId: oid(country), isActive: true, deliveryFee: fee });
    return { cityId: String(city), communeId: String(commune), addressLine: 'Nouvelle adresse', phone: '+242060000001' };
  };
  const sellerRequest = (order, body = {}) => ({ user: seller, params: { id: String(order._id) }, body });
  const buyerRequest = (order, body = {}) => ({ user: { _id: ids.buyer }, params: { id: String(order._id) }, body });
  const proof = order => invoke(sellerSubmitDeliveryProof, { ...sellerRequest(order, { clientSignatureImage: 'data:image/png;base64,AA==' }),
    files: [{ filename: 'local-test.jpg', originalname: 'local-test.jpg', mimetype: 'image/jpeg', size: 10 }] });

  it('rejects unavailable products before opening a provider payment', async () => {
    expect((await start()).statusCode).toBe(400);
    expect(provider.initiatePawaPayCheckout).not.toHaveBeenCalled();
    expect(await Checkout.countDocuments()).toBe(0);
  });
  it('rejects an incorrect amount before payment', async () => {
    await seedProduct();
    expect((await start(action(), 10)).statusCode).toBe(400);
    expect(provider.initiatePawaPayCheckout).not.toHaveBeenCalled();
  });
  it('reserves one checkout across simultaneous different idempotency keys', async () => {
    await seedProduct();
    const responses = await Promise.all([start(), start()]);
    expect(responses.map(r => r.statusCode).sort()).toEqual([201, 202]);
    expect(new Set(responses.map(r => r.body.checkoutId)).size).toBe(1);
    expect(provider.initiatePawaPayCheckout).toHaveBeenCalledOnce();
    for (const response of responses) await callback(await Checkout.findOne({ checkoutId: response.body.checkoutId }));
    expect(await Order.countDocuments()).toBe(1);
    expect((await start()).statusCode).toBe(201); // An intentional later purchase remains possible.
  });
  it('finalizes the accepted quote even if product price and availability change', async () => {
    await seedProduct();
    const response = await start();
    await Product.updateOne({ _id: ids.product }, { $set: { price: 11000, status: 'rejected' } });
    await callback(await Checkout.findOne({ checkoutId: response.body.checkoutId }));
    expect((await Checkout.findOne({})).autoValidationState).toBe('COMPLETED');
    expect((await Order.findOne({})).totalAmount).toBe(10000);
    expect((await Order.findOne({})).remainingAmount).toBe(0);
  });
  it.each(['ORDER_CHECKOUT', 'ORDER_PAYMENT', 'SPONSORSHIP_ACCEPT', 'SPONSORSHIP_PAY_SELF'])('retries confirmed unfinished %s without another charge', async kind => {
    await seedProduct();
    await seedCheckout({ actionContext: { ...action(), kind }, autoValidationState: 'FAILED', lastProviderStatusCheckAt: new Date(0) });
    expect(await reconcilePendingPawaPayCheckouts()).toBe(1);
    expect(provider.initiatePawaPayCheckout).not.toHaveBeenCalled();
    if (kind === 'ORDER_CHECKOUT') expect(await Order.countDocuments()).toBe(1);
  });
  it.each(['buyer', 'admin', 'seller-status', 'seller-cancel'])('persists a refund for %s cancellation', async role => {
    const order = await paidOrder();
    const controller = role === 'buyer' ? userUpdateOrderStatus : role === 'admin' ? adminUpdateOrder : role === 'seller-cancel' ? sellerCancelOrder : sellerUpdateOrderStatus;
    const response = await invoke(controller, { user: role === 'buyer' ? { _id: ids.buyer } : role === 'admin' ? admin : seller,
      params: { id: String(order._id) }, body: { status: 'cancelled', reason: 'Annulation demandée', cancellationReason: 'Annulation demandée' } });
    expect(response.statusCode, response.body?.message).toBe(200);
    const stored = await Order.findById(order._id);
    expect(stored.status).toBe('cancelled');
    expect(stored.cancellationRefundRequired).toBe(true);
    expect(stored.refundStatus).toBe('pending');
    expect(stored.autoReleaseAt).toBeNull();
    expect(await Refund.countDocuments()).toBe(1);
    expect(provider.initiatePawaPayRefund).toHaveBeenCalledOnce();
  });
  it('retries a durable refund obligation after provider failure', async () => {
    const order = await paidOrder();
    provider.initiatePawaPayRefund.mockRejectedValueOnce(new Error('network unavailable'));
    await invoke(userUpdateOrderStatus, buyerRequest(order, { status: 'cancelled' }));
    expect((await Order.findById(order._id)).cancellationRefundRequired).toBe(true);
    await reconcileCancellationRefunds();
    expect(await Refund.countDocuments()).toBe(1);
    expect((await Order.findById(order._id)).status).toBe('cancelled');
  });
  it.each(['cancelled', 'completed', 'dispute_opened', 'delivery_proof_submitted'])('cannot reopen %s through seller or admin status', async status => {
    const order = await paidOrder({ status, cancellationWindowSkippedAt: new Date() });
    const sellerResponse = await invoke(sellerUpdateOrderStatus, sellerRequest(order, { status: 'confirmed' }));
    expect(sellerResponse.statusCode).toBeGreaterThanOrEqual(400);
    if (status !== 'delivery_proof_submitted') {
      expect((await invoke(adminUpdateOrder, { user: admin, params: { id: String(order._id) }, body: { status: 'confirmed' } })).statusCode).toBe(409);
    }
    expect((await Order.findById(order._id)).status).toBe(status);
  });
  it.each(['cancelled', 'dispute_opened'])('does not release an old timer for %s', async status => {
    await paidOrder({ status, escrowStatus: 'WAITING_BUYER_CONFIRMATION', autoReleaseAt: new Date(0) });
    expect((await processEscrowAutoReleases()).released).toBe(0);
    expect(await Settlement.countDocuments()).toBe(0);
  });
  it('rejects a stale seller document after atomic cancellation', async () => {
    const order = await paidOrder();
    const stale = await Order.findById(order._id);
    await invoke(userUpdateOrderStatus, buyerRequest(order, { status: 'cancelled' }));
    stale.status = 'confirmed';
    await expect(stale.save()).rejects.toMatchObject({ status: 409 });
    expect((await Order.findById(order._id)).status).toBe('cancelled');
  });
  it.each([true, false])('locks offered delivery for new and legacy waiver fields (%s)', async modern => {
    const order = await paidOrder({ deliveryMode: 'DELIVERY', ...(modern ? {} : { deliveryFeeWaiverReason: '' }) });
    expect(order.deliveryFeeLocked).toBe(true);
    const result = await invoke(sellerUpdateOrderDeliveryFee, sellerRequest(order, { deliveryFeeTotal: 1500 }));
    expect(result.statusCode).toBe(403);
    expect((await Order.findById(order._id)).totalAmount).toBe(10000);
  });
  it.each(['PICKUP', 'DELIVERY'])('rejects unavailable %s independently of free delivery', async mode => {
    await seedProduct({ [mode === 'PICKUP' ? 'pickupAvailable' : 'deliveryAvailable']: false });
    const shippingAddress = mode === 'DELIVERY' ? await destination() : undefined;
    expect((await start({ ...action(), deliveryMode: mode, shippingAddress })).statusCode).toBe(400);
    expect(provider.initiatePawaPayCheckout).not.toHaveBeenCalled();
  });
  it('rejects a destination from another country before charging', async () => {
    await seedProduct();
    const shippingAddress = await destination(String(oid()));
    expect((await start({ ...action(), deliveryMode: 'DELIVERY', shippingAddress })).statusCode).toBe(400);
    expect(provider.initiatePawaPayCheckout).not.toHaveBeenCalled();
  });
  it('conserves a one-FCFA promotion across three order lines', async () => {
    const productIds = [ids.product, String(oid()), String(oid())];
    for (const id of productIds) await seedProduct({ _id: oid(id), slug: 'price-' + id });
    promos.consumeMarketplacePromoForOrder.mockResolvedValue({ applied: true, promo: { _id: oid() }, pricing: { finalAmount: 29999, discountAmount: 1 } });
    const checkout = await seedCheckout({ amount: 29999, actionContext: { ...action(), items: productIds.map(productId => ({ productId, quantity: 1 })), promoEntries: [{ sellerId: ids.seller, promoCode: 'SAVE1' }] } });
    expect((await finish(checkout)).statusCode).toBe(201);
    const order = await Order.findOne({});
    expect(order.items.reduce((sum, item) => sum + item.lineTotal, 0)).toBe(29999);
    expect(order.totalAmount).toBe(29999);
    expect(order.remainingAmount).toBe(0);
    expect(order.paymentStatus).toBe('PAID_FULL');
    expect(order.appliedPromoCode.code).toBe('SAVE1');
  });
  it('blocks early proof, then accepts proof after normal delivery steps', async () => {
    const order = await paidOrder({ deliveryMode: 'DELIVERY' });
    expect((await proof(order)).statusCode).toBe(403);
    expect((await Order.findById(order._id)).escrowStatus).toBe('IN_ESCROW');
    await Order.updateOne({ _id: order._id }, { $set: { cancellationWindowSkippedAt: new Date() } });
    expect((await proof(order)).statusCode).toBe(400);
    for (const status of ['confirmed', 'ready_for_delivery', 'delivering']) {
      const response = await invoke(sellerUpdateOrderStatus, sellerRequest(order, { status }));
      expect(response.statusCode, response.body?.message).toBe(200);
    }
    const response = await proof(order);
    expect(response.statusCode, response.body?.message).toBe(200);
    expect((await Order.findById(order._id)).escrowStatus).toBe('WAITING_BUYER_CONFIRMATION');
  });
  it('updates structured delivery data after the buyer reviews the quote', async () => {
    const order = await paidOrder({ deliveryMode: 'DELIVERY' });
    const shippingAddress = await destination();
    const quote = await invoke(previewOrderAddress, buyerRequest(order, { shippingAddress }));
    expect(quote.statusCode, quote.body?.message).toBe(200);
    expect((await invoke(userUpdateOrderAddress, buyerRequest(order, { shippingAddress }))).statusCode).toBe(409);
    const response = await invoke(userUpdateOrderAddress, buyerRequest(order, { shippingAddress, expectedDeliveryFee: quote.body.deliveryFeeTotal, expectedTotalAmount: quote.body.totalAmount }));
    expect(response.statusCode, response.body?.message).toBe(200);
    const stored = await Order.findById(order._id);
    expect(stored.shippingAddressSnapshot.addressLine).toBe(shippingAddress.addressLine);
    expect(stored.shippingAddressSnapshot.cityName).toBe(stored.deliveryCity);
    expect(stored.deliveryAddress).toBe(shippingAddress.addressLine);
    expect(stored.totalAmount).toBe(10000);
  });
  it('rejects ambiguous legacy address changes', async () => {
    const order = await paidOrder({ deliveryMode: 'DELIVERY' });
    expect((await invoke(userUpdateOrderAddress, buyerRequest(order, { deliveryAddress: 'New address', deliveryCity: 'Pointe-Noire' }))).statusCode).toBe(400);
  });
  it('synchronizes a pending delivery request on an address correction', async () => {
    const shippingAddress = await destination();
    const order = await paidOrder({ deliveryMode: 'DELIVERY', shippingAddressSnapshot: { ...shippingAddress, cityName: 'Pointe-Noire' } });
    await DeliveryRequest.collection.insertOne({ orderId: order._id, sellerId: oid(ids.seller), buyerId: oid(ids.buyer), shopId: oid(ids.seller), status: 'PENDING', assignmentStatus: 'PENDING', updatedAt: new Date(), dropoff: { address: 'Old address' } });
    const response = await invoke(userUpdateOrderAddress, buyerRequest(order, { shippingAddress: { ...shippingAddress, addressLine: 'Corrected address' }, expectedDeliveryFee: 0, expectedTotalAmount: 10000 }));
    expect(response.statusCode, response.body?.message).toBe(200);
    expect((await DeliveryRequest.findOne({})).dropoff.address).toBe('Corrected address');
  });
  it('records cash once without increasing PawaPay escrow or seller payout', async () => {
    const order = await paidOrder({ paidAmount: 5000, deliveryMode: 'DELIVERY', status: 'delivery_proof_submitted', deliveryProofImages: [{ url: '/local-test.jpg' }],
      clientSignatureImage: 'data:image/png;base64,AA==', deliveryDate: new Date() });
    const confirm = await invoke(clientConfirmDelivery, buyerRequest(order, { confirm: true }));
    expect(confirm.statusCode, confirm.body?.message).toBe(200);
    expect((await Order.findById(order._id)).remainingAmount).toBe(5000); // Delivery alone is not a cash receipt.
    const responses = await Promise.all([1, 2].map(() => invoke(sellerRecordCashCollection, sellerRequest(order, { amount: 5000, method: 'CASH' }))));
    expect(responses.map(r => r.statusCode).sort()).toEqual([200, 409]);
    const stored = await Order.findById(order._id);
    expect(stored.paidAmount).toBe(5000);
    expect(stored.cashCollectedAmount).toBe(5000);
    expect(stored.cashCollections).toHaveLength(1);
    expect(String(stored.cashCollections[0].actor)).toBe(ids.seller);
    expect(stored.paymentStatus).toBe('PAID_FULL');
    expect(stored.remainingAmount).toBe(0);
    expect((await Settlement.findOne({})).grossAmount).toBe(5000);
  });
  it('refunds late negotiated payment without reopening a cancelled sale', async () => {
    await seedProduct();
    const order = await Order.create({ customer: ids.buyer, createdBy: ids.buyer, countryId: ids.country, currency: 'XAF', totalAmount: 10000, paidAmount: 0, status: 'pending_payment',
      deliveryMode: 'PICKUP', deliveryAddress: 'Retrait', items: [{ product: ids.product, quantity: 1, unitPrice: 10000, lineTotal: 10000, snapshot: { title: 'Article', shopId: ids.seller } }], quotationSnapshot: { applied: true } });
    const response = await start({ kind: 'ORDER_PAYMENT', orderId: String(order._id), amount: 10000 });
    expect(response.statusCode, response.body?.message).toBe(201);
    expect((await invoke(userUpdateOrderStatus, buyerRequest(order, { status: 'cancelled' }))).statusCode).toBe(200);
    await Checkout.updateOne({ checkoutId: response.body.checkoutId }, { $set: { depositId: crypto.randomUUID() } });
    await callback(await Checkout.findOne({ checkoutId: response.body.checkoutId }));
    const stored = await Order.findById(order._id);
    expect(stored.status).toBe('cancelled');
    expect(stored.cancellationRefundRequired).toBe(true);
    expect(await Refund.countDocuments()).toBe(1);
    expect((await start({ kind: 'ORDER_PAYMENT', orderId: String(order._id), amount: 10000 })).statusCode).toBe(409);
  });
});
