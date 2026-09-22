// Opt in with ORDER_TEST_MONGO_URI pointing to a disposable local replica set.
// Only provider calls and external side effects are mocked; MongoDB transactions,
// controllers, validation and Order save hooks run normally.
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import Order from '../models/orderModel.js';
import Checkout from '../models/pawapayCheckoutModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import CommerceOperation from '../models/commerceOperationModel.js';
import Event from '../models/pawapayEventModel.js';
import { pawaPayCheckoutOrder, cancelSponsorship, respondSponsorship, retrySponsorship,
  resolveSponsorPayer, expireStaleSponsorships, listIncomingSponsorships, userUpdateOrderStatus } from '../controllers/orderController.js';
import { createPawaPayCheckout, receivePawaPayCallback } from '../controllers/pawapayController.js';
import { completeSponsoredCheckout, reserveSponsoredCheckout, sponsorshipAmounts } from './sponsoredPaymentService.js';
import * as provider from './pawapayService.js';
import * as payments from './paymentService.js';
import * as config from './configService.js';
import * as notifications from '../utils/notificationService.js';

const ids = vi.hoisted(() => ({ country: 'cccccccccccccccccccccccc', buyer: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  payer: '999999999999999999999999', seller: 'aaaaaaaaaaaaaaaaaaaaaaaa', product: '111111111111111111111111' }));
vi.mock('./countryService.js', async importOriginal => ({ ...await importOriginal(),
  ensureDefaultCountry: vi.fn(async () => ({ _id: ids.country, currency: { code: 'XAF' } })) }));
vi.mock('./configService.js', () => ({ getRuntimeConfig: vi.fn() }));
vi.mock('./paymentService.js', async importOriginal => ({ ...await importOriginal(), resolvePaymentProvider: vi.fn() }));
vi.mock('./pawapayService.js', async importOriginal => ({ ...await importOriginal(),
  initiatePawaPayCheckout: vi.fn(), getPawaPayCheckoutStatus: vi.fn() }));
vi.mock('./escrowService.js', async importOriginal => ({ ...await importOriginal(), recordEscrowAudit: vi.fn(async () => {}) }));
vi.mock('../utils/notificationService.js', async importOriginal => ({ ...await importOriginal(), createNotification: vi.fn(async () => {}) }));
vi.mock('./socialCommerce/attributionService.js', () => ({ resolveAttributionForOrder: vi.fn(async () => ({})) }));
vi.mock('./bundleService.js', () => ({ applyBundleDiscountsForSellers: vi.fn(async () => {}) }));

const uri = process.env.ORDER_TEST_MONGO_URI;
const oid = value => new mongoose.Types.ObjectId(value);
const totalPaid = orders => orders.reduce((sum, order) => sum + order.paidAmount, 0);
const invoke = async (handler, req) => {
  const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  let error;
  await handler(req, res, value => { error = value; });
  if (error) throw error;
  return res;
};
const callback = (checkout, status = 'COMPLETED', extra = {}) => invoke(receivePawaPayCallback('checkout'), {
  body: { checkoutId: checkout.checkoutId, status, amount: String(checkout.amount), currency: 'XAF', ...extra }
});
const seedProduct = async (extra = {}) => {
  const row = { _id: oid(ids.product), user: oid(ids.seller), countryId: oid(ids.country), currency: 'XAF',
    title: 'Article test', price: 10000, status: 'approved', images: [], attributes: [],
    deliveryAvailable: true, pickupAvailable: true, deliveryFeeEnabled: false, ...extra };
  await Product.collection.insertOne(row);
  return row;
};
const seedOrderCheckout = async (extra = {}) => Checkout.create({ checkoutId: crypto.randomUUID(), user: ids.buyer,
  countryId: ids.country, currency: 'XAF', amount: 10000, status: 'COMPLETED', paymentState: 'CONFIRMED',
  depositId: crypto.randomUUID(), actionContext: { kind: 'ORDER_CHECKOUT', deliveryMode: 'PICKUP', paymentPercent: 100,
    items: [{ productId: ids.product, quantity: 1 }] }, autoValidationState: 'PENDING', ...extra });
const finishOrder = checkout => invoke(pawaPayCheckoutOrder, { user: { _id: ids.buyer },
  body: checkout.actionContext, pawaPayCheckout: checkout });
