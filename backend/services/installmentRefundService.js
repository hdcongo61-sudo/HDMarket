import crypto from 'node:crypto';
import Order from '../models/orderModel.js';
import Checkout from '../models/pawapayCheckoutModel.js';
import Refund from '../models/refundModel.js';
import Batch from '../models/installmentRefundBatchModel.js';
import RefundDepositLock from '../models/refundDepositLockModel.js';
import { withCommerceOperation } from './commerceOperationService.js';
import { importLegacyInstallmentReceipts, installmentOrderKey, installmentError } from './installmentPaymentService.js';
import { getPawaPayCheckoutStatus } from './pawapayService.js';
import { markEscrowRefunded, releaseEscrowForOrder } from './escrowService.js';
import { createNotification } from '../utils/notificationService.js';
import { invalidateUserCache, invalidateSellerCache, invalidateAdminCache } from '../utils/cache.js';

const ACTIVE = ['CREATED', 'PROCESSING', 'NEEDS_ATTENTION'];

const depositIdsForOrder = order => [...new Set(order.installmentPayments.map(receipt => receipt.depositId).filter(Boolean))].sort();
const ensureDepositLocks = async order => {
  for (const depositId of depositIdsForOrder(order)) {
    try {
      await RefundDepositLock.updateOne({ _id: depositId }, { $setOnInsert: { revision: 0 } }, { upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
};

const resolveDeposits = async order => {
  await importLegacyInstallmentReceipts(order);
  for (const receipt of order.installmentPayments) {
    if (receipt.depositId) continue;
    let checkout = await Checkout.findOne({ checkoutId: receipt.checkoutId, user: order.customer, paymentState: 'CONFIRMED' });
    if (!checkout) throw installmentError('Référence du paiement introuvable. Vérification nécessaire.');
    if (!checkout.depositId) {
      const response = await getPawaPayCheckoutStatus(checkout.checkoutId, { timeoutMs: 12000 });
      const data = response?.data || response;
      const deposit = data?.deposit || data?.depositsHistory?.find(item => ['COMPLETED', 'SUCCESSFUL'].includes(item.status));
      if (deposit?.depositId) {
        checkout = await Checkout.findOneAndUpdate({ _id: checkout._id }, { $set: { depositId: deposit.depositId } }, { new: true });
      }
    }
    if (!checkout.depositId) throw installmentError('Le dépôt est en cours de vérification. Le remboursement sera repris automatiquement.');
    receipt.depositId = checkout.depositId;
  }
  return order.installmentPayments.map(receipt => receipt.toObject ? receipt.toObject() : receipt);
};

export const initiateInstallmentRefund = async ({ order: sourceOrder, requestedBy, amount, source, dispute = null,
  operationSuffix = '', checkoutIds = null, retry = true }) => {
  const amountNumber = Number(amount);
  if (!Number.isSafeInteger(amountNumber) || amountNumber <= 0) throw installmentError('Le remboursement doit être un montant entier de FCFA.', 400);
  const order = await Order.findById(sourceOrder._id);
  const receipts = await resolveDeposits(order);
  await ensureDepositLocks(order);
  const operationKey = `${order._id}:${dispute || source}:${operationSuffix}`;
  const batch = await withCommerceOperation(installmentOrderKey(order._id), async session => {
    const current = await Order.findById(order._id).session(session);
    let existing = await Batch.findOne({ operationKey }).session(session);
    if (existing) {
      if (existing.status === 'FAILED' && retry) { existing.status = 'CREATED'; existing.failureReason = ''; await existing.save({ session }); }
      return existing;
    }
    const busy = await Batch.exists({ order: order._id, status: { $in: ['CREATED', 'PROCESSING'] } }).session(session);
    if (busy) throw installmentError('Un remboursement est déjà en cours pour cette commande.');
    // Merge deposit references without overwriting a payment received while the
    // provider lookup was running.
    for (const receipt of receipts) {
      const saved = current.installmentPayments.find(item => item.checkoutId === receipt.checkoutId);
      if (saved) saved.depositId = receipt.depositId;
      else current.installmentPayments.push(receipt);
    }
    const completed = await Refund.find({ order: current._id, status: 'COMPLETED' }).session(session).lean();
    const captured = current.installmentPayments.reduce((sum, item) => sum + item.amount, 0);
    if (amountNumber > captured - completed.reduce((sum, item) => sum + item.amount, 0)) throw installmentError('Le montant dépasse le solde remboursable.', 400);
    const [created] = await Batch.create([{ refundId: crypto.randomUUID(), operationKey, order: order._id, requestedBy: requestedBy || current.customer,
      source, dispute, amount: amountNumber, checkoutIds: checkoutIds || [] }], { session });
    await reserveBatchRefunds(created, current, session, checkoutIds);
    current.refundId = created.refundId;
    current.refundStatus = 'pending';
    current.refundAmount = amountNumber;
    current.refundRequestedBy = requestedBy || current.customer;
    current.refundRequestedAt = new Date();
    current.refundMethod = 'pawapay';
    current.refundFailureReason = '';
    current.installmentRefundRequired = false;
    await current.save({ session });
    return created;
  });
  await processInstallmentRefundBatch(batch.refundId);
  return Batch.findOne({ refundId: batch.refundId });
};

const reserveBatchRefunds = async (batch, order, session, checkoutIds = null) => {
  // Share the ordinary-refund lock: historical duplicate orders can refer to
  // the same deposit, even though their order-level locks are different.
  for (const depositId of depositIdsForOrder(order)) {
    await RefundDepositLock.updateOne({ _id: depositId }, { $inc: { revision: 1 } }, { session, upsert: true });
  }
  const previous = await Refund.find({ installmentBatchId: batch.refundId, status: { $in: [...ACTIVE, 'COMPLETED'] } }).session(session).lean();
  let left = batch.amount - previous.reduce((sum, item) => sum + item.amount, 0);
  for (const receipt of order.installmentPayments) {
    if (left <= 0) break;
    if (checkoutIds && !checkoutIds.includes(receipt.checkoutId)) continue;
    if (!receipt.depositId) throw installmentError('Dépôt manquant pour le remboursement.');
    const prior = await Refund.find({ depositId: receipt.depositId, status: { $in: [...ACTIVE, 'COMPLETED'] } }).session(session).lean();
    const checkout = await Checkout.findOne({ checkoutId: receipt.checkoutId }).session(session).lean();
    const available = Math.min(receipt.amount, Number(checkout?.amount || 0)) - prior.reduce((sum, item) => sum + item.amount, 0);
    const part = Math.min(left, Math.max(0, available));
    if (!part) continue;
    await Refund.create([{ refundId: crypto.randomUUID(), installmentBatchId: batch.refundId, operationKey: batch.operationKey,
      depositId: receipt.depositId, checkoutId: receipt.checkoutId, order: order._id, customer: order.customer, requestedBy: batch.requestedBy,
      countryId: order.countryId, source: batch.source, dispute: batch.dispute, amount: part, currency: order.currency }], { session });
    left -= part;
  }
  if (left > 0) throw installmentError('Le montant dépasse les dépôts disponibles pour le remboursement.', 400);
};

export const processInstallmentRefundBatch = async refundId => {
  const batch = await Batch.findOne({ refundId });
  if (!batch) return null;
  if (batch.status === 'CREATED') {
    await ensureDepositLocks(await Order.findById(batch.order));
    await withCommerceOperation(installmentOrderKey(batch.order), async session => {
      const current = await Batch.findOne({ refundId }).session(session);
      if (current.status !== 'CREATED') return;
      const order = await Order.findById(batch.order).session(session);
      // On retry, reserve only the failed portions; completed deposits stay final.
      await reserveBatchRefunds(current, order, session, current.checkoutIds.length ? current.checkoutIds : null);
      current.status = 'PROCESSING';
      await current.save({ session });
      await Order.updateOne({ _id: order._id }, { $set: { refundId, refundStatus: 'pending', refundFailureReason: '' } }, { session });
    });
  }
  const { recoverReservedRefund } = await import('./refundService.js');
  const children = await Refund.find({ installmentBatchId: refundId, status: 'CREATED' });
  // Recovery looks up the same provider ID before sending, including after a
  // process crash or a lost response. Concurrent workers reuse that ID.
  for (const child of children) await recoverReservedRefund(child);
  return synchronizeInstallmentRefundBatch(refundId);
};

export const synchronizeInstallmentRefundBatch = async refundId => {
  const found = await Batch.findOne({ refundId });
  if (!found) return null;
  const result = await withCommerceOperation(installmentOrderKey(found.order), async session => {
    const batch = await Batch.findOne({ refundId }).session(session);
    const refunds = await Refund.find({ installmentBatchId: refundId }).session(session).lean();
    const paid = refunds.filter(item => item.status === 'COMPLETED').reduce((sum, item) => sum + item.amount, 0);
    const active = refunds.some(item => ACTIVE.includes(item.status));
    batch.status = paid >= batch.amount ? 'COMPLETED' : active ? 'PROCESSING' : 'FAILED';
    batch.failureReason = batch.status === 'FAILED' ? 'Une partie du remboursement a échoué. Relancez uniquement le solde.' : '';
    if (batch.status === 'COMPLETED') batch.completedAt ||= new Date();
    await batch.save({ session });
    const order = await Order.findById(batch.order).session(session);
    if (order.refundId !== refundId) return { batch, order: null };
    const completed = await Refund.find({ order: batch.order, status: 'COMPLETED' }).session(session).lean();
    order.refundStatus = batch.status === 'COMPLETED' ? 'processed' : batch.status === 'FAILED' ? 'failed' : 'pending';
    order.refundAmount = completed.reduce((sum, item) => sum + item.amount, 0);
    order.refundFailureReason = batch.failureReason;
    order.refundedAt = batch.completedAt;
    await order.save({ session });
    return { batch, order };
  });
  const { batch, order } = result;
  if (order && batch.status === 'COMPLETED' && batch.effectsPending) {
    if (order.refundAmount >= order.paidAmount) {
      await markEscrowRefunded({ order, expectedRefundId: batch.refundId, actor: batch.requestedBy, disputeId: batch.dispute });
    } else if (['ON_HOLD', 'WAITING_BUYER_CONFIRMATION'].includes(order.escrowStatus) && !order.installmentRefundRequired && order.status !== 'cancelled' && order.remainingAmount === 0) {
      await Order.updateOne({ _id: order._id, refundId, escrowStatus: 'ON_HOLD' }, { $set: { escrowStatus: 'WAITING_BUYER_CONFIRMATION', disputeOpened: false, autoReleaseAt: null } });
      await releaseEscrowForOrder({ order, expectedRefundId: refundId, actor: batch.requestedBy, actorRole: 'admin', reason: 'ADMIN_RELEASE' });
    }
    await createNotification({ userId: order.customer, type: 'admin_broadcast', allowSelf: true, deepLink: `/orders/detail/${order._id}`,
      dedupeKey: `installment-refund:${refundId}`, metadata: { orderId: order._id, refundId, message: `Remboursement de ${batch.amount.toLocaleString('fr-FR')} FCFA confirmé.` } }).catch(() => {});
    await Batch.updateOne({ refundId }, { $set: { effectsPending: false } });
  }
  if (order) await Promise.allSettled([invalidateUserCache(order.customer, ['orders', 'notifications']),
    invalidateSellerCache(order.items?.[0]?.snapshot?.shopId, ['orders', 'analytics']), invalidateAdminCache(['orders', 'admin'])]);
  await Refund.updateMany({ installmentBatchId: refundId, status: { $in: ['COMPLETED', 'FAILED'] } }, { $set: { effectsPending: false, effectsAppliedAt: new Date() } });
  return batch;
};

export const recoverInstallmentRefundsForOrder = async orderId => {
  const order = await Order.findById(orderId);
  if (!order?.installmentRefundRequired || order.paymentType !== 'installment') return null;
  const receipts = await resolveDeposits(order);
  const cancelled = order.status === 'cancelled' || order.installmentSaleStatus === 'cancelled';
  const refundable = receipts.filter(receipt => cancelled || receipt.allocatedAmount === 0);
  const checkoutIds = refundable.map(receipt => receipt.checkoutId);
  const completed = await Refund.find({ order: order._id, checkoutId: { $in: checkoutIds }, status: 'COMPLETED' }).lean();
  const amount = refundable.reduce((sum, receipt) => sum + receipt.amount, 0) - completed.reduce((sum, refund) => sum + refund.amount, 0);
  if (amount <= 0) {
    await Order.updateOne({ _id: order._id, paidAmount: order.paidAmount }, { $set: { installmentRefundRequired: false } });
    return null;
  }
  return initiateInstallmentRefund({ order, requestedBy: order.refundRequestedBy || order.cancelledBy || order.customer,
    amount, source: cancelled ? 'SELLER_CANCELLATION' : 'ADMIN', checkoutIds,
    operationSuffix: `automatic:${checkoutIds.sort().join(',')}`, retry: false });
};

export const reconcileInstallmentRefunds = async ({ limit = 25 } = {}) => {
  const orders = await Order.find({ paymentType: 'installment', installmentRefundRequired: true }).select('_id').limit(limit);
  for (const order of orders) await recoverInstallmentRefundsForOrder(order._id).catch(async error => {
    await Order.updateOne({ _id: order._id, installmentRefundRequired: true }, { $set: { refundFailureReason: String(error.message).slice(0, 500) } });
  });
  const batches = await Batch.find({ $or: [{ status: { $in: ['CREATED', 'PROCESSING'] } }, { status: 'COMPLETED', effectsPending: true }] }).limit(limit);
  for (const batch of batches) await processInstallmentRefundBatch(batch.refundId).catch(() => {});
  return orders.length + batches.length;
};
