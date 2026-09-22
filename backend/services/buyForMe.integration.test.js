import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as service from './buyForMeService.js';
import * as transfers from './buyForMeTransferService.js';
import * as provider from './pawapayService.js';
import * as payments from './paymentService.js';
import * as flags from './configService.js';
import * as notifications from '../utils/notificationService.js';
import * as platform from './platformDeliveryService.js';
import Order from '../models/buyForMeOrderModel.js';
import Config from '../models/buyForMeConfigModel.js';
import Transaction from '../models/buyForMeTransactionModel.js';
import Transfer from '../models/buyForMeTransferModel.js';
import Receipt from '../models/buyForMeReceiptModel.js';
import Dispute from '../models/buyForMeDisputeModel.js';
import Preference from '../models/buyForMePreferenceModel.js';
import User from '../models/userModel.js';
import Driver from '../models/deliveryGuyModel.js';
import Checkout from '../models/pawapayCheckoutModel.js';
import Event from '../models/pawapayEventModel.js';
import Country from '../models/countryModel.js';
import CommerceOperation from '../models/commerceOperationModel.js';
import Media from '../models/buyForMeMediaModel.js';
import ShoppingList from '../models/buyForMeListModel.js';
import { getShoppingLists, getShoppingList, saveShoppingList, deleteShoppingList } from '../controllers/buyForMeListController.js';
import { persistShoppingMedia, getShoppingMedia, blockLegacyShoppingReceipts } from '../controllers/buyForMeMediaController.js';
import { privateUploadDirectory } from '../utils/privateAttachments.js';
import { createPawaPayCheckout, receivePawaPayCallback } from '../controllers/pawapayController.js';
import { getAdminBuyForMeOrders } from '../controllers/buyForMeController.js';
import { shoppingAdminFilter } from './buyForMeAccessService.js';

vi.mock('./parcelRequestService.js', async original => ({ ...await original(), estimateParcelPrice: vi.fn(async () => ({ price: 1000, distanceMeters: 2000 })) }));
vi.mock('../utils/notificationService.js', async original => ({ ...await original(), createNotification: vi.fn(async () => ({})) }));
vi.mock('../utils/cache.js', async original => ({ ...await original(), invalidateAdminCache: vi.fn(async () => {}), invalidateUserCache: vi.fn(async () => {}) }));
vi.mock('./paymentService.js', async original => ({ ...await original(), resolvePaymentProvider: vi.fn() }));
vi.mock('./pawapayService.js', async original => ({ ...await original(), initiatePawaPayCheckout: vi.fn(), getPawaPayCheckoutStatus: vi.fn(),
  initiatePawaPayRefund: vi.fn(), getPawaPayRefundStatus: vi.fn(), initiatePawaPayPayout: vi.fn(), getPawaPayPayoutStatus: vi.fn() }));
vi.mock('./configService.js', async original => ({ ...await original(), isFeatureEnabled: vi.fn(), getRuntimeConfig: vi.fn(async (_key, options) => options?.fallback) }));
vi.mock('../utils/cloudinaryUploader.js', async original => ({ ...await original(), isCloudinaryConfigured: vi.fn(() => false) }));

const uri = process.env.SHOPPING_TEST_MONGO_URI;
const country = 'cccccccccccccccccccccccc', buyer = 'bbbbbbbbbbbbbbbbbbbbbbbb', courier = 'aaaaaaaaaaaaaaaaaaaaaaaa', driver = 'dddddddddddddddddddddddd';
const founder = { _id: buyer, role: 'founder' };
const oid = value => new mongoose.Types.ObjectId(value);
const payload = extra => ({ storeType: 'SUPERMARKET', pickup: { address: 'Magasin test' }, dropoff: { address: 'Adresse test' },
  items: [{ name: 'Riz', quantity: 1, estimatedUnitPrice: 10000 }], balancePreference: 'ORIGINAL_PAYMENT', ...extra });
