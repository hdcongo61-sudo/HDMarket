// Opt in with INSTALLMENT_TEST_MONGO_URI pointing to a disposable local replica set.
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
import Batch from '../models/installmentRefundBatchModel.js';
import { reconcileRefund, reconcilePendingRefunds } from './refundService.js';
import { refreshInstallmentOrder, quoteNewInstallment, cancelInstallmentOrder } from './installmentPaymentService.js';
import { recoverInstallmentRefundsForOrder } from './installmentRefundService.js';
import { applyDeliveryFeeToOrder } from './orderDeliveryFeeService.js';
import { checkoutInstallmentOrder, uploadInstallmentPaymentProof, sellerConfirmInstallmentSale, sellerValidateInstallmentPayment } from '../controllers/installmentController.js';
import { createPawaPayCheckout, receivePawaPayCallback, reconcilePendingPawaPayCheckouts } from '../controllers/pawapayController.js';
import { processInstallmentReminders } from '../utils/installmentReminder.js';
import { runInstallmentProofValidationSlaSweep } from './orderReliabilityAutomationService.js';
import { invalidateVerifiedProductCache } from '../utils/publicProductVisibility.js';
import { initiateOrderRefund } from './refundService.js';
import { getOrderAllowedActions } from './orderStatusFlowService.js';
import * as provider from './pawapayService.js';
import * as payments from './paymentService.js';
import * as config from './configService.js';
import * as notifications from '../utils/notificationService.js';

const ids = vi.hoisted(() => ({ country: 'cccccccccccccccccccccccc', buyer: 'bbbbbbbbbbbbbbbbbbbbbbbb', seller: 'aaaaaaaaaaaaaaaaaaaaaaaa', product: '111111111111111111111111' }));
vi.mock('./countryService.js', async original => ({ ...await original(), ensureDefaultCountry: vi.fn(async () => ({ _id: ids.country, currency: { code: 'XAF' } })), resolveCountryContext: vi.fn(async ({ resourceCountryId }) => ({ countryId: resourceCountryId || ids.country, currency: { code: 'XAF' } })) }));
vi.mock('./configService.js', () => ({ getRuntimeConfig: vi.fn(), isFeatureEnabled: vi.fn() }));
vi.mock('./paymentService.js', async original => ({ ...await original(), resolvePaymentProvider: vi.fn() }));
vi.mock('./pawapayService.js', async original => ({ ...await original(), getPawaPayConfig: vi.fn(() => ({ exclusiveMode: false })), initiatePawaPayCheckout: vi.fn(), getPawaPayCheckoutStatus: vi.fn(), initiatePawaPayRefund: vi.fn(), getPawaPayRefundStatus: vi.fn() }));
vi.mock('../utils/notificationService.js', async original => ({ ...await original(), createNotification: vi.fn(async () => {}) }));
vi.mock('../utils/deliveryDistanceWarning.js', () => ({ notifyBuyerDeliveryDistanceWarning: vi.fn(async () => {}) }));
vi.mock('./orderReviewReminderService.js', async original => ({ ...await original(), scheduleOrderReviewReminder: vi.fn(async () => {}) }));

