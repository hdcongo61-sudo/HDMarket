import crypto from 'crypto';
import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import PawaPayCheckout from '../models/pawapayCheckoutModel.js';
import Refund from '../models/refundModel.js';
import RefundDepositLock from '../models/refundDepositLockModel.js';
import User from '../models/userModel.js';
import {
  getPawaPayCheckoutStatus,
  getPawaPayRefundStatus,
  initiatePawaPayRefund
} from './pawapayService.js';
import { createNotification } from '../utils/notificationService.js';
import { invalidateAdminCache, invalidateSellerCache, invalidateUserCache } from '../utils/cache.js';
import { markEscrowRefunded, releaseEscrowForOrder } from './escrowService.js';

const SUCCESS = new Set(['COMPLETED', 'SUCCESSFUL']);
const FAILURE = new Set(['FAILED', 'REJECTED', 'CANCELLED']);
const ACTIVE = ['CREATED', 'PROCESSING', 'NEEDS_ATTENTION'];
const MISMATCH_CODES = ['AMOUNT_MISMATCH', 'CURRENCY_MISMATCH'];
const hasProviderMismatch = (refund) => MISMATCH_CODES.includes(refund.failureReason?.failureCode);

const clean = (value) => {
  if (value == null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
};

const providerData = (payload) =>
  String(payload?.status || '').toUpperCase() === 'FOUND' && payload?.data
    ? payload.data
    : payload;

const findDeposit = (payload) => {
  const data = providerData(payload) || {};
  const completed = Array.isArray(data.depositsHistory)
    ? data.depositsHistory.find((item) => SUCCESS.has(String(item?.status || '').toUpperCase()))
    : null;
  return data.deposit || completed || null;
};

const failureMessage = (payload) => {
  const data = providerData(payload) || {};
  const reason = data.failureReason || data.rejectionReason || payload?.failureReason;
  return String(reason?.failureMessage || reason?.message || reason?.failureCode || reason || '').slice(0, 500);
};

const notifyTerminalRefund = async (refund, order, succeeded) => {
  const amount = Number(refund.amount || 0).toLocaleString('fr-FR');
  const message = succeeded
    ? `Le remboursement PawaPay de ${amount} FCFA pour la commande #${String(order._id).slice(-6)} est confirmé.`
    : `Le remboursement PawaPay de ${amount} FCFA pour la commande #${String(order._id).slice(-6)} a échoué et nécessite une intervention.`;
  const recipients = new Set([String(order.customer || '')]);
  const sellerId = order.items?.[0]?.snapshot?.shopId;
  if (sellerId) recipients.add(String(sellerId));
  const staff = await User.find({
    $or: [{ role: 'founder' }, { role: 'admin' }, { role: 'manager' }, { canVerifyPayments: true }]
  }).select('_id').lean();
  staff.forEach((user) => recipients.add(String(user._id)));
  await Promise.all(
    [...recipients].filter(Boolean).map((userId) =>
      createNotification({
        userId,
        type: 'admin_broadcast',
        allowSelf: true,
        deepLink: `/orders/detail/${order._id}`,
        entityType: 'order',
        entityId: String(order._id),
        metadata: {
          message,
          orderId: order._id,
          refundId: refund.refundId,
          refundAmount: refund.amount,
          refundStatus: succeeded ? 'processed' : 'failed'
        }
      }).catch(() => {})
    )
  );
};

export const resolveOrderDepositId = async (order) => {
  if (order.paymentDepositId) return order.paymentDepositId;
  let checkoutId = String(order.paymentCheckoutId || order.paymentTransactionCode || '').trim();
  let checkout = checkoutId
    ? await PawaPayCheckout.findOne({ checkoutId })
    : await PawaPayCheckout.findOne({
        user: order.customer,
        'completionResult.orderIds': String(order._id)
      }).sort({ confirmedAt: -1 });
  if (!checkout) {
    // Orders created before checkout references were stored can still be linked
    // through the automatic-completion result. We deliberately avoid guessing
    // from amount/date alone because one checkout can contain several shops.
    return '';
  }
  checkoutId = checkout.checkoutId;
  if (!checkout.depositId) {
    const status = await getPawaPayCheckoutStatus(checkoutId, { timeoutMs: 12_000 });
    const deposit = findDeposit(status);
    if (deposit?.depositId) {
      checkout.depositId = String(deposit.depositId);
      checkout.depositStatus = String(deposit.status || '').toUpperCase();
      checkout.providerTransactionId = String(deposit.providerTransactionId || checkout.providerTransactionId || '');
      await checkout.save();
    }
  }
  if (checkout.depositId) {
    order.paymentCheckoutId = checkoutId;
    order.paymentDepositId = checkout.depositId;
    await order.save();
  }
  return String(checkout.depositId || '');
};

export const reconcileRefund = async (refundId, payload) => {
  let refund = await Refund.findOne({ refundId });
  if (!refund) return null;
  // A stale callback (or a status check started before completion) must never
  // undo a terminal result. The database condition below also covers races.
  if (SUCCESS.has(refund.status) || FAILURE.has(refund.status)) {
    return refund.effectsPending ? synchronizeRefundOrder(refund) : refund;
  }
  const data = providerData(payload) || {};
  const status = String(data.status || payload?.status || '').toUpperCase();
  const rawAmount = data.amount ?? payload?.amount;
  const receivedAmount = rawAmount == null ? NaN : Number(rawAmount);
  const receivedCurrency = String(data.currency || payload?.currency || '').toUpperCase();

  // An incomplete status response must not erase a previously detected mismatch.
  if (hasProviderMismatch(refund) &&
    (!Number.isFinite(receivedAmount) || !receivedCurrency)) return refund;

  if (!SUCCESS.has(status) && !FAILURE.has(status) &&
    !['ACCEPTED', 'PROCESSING', 'SUBMITTED', 'ENQUEUED'].includes(status)) return refund;
  const updates = {
    rawResponse: clean(payload),
    providerTransactionId: String(data.providerTransactionId || refund.providerTransactionId || ''),
    failureReason: clean(data.failureReason || data.rejectionReason || null)
  };
  if (rawAmount != null && (!Number.isFinite(receivedAmount) || Math.abs(receivedAmount - Number(refund.amount)) > 0.01)) {
    updates.status = 'NEEDS_ATTENTION';
    updates.failureReason = {
      failureCode: 'AMOUNT_MISMATCH',
      expectedAmount: refund.amount,
      receivedAmount: Number.isFinite(receivedAmount) ? receivedAmount : String(rawAmount)
    };
  } else if (receivedCurrency && receivedCurrency !== refund.currency) {
    updates.status = 'NEEDS_ATTENTION';
    updates.failureReason = {
      failureCode: 'CURRENCY_MISMATCH',
      expectedCurrency: refund.currency,
      receivedCurrency
    };
  } else if (SUCCESS.has(status)) {
    updates.status = 'COMPLETED';
    updates.completedAt = new Date();
    updates.effectsPending = true;
  } else if (FAILURE.has(status)) {
    updates.status = 'FAILED';
    updates.failedAt = new Date();
    updates.effectsPending = true;
  } else {
    updates.status = 'PROCESSING';
  }
  refund = await Refund.findOneAndUpdate(
    { refundId, status: { $in: ACTIVE },
      ...(!Number.isFinite(receivedAmount) || !receivedCurrency
        ? { 'failureReason.failureCode': { $nin: MISMATCH_CODES } } : {})
    }, { $set: updates }, { new: true }
  );
  if (!refund) return Refund.findOne({ refundId });
  return synchronizeRefundOrder(refund);
};

const synchronizeRefundOrder = async (refund) => {
  if (refund.installmentBatchId) {
    const { synchronizeInstallmentRefundBatch } = await import('./installmentRefundService.js');
    await synchronizeInstallmentRefundBatch(refund.installmentBatchId);
    return refund;
  }
  const terminal = SUCCESS.has(refund.status) || FAILURE.has(refund.status);
  // Older records can lack the order reference. Only the newest attempt may
  // restore it; never let a replay take ownership from a later refund.
  const latest = await Refund.findOne({ order: refund.order }).sort({ createdAt: -1, _id: -1 }).select('refundId');
  const referenceFilter = latest?.refundId === refund.refundId
    ? { $or: [{ refundId: refund.refundId }, { refundId: null }, { refundId: '' }] }
    : { refundId: refund.refundId };
  const totals = refund.status === 'COMPLETED' ? await Refund.aggregate([
    { $match: { order: refund.order, status: 'COMPLETED' } },
    { $group: { _id: null, amount: { $sum: '$amount' } } }
  ]) : [];
  const refundedAmount = Number(totals[0]?.amount || refund.amount);
  const orderUpdates = {
    refundId: refund.refundId,
    refundAmount: refundedAmount,
    refundMethod: 'pawapay',
    refundStatus: refund.status === 'COMPLETED' ? 'processed' : refund.status === 'FAILED' ? 'failed' : 'pending',
    refundedAt: refund.status === 'COMPLETED' ? refund.completedAt : null,
    refundFailureReason: refund.status === 'FAILED' ? failureMessage({ failureReason: refund.failureReason }) || 'Le remboursement PawaPay a échoué.' : ''
  };
  const order = await Order.findOneAndUpdate(
    { _id: refund.order, ...referenceFilter,
      ...(!terminal ? { refundStatus: { $nin: ['processed', 'failed'] } } :
        refund.status !== 'COMPLETED' ? { refundStatus: { $ne: 'processed' } } : {}) },
    { $set: orderUpdates }, { new: true }
  );
  if (order) {
    if (refund.status === 'COMPLETED' && String(order.paymentSource || '').toLowerCase() === 'pawapay') {
      if (refundedAmount >= Number(order.paidAmount || 0)) {
        await markEscrowRefunded({
          order,
          expectedRefundId: refund.refundId,
          actor: refund.requestedBy || null,
          disputeId: refund.dispute || null
        });
      } else if (['ON_HOLD', 'WAITING_BUYER_CONFIRMATION'].includes(order.escrowStatus)) {
        await Order.updateOne({ _id: order._id, refundId: refund.refundId, escrowStatus: 'ON_HOLD' }, {
          $set: { escrowStatus: 'WAITING_BUYER_CONFIRMATION', disputeOpened: false, autoReleaseAt: null }
        });
        await releaseEscrowForOrder({
          order,
          expectedRefundId: refund.refundId,
          actor: refund.requestedBy || null,
          actorRole: refund.requestedBy ? 'admin' : 'system',
          reason: 'ADMIN_RELEASE'
        });
      }
    }
    await Promise.allSettled([
      invalidateUserCache(order.customer, ['orders', 'notifications']),
      order.items?.[0]?.snapshot?.shopId
        ? invalidateSellerCache(order.items[0].snapshot.shopId, ['orders', 'notifications'])
        : Promise.resolve(),
      invalidateAdminCache(['admin', 'orders'])
    ]);
    if (terminal) {
      const notify = await Refund.findOneAndUpdate({ refundId: refund.refundId, terminalNotifiedAt: null }, {
        $set: { terminalNotifiedAt: new Date() }
      });
      if (notify) await notifyTerminalRefund(refund, order, refund.status === 'COMPLETED');
    }
  }
  const superseded = !order && terminal && await Order.exists({
    _id: refund.order, refundId: { $nin: [refund.refundId, '', null] }
  });
  if (terminal && (order || superseded)) {
    await Refund.updateOne({ refundId: refund.refundId }, { $set: { effectsAppliedAt: new Date(), effectsPending: false } });
  }
  return refund;
};

export const initiateOrderRefund = async ({
  order,
  requestedBy,
  amount,
  source,
  dispute = null
}) => {
  if (order.paymentType === 'installment') {
    const { initiateInstallmentRefund } = await import('./installmentRefundService.js');
    return initiateInstallmentRefund({ order, requestedBy, amount, source, dispute });
  }
  if (String(order.paymentSource || '').toLowerCase() !== 'pawapay') {
    throw Object.assign(new Error('Seules les commandes payées avec PawaPay peuvent être remboursées automatiquement.'), {
      status: 400
    });
  }
  const depositId = await resolveOrderDepositId(order);
  if (!depositId) {
    throw Object.assign(new Error('Le dépôt PawaPay original est introuvable. Le remboursement ne peut pas être lancé.'), {
      status: 409
    });
  }

  const requestedAmount = Number(amount);
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || !Number.isInteger(requestedAmount)) {
    throw Object.assign(new Error('Le montant du remboursement doit être un nombre entier de FCFA.'), { status: 400 });
  }
  if (requestedAmount - Number(order.paidAmount || 0) > 0.01) {
    throw Object.assign(new Error('Le remboursement ne peut pas dépasser le montant payé pour cette commande.'), {
      status: 400
    });
  }
  const operationKey = `${order._id}:${dispute || source}`;
  try {
    await RefundDepositLock.updateOne({ _id: depositId }, { $setOnInsert: { revision: 0 } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  const session = await mongoose.startSession();
  let refund, created;
  try {
    await session.withTransaction(async () => {
      created = false;
      await RefundDepositLock.updateOne({ _id: depositId }, { $inc: { revision: 1 } }, { session });
      // Match historical attempts by dispute/source as well as new operation keys.
      refund = await Refund.findOne({ order: order._id,
        ...(dispute ? { dispute } : { source, dispute: null }),
        status: { $in: [...ACTIVE, 'COMPLETED'] }
      }).session(session).sort({ createdAt: -1 });
      if (refund) return;
      const busy = await Refund.exists({ depositId, $or: [
        { status: { $in: ACTIVE } },
        { status: { $in: ['COMPLETED', 'FAILED'] }, effectsPending: true }
      ] }).session(session);
      if (busy) throw Object.assign(new Error('Un remboursement lié à ce paiement est déjà en cours. Réessayez après sa confirmation.'), { status: 409 });
      const completed = await Refund.find({ depositId, status: 'COMPLETED' }).session(session).lean();
      const depositRefunded = completed.reduce((sum, item) => sum + Number(item.amount), 0);
      const orderRefunded = completed.filter(item => String(item.order) === String(order._id)).reduce((sum, item) => sum + Number(item.amount), 0);
      const checkout = await PawaPayCheckout.findOne({ depositId }).session(session).lean();
      if (requestedAmount > Number(order.paidAmount) - orderRefunded ||
        requestedAmount > Number(checkout?.amount || order.paidAmount) - depositRefunded) {
        throw Object.assign(new Error('Le montant dépasse le solde remboursable de la commande ou du paiement.'), { status: 400 });
      }
      [refund] = await Refund.create([{
        refundId: crypto.randomUUID(), operationKey, depositId,
        countryId: order.countryId || null,
        checkoutId: String(order.paymentCheckoutId || order.paymentTransactionCode || ''),
        order: order._id, customer: order.customer, requestedBy, dispute, source,
        amount: requestedAmount, currency: 'XAF'
      }], { session });
      await Order.updateOne({ _id: order._id }, { $set: {
        refundStatus: 'pending', refundAmount: requestedAmount, refundRequestedBy: requestedBy,
        refundRequestedAt: new Date(), refundMethod: 'pawapay', refundId: refund.refundId,
        refundedAt: null, refundFailureReason: ''
      } }, { session });
      created = true;
    });
  } finally {
    await session.endSession();
  }
  if (!created) return refund;
  return submitReservedRefund(refund);
};

const submitReservedRefund = async (refund) => {
  let response;
  try {
    response = await initiatePawaPayRefund({
      refundId: refund.refundId,
      depositId: refund.depositId,
      amount: String(refund.amount),
      currency: refund.currency,
      clientReferenceId: String(refund.order),
      metadata: [
        { orderId: String(refund.order) },
        { source: refund.source }
      ]
    });
  } catch (error) {
    const requiresStatusCheck = (error?.details?.action || error?.action) === 'CHECK_STATUS';
    const definitelyRejected = !requiresStatusCheck && (
      ['PAWAPAY_CONFIG_DISABLED', 'PAWAPAY_CONFIG_MISSING'].includes(error?.code) ||
      String(error?.meta?.providerResponse?.status || '').toUpperCase() === 'REJECTED' ||
      [400, 401, 403, 404, 422].includes(error?.meta?.providerStatus)
    );
    if (definitelyRejected) {
      return reconcileRefund(refund.refundId, { status: 'FAILED', failureReason: { message: error?.message } });
    }
    await Refund.updateOne({ refundId: refund.refundId, status: { $in: ACTIVE } }, { $set: {
      status: 'NEEDS_ATTENTION', rawResponse: clean(error?.meta?.providerResponse || null),
      failureReason: clean(error?.details || error?.message)
    } });
    return Refund.findOne({ refundId: refund.refundId });
  }
  // Keep database errors outside the provider-failure handler: a successful
  // transfer must never be labelled failed because local persistence failed.
  await Refund.updateOne({ refundId: refund.refundId, status: { $in: ACTIVE } }, {
    $set: { status: 'PROCESSING', initiatedAt: new Date(), rawResponse: clean(response) }
  });
  return reconcileRefund(refund.refundId, response);
};

export const recoverReservedRefund = async (refund) => {
  if (refund?.constructor?.modelName === 'InstallmentRefundBatch') {
    const { processInstallmentRefundBatch } = await import('./installmentRefundService.js');
    return processInstallmentRefundBatch(refund.refundId);
  }
  if (refund) refund = await Refund.findById(refund._id);
  if (!refund || !['CREATED', 'NEEDS_ATTENTION'].includes(refund.status)) return refund;
  const status = await getPawaPayRefundStatus(refund.refundId, { timeoutMs: 12_000 });
  if (String(status?.status || '').toUpperCase() === 'NOT_FOUND') {
    if (hasProviderMismatch(refund)) return refund;
    // Reuse the provider id even if an earlier request's outcome is uncertain.
    return submitReservedRefund(refund);
  }
  return reconcileRefund(refund.refundId, status);
};

export const reconcilePendingRefunds = async ({ limit = 25 } = {}) => {
  const { reconcileCancellationRefunds } = await import('./orderCancellationService.js');
  await reconcileCancellationRefunds({ limit });
  const { reconcileInstallmentRefunds } = await import('./installmentRefundService.js');
  await reconcileInstallmentRefunds({ limit });
  const refunds = await Refund.find({
    $and: [{ $or: [
      { status: { $in: ACTIVE } },
      { status: { $in: ['COMPLETED', 'FAILED'] }, effectsPending: true }
    ] }, { $or: [
      { lastProviderStatusCheckAt: null },
      { lastProviderStatusCheckAt: { $lt: new Date(Date.now() - 60_000) } }
    ] }]
  }).sort({ createdAt: 1 }).limit(limit);
  for (const refund of refunds) {
    await Refund.updateOne({ refundId: refund.refundId }, { $set: { lastProviderStatusCheckAt: new Date() } });
    try {
      if (SUCCESS.has(refund.status) || FAILURE.has(refund.status)) {
        await synchronizeRefundOrder(refund);
        continue;
      }
      if (['CREATED', 'NEEDS_ATTENTION'].includes(refund.status) &&
        refund.createdAt <= new Date(Date.now() - 60_000)) {
        await recoverReservedRefund(refund);
        continue;
      }
      const status = await getPawaPayRefundStatus(refund.refundId, { timeoutMs: 12_000 });
      await reconcileRefund(refund.refundId, status);
    } catch {
      // A callback or the next scheduled pass will safely retry this status check.
    }
  }
  return refunds.length;
};