const seedGroup = async ({ totals = [10000], delivery = 0, status = 'pending', expired = false } = {}) => {
  const groupId = crypto.randomUUID();
  const orders = [];
  for (const total of totals) orders.push(await Order.create({ customer: ids.buyer, createdBy: ids.buyer,
    countryId: ids.country, currency: 'XAF', items: [{ product: ids.product, quantity: 1,
      unitPrice: total - delivery, lineTotal: total - delivery, snapshot: { title: 'Article test', shopId: ids.seller } }],
    deliveryMode: 'PICKUP', deliveryAddress: 'Retrait',
    totalAmount: total, paidAmount: 0, deliveryFeeTotal: delivery,
    status: status === 'pending' ? 'pending' : 'cancelled', sponsoredPayment: { isSponsored: true,
      requestGroupId: groupId, requester: ids.buyer, payer: ids.payer, payerPhone: '+242060000002', status,
      expiresAt: new Date(Date.now() + (expired ? -1 : 1) * 3600000) } }));
  return { groupId, orders };
};
const sponsorData = (group, paymentOption = 'deposit', kind = 'SPONSORSHIP_ACCEPT') => ({
  checkoutId: crypto.randomUUID(), user: kind === 'SPONSORSHIP_ACCEPT' ? ids.payer : ids.buyer,
  countryId: ids.country, currency: 'XAF', amount: sponsorshipAmounts(group.orders, paymentOption).amount,
  actionContext: { kind, groupId: group.groupId, paymentOption }, autoValidationState: 'PENDING'
});
const initiateSponsor = data => invoke(createPawaPayCheckout, { user: { _id: data.user }, body: data, headers: {} });