const oid = value => new mongoose.Types.ObjectId(value);
const invoke = async (handler, req) => {
  const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  let error;
  await handler(req, res, value => { error = value; });
  if (error) return { statusCode: error.status || error.statusCode || 500, body: { message: error.message } };
  return res;
};
const seedProduct = async extra => {
  await Product.collection.insertOne({ _id: oid(ids.product), user: oid(ids.seller), countryId: oid(ids.country), currency: 'XAF', title: 'Audit installment', slug: 'audit-installment', price: 10000, status: 'approved', listingFeeSettled: true, images: [], attributes: [], deliveryAvailable: true, pickupAvailable: true, deliveryFeeEnabled: false, installmentEnabled: true, installmentMinAmount: 3000, installmentDuration: 30, installmentStartDate: new Date(Date.now() - 86400000), installmentEndDate: new Date(Date.now() + 100 * 86400000), ...extra });
  invalidateVerifiedProductCache();
};
const seedCheckout = extra => Checkout.create({ checkoutId: crypto.randomUUID(), depositId: crypto.randomUUID(), user: ids.buyer, countryId: ids.country, currency: 'XAF', amount: 3000, purpose: 'INSTALLMENT_FUNDING', status: 'COMPLETED', paymentState: 'CONFIRMED', autoValidationState: 'PENDING', actionContext: { kind: 'INSTALLMENT_CHECKOUT', productId: ids.product, quantity: 1, firstPaymentAmount: 3000, deliveryMode: 'PICKUP' }, ...extra });
const finish = checkout => invoke(checkoutInstallmentOrder, { user: { _id: ids.buyer }, body: { ...checkout.actionContext, paymentMethod: 'pawapay' }, pawaPayCheckout: checkout });
const confirm = (id, approve = true) => invoke(sellerConfirmInstallmentSale, { user: { _id: ids.seller }, params: { id: String(id) }, body: { approve } });
const pay = async (order, amount, index = 1) => {
  const checkout = await seedCheckout({ amount, actionContext: { kind: 'INSTALLMENT_PAYMENT', orderId: String(order._id), scheduleIndex: index, amount } });
  return invoke(uploadInstallmentPaymentProof, { user: { _id: ids.buyer }, params: { id: String(order._id), scheduleIndex: String(index) },
    body: { paymentMethod: 'pawapay', amount }, pawaPayCheckout: checkout });
};
const makeActive = async extra => {
  await seedProduct(extra);
  const checkout = await seedCheckout();
  const result = await finish(checkout);
  expect(result.statusCode).toBe(201);
  await confirm(result.body._id);
  return Order.findById(result.body._id);
};
const callback = checkout => invoke(receivePawaPayCallback('checkout'), { body: { checkoutId: checkout.checkoutId, status: 'COMPLETED', amount: String(checkout.amount), currency: 'XAF' } });
const start = (actionContext, amount = 3000) => invoke(createPawaPayCheckout, { user: { _id: ids.buyer }, headers: { 'idempotency-key': crypto.randomUUID() }, body: { amount, purpose: 'INSTALLMENT_FUNDING', actionContext } });


