// Run only against an explicitly supplied, disposable local replica set.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import Refund from '../models/refundModel.js';
import Checkout from '../models/pawapayCheckoutModel.js';
import RefundDepositLock from '../models/refundDepositLockModel.js';
import Dispute from '../models/disputeModel.js';
import DisputeActionLog from '../models/disputeActionLogModel.js';
import User from '../models/userModel.js';
import { initiateOrderRefund, reconcileRefund, recoverReservedRefund, reconcilePendingRefunds } from './refundService.js';
import { createPawaPayError } from '../utils/pawapayErrors.js';
import { retryAdminDisputeRefund, resolveAdminDispute } from '../controllers/disputeController.js';
import * as provider from './pawapayService.js';
import * as escrow from './escrowService.js';
import * as notifications from '../utils/notificationService.js';
vi.mock('./pawapayService.js', () => ({ initiatePawaPayRefund: vi.fn(), getPawaPayRefundStatus: vi.fn(), getPawaPayCheckoutStatus: vi.fn() }));
vi.mock('./escrowService.js', () => ({ markEscrowRefunded: vi.fn(), releaseEscrowForOrder: vi.fn(), getEscrowSettings: vi.fn(), recordEscrowAudit: vi.fn(), requestAuditContext: vi.fn() }));
vi.mock('../utils/notificationService.js', () => ({ createNotification: vi.fn(), resolveValidationTaskNotifications: vi.fn() }));
vi.mock('../utils/cache.js', () => ({ invalidateAdminCache: vi.fn(), invalidateSellerCache: vi.fn(), invalidateUserCache: vi.fn() }));
const uri = process.env.REFUND_TEST_MONGO_URI;
const id = () => new mongoose.Types.ObjectId();
const country = id(), customer = id(), admin = id();
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });
let order;
const makeOrder = async (amount = 3000) => {
  const raw = { _id: id(), countryId: country, customer, paidAmount: amount,
    paymentSource: 'pawapay', paymentDepositId: 'shared-deposit', paymentCheckoutId: 'checkout',
    status: 'dispute_opened', escrowStatus: 'ON_HOLD', refundStatus: 'none', items: [] };
  await Order.collection.insertOne(raw);
  return Order.findById(raw._id);
};
const initiate = (extra = {}) => initiateOrderRefund({ order, requestedBy: admin, amount: 2000, source: 'ADMIN', ...extra });
describe.skipIf(!uri)('refund persistence and retry concurrency', () => {
  beforeAll(async () => {
    if (!/^mongodb:\/\/127\.0\.0\.1:\d+\/hdmarket_refund_test_[a-z0-9_]+$/i.test(uri)) throw new Error('A disposable local refund test database is required');
    await mongoose.connect(uri, { autoIndex: false });
    await Promise.all([Refund.createCollection(), RefundDepositLock.createCollection(), Order.createCollection(), Dispute.createCollection(), DisputeActionLog.createCollection()]);
    await Refund.collection.createIndex({ refundId: 1 }, { unique: true });
  });
  afterAll(async () => { if (mongoose.connection.readyState) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } });
  beforeEach(async () => {
    vi.clearAllMocks();
    provider.initiatePawaPayRefund.mockResolvedValue({ status: 'ACCEPTED' });
    provider.getPawaPayRefundStatus.mockResolvedValue({ status: 'NOT_FOUND' });
    notifications.createNotification.mockResolvedValue({});
    notifications.resolveValidationTaskNotifications.mockResolvedValue({});
    escrow.recordEscrowAudit.mockResolvedValue({});
    await Promise.all([Order.deleteMany({}), Refund.deleteMany({}), RefundDepositLock.deleteMany({}), Checkout.deleteMany({}), Dispute.deleteMany({}), DisputeActionLog.deleteMany({}), User.deleteMany({})]);
    await Checkout.collection.insertOne({ depositId: 'shared-deposit', checkoutId: 'checkout', amount: 10000 });
    order = await makeOrder();
  });
  it('keeps completion and its timestamp after delayed or duplicate callbacks', async () => {
    const refund = await initiate();
    const completed = await reconcileRefund(refund.refundId, { status: 'COMPLETED', amount: '2000', currency: 'XAF' });
    const notificationsBefore = notifications.createNotification.mock.calls.length;
    for (const status of ['PROCESSING', 'ACCEPTED', 'FAILED', 'COMPLETED']) await reconcileRefund(refund.refundId, { status });
    const stored = await Refund.findById(refund._id);
    const storedOrder = await Order.findById(order._id);
    expect(stored.status).toBe('COMPLETED');
    expect(storedOrder.refundStatus).toBe('processed');
    expect(storedOrder.refundedAt).toEqual(completed.completedAt);
    expect(notifications.createNotification).toHaveBeenCalledTimes(notificationsBefore);
    expect(escrow.releaseEscrowForOrder).toHaveBeenCalledOnce();
  });
  it('keeps terminal status when processing and completion race', async () => {
    const refund = await initiate();
    await Promise.all([reconcileRefund(refund.refundId, { status: 'PROCESSING' }), reconcileRefund(refund.refundId, { status: 'COMPLETED' })]);
    expect((await Refund.findById(refund._id)).status).toBe('COMPLETED');
    expect((await Order.findById(order._id)).refundStatus).toBe('processed');
  });
  it('does not overwrite a callback received before the initiation response', async () => {
    provider.initiatePawaPayRefund.mockImplementationOnce(async ({ refundId }) => {
      await reconcileRefund(refundId, { status: 'COMPLETED' });
      return { status: 'ACCEPTED' };
    });
    expect((await initiate()).status).toBe('COMPLETED');
    expect((await Order.findById(order._id)).refundStatus).toBe('processed');
  });
  it('serializes concurrent attempts into one provider request', async () => {
    const [a, b] = await Promise.all([initiate(), initiate()]);
    expect(a.refundId).toBe(b.refundId);
    expect(await Refund.countDocuments()).toBe(1);
    expect(provider.initiatePawaPayRefund).toHaveBeenCalledOnce();
  });
  it('does not let one order consume another order’s refundable balance', async () => {
    const first = await initiate();
    await reconcileRefund(first.refundId, { status: 'COMPLETED' });
    await expect(initiate({ source: 'DISPUTE_PARTIAL', dispute: id() })).rejects.toMatchObject({ status: 400 });
    expect(provider.initiatePawaPayRefund).toHaveBeenCalledOnce();
  });
  it('blocks another order on the same deposit while a refund is uncertain', async () => {
    provider.initiatePawaPayRefund.mockRejectedValueOnce({ action: 'CHECK_STATUS', retryable: true, message: 'Timeout' });
    const first = await initiate();
    expect(first.status).toBe('NEEDS_ATTENTION');
    await expect(initiate({ order: await makeOrder() })).rejects.toMatchObject({ status: 409 });
    expect(provider.initiatePawaPayRefund).toHaveBeenCalledOnce();
  });
  it('recovers an uncertain request with the same provider ID', async () => {
    provider.initiatePawaPayRefund.mockRejectedValueOnce({ action: 'CHECK_STATUS', retryable: true });
    const first = await initiate();
    await recoverReservedRefund(first);
    expect(await Refund.countDocuments()).toBe(1);
    expect(provider.initiatePawaPayRefund.mock.calls.map(([payload]) => payload.refundId)).toEqual([first.refundId, first.refundId]);
  });
  it('does not resubmit when a status check finds the transfer complete', async () => {
    provider.initiatePawaPayRefund.mockRejectedValueOnce({ action: 'CHECK_STATUS', retryable: true });
    const first = await initiate();
    provider.getPawaPayRefundStatus.mockResolvedValueOnce({ status: 'FOUND', data: { status: 'COMPLETED' } });
    expect((await recoverReservedRefund(first)).status).toBe('COMPLETED');
    expect(provider.initiatePawaPayRefund).toHaveBeenCalledOnce();
  });
  it('holds amount/currency mismatches for review and ignores NOT_FOUND', async () => {
    const first = await initiate();
    await reconcileRefund(first.refundId, { status: 'COMPLETED', amount: 1, currency: 'XAF' });
    expect((await Refund.findById(first._id)).status).toBe('NEEDS_ATTENTION');
    await reconcileRefund(first.refundId, { status: 'NOT_FOUND' });
    expect((await Refund.findById(first._id)).status).toBe('NEEDS_ATTENTION');
    expect((await Order.findById(order._id)).refundStatus).toBe('pending');
  });
  it('recovers order synchronization if local persistence failed after completion', async () => {
    const first = await initiate();
    const update = vi.spyOn(Order, 'findOneAndUpdate').mockRejectedValueOnce(new Error('DB unavailable'));
    await expect(reconcileRefund(first.refundId, { status: 'COMPLETED' })).rejects.toThrow('DB unavailable');
    update.mockRestore();
    await reconcileRefund(first.refundId, { status: 'PROCESSING' });
    expect((await Order.findById(order._id)).refundStatus).toBe('processed');
    expect((await Refund.findById(first._id)).effectsAppliedAt).toBeTruthy();
  });
  it('retries a closed dispute without changing its decision, amount or reputation', async () => {
    const disputeId = id();
    await Dispute.collection.insertOne({ _id: disputeId, countryId: country, orderId: order._id,
      clientId: customer, sellerId: id(), reason: 'damaged_item', description: 'Produit reçu endommagé', sellerDeadline: new Date(),
      status: 'RESOLVED_CLIENT', resolutionType: 'refund_partial', resolutionAmount: 2000, reputationImpactApplied: true, adminDecision: 'Retour accepté' });
    provider.initiatePawaPayRefund.mockRejectedValueOnce(createPawaPayError({ code: 'CONFIG_MISSING', message: 'Configuration rejected', retryable: false }));
    const failed = await initiate({ dispute: disputeId, source: 'DISPUTE_PARTIAL' });
    expect(failed.status).toBe('FAILED');
    const req = { params: { id: String(disputeId) }, user: { id: String(admin), role: 'admin', adminCountryIds: [String(country)] }, body: { resolutionAmount: 9000 } };
    const res = response(), next = vi.fn();
    await retryAdminDisputeRefund(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].refund.amount).toBe(2000);
    expect(provider.initiatePawaPayRefund).toHaveBeenCalledTimes(2);
    expect(provider.initiatePawaPayRefund.mock.calls[1][0].refundId).not.toBe(failed.refundId);
    await retryAdminDisputeRefund(req, response(), vi.fn());
    expect(provider.initiatePawaPayRefund).toHaveBeenCalledTimes(2);
    const dispute = await Dispute.findById(disputeId);
    expect(dispute.status).toBe('RESOLVED_CLIENT');
    expect(dispute.reputationImpactApplied).toBe(true);
    expect(dispute.adminDecision).toBe('Retour accepté');
    expect(await DisputeActionLog.countDocuments({ action: 'REFUND_RETRIED' })).toBe(2);
  });
  it('rejects a refund retry by another country’s admin', async () => {
    const disputeId = id();
    await Dispute.collection.insertOne({ _id: disputeId, countryId: country, orderId: order._id, status: 'RESOLVED_CLIENT', resolutionType: 'refund_full', resolutionAmount: 3000 });
    const res = response();
    await retryAdminDisputeRefund({ params: { id: String(disputeId) }, user: { id: String(admin), role: 'admin', adminCountryIds: [String(id())] } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(provider.initiatePawaPayRefund).not.toHaveBeenCalled();
  });
  it('treats an interrupted response body as uncertain, preserving the same attempt', async () => {
    provider.initiatePawaPayRefund.mockRejectedValueOnce(new Error('Body stream interrupted'));
    const first = await initiate();
    expect(first.status).toBe('NEEDS_ATTENTION');
    expect((await initiate()).refundId).toBe(first.refundId);
    expect(provider.initiatePawaPayRefund).toHaveBeenCalledOnce();
  });
  it('preserves uncertainty when the provider asks for a status check despite HTTP 400', async () => {
    provider.initiatePawaPayRefund.mockRejectedValueOnce(createPawaPayError({
      code: 'UNKNOWN_ERROR', action: 'CHECK_STATUS', meta: { providerStatus: 400 }
    }));
    const first = await initiate();
    expect(first.status).toBe('NEEDS_ATTENTION');
    expect((await initiate()).refundId).toBe(first.refundId);
    expect(provider.initiatePawaPayRefund).toHaveBeenCalledOnce();
  });
  it('holds malformed provider amounts instead of completing the refund', async () => {
    const first = await initiate();
    expect((await reconcileRefund(first.refundId, { status: 'COMPLETED', amount: 'invalid', currency: 'XAF' })).status).toBe('NEEDS_ATTENTION');
    expect(escrow.markEscrowRefunded).not.toHaveBeenCalled();
    expect(escrow.releaseEscrowForOrder).not.toHaveBeenCalled();
  });
  it('ignores pending updates after a definitive failure', async () => {
    const first = await initiate();
    await reconcileRefund(first.refundId, { status: 'FAILED' });
    await reconcileRefund(first.refundId, { status: 'PROCESSING' });
    expect((await Refund.findById(first._id)).status).toBe('FAILED');
    expect((await Order.findById(order._id)).refundStatus).toBe('failed');
  });
  it('keeps a later partial refund pending when an older completion is replayed', async () => {
    const first = await initiate();
    await reconcileRefund(first.refundId, { status: 'COMPLETED' });
    const later = await initiate({ source: 'DISPUTE_PARTIAL', dispute: id(), amount: 1000 });
    await reconcileRefund(later.refundId, { status: 'PROCESSING' });
    await Refund.updateOne({ refundId: first.refundId }, { $set: { effectsPending: true } });
    escrow.releaseEscrowForOrder.mockClear();
    await reconcileRefund(first.refundId, { status: 'COMPLETED' });
    expect(await Order.findById(order._id)).toMatchObject({ refundStatus: 'pending', refundId: later.refundId, refundAmount: 1000, refundedAt: null });
    expect(escrow.releaseEscrowForOrder).not.toHaveBeenCalled();
    expect((await Refund.findOne({ refundId: first.refundId })).effectsPending).toBe(false);
  });
  it('does not apply an old failure to the current retry', async () => {
    const first = await initiate();
    await reconcileRefund(first.refundId, { status: 'FAILED' });
    const retry = await initiate();
    await Refund.updateOne({ refundId: first.refundId }, { $set: { effectsPending: true } });
    await reconcileRefund(first.refundId, { status: 'FAILED' });
    expect(await Order.findById(order._id)).toMatchObject({ refundStatus: 'pending', refundId: retry.refundId, refundFailureReason: '' });
    expect((await Refund.findById(first._id)).effectsPending).toBe(false);
  });
  it('restores a missing historical order reference using its latest refund', async () => {
    const first = await initiate();
    await Order.updateOne({ _id: order._id }, { $unset: { refundId: 1 } });
    await reconcileRefund(first.refundId, { status: 'COMPLETED' });
    expect(await Order.findById(order._id)).toMatchObject({ refundStatus: 'processed', refundId: first.refundId });
    expect((await Refund.findById(first._id)).effectsPending).toBe(false);
  });
  it('blocks a new attempt until the previous terminal result is synchronized', async () => {
    const first = await initiate();
    const update = vi.spyOn(Order, 'findOneAndUpdate').mockRejectedValueOnce(new Error('DB unavailable'));
    await expect(reconcileRefund(first.refundId, { status: 'COMPLETED' })).rejects.toThrow('DB unavailable');
    update.mockRestore();
    const next = { source: 'DISPUTE_PARTIAL', dispute: id(), amount: 1000 };
    await expect(initiate(next)).rejects.toMatchObject({ status: 409 });
    await reconcileRefund(first.refundId, { status: 'COMPLETED' });
    expect((await initiate(next)).status).toBe('PROCESSING');
  });
  it('does not resubmit or clear a mismatched transfer without matching provider details', async () => {
    const first = await initiate();
    const held = await reconcileRefund(first.refundId, { status: 'COMPLETED', amount: 1, currency: 'XAF' });
    await recoverReservedRefund(held);
    expect(provider.initiatePawaPayRefund).toHaveBeenCalledOnce();
    expect((await reconcileRefund(first.refundId, { status: 'PROCESSING' })).status).toBe('NEEDS_ATTENTION');
    expect((await reconcileRefund(first.refundId, { status: 'COMPLETED', amount: 2000, currency: 'XAF' })).status).toBe('COMPLETED');
  });
  it('recovers an abandoned reservation in the background using the original ID', async () => {
    const first = await initiate();
    await Refund.collection.updateOne({ _id: first._id }, { $set: { status: 'CREATED', createdAt: new Date(Date.now() - 120_000) } });
    await reconcilePendingRefunds();
    expect(provider.initiatePawaPayRefund.mock.calls.map(([payload]) => payload.refundId)).toEqual([first.refundId, first.refundId]);
    expect((await Refund.findById(first._id)).status).toBe('PROCESSING');
  });
  it('sums completed partial refunds before marking the order fully refunded', async () => {
    const first = await initiate();
    await reconcileRefund(first.refundId, { status: 'COMPLETED' });
    const final = await initiate({ source: 'DISPUTE_PARTIAL', dispute: id(), amount: 1000 });
    await reconcileRefund(final.refundId, { status: 'COMPLETED' });
    expect((await Order.findById(order._id)).refundAmount).toBe(3000);
    expect(escrow.markEscrowRefunded).toHaveBeenCalledOnce();
  });
  it('commits only one concurrent dispute decision and reputation adjustment', async () => {
    const disputeId = id(), seller = id();
    await User.collection.insertMany([{ _id: customer, reputationScore: 0 }, { _id: seller, reputationScore: 0 }]);
    await Dispute.collection.insertOne({ _id: disputeId, countryId: country, orderId: order._id,
      clientId: customer, sellerId: seller, reason: 'damaged_item', description: 'Produit reçu endommagé', sellerDeadline: new Date(), status: 'OPEN' });
    const request = (amount) => ({ params: { id: String(disputeId) }, user: { id: String(admin), role: 'admin', adminCountryIds: [String(country)] },
      body: { resolutionType: 'refund_partial', resolutionAmount: amount, adminDecision: 'Remboursement accepté' } });
    const a = response(), b = response(), next = vi.fn();
    await Promise.all([resolveAdminDispute(request(1000), a, next), resolveAdminDispute(request(2000), b, next)]);
    expect(next).not.toHaveBeenCalled();
    expect([a, b].filter(res => res.status.mock.calls.some(([status]) => [400, 409].includes(status)))).toHaveLength(1);
    const dispute = await Dispute.findById(disputeId);
    expect(dispute.status).toBe('RESOLVED_CLIENT');
    expect((await User.findById(customer)).reputationScore).toBe(1);
    expect((await User.findById(seller)).reputationScore).toBe(-2);
    expect(await DisputeActionLog.countDocuments({ action: 'ADMIN_RESOLVED' })).toBe(1);
    expect(provider.initiatePawaPayRefund).toHaveBeenCalledOnce();
    expect(provider.initiatePawaPayRefund.mock.calls[0][0].amount).toBe(String(dispute.resolutionAmount));
  });
});