describe.skipIf(!uri)('checkout persistence, sponsored payments and concurrency', () => {
  beforeAll(async () => {
    if (!/^mongodb:\/\/127\.0\.0\.1:\d+\/hdmarket_order_test_[a-z0-9_]+$/i.test(uri)) throw new Error('Disposable local order test database required');
    await mongoose.connect(uri, { autoIndex: false });
    await Promise.all([Order, Checkout, Product, User, CommerceOperation, Event].map(model => model.createCollection()));
    await Checkout.collection.createIndex({ checkoutId: 1 }, { unique: true });
    await Event.collection.createIndex({ resourceType: 1, resourceId: 1 }, { unique: true });
  });
  afterAll(async () => {
    if (mongoose.connection.readyState) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
  });
  beforeEach(async () => {
    vi.clearAllMocks();
    await Promise.all([Order, Checkout, Product, User, CommerceOperation, Event].map(model => model.deleteMany({})));
    await User.collection.insertMany([
      { _id: oid(ids.buyer), name: 'Client', phone: '+242060000001', city: 'Brazzaville', isActive: true },
      { _id: oid(ids.payer), name: 'Proche', phone: '+242060000002', isActive: true },
      { _id: oid(ids.seller), name: 'Boutique', isActive: true }
    ]);
    config.getRuntimeConfig.mockImplementation(async (key, { fallback, countryId } = {}) =>
      key === 'enable_pay_for_other' ? String(countryId) === ids.country : fallback);
    payments.resolvePaymentProvider.mockResolvedValue({ currency: 'XAF', countryContext: { iso3: 'COG', countryId: ids.country } });
    provider.initiatePawaPayCheckout.mockResolvedValue({ status: 'ACCEPTED', redirectUrl: 'https://provider.example.invalid/checkout' });
    notifications.createNotification.mockResolvedValue({});
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([50, 70, 100])('creates a %s%% order and puts only captured funds in escrow', async percent => {
    await seedProduct();
    const checkout = await seedOrderCheckout({ amount: percent * 100 });
    checkout.actionContext.paymentPercent = percent;
    expect((await finishOrder(checkout)).statusCode).toBe(201);
    const [order] = await Order.find({});
    expect(order.paidAmount).toBe(percent * 100);
    expect(order.remainingAmount).toBe(10000 - percent * 100);
    expect(order.escrowStatus).toBe('IN_ESCROW');
    expect(order.escrowAmount).toBe(checkout.amount);
    expect(order.paymentDepositId).toBe(checkout.depositId);
  });
  it('creates both variants of the same product at their specific prices', async () => {
    await seedProduct({ attributes: [{ name: 'Taille', type: 'select', required: true,
      options: ['S', 'L'], optionPrices: { s: 8000, l: 12000 } }] });
    const checkout = await seedOrderCheckout({ amount: 20000 });
    checkout.actionContext.items = ['S', 'L'].map(value => ({ productId: ids.product, quantity: 1,
      selectedAttributes: [{ name: 'Taille', value }] }));
    expect((await finishOrder(checkout)).statusCode).toBe(201);
    const [order] = await Order.find({});
    expect(order.items.map(item => item.lineTotal)).toEqual([8000, 12000]);
    expect(order.totalAmount).toBe(20000);
  });
  it('serializes concurrent completion, conserves odd FCFA and replays identical orders', async () => {
    await seedProduct({ price: 10001 });
    const second = await seedProduct({ _id: oid(), user: oid(), price: 10001 });
    const checkout = await seedOrderCheckout({ amount: 10001 });
    checkout.actionContext.paymentPercent = 50;
    checkout.actionContext.items.push({ productId: String(second._id), quantity: 1 });
    const results = await Promise.all([finishOrder(checkout), finishOrder(checkout), finishOrder(checkout)]);
    expect(results.map(result => result.statusCode).sort()).toEqual([200, 200, 201]);
    const orders = await Order.find({});
    expect(orders).toHaveLength(2);
    expect(totalPaid(orders)).toBe(10001);
    expect(orders.map(order => order.paidAmount).sort()).toEqual([5000, 5001]);
    for (const result of results) expect(result.body.orders.map(order => String(order._id)).sort()).toEqual(orders.map(order => String(order._id)).sort());
  });
  it('rolls back all shops when creation fails midway, then retries once', async () => {
    await seedProduct();
    const second = await seedProduct({ _id: oid(), user: oid() });
    const checkout = await seedOrderCheckout({ amount: 20000 });
    checkout.actionContext.items.push({ productId: String(second._id), quantity: 1 });
    const create = Order.create.bind(Order);
    let calls = 0;
    const spy = vi.spyOn(Order, 'create').mockImplementation((...args) => {
      if (++calls === 2) throw new Error('Simulated write failure');
      return create(...args);
    });
    expect((await finishOrder(checkout)).statusCode).toBe(500);
    expect(await Order.countDocuments()).toBe(0);
    spy.mockRestore();
    expect((await finishOrder(checkout)).statusCode).toBe(201);
    expect(await Order.countDocuments()).toBe(2);
  });
  it('does not recreate orders or mark completion failed when staff notification fails', async () => {
    await seedProduct();
    await User.collection.insertOne({ _id: oid(), role: 'admin', isActive: true });
    notifications.createNotification.mockImplementation(async data => {
      if (data.type === 'payment_validated') throw new Error('Notification unavailable');
    });
    const checkout = await seedOrderCheckout({ status: 'PROCESSING', paymentState: 'PENDING' });
    await callback(checkout);
    const first = await Order.findOne({});
    await callback(checkout);
    expect(await Order.countDocuments()).toBe(1);
    expect((await Order.findOne({}))._id).toEqual(first._id);
    expect((await Checkout.findById(checkout._id)).autoValidationState).toBe('COMPLETED');
  });
  it.each(['PROCESSING', 'FAILED', 'EXPIRED', 'COMPLETED'])('ignores delayed %s after confirmed completion', async status => {
    const checkout = await seedOrderCheckout({ actionContext: null });
    await callback(checkout, status);
    const stored = await Checkout.findById(checkout._id);
    expect(stored.status).toBe('COMPLETED');
    expect(stored.paymentState).toBe('CONFIRMED');
  });
  it('keeps completion when processing and success callbacks race', async () => {
    const checkout = await seedOrderCheckout({ status: 'PROCESSING', paymentState: 'PENDING', actionContext: null });
    await Promise.all([callback(checkout, 'PROCESSING'), callback(checkout)]);
    expect((await Checkout.findById(checkout._id)).status).toBe('COMPLETED');
  });
  it.each(['ACCEPTED', 'REJECTED', 'network-error'])('preserves a callback that arrives before the initiation response (%s)', async response => {
    const group = await seedGroup();
    provider.initiatePawaPayCheckout.mockImplementation(async ({ checkoutId }) => {
      const checkout = await Checkout.findOne({ checkoutId });
      await callback(checkout);
      if (response === 'network-error') throw new Error('Connection interrupted');
      return { status: response, redirectUrl: 'https://provider.example.invalid', checkoutCode: 'provider-return-code' };
    });
    const result = await initiateSponsor(sponsorData(group));
    expect(result.statusCode).toBe(202);
    const stored = await Checkout.findOne({});
    expect(stored.status).toBe('COMPLETED');
    expect(stored.autoValidationState).toBe('COMPLETED');
    if (response === 'ACCEPTED') expect(stored.checkoutCode).toBe('provider-return-code');
    expect((await Order.findById(group.orders[0]._id)).paidAmount).toBe(2500);
  });

  it('keeps an uncertain provider response reserved for verification', async () => {
    const group = await seedGroup();
    provider.initiatePawaPayCheckout.mockResolvedValue({ status: 'ACCEPTED' });
    const result = await initiateSponsor(sponsorData(group));
    expect(result.statusCode).toBe(202);
    expect((await Checkout.findOne({})).status).toBe('PROCESSING');
    await expect(invoke(cancelSponsorship, { user: { _id: ids.buyer }, params: { groupId: group.groupId } })).rejects.toMatchObject({ status: 409 });
  });

  it.each(['missing', 'wrong-user', 'amount', 'expired', 'disabled', 'blocked', 'country'])('rejects %s sponsored payment before contacting provider', async reason => {
    const group = await seedGroup({ expired: reason === 'expired' });
    const data = sponsorData(group);
    if (reason === 'missing') data.actionContext.groupId = 'missing';
    if (reason === 'wrong-user') data.user = ids.buyer;
    if (reason === 'amount') data.amount++;
    if (reason === 'disabled') config.getRuntimeConfig.mockResolvedValue(false);
    if (reason === 'blocked') await User.updateOne({ _id: ids.payer }, { $set: { isBlocked: true } });
    if (reason === 'country') payments.resolvePaymentProvider.mockResolvedValue({ currency: 'XOF', countryContext: { countryId: String(oid()), iso3: 'SEN' } });
    const result = await initiateSponsor(data);
    expect(result.statusCode).toBeGreaterThanOrEqual(400);
    expect(provider.initiatePawaPayCheckout).not.toHaveBeenCalled();
    expect(await Checkout.countDocuments()).toBe(0);
  });
  it.each(['deposit', 'full'])('completes sponsored %s once with exact allocation and escrow', async option => {
    const group = await seedGroup({ totals: [10751, 10751], delivery: 750 });
    const result = await initiateSponsor(sponsorData(group, option));
    expect(result.statusCode).toBe(201);
    const checkout = await Checkout.findOne({ checkoutId: result.body.checkoutId });
    await callback(checkout);
    await callback(checkout);
    const orders = await Order.find({}).sort({ _id: 1 });
    expect(totalPaid(orders)).toBe(option === 'deposit' ? 5001 : 21502);
    expect(orders.every(order => order.sponsoredPayment.status === 'accepted')).toBe(true);
    expect(orders.every(order => order.escrowAmount === order.paidAmount && order.escrowStatus === 'IN_ESCROW')).toBe(true);
    expect(orders.every(order => order.remainingAmount === order.totalAmount - order.paidAmount)).toBe(true);
    const list = await invoke(listIncomingSponsorships, { user: { _id: ids.payer } });
    expect(list.body.requests[0]).toMatchObject({ depositAmount: 5001, paidAmount: checkout.amount,
      remainingAmount: 21502 - checkout.amount });
  });
  it.each(['declined', 'expired'])('allows requester to pay a %s request with the 25%% deposit', async status => {
    const group = await seedGroup({ status });
    const result = await initiateSponsor(sponsorData(group, 'deposit', 'SPONSORSHIP_PAY_SELF'));
    expect(result.statusCode).toBe(201);
    await callback(await Checkout.findOne({ checkoutId: result.body.checkoutId }));
    const order = await Order.findById(group.orders[0]._id);
    expect(order.sponsoredPayment.status).toBe('self_paid');
    expect(order.status).toBe('pending');
    expect(order.paidAmount).toBe(2500);
    expect(order.remainingAmount).toBe(7500);
  });
  it('reserves one checkout across concurrent initiation attempts with different keys', async () => {
    const group = await seedGroup();
    const results = await Promise.all([initiateSponsor(sponsorData(group)), initiateSponsor(sponsorData(group))]);
    expect(results.every(result => result.statusCode < 300)).toBe(true);
    expect(results[0].body.checkoutId).toBe(results[1].body.checkoutId);
    expect(provider.initiatePawaPayCheckout).toHaveBeenCalledOnce();
    expect(await Checkout.countDocuments()).toBe(1);
  });
  it('blocks cancellation, refusal and expiry during payment, and accepts completion past expiry', async () => {
    const group = await seedGroup();
    const { checkout } = await reserveSponsoredCheckout(sponsorData(group));
    const directCancel = await invoke(userUpdateOrderStatus, { user: { _id: ids.buyer },
      params: { id: String(group.orders[0]._id) }, body: { status: 'cancelled' } });
    expect(directCancel.statusCode).toBe(409);
    await expect(invoke(cancelSponsorship, { user: { _id: ids.buyer }, params: { groupId: group.groupId } })).rejects.toMatchObject({ status: 409 });
    await expect(invoke(respondSponsorship, { user: { _id: ids.payer }, params: { groupId: group.groupId }, body: { action: 'decline' } })).rejects.toMatchObject({ status: 409 });
    await Order.updateMany({}, { $set: { 'sponsoredPayment.expiresAt': new Date(0) } });
    await expireStaleSponsorships();
    expect((await Order.findOne({})).sponsoredPayment.status).toBe('pending');
    await callback(checkout);
    expect((await Order.findOne({})).sponsoredPayment.status).toBe('accepted');
  });
  it('allows cancellation after a definitive payment failure', async () => {
    const group = await seedGroup();
    const { checkout } = await reserveSponsoredCheckout(sponsorData(group));
    await callback(checkout, 'FAILED');
    expect((await invoke(cancelSponsorship, { user: { _id: ids.buyer }, params: { groupId: group.groupId } })).statusCode).toBe(200);
    expect((await Order.findOne({})).sponsoredPayment.status).toBe('cancelled');
  });
  it('lets either cancellation or reservation win atomically, never both', async () => {
    const group = await seedGroup();
    const results = await Promise.allSettled([
      reserveSponsoredCheckout(sponsorData(group)),
      invoke(cancelSponsorship, { user: { _id: ids.buyer }, params: { groupId: group.groupId } })
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const order = await Order.findOne({});
    expect(Boolean(order.sponsoredPayment.checkoutId)).toBe(order.sponsoredPayment.status === 'pending');
  });
  it('uses Congo configuration for payer lookup and retry even when global settings are disabled', async () => {
    const group = await seedGroup({ status: 'declined' });
    const lookup = await invoke(resolveSponsorPayer, { user: { _id: ids.buyer },
      countryContext: { countryId: ids.country }, query: { phone: '+242060000002' } });
    expect(lookup.body.found).toBe(true);
    const retry = await invoke(retrySponsorship, { user: { _id: ids.buyer },
      params: { groupId: group.groupId }, body: { payerPhone: '+242060000002' } });
    expect(retry.statusCode).toBe(200);
    expect((await Order.findOne({})).sponsoredPayment.attemptCount).toBe(2);
    expect(config.getRuntimeConfig.mock.calls.filter(([key]) => key === 'enable_pay_for_other')
      .every(([, options]) => String(options.countryId) === ids.country)).toBe(true);
  });
  it('rejects using a confirmed checkout to pay another sponsored group', async () => {
    const group = await seedGroup();
    const { checkout } = await reserveSponsoredCheckout(sponsorData(group));
    checkout.status = 'COMPLETED'; checkout.paymentState = 'CONFIRMED';
    await expect(completeSponsoredCheckout({ checkout, groupId: 'other', kind: 'SPONSORSHIP_ACCEPT', userId: ids.payer })).rejects.toMatchObject({ status: 403 });
  });
});