const uri = process.env.INSTALLMENT_TEST_MONGO_URI;
describe.skipIf(!uri)('installment payments, recovery and refunds', () => {
  beforeAll(async () => {
    if (!/^mongodb:\/\/127\.0\.0\.1:\d+\/hdmarket_installment_test_[a-z0-9_]+$/i.test(uri)) throw new Error('Disposable local database required');
    await mongoose.connect(uri, { autoIndex: false });
    await Checkout.collection.createIndex({ checkoutId: 1 }, { unique: true });
    await Refund.collection.createIndex({ refundId: 1 }, { unique: true });
    await Batch.collection.createIndex({ refundId: 1 }, { unique: true });
  });
  afterAll(async () => { if (mongoose.connection.readyState) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } });
  beforeEach(async () => {
    vi.clearAllMocks();
    await Promise.all(Object.values(mongoose.connection.collections).map(collection => collection.deleteMany({})));
    invalidateVerifiedProductCache();
    await User.collection.insertMany([
      { _id: oid(ids.buyer), name: 'Client', phone: '+242060000001', countryId: oid(ids.country), city: 'Brazzaville', isActive: true },
      { _id: oid(ids.seller), name: 'Boutique', slug: 'boutique', accountType: 'shop', isActive: true }
    ]);
    config.getRuntimeConfig.mockImplementation(async (key, { fallback } = {}) => fallback);
    config.isFeatureEnabled.mockResolvedValue({ enabled: true });
    payments.resolvePaymentProvider.mockResolvedValue({ currency: 'XAF', countryContext: { iso3: 'COG', countryId: ids.country } });
    provider.initiatePawaPayCheckout.mockResolvedValue({ status: 'ACCEPTED', redirectUrl: 'https://provider.example.invalid/checkout' });
    provider.initiatePawaPayRefund.mockResolvedValue({ status: 'ACCEPTED' });
    provider.getPawaPayRefundStatus.mockResolvedValue({ status: 'NOT_FOUND' });
    notifications.createNotification.mockResolvedValue({});
  });
  afterEach(() => vi.restoreAllMocks());

  it('rejects missing installment orders before contacting the provider', async () => {
    expect((await start({ kind: 'INSTALLMENT_PAYMENT', orderId: String(oid()), scheduleIndex: 0, amount: 3000 })).statusCode).toBe(404);
    expect(provider.initiatePawaPayCheckout).not.toHaveBeenCalled();
  });
  it('reserves one provider checkout across concurrent different idempotency keys', async () => {
    const order = await makeActive();
    const action = { kind: 'INSTALLMENT_PAYMENT', orderId: String(order._id), scheduleIndex: 1, amount: 7000 };
    const results = await Promise.all([start(action, 7000), start(action, 7000)]);
    expect(results.every(r => r.statusCode < 300)).toBe(true);
    expect(new Set(results.map(r => r.body.checkoutId)).size).toBe(1);
    expect(provider.initiatePawaPayCheckout).toHaveBeenCalledOnce();
  });
  it('opens only one initial payment for the same buyer and product', async () => {
    await seedProduct();
    const action = { kind: 'INSTALLMENT_CHECKOUT', productId: ids.product, quantity: 1, firstPaymentAmount: 3000, deliveryMode: 'PICKUP' };
    const results = await Promise.all([start(action), start(action)]);
    expect(results.every(r => r.statusCode < 300)).toBe(true);
    expect(new Set(results.map(r => r.body.checkoutId)).size).toBe(1);
  });
  it('does not duplicate orders when notification fails or callbacks repeat', async () => {
    await seedProduct();
    const checkout = await seedCheckout({ status: 'PROCESSING', paymentState: 'PENDING' });
    notifications.createNotification.mockRejectedValue(new Error('Notification outage'));
    expect((await callback(checkout)).statusCode).toBe(200);
    await callback(checkout);
    expect(await Order.countDocuments()).toBe(1);
    expect((await Checkout.findById(checkout._id)).autoValidationState).toBe('COMPLETED');
  });
  it('serializes concurrent initial completions', async () => {
    await seedProduct();
    const checkout = await seedCheckout();
    const results = await Promise.all([finish(checkout), finish(checkout), finish(checkout)]);
    expect(results.map(r => r.statusCode).sort()).toEqual([200, 200, 201]);
    expect(await Order.countDocuments()).toBe(1);
  });
  it('recovers a confirmed failed checkout without a user returning', async () => {
    await seedProduct();
    const checkout = await seedCheckout({ autoValidationState: 'FAILED', lastProviderStatusCheckAt: new Date(0) });
    expect(await reconcilePendingPawaPayCheckouts()).toBe(1);
    expect(await Order.countDocuments()).toBe(1);
    expect((await Checkout.findById(checkout._id)).autoValidationState).toBe('COMPLETED');
  });
  it('honors the saved quote when the product price, window and feature change during payment', async () => {
    await seedProduct();
    const result = await start({ kind: 'INSTALLMENT_CHECKOUT', productId: ids.product, quantity: 1, firstPaymentAmount: 3000, deliveryMode: 'PICKUP' });
    expect(result.statusCode).toBe(201);
    await Product.updateOne({ _id: ids.product }, { $set: { price: 20000, installmentEnabled: false } });
    config.isFeatureEnabled.mockResolvedValue({ enabled: false });
    expect((await callback(await Checkout.findOne({ checkoutId: result.body.checkoutId }))).statusCode).toBe(200);
    expect((await Order.findOne({})).totalAmount).toBe(10000);
  });
  it('uses the selected variant price', async () => {
    await seedProduct({ attributes: [{ name: 'Taille', type: 'select', required: true, options: ['S', 'L'], optionPrices: { s: 8000, l: 12000 } }] });
    const checkout = await seedCheckout();
    checkout.actionContext.selectedAttributes = [{ name: 'Taille', value: 'L' }];
    expect((await finish(checkout)).statusCode).toBe(201);
    expect((await Order.findOne({})).totalAmount).toBe(12000);
  });
  it('includes the configured delivery fee and rejects foreign addresses', async () => {
    await seedProduct({ deliveryFeeEnabled: true, deliveryFee: 1500 });
    const city = oid(), commune = oid();
    await City.collection.insertOne({ _id: city, name: 'Brazzaville', countryId: oid(ids.country), isActive: true });
    await Commune.collection.insertOne({ _id: commune, name: 'Centre', cityId: city, countryId: oid(ids.country), isActive: true });
    const action = { kind: 'INSTALLMENT_CHECKOUT', productId: ids.product, quantity: 1, firstPaymentAmount: 3000, deliveryMode: 'DELIVERY',
      shippingAddress: { cityId: String(city), communeId: String(commune), addressLine: 'Adresse', phone: '+242060000001' } };
    const quote = await quoteNewInstallment({ userId: ids.buyer, action, amount: 3000 });
    expect(quote.order.totalAmount).toBe(11500);
    expect(quote.order.deliveryFeeTotal).toBe(1500);
    await City.updateOne({ _id: city }, { $set: { countryId: oid() } });
    await expect(quoteNewInstallment({ userId: ids.buyer, action, amount: 3000 })).rejects.toMatchObject({ status: 400 });
  });
  it.each(['PICKUP', 'DELIVERY'])('rejects forbidden %s before payment', async mode => {
    await seedProduct({ pickupAvailable: false, deliveryAvailable: false });
    expect((await start({ kind: 'INSTALLMENT_CHECKOUT', productId: ids.product, quantity: 1, firstPaymentAmount: 3000, deliveryMode: mode })).statusCode).toBe(400);
    expect(provider.initiatePawaPayCheckout).not.toHaveBeenCalled();
  });
  it('uses exact integer installments and credits every payment', async () => {
    let order = await makeActive({ installmentDuration: 90 });
    expect(order.installmentPlan.schedule.map(e => e.amount)).toEqual([3000, 2333, 2333, 2334]);
    for (let i = 1; i < 4; i++) {
      expect((await pay(order, order.installmentPlan.schedule[i].amount, i)).statusCode).toBe(200);
      order = await Order.findById(order._id);
    }
    expect(order.status).toBe('installment_paid');
    expect(order.paidAmount).toBe(10000);
    expect(order.escrowAmount).toBe(10000);
  });
  it('repairs unpaid historical fractional amounts without changing indices or total', async () => {
    const order = await makeActive({ installmentDuration: 90 });
    await Order.updateOne({ _id: order._id }, { $set: { 'installmentPlan.schedule.1.amount': 2333.33, 'installmentPlan.schedule.2.amount': 2333.33, 'installmentPlan.schedule.3.amount': 2333.34 } });
    await refreshInstallmentOrder(order._id);
    const stored = await Order.findById(order._id);
    expect(stored.installmentPlan.schedule.map(e => e.amount)).toEqual([3000, 2333, 2333, 2334]);
  });
  it('refunds all deposits and keeps the order pending until every portion completes', async () => {
    const order = await makeActive();
    await pay(order, 7000);
    const stored = await Order.findById(order._id);
    expect(stored.escrowAmount).toBe(10000);
    const batch = await initiateOrderRefund({ order: stored, requestedBy: ids.seller, amount: 10000, source: 'ADMIN' });
    const refunds = await Refund.find({ installmentBatchId: batch.refundId }).sort({ amount: 1 });
    expect(refunds.map(r => r.amount)).toEqual([3000, 7000]);
    expect(new Set(refunds.map(r => r.depositId)).size).toBe(2);
    await reconcileRefund(refunds[0].refundId, { status: 'COMPLETED', amount: '3000', currency: 'XAF' });
    expect((await Order.findById(order._id)).refundStatus).toBe('pending');
    await reconcileRefund(refunds[1].refundId, { status: 'COMPLETED', amount: '7000', currency: 'XAF' });
    expect((await Order.findById(order._id)).refundStatus).toBe('processed');
    expect((await Order.findById(order._id)).escrowStatus).toBe('REFUNDED');
  });
  it('queues a durable refund when the seller refuses a paid order', async () => {
    await seedProduct();
    const initial = await finish(await seedCheckout());
    expect((await confirm(initial.body._id, false)).statusCode).toBe(200);
    const order = await Order.findById(initial.body._id);
    expect(order.status).toBe('cancelled');
    expect(order.refundStatus).toBe('pending');
    expect(await Refund.countDocuments()).toBe(1);
    expect(provider.initiatePawaPayRefund).toHaveBeenCalledOnce();
  });
  it('keeps a cancelled order closed and refunds a late confirmed payment', async () => {
    const order = await makeActive();
    await confirm(order._id, false);
    const first = await Refund.findOne({});
    await reconcileRefund(first.refundId, { status: 'COMPLETED', amount: '3000', currency: 'XAF' });
    expect((await pay(order, 7000)).statusCode).toBe(200);
    expect((await Order.findById(order._id)).status).toBe('cancelled');
    expect((await Refund.find({})).map(r => r.amount).sort()).toEqual([3000, 7000]);
  });
  it('refunds a duplicate historical payment instead of leaving it uncredited', async () => {
    const order = await makeActive();
    await pay(order, 7000);
    await pay(order, 7000);
    const stored = await Order.findById(order._id);
    expect(stored.installmentPlan.amountPaid).toBe(10000);
    expect(stored.paidAmount).toBe(17000);
    expect((await Refund.findOne({})).amount).toBe(7000);
  });
  it('retains submitted manual proofs past their due date and charges no seller-delay penalty', async () => {
    const order = await makeActive({ installmentLatePenaltyRate: 10 });
    order.installmentPlan.schedule[1].dueDate = new Date(Date.now() - 2 * 86400000);
    order.installmentPlan.schedule[1].status = 'proof_uploaded';
    order.installmentPlan.schedule[1].transactionProof = { senderName: 'Client', transactionCode: '1234567890', amount: 7000,
      submittedAt: new Date(Date.now() - 3 * 86400000), paymentMethod: 'mobile_money' };
    await order.save();
    await processInstallmentReminders();
    expect((await Order.findById(order._id)).installmentPlan.schedule[1].status).toBe('proof_uploaded');
    const result = await invoke(sellerValidateInstallmentPayment, { user: { _id: ids.seller }, params: { id: String(order._id), scheduleIndex: '1' }, body: { approve: true } });
    expect(result.statusCode).toBe(200);
    expect((await Order.findById(order._id)).installmentPlan.totalPenaltyAccrued).toBe(0);
  });
  it('continues the original schedule after refunding an extra payment', async () => {
    const order = await makeActive({ installmentDuration: 90 });
    await pay(order, 2333, 1);
    await pay(order, 2333, 1);
    const refund = await Refund.findOne({});
    await reconcileRefund(refund.refundId, { status: 'COMPLETED', amount: '2333', currency: 'XAF' });
    const next = await start({ kind: 'INSTALLMENT_PAYMENT', orderId: String(order._id), scheduleIndex: 2, amount: 2333 }, 2333);
    expect(next.statusCode).toBe(201);
    await callback(await Checkout.findOne({ checkoutId: next.body.checkoutId }));
    const stored = await Order.findById(order._id);
    expect(stored.installmentPlan.schedule[2].status).toBe('paid');
    expect(stored.remainingAmount).toBe(2334);
    expect(await Refund.countDocuments()).toBe(1);
  });
  it('restores legacy overdue proofs to the seller-review and escalation queue', async () => {
    const order = await makeActive();
    await Order.updateOne({ _id: order._id }, { $set: {
      'installmentPlan.schedule.1.status': 'overdue',
      'installmentPlan.schedule.1.dueDate': new Date(Date.now() - 2 * 86400000),
      'installmentPlan.schedule.1.transactionProof': { senderName: 'Client', transactionCode: '1234567890', amount: 7000,
        submittedAt: new Date(Date.now() - 3 * 86400000), paymentMethod: 'mobile_money' }
    } });
    await processInstallmentReminders();
    expect((await Order.findById(order._id)).installmentPlan.schedule[1].status).toBe('proof_uploaded');
    expect((await runInstallmentProofValidationSlaSweep()).escalatedEntries).toBe(1);
    const stored = await Order.findById(order._id);
    expect(stored.paidAmount).toBe(3000);
    expect(stored.remainingAmount).toBe(7000);
  });
  it('does not over-refund a deposit shared by historical duplicate orders', async () => {
    const original = await makeActive();
    const copy = original.toObject();
    delete copy._id;
    const duplicate = await Order.create(copy);
    const results = await Promise.allSettled([original, duplicate].map(order => initiateOrderRefund({ order, requestedBy: ids.seller, amount: 3000, source: 'ADMIN' })));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(await Refund.countDocuments()).toBe(1);
    expect(provider.initiatePawaPayRefund).toHaveBeenCalledOnce();
  });
  it('keeps penalties, cash received and remaining debt consistent', async () => {
    const order = await makeActive({ installmentLatePenaltyRate: 10 });
    order.installmentPlan.schedule[1].dueDate = new Date(Date.now() - 2 * 86400000);
    await order.save();
    await pay(order, 7000);
    let stored = await Order.findById(order._id);
    expect(stored.installmentPlan.remainingAmount).toBe(700);
    expect(stored.remainingAmount).toBe(700);
    expect(stored.paymentStatus).toBe('PARTIAL');
    expect(stored.totalAmount).toBe(10700);
    await pay(stored, 700, 2);
    stored = await Order.findById(order._id);
    expect(stored.paidAmount).toBe(10700);
    expect(stored.escrowAmount).toBe(10700);
    expect(stored.installmentPlan.principalPaid).toBe(10000);
    expect(stored.installmentPlan.penaltiesPaid).toBe(700);
  });
  it('allows fulfillment when the initial payment settles the whole order', async () => {
    await seedProduct({ installmentMinAmount: 10000 });
    const checkout = await seedCheckout({ amount: 10000 });
    checkout.actionContext.firstPaymentAmount = 10000;
    const initial = await finish(checkout);
    expect(initial.statusCode).toBe(201);
    await confirm(initial.body._id);
    const order = await Order.findById(initial.body._id);
    expect(order.status).toBe('installment_paid');
    expect(order.paymentStatus).toBe('PAID_FULL');
    expect(getOrderAllowedActions(order).allowedActions.seller.some(a => a.key === 'wait_installment_settlement')).toBe(false);
  });
  it('disables new purchases without blocking an existing repayment', async () => {
    const order = await makeActive();
    config.isFeatureEnabled.mockResolvedValue({ enabled: false });
    const result = await start({ kind: 'INSTALLMENT_CHECKOUT', productId: ids.product, quantity: 1, firstPaymentAmount: 3000, deliveryMode: 'PICKUP' });
    expect(result.statusCode).toBe(403);
    expect((await pay(order, 7000)).statusCode).toBe(200);
  });
  it('rejects a changed country/currency from the provider resolver before opening payment', async () => {
    await seedProduct();
    payments.resolvePaymentProvider.mockResolvedValue({ currency: 'XOF', countryContext: { iso3: 'SEN', countryId: String(oid()) } });
    expect((await start({ kind: 'INSTALLMENT_CHECKOUT', productId: ids.product, quantity: 1, firstPaymentAmount: 3000, deliveryMode: 'PICKUP' })).statusCode).toBe(400);
    expect(provider.initiatePawaPayCheckout).not.toHaveBeenCalled();
  });
  it('keeps delivery costs fixed after accepting the installment quote', async () => {
    const order = await makeActive();
    expect(() => applyDeliveryFeeToOrder({ order, nextFee: 1000 })).toThrow('fixés');
  });
  it('rejects a different seller and validates amount/sequence before collecting money', async () => {
    const order = await makeActive({ installmentDuration: 60 });
    const result = await invoke(sellerConfirmInstallmentSale, { user: { _id: oid() }, params: { id: String(order._id) }, body: { approve: false } });
    expect(result.statusCode).toBe(404);
    expect((await start({ kind: 'INSTALLMENT_PAYMENT', orderId: String(order._id), scheduleIndex: 1, amount: 3000 }, 3000)).statusCode).toBe(400);
    expect((await start({ kind: 'INSTALLMENT_PAYMENT', orderId: String(order._id), scheduleIndex: 2, amount: 3500 }, 3500)).statusCode).toBe(409);
    expect(provider.initiatePawaPayCheckout).not.toHaveBeenCalled();
  });
  it('refuses a low first payment before opening the provider', async () => {
    await seedProduct();
    expect((await start({ kind: 'INSTALLMENT_CHECKOUT', productId: ids.product, quantity: 1, firstPaymentAmount: 2000, deliveryMode: 'PICKUP' }, 2000)).statusCode).toBe(400);
    expect(provider.initiatePawaPayCheckout).not.toHaveBeenCalled();
  });
  it('rolls back a failed initial transaction and creates exactly one order on retry', async () => {
    await seedProduct();
    const checkout = await seedCheckout();
    const { default: Cart } = await import('../models/cartModel.js');
    const update = vi.spyOn(Cart, 'updateOne').mockRejectedValueOnce(new Error('Cart write failure'));
    expect((await finish(checkout)).statusCode).toBe(500);
    expect(await Order.countDocuments()).toBe(0);
    update.mockRestore();
    expect((await finish(checkout)).statusCode).toBe(201);
    expect(await Order.countDocuments()).toBe(1);
  });
  it('does not create duplicate receipts when the same repayment completes concurrently', async () => {
    const order = await makeActive();
    const checkout = await seedCheckout({ amount: 7000, actionContext: { kind: 'INSTALLMENT_PAYMENT', orderId: String(order._id), scheduleIndex: 1, amount: 7000 } });
    const request = { user: { _id: ids.buyer }, params: { id: String(order._id), scheduleIndex: '1' }, body: { amount: 7000 }, pawaPayCheckout: checkout };
    const results = await Promise.all([invoke(uploadInstallmentPaymentProof, request), invoke(uploadInstallmentPaymentProof, request)]);
    expect(results.every(result => result.statusCode === 200)).toBe(true);
    const stored = await Order.findById(order._id);
    expect(stored.installmentPayments).toHaveLength(2);
    expect(stored.paidAmount).toBe(10000);
    expect(await Refund.countDocuments()).toBe(0);
  });
  it('retries only the failed portion of a refund, preserving completed portions', async () => {
    const order = await makeActive();
    await pay(order, 7000);
    const stored = await Order.findById(order._id);
    const args = { order: stored, requestedBy: ids.seller, amount: 10000, source: 'ADMIN' };
    const batch = await initiateOrderRefund(args);
    const refunds = await Refund.find({ installmentBatchId: batch.refundId }).sort({ amount: 1 });
    await reconcileRefund(refunds[0].refundId, { status: 'COMPLETED', amount: '3000', currency: 'XAF' });
    await reconcileRefund(refunds[1].refundId, { status: 'FAILED' });
    expect((await Order.findById(order._id)).refundStatus).toBe('failed');
    await initiateOrderRefund(args);
    const calls = provider.initiatePawaPayRefund.mock.calls.map(([data]) => Number(data.amount));
    expect(calls).toEqual([3000, 7000, 7000]);
    const retry = await Refund.findOne({ installmentBatchId: batch.refundId, status: 'PROCESSING' });
    await reconcileRefund(retry.refundId, { status: 'COMPLETED', amount: '7000', currency: 'XAF' });
    expect((await Order.findById(order._id)).refundAmount).toBe(10000);
    expect((await Order.findById(order._id)).refundStatus).toBe('processed');
  });
  it('recovers a cancellation refund after a crash between cancelling and dispatch', async () => {
    const order = await makeActive();
    await cancelInstallmentOrder({ orderId: order._id, actorId: ids.seller, sellerId: ids.seller });
    expect(await Refund.countDocuments()).toBe(0);
    await reconcilePendingRefunds();
    expect(await Refund.countDocuments()).toBe(1);
    expect((await Order.findById(order._id)).status).toBe('cancelled');
    expect((await Order.findById(order._id)).installmentRefundRequired).toBe(false);
  });
  it('does not recreate a refund after an uncertain provider response', async () => {
    const order = await makeActive();
    provider.initiatePawaPayRefund.mockRejectedValueOnce(new Error('Response lost'));
    const args = { order, requestedBy: ids.seller, amount: 3000, source: 'ADMIN' };
    const first = await initiateOrderRefund(args);
    const second = await initiateOrderRefund(args);
    expect(first.refundId).toBe(second.refundId);
    expect(await Refund.countDocuments()).toBe(1);
    expect(provider.initiatePawaPayRefund).toHaveBeenCalledOnce();
  });
  it('retains legacy captured funds when later payments acquire new receipt records', async () => {
    const order = await makeActive();
    await Order.updateOne({ _id: order._id }, { $set: { installmentPayments: [] } });
    await pay(order, 7000);
    const stored = await Order.findById(order._id);
    expect(stored.installmentPayments).toHaveLength(2);
    expect(stored.escrowAmount).toBe(10000);
  });
  it('never collects a repayment after cancellation', async () => {
    const order = await makeActive();
    await confirm(order._id, false);
    expect((await start({ kind: 'INSTALLMENT_PAYMENT', orderId: String(order._id), scheduleIndex: 1, amount: 7000 }, 7000)).statusCode).toBe(409);
    expect(provider.initiatePawaPayCheckout).not.toHaveBeenCalled();
  });
  it('does not overwrite balances when a reminder saves a partially selected order', async () => {
    const order = await makeActive();
    const partial = await Order.findById(order._id).select('customer items status installmentPlan.schedule timeline');
    partial.timeline.push({ type: 'installment_payment_proof_sla_escalated', at: new Date() });
    await partial.save();
    const stored = await Order.findById(order._id);
    expect(stored.paidAmount).toBe(3000);
    expect(stored.totalAmount).toBe(10000);
    expect(stored.installmentPlan.remainingAmount).toBe(7000);
  });
});