const models = [Order, Config, Transaction, Transfer, Receipt, Dispute, Preference, User, Driver, Checkout, Event, Country, CommerceOperation, Media, ShoppingList];
const createdMedia = [];
const invoke = async (handler, req) => {
  const res = { statusCode: 200, set() { return this; }, end() { return this; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  let error; await handler(req, res, value => { error = value; }); if (error) throw error; return res;
};
const initiate = async ({ amount = 12000, kind = 'BUY_FOR_ME_ORDER', action = payload() } = {}) => invoke(createPawaPayCheckout, {
  user: { _id: buyer, countryId: country }, headers: {}, body: { amount, purpose: kind === 'BUY_FOR_ME_ORDER' ? 'BUY_FOR_ME_FUNDING' : 'BUY_FOR_ME_ADDITIONAL_FUNDING', actionContext: { kind, ...action } }
});
const callback = (checkout, status = 'COMPLETED') => invoke(receivePawaPayCallback('checkout'), { body: {
  checkoutId: checkout.checkoutId, status, amount: String(checkout.amount), currency: 'XAF', deposit: { depositId: 'deposit-' + checkout.checkoutId, status, amount: String(checkout.amount), currency: 'XAF' }
} });
const create = async (extra = {}) => {
  const response = await initiate({ action: payload(extra) });
  expect(response.statusCode).toBe(201);
  const checkout = await Checkout.findOne({ checkoutId: response.body.checkoutId });
  await callback(checkout);
  return Order.findOne({ 'payment.checkoutId': checkout.checkoutId });
};
const additional = async () => {
  const order = await create();
  await Order.updateOne({ _id: order._id }, { $set: { driverId: driver, status: 'WAITING_CUSTOMER_APPROVAL', currentStage: 'WAITING_APPROVAL', amountSpent: 13000,
    additionalPayment: { required: true, amount: 3000, status: 'REQUIRED', requestedAt: new Date() } } });
  return order;
};
const delivered = async (extra = {}) => {
  const order = await create(extra);
  await Order.updateOne({ _id: order._id }, { $set: { driverId: driver, status: 'DELIVERED', currentStage: 'DELIVERED', amountSpent: 8000 } });
  return order;
};
const payExtra = async order => {
  const opened = await initiate({ kind: 'BUY_FOR_ME_ADDITIONAL_PAYMENT', amount: 3000, action: { orderId: String(order._id) } });
  return Checkout.findOne({ checkoutId: opened.body.checkoutId });
};

describe.skipIf(!uri)('buy-for-me payment, delivery and recovery', () => {
  beforeAll(async () => {
    if (!/^mongodb:\/\/127\.0\.0\.1:\d+\/hdmarket_shopping_test_[a-z0-9_]+$/i.test(uri)) throw new Error('Disposable local shopping test database required');
    await mongoose.connect(uri, { autoIndex: false });
    await Promise.all(models.map(model => model.createCollection()));
    await Checkout.collection.createIndex({ checkoutId: 1 }, { unique: true });
    await Transfer.collection.createIndex({ operationKey: 1 }, { unique: true });
    await Transfer.collection.createIndex({ providerId: 1 }, { unique: true });
    await Receipt.collection.createIndex({ orderId: 1 }, { unique: true });
    await Preference.collection.createIndex({ userId: 1 }, { unique: true });
  });
  afterAll(async () => { if (mongoose.connection.readyState) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } });
  beforeEach(async () => {
    vi.clearAllMocks();
    await Promise.all(models.map(model => model.deleteMany({})));
    await User.collection.insertMany([{ _id: oid(buyer), name: 'Client test', countryId: oid(country), isActive: true },
      { _id: oid(courier), name: 'Livreur test', countryId: oid(country), payoutAccount: { verifiedAt: new Date(), provider: 'MTN_MOMO_COG', phoneNumber: '242060000002' } }]);
    await Driver.collection.insertOne({ _id: oid(driver), userId: oid(courier), countryId: oid(country), fullName: 'Livreur test', buyForMeOptIn: true, isActive: true });
    await Country.collection.insertOne({ _id: oid(country), code: 'CG', currency: { code: 'XAF' } });
    await Config.create({ key: 'default', enabled: true, serviceCommissionPercent: 5, cashAdvanceFee: 500 });
    payments.resolvePaymentProvider.mockResolvedValue({ currency: 'XAF', countryContext: { iso3: 'COG', countryId: country } });
    provider.initiatePawaPayCheckout.mockResolvedValue({ status: 'ACCEPTED', redirectUrl: 'https://provider.example.invalid/payment' });
    provider.initiatePawaPayRefund.mockResolvedValue({ status: 'ACCEPTED' });
    provider.initiatePawaPayPayout.mockResolvedValue({ status: 'ACCEPTED' });
    provider.getPawaPayRefundStatus.mockResolvedValue({ status: 'NOT_FOUND' });
    provider.getPawaPayPayoutStatus.mockResolvedValue({ status: 'NOT_FOUND' });
    flags.isFeatureEnabled.mockResolvedValue({ enabled: true });
    vi.spyOn(platform, 'getPlatformDeliveryRuntime').mockResolvedValue({ managerRoles: [] });
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    for (const filename of createdMedia.splice(0)) await fs.unlink(path.join(privateUploadDirectory('shopping'), filename));
  });

  it.each(['ITEM_ESTIMATES', 'SHOPPING_BUDGET'])('completes %s with actual refund and courier payout obligations', async authorizationMode => {
    const order = await create({ authorizationMode, shoppingBudget: 10000 });
    expect(String(order.countryId)).toBe(country);
    await service.acceptBuyForMeJob({ orderId: order._id, driverId: driver, actorId: courier });
    await service.startBuyForMeShopping({ orderId: order._id, driverId: driver, actorId: courier });
    await service.uploadBuyForMeReceipt({ orderId: order._id, driverId: driver, actorId: courier, amountSpent: 8000, receiptImageUrl: 'api/buy-for-me/media/' + oid() });
    await service.startBuyForMeDelivery({ orderId: order._id, driverId: driver, actorId: courier });
    await service.markBuyForMeDelivered({ orderId: order._id, driverId: driver, actorId: courier });
    const result = await service.confirmBuyForMeOrder({ orderId: order._id, customerId: buyer });
    expect(result).toMatchObject({ status: 'COMPLETED', refundDue: 2000, refundedAmount: 0, settlementVersion: 1 });
    expect(await Transfer.findOne({ type: 'PAYOUT' }).lean()).toMatchObject({ amount: 9500, status: 'PROCESSING' });
    expect(await Transfer.findOne({ type: 'REFUND' }).lean()).toMatchObject({ amount: 2000, status: 'PROCESSING' });
    expect(await Transaction.countDocuments({ type: 'DRIVER_EARNING', status: 'COMPLETED' })).toBe(0);
    expect(provider.initiatePawaPayRefund).toHaveBeenCalledOnce();
    expect(provider.initiatePawaPayPayout).toHaveBeenCalledOnce();
  });
  it.each(['missing-items', 'wrong-price', 'service-disabled', 'feature-disabled', 'restricted', 'missing-additional-order'])('rejects %s before opening payment', async reason => {
    if (reason === 'service-disabled') await Config.updateOne({}, { $set: { enabled: false } });
    if (reason === 'feature-disabled') flags.isFeatureEnabled.mockResolvedValue({ enabled: false });
    if (reason === 'restricted') await User.updateOne({ _id: buyer }, { $set: { 'restrictions.canOrder.restricted': true } });
    const result = await initiate(reason === 'missing-items' ? { action: payload({ items: [] }) } : reason === 'wrong-price' ? { amount: 10 }
      : reason === 'missing-additional-order' ? { kind: 'BUY_FOR_ME_ADDITIONAL_PAYMENT', amount: 3000, action: { orderId: String(oid()) } } : {});
    expect(result.statusCode).toBeGreaterThanOrEqual(400);
    expect(provider.initiatePawaPayCheckout).not.toHaveBeenCalled();
  });
  it.each(['WALLET_REFUND', 'DRIVER_TIP', 'PLATFORM_DONATION'])('settles the chosen surplus disposition %s without inventing a wallet credit', async preference => {
    const order = await delivered({ balancePreference: preference });
    // Simulate a previously saved wallet preference on an unsettled request.
    if (preference === 'WALLET_REFUND') await Order.updateOne({ _id: order._id }, { $set: { balancePreference: preference } });
    await service.confirmBuyForMeOrder({ orderId: order._id, customerId: buyer });
    expect((await Transfer.findOne({ type: 'PAYOUT' })).amount).toBe(preference === 'DRIVER_TIP' ? 11500 : 9500);
    expect(await Transfer.countDocuments({ type: 'REFUND' })).toBe(preference === 'WALLET_REFUND' ? 1 : 0);
    if (preference === 'PLATFORM_DONATION') expect(await Transaction.findOne({ type: preference }).lean()).toMatchObject({ amount: 2000, status: 'COMPLETED' });
    if (preference === 'DRIVER_TIP') expect(await Transaction.findOne({ type: preference }).lean()).toMatchObject({ amount: 2000, status: 'PENDING' });
    if (preference === 'WALLET_REFUND') expect((await Order.findById(order._id)).balancePreference).toBe('ORIGINAL_PAYMENT');
  });
  it('honors the accepted quote after fees and availability change', async () => {
    const opened = await initiate();
    await Config.updateOne({}, { $set: { serviceCommissionPercent: 10, enabled: false } });
    flags.isFeatureEnabled.mockResolvedValue({ enabled: false });
    await callback(await Checkout.findOne({ checkoutId: opened.body.checkoutId }));
    expect(await Order.findOne().lean()).toMatchObject({ pricing: { total: 12000, serviceCommission: 500 } });
  });
  it('rolls back partial order creation, then retries without duplication', async () => {
    const opened = await initiate(); const checkout = await Checkout.findOne({ checkoutId: opened.body.checkoutId });
    const write = vi.spyOn(Transaction, 'create').mockRejectedValueOnce(new Error('Simulated funding failure'));
    await expect(callback(checkout)).rejects.toThrow('Simulated funding failure');
    expect(await Order.countDocuments()).toBe(0); write.mockRestore();
    await callback(checkout); await callback(checkout);
    expect(await Order.countDocuments()).toBe(1); expect(await Transaction.countDocuments({ type: 'FUNDING' })).toBe(1);
  });
  it('serializes concurrent creation', async () => {
    const order = await create();
    await Promise.all([1, 2].map(() => service.createPaidBuyForMeOrder({ customerId: buyer, checkoutId: order.payment.checkoutId, amountPaid: 12000 })));
    expect(await Order.countDocuments()).toBe(1);
  });
  it.each(['customer', 'admin'])('%s cancellation reserves a full refund exactly once', async actor => {
    const order = await create();
    const cancel = () => actor === 'customer' ? service.cancelBuyForMeOrder({ orderId: order._id, customerId: buyer })
      : service.adminCancelBuyForMeOrder({ orderId: order._id, actorId: buyer, user: founder, reason: 'Annulation vérifiée' });
    await cancel(); await cancel();
    expect(await Transfer.countDocuments({ type: 'REFUND' })).toBe(1);
    expect(await Order.findById(order._id).lean()).toMatchObject({ status: 'CANCELED', refundDue: 12000, refundedAmount: 0 });
    const refund = await Transfer.findOne({ type: 'REFUND' });
    await Promise.all([1, 2].map(() => transfers.reconcileShoppingTransfer(refund.providerId, { status: 'COMPLETED', amount: '12000', currency: 'XAF' }, 'REFUND')));
    expect(await Order.findById(order._id).lean()).toMatchObject({ payment: { status: 'REFUNDED' }, refundedAmount: 12000 });
    expect(await Transaction.countDocuments({ type: 'REFUND' })).toBe(1);
  });
  it('rolls back cancellation if refund reservation fails', async () => {
    const order = await create();
    vi.spyOn(Transfer, 'create').mockRejectedValueOnce(new Error('No refund write'));
    await expect(service.cancelBuyForMeOrder({ orderId: order._id, customerId: buyer })).rejects.toThrow('No refund write');
    expect((await Order.findById(order._id)).status).toBe('SEARCHING_DRIVER');
  });
  it('reuses one overage checkout across concurrent requests', async () => {
    const order = await additional();
    const results = await Promise.all([1, 2].map(() => payExtra(order)));
    expect(results[0].checkoutId).toBe(results[1].checkoutId);
    expect(await Checkout.countDocuments({ 'actionContext.kind': 'BUY_FOR_ME_ADDITIONAL_PAYMENT' })).toBe(1);
    await callback(results[0]); await callback(results[1]);
    expect((await Order.findById(order._id)).payment.totalPaid).toBe(15000);
  });
  it('blocks decline, adjustment and cancellation while an overage payment is pending', async () => {
    const order = await additional(); await payExtra(order);
    await expect(service.declineBuyForMeAdditionalPayment({ orderId: order._id, customerId: buyer })).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.adjustBuyForMeOverage({ orderId: order._id, customerId: buyer })).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.adminCancelBuyForMeOrder({ orderId: order._id, actorId: buyer, user: founder, reason: 'Test' })).rejects.toMatchObject({ statusCode: 409 });
  });
  it('refunds late overage capture without reviving a cancelled request', async () => {
    const order = await additional(); const checkout = await payExtra(order);
    await callback(checkout, 'FAILED');
    await service.adminCancelBuyForMeOrder({ orderId: order._id, actorId: buyer, user: founder, reason: 'Test' });
    await callback(checkout); await callback(checkout);
    expect(await Order.findById(order._id).lean()).toMatchObject({ status: 'CANCELED', refundDue: 15000, payment: { totalPaid: 15000 } });
    expect(await Transfer.countDocuments({ type: 'REFUND' })).toBe(2);
  });
  it('refunds an obsolete overage without applying it to a newer request', async () => {
    const order = await additional(); const first = await payExtra(order); await callback(first, 'FAILED');
    const next = await payExtra(order); expect(next.checkoutId).not.toBe(first.checkoutId);
    await callback(first);
    expect((await Order.findById(order._id)).additionalPayment.checkoutId).toBe(next.checkoutId);
    expect((await Order.findById(order._id)).status).toBe('WAITING_CUSTOMER_APPROVAL');
    expect(await Transfer.countDocuments({ checkoutId: first.checkoutId, type: 'REFUND' })).toBe(1);
    await callback(next); expect((await Order.findById(order._id)).status).toBe('RECEIPT_UPLOADED');
  });
  it('rolls back settlement failure and permits retry', async () => {
    const order = await delivered();
    const write = vi.spyOn(Transaction, 'insertMany').mockRejectedValueOnce(new Error('Settlement failure'));
    await expect(service.confirmBuyForMeOrder({ orderId: order._id, customerId: buyer })).rejects.toThrow('Settlement failure');
    expect((await Order.findById(order._id)).status).toBe('DELIVERED'); expect(await Transfer.countDocuments()).toBe(0);
    write.mockRestore(); await service.confirmBuyForMeOrder({ orderId: order._id, customerId: buyer });
    await service.confirmBuyForMeOrder({ orderId: order._id, customerId: buyer });
    expect(await Transfer.countDocuments()).toBe(2);
  });
  it('rolls back a receipt when the order update fails and allows retry', async () => {
    const order = await create();
    await Order.updateOne({ _id: order._id }, { $set: { driverId: driver, status: 'SHOPPING', currentStage: 'SHOPPING' } });
    const input = { orderId: order._id, driverId: driver, actorId: courier, amountSpent: 8000, receiptImageUrl: 'api/buy-for-me/media/' + oid() };
    const save = vi.spyOn(Order.prototype, 'save').mockRejectedValueOnce(new Error('Receipt order failure'));
    await expect(service.uploadBuyForMeReceipt(input)).rejects.toThrow('Receipt order failure');
    save.mockRestore();
    expect(await Receipt.countDocuments()).toBe(0);
    expect((await Order.findById(order._id)).status).toBe('SHOPPING');
    await service.uploadBuyForMeReceipt(input);
    expect(await Receipt.countDocuments()).toBe(1);
    expect((await Order.findById(order._id)).status).toBe('RECEIPT_UPLOADED');
  });
  it('requires staff review before cancelling a disputed request', async () => {
    const order = await create();
    await service.openBuyForMeDispute({ orderId: order._id, customerId: buyer, reason: 'Paiement à vérifier' });
    await expect(service.cancelBuyForMeOrder({ orderId: order._id, customerId: buyer })).rejects.toMatchObject({ statusCode: 409 });
    expect(await Transfer.countDocuments()).toBe(0);
  });
  it('reviews historical countries without writes and backfills only a matching confirmed checkout', async () => {
    const order = await create(), other = await create();
    await Order.updateMany({}, { $set: { countryId: null } });
    await Checkout.updateOne({ checkoutId: other.payment.checkoutId }, { $set: { user: courier } });
    const run = async args => {
      const { stdout } = await promisify(execFile)(process.execPath, ['scripts/reviewShoppingHistory.js', ...args], {
        env: { ...process.env, MONGO_URI: uri, DOTENV_CONFIG_PATH: '/dev/null' }
      });
      return JSON.parse(stdout);
    };
    const report = await run([]);
    expect(report.counts.countryCandidates).toBe(1);
    expect(await Order.countDocuments({ countryId: null })).toBe(2);
    const changed = await run(['--apply-country']);
    expect(changed.counts.countriesFilled).toBe(1);
    expect(String((await Order.findById(order._id)).countryId)).toBe(country);
    expect((await Order.findById(other._id)).countryId).toBeNull();
    expect(await Transaction.countDocuments()).toBe(2);
    expect(await Transfer.countDocuments()).toBe(0);
  });
  it('serializes simultaneous confirmations without duplicate financial obligations', async () => {
    const order = await delivered();
    await Promise.all([1, 2].map(() => service.confirmBuyForMeOrder({ orderId: order._id, customerId: buyer })));
    expect(await Transfer.countDocuments()).toBe(2); expect(await Transaction.countDocuments({ type: 'DRIVER_EARNING' })).toBe(1);
  });
  it('holds settlement for a dispute and provides a country-scoped resolution', async () => {
    const order = await delivered();
    const dispute = await service.openBuyForMeDispute({ orderId: order._id, customerId: buyer, reason: 'Article manquant' });
    await service.openBuyForMeDispute({ orderId: order._id, customerId: buyer, reason: 'Article manquant' });
    expect(await Dispute.countDocuments()).toBe(1);
    await expect(service.confirmBuyForMeOrder({ orderId: order._id, customerId: buyer })).rejects.toMatchObject({ statusCode: 409 });
    await service.resolveShoppingDispute({ disputeId: dispute._id, user: founder, status: 'RESOLVED', resolution: 'Article livré après vérification.' });
    await service.confirmBuyForMeOrder({ orderId: order._id, customerId: buyer });
    expect((await Order.findById(order._id)).status).toBe('COMPLETED');
  });
  it('prevents a new dispute after completed settlement', async () => {
    const order = await delivered(); await service.confirmBuyForMeOrder({ orderId: order._id, customerId: buyer });
    await expect(service.openBuyForMeDispute({ orderId: order._id, customerId: buyer, reason: 'Test' })).rejects.toMatchObject({ statusCode: 409 });
  });
  it('isolates foreign courier claims and country-scoped admin reads/mutations', async () => {
    const order = await create(); const foreign = oid();
    await Driver.updateOne({ _id: driver }, { $set: { countryId: foreign } });
    expect((await service.listDriverBuyForMeJobs({ driverId: driver, scope: 'pool' })).items).toHaveLength(0);
    await expect(service.acceptBuyForMeJob({ orderId: order._id, driverId: driver, actorId: courier })).rejects.toMatchObject({ statusCode: 409 });
    const user = { _id: courier, role: 'admin', adminCountryIds: [foreign] };
    expect((await invoke(getAdminBuyForMeOrders, { user, query: {}, headers: {} })).body.items).toHaveLength(0);
    await expect(service.adminCancelBuyForMeOrder({ orderId: order._id, actorId: courier, user, reason: 'Test' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(shoppingAdminFilter(user, country)).rejects.toMatchObject({ statusCode: 403 });
  });
  it('loads a notified job directly without exposing another courier’s request', async () => {
    const order = await delivered();
    const pool = await create();
    const result = await service.listDriverBuyForMeJobs({ driverId: driver, orderId: String(order._id), scope: 'assigned', limit: 1 });
    expect(result.items.map(item => String(item._id))).toEqual([String(order._id)]);
    expect((await service.listDriverBuyForMeJobs({ driverId: driver, orderId: String(pool._id) })).items).toHaveLength(0);
    await Driver.updateOne({ _id: driver }, { $set: { countryId: oid() } });
    expect((await service.listDriverBuyForMeJobs({ driverId: driver, orderId: String(order._id) })).items).toHaveLength(0);
  });
  it('keeps paid request operations available after the feature is disabled', async () => {
    const order = await create(); flags.isFeatureEnabled.mockResolvedValue({ enabled: false });
    expect((await service.getBuyForMeOrderForCustomer({ orderId: order._id, customerId: buyer }))._id).toEqual(order._id);
    await service.cancelBuyForMeOrder({ orderId: order._id, customerId: buyer });
    expect(await Transfer.countDocuments()).toBe(1);
  });
  it('sends couriers to the authorized job page', async () => {
    const order = await create(); await service.assignBuyForMeDriver({ orderId: order._id, driverId: driver, actorId: buyer, user: founder });
    const notice = notifications.createNotification.mock.calls.map(([value]) => value).find(value => String(value.userId) === courier);
    expect(notice.deepLink).toBe('/delivery/buy-for-me?orderId=' + order._id);
  });
  it('blocks another customer reading or cancelling a request', async () => {
    const order = await create();
    await expect(service.getBuyForMeOrderForCustomer({ orderId: order._id, customerId: courier })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.cancelBuyForMeOrder({ orderId: order._id, customerId: courier })).rejects.toMatchObject({ statusCode: 404 });
  });
  it('keeps a single winner when two couriers claim', async () => {
    const order = await create();
    const results = await Promise.allSettled([1, 2].map(() => service.acceptBuyForMeJob({ orderId: order._id, driverId: driver, actorId: courier })));
    expect(results.filter(item => item.status === 'fulfilled')).toHaveLength(1);
  });
  it('does not mark money transferred on mismatch or delayed failure', async () => {
    const order = await create(); await service.cancelBuyForMeOrder({ orderId: order._id, customerId: buyer });
    const refund = await Transfer.findOne();
    await transfers.reconcileShoppingTransfer(refund.providerId, { status: 'COMPLETED', amount: 1, currency: 'XAF' }, 'REFUND');
    expect((await Transfer.findById(refund._id)).status).toBe('NEEDS_ATTENTION');
    expect((await Order.findById(order._id)).refundedAmount).toBe(0);
    await transfers.reconcileShoppingTransfer(refund.providerId, { status: 'COMPLETED', amount: 12000, currency: 'XAF' }, 'REFUND');
    await transfers.reconcileShoppingTransfer(refund.providerId, { status: 'FAILED' }, 'REFUND');
    expect((await Transfer.findById(refund._id)).status).toBe('COMPLETED');
  });
  it('checks uncertain refunds with the same provider id before resubmission', async () => {
    const order = await create(); provider.initiatePawaPayRefund.mockRejectedValueOnce(new Error('Timeout'));
    await service.cancelBuyForMeOrder({ orderId: order._id, customerId: buyer });
    const refund = await Transfer.findOne(); expect(refund.status).toBe('NEEDS_ATTENTION');
    provider.getPawaPayRefundStatus.mockResolvedValue({ status: 'FOUND', data: { status: 'COMPLETED', amount: 12000, currency: 'XAF' } });
    await transfers.processShoppingTransfer(refund._id, { retry: true });
    expect(provider.initiatePawaPayRefund).toHaveBeenCalledOnce();
    expect((await Transfer.findById(refund._id)).providerId).toBe(refund.providerId);
  });
  it('exposes a pending payout until the courier has a verified account', async () => {
    const order = await delivered(); await User.updateOne({ _id: courier }, { $unset: { payoutAccount: '' } });
    await service.confirmBuyForMeOrder({ orderId: order._id, customerId: buyer });
    expect((await Transfer.findOne({ type: 'PAYOUT' })).status).toBe('WAITING_ACCOUNT');
    expect(provider.initiatePawaPayPayout).not.toHaveBeenCalled();
  });
  it('posts courier earnings and purchase reimbursement only after provider confirmation', async () => {
    const order = await delivered(); await service.confirmBuyForMeOrder({ orderId: order._id, customerId: buyer });
    const payout = await Transfer.findOne({ type: 'PAYOUT' });
    await invoke(receivePawaPayCallback('payout'), { body: { payoutId: payout.providerId, status: 'COMPLETED', amount: 9500, currency: 'XAF' } });
    expect(await Transaction.countDocuments({ type: { $in: ['DRIVER_EARNING', 'DRIVER_REIMBURSEMENT'] }, status: 'COMPLETED' })).toBe(2);
  });
  it('stores receipts privately and allows only the customer, assigned courier or country staff', async () => {
    const order = await create(); await Order.updateOne({ _id: order._id }, { $set: { driverId: driver } });
    const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO2kAAAAASUVORK5CYII=', 'base64');
    const url = await persistShoppingMedia({ file: { buffer }, orderId: order._id, uploadedBy: courier });
    const media = await Media.findById(url.split('/').at(-1)); createdMedia.push(media.filename);
    expect(url).toMatch(/^api\/buy-for-me\/media\//);
    const read = async user => {
      const res = { statusCode: 200, headers: {}, set(value) { Object.assign(this.headers, value); return this; }, status(value) { this.statusCode = value; return this; },
        type(value) { this.contentType = value; return this; }, end() { return this; }, send(value) { this.body = value; return this; } };
      await getShoppingMedia({ params: { id: media._id }, user }, res, error => { throw error; }); return res;
    };
    const buyerResponse = await read({ _id: buyer, role: 'user' });
    expect(buyerResponse.body).toEqual(buffer); expect(buyerResponse.headers['Cache-Control']).toBe('private, no-store');
    expect((await read({ _id: courier, role: 'delivery_agent' })).body).toEqual(buffer);
    expect((await read({ _id: oid(), role: 'user' })).statusCode).toBe(404);
    expect((await read({ _id: oid(), role: 'admin', adminCountryIds: [oid()] })).statusCode).toBe(404);
    expect((await read({ _id: oid(), role: 'admin', adminCountryIds: [country] })).body).toEqual(buffer);
  });
  it('blocks old local receipt URLs even after migration and rejects non-photo uploads', async () => {
    const order = await create();
    await Receipt.create({ orderId: order._id, uploadedBy: courier, storeName: 'Test', amountSpent: 1000, receiptImageUrl: 'uploads/delivery-proofs/audit.jpg' });
    const next = vi.fn(), res = { set: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis(), end: vi.fn() };
    await blockLegacyShoppingReceipts({ path: '/delivery-proofs/audit.jpg' }, res, next);
    expect(res.status).toHaveBeenCalledWith(404); expect(next).not.toHaveBeenCalled();
    res.status.mockClear();
    await blockLegacyShoppingReceipts({ path: '/other/../delivery-proofs/audit.jpg' }, res, next);
    expect(res.status).toHaveBeenCalledWith(404); expect(next).not.toHaveBeenCalled();
    await Receipt.deleteMany({});
    await Media.create({ orderId: order._id, uploadedBy: courier, filename: 'migrated.jpg', contentType: 'image/jpeg', legacyUrl: 'uploads/delivery-proofs/audit.jpg' });
    res.status.mockClear();
    await blockLegacyShoppingReceipts({ path: '/delivery-proofs/audit.jpg' }, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    await expect(persistShoppingMedia({ file: { buffer: Buffer.from('<script>alert(1)</script>') }, orderId: order._id, uploadedBy: courier })).rejects.toMatchObject({ statusCode: 400 });
  });
  it('stores reusable lists without payment data and enforces owner and country on reads and deletion', async () => {
    await Country.updateOne({ _id: country }, { $set: { status: 'ACTIVE' } });
    const req = { user: { _id: buyer, countryId: country }, headers: {}, body: { name: 'Courses', ...payload(), payment: { totalPaid: 10000 }, dropoff: { address: 'Private' } } };
    const saved = await invoke(saveShoppingList, req);
    expect(saved.statusCode).toBe(201);
    const id = String(saved.body._id);
    const record = await ShoppingList.findById(id).lean();
    expect(record).not.toHaveProperty('payment'); expect(record).not.toHaveProperty('dropoff');
    expect(await Checkout.countDocuments()).toBe(0);
    const other = { ...req, user: { _id: courier, countryId: country }, params: { id } };
    expect((await invoke(getShoppingList, other)).statusCode).toBe(404);
    expect((await invoke(deleteShoppingList, other)).statusCode).toBe(404);
    const foreign = oid(); await Country.collection.insertOne({ _id: foreign, code: 'CM', status: 'ACTIVE', currency: { code: 'XAF' } });
    const foreignReq = { ...req, headers: { 'x-country-id': String(foreign) }, params: { id } };
    expect((await invoke(getShoppingLists, foreignReq)).statusCode).toBe(403);
    const selectedForeign = { ...foreignReq, user: { ...req.user, selectedCountryId: foreign } };
    expect((await invoke(getShoppingLists, selectedForeign)).body.items).toHaveLength(0);
    expect((await invoke(getShoppingList, selectedForeign)).statusCode).toBe(404);
    expect((await invoke(getShoppingList, { ...req, params: { id } })).body.name).toBe('Courses');
    expect((await invoke(deleteShoppingList, { ...req, params: { id } })).statusCode).toBe(204);
    expect(await ShoppingList.countDocuments()).toBe(0);
  });
  it('enforces list limits under concurrent requests and rejects malformed items', async () => {
    await Country.updateOne({ _id: country }, { $set: { status: 'ACTIVE' } });
    const req = { user: { _id: buyer, countryId: country }, headers: {}, body: { name: 'Courses', ...payload() } };
    await ShoppingList.insertMany(Array.from({ length: 19 }, (_, i) => ({ ...req.body, name: 'Liste ' + i, userId: buyer, countryId: country })));
    const result = await Promise.all([invoke(saveShoppingList, req), invoke(saveShoppingList, req)]);
    expect(result.map(item => item.statusCode).sort()).toEqual([201, 409]);
    expect(await ShoppingList.countDocuments()).toBe(20);
    expect((await invoke(saveShoppingList, { ...req, body: { ...req.body, items: [null] } })).statusCode).toBe(400);
    expect((await invoke(saveShoppingList, { ...req, body: { ...req.body, items: Array(31).fill({ name: 'Riz', quantity: 1 }) } })).statusCode).toBe(400);
  });
  it('filters active and historical purchases before pagination and keeps counts private', async () => {
    const first = await create(); await create();
    await Order.updateOne({ _id: first._id }, { $set: { status: 'COMPLETED' } });
    const active = await service.listMyBuyForMeOrders({ customerId: buyer, scope: 'active', limit: 1 });
    expect(active.items).toHaveLength(1); expect(active.items[0].status).toBe('SEARCHING_DRIVER');
    expect(active.counts).toEqual({ active: 1, history: 1 });
    const history = await service.listMyBuyForMeOrders({ customerId: buyer, scope: 'history', limit: 1 });
    expect(String(history.items[0]._id)).toBe(String(first._id));
    expect((await service.listMyBuyForMeOrders({ customerId: courier })).counts).toEqual({ active: 0, history: 0 });
  });
});
