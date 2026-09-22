import crypto from 'node:crypto';
import Transfer from '../models/buyForMeTransferModel.js';
import ShoppingOrder from '../models/buyForMeOrderModel.js';
import Transaction from '../models/buyForMeTransactionModel.js';
import Checkout from '../models/pawapayCheckoutModel.js';
import User from '../models/userModel.js';
import Country from '../models/countryModel.js';
import { withCommerceOperation } from './commerceOperationService.js';
import { shoppingError } from './buyForMeAccessService.js';
import { getPawaPayCheckoutStatus, getPawaPayRefundStatus, getPawaPayPayoutStatus, initiatePawaPayRefund, initiatePawaPayPayout } from './pawapayService.js';
import { payoutLimitsForProvider } from './sellerSettlementService.js';

const dataOf = payload => payload?.status === 'FOUND' ? payload.data : payload;
const active = ['READY', 'WAITING_REFERENCE', 'WAITING_ACCOUNT', 'PROCESSING', 'NEEDS_ATTENTION'];

export const reserveShoppingRefund = async ({ order, amount, reason, session, checkoutId = null }) => {
  if (!Number.isInteger(amount) || amount < 0) throw shoppingError('Montant de remboursement invalide.');
  if (!amount) return;
  const funding = await Transaction.find({ orderId: order._id, type: { $in: ['FUNDING', 'ADDITIONAL_FUNDING'] },
    ...(checkoutId ? { providerReference: checkoutId } : {}) }).session(session).lean();
  let remaining = amount;
  for (const source of funding) {
    if (!source.providerReference) continue;
    const reserved = await Transfer.find({ checkoutId: source.providerReference, type: 'REFUND' }).session(session).lean();
    const available = Math.max(0, source.amount - reserved.reduce((sum, item) => sum + item.amount, 0));
    const part = Math.min(available, remaining);
    if (!part) continue;
    const checkout = await Checkout.findOne({ checkoutId: source.providerReference }).session(session).lean();
    await Transfer.create([{
      operationKey: `${order._id}:refund:${reason}:${source.providerReference}`, providerId: crypto.randomUUID(),
      orderId: order._id, userId: order.customerId, countryId: order.countryId, type: 'REFUND', amount: part,
      currency: order.currency, checkoutId: source.providerReference, depositId: checkout?.depositId || '', reason
    }], { session });
    remaining -= part;
    if (!remaining) break;
  }
  if (remaining) throw shoppingError('Le financement doit être rapproché avant de rembourser cette demande.', 409);
  order.refundDue = Number(order.refundDue || 0) + amount;
};

export const reserveShoppingPayout = async ({ order, userId, amount, session }) => {
  if (!amount) return;
  await Transfer.create([{
    operationKey: `${order._id}:courier-settlement`, providerId: crypto.randomUUID(), orderId: order._id,
    userId, countryId: order.countryId, type: 'PAYOUT', amount, currency: order.currency, reason: 'COURIER_SETTLEMENT'
  }], { session });
};

export const reconcileShoppingTransfer = async (providerId, payload, type) => {
  const transfer = await Transfer.findOne({ providerId, ...(type ? { type } : {}) }).lean();
  if (!transfer) return null;
  const data = dataOf(payload) || {};
  return withCommerceOperation(`shopping:${transfer.orderId}`, async session => {
    const current = await Transfer.findById(transfer._id).session(session);
    if (current.status === 'COMPLETED') return current;
    const state = String(data.status || '').toUpperCase();
    const success = ['COMPLETED', 'SUCCESSFUL'].includes(state);
    const amount = Number(data.amount ?? data.requestedAmount);
    const currency = String(data.currency || '').toUpperCase();
    const mismatch = (Number.isFinite(amount) && amount !== current.amount) || (currency && currency !== current.currency);
    if (mismatch || (success && (!Number.isFinite(amount) || !currency))) {
      current.status = 'NEEDS_ATTENTION'; current.mismatch = true;
      current.failureReason = 'Montant ou devise à vérifier auprès de PawaPay.';
    } else if (success) {
      current.status = 'COMPLETED'; current.completedAt = new Date(); current.failureReason = ''; current.mismatch = false;
      if (current.type === 'REFUND') {
        await Transaction.create([{ orderId: current.orderId, userId: current.userId, type: 'REFUND', amount: current.amount,
          status: 'COMPLETED', providerReference: current.providerId }], { session });
        await ShoppingOrder.updateOne({ _id: current.orderId }, { $inc: { refundedAmount: current.amount, __v: 1 } }, { session });
        const order = await ShoppingOrder.findById(current.orderId).session(session);
        if (order && order.refundedAmount >= order.payment.totalPaid) { order.payment.status = 'REFUNDED'; await order.save({ session }); }
      } else {
        await Transaction.updateMany({ orderId: current.orderId, type: { $in: ['DRIVER_EARNING', 'DRIVER_REIMBURSEMENT', 'DRIVER_TIP'] } },
          { $set: { status: 'COMPLETED', providerReference: current.providerId } }, { session });
      }
    } else if (['FAILED', 'REJECTED', 'CANCELLED'].includes(state) && !current.mismatch) {
      current.status = 'FAILED'; current.failureReason = String(data.failureReason?.failureMessage || data.failureReason?.message || 'Transfert refusé par PawaPay.').slice(0, 500);
    } else if (['ACCEPTED', 'PROCESSING', 'ENQUEUED', 'SUBMITTED'].includes(state) && !['FAILED', 'NEEDS_ATTENTION'].includes(current.status)) {
      current.status = 'PROCESSING';
    }
    await current.save({ session });
    return current;
  });
};

export const processShoppingTransfer = async (transferId, { retry = false } = {}) => {
  const leaseToken = crypto.randomUUID();
  let transfer = await Transfer.findOneAndUpdate({ _id: transferId, status: { $in: retry ? [...active, 'FAILED'] : active },
    $or: [{ leaseUntil: null }, { leaseUntil: { $lt: new Date() } }] },
  { $set: { leaseToken, leaseUntil: new Date(Date.now() + 90_000), lastCheckedAt: new Date() } }, { new: true }).select('+recipient');
  if (!transfer) return Transfer.findById(transferId);
  try {
    // Always establish the outcome of a previous submission before retrying.
    if (transfer.attemptStartedAt) {
      const status = await (transfer.type === 'REFUND' ? getPawaPayRefundStatus : getPawaPayPayoutStatus)(transfer.providerId, { timeoutMs: 12_000 });
      if (status?.status !== 'NOT_FOUND') {
        transfer = await reconcileShoppingTransfer(transfer.providerId, status, transfer.type);
        if (transfer.status !== 'FAILED' || !retry) return transfer;
        // Explicit retry after a provider-confirmed failure gets a new id.
        transfer = await Transfer.findOneAndUpdate({ _id: transferId, status: 'FAILED', leaseToken },
          { $set: { providerId: crypto.randomUUID(), status: 'READY', attemptStartedAt: null, recipient: null, failureReason: '' }, $inc: { attempts: 1 } }, { new: true }).select('+recipient');
        if (!transfer) return Transfer.findById(transferId);
      } else if (transfer.mismatch) return transfer;
    }
    if (transfer.type === 'REFUND' && !transfer.depositId) {
      const checkout = await Checkout.findOne({ checkoutId: transfer.checkoutId });
      if (!checkout || checkout.paymentState !== 'CONFIRMED') throw shoppingError('Paiement initial à rapprocher.', 409);
      let depositId = checkout.depositId;
      if (!depositId) {
        const response = dataOf(await getPawaPayCheckoutStatus(checkout.checkoutId, { timeoutMs: 12_000 }));
        const deposit = response?.deposit || response?.depositsHistory?.find(item => item.status === 'COMPLETED');
        if (deposit?.depositId && deposit.status === 'COMPLETED' && Number(deposit.amount) === checkout.amount && deposit.currency === checkout.currency) {
          depositId = deposit.depositId;
          await Checkout.updateOne({ _id: checkout._id }, { $set: { depositId, depositStatus: 'COMPLETED' } });
        }
      }
      if (!depositId) {
        await Transfer.updateOne({ _id: transferId, leaseToken, status: { $ne: 'COMPLETED' } }, { $set: { status: 'WAITING_REFERENCE', failureReason: 'En attente de la référence du dépôt PawaPay.' } });
        return Transfer.findById(transferId);
      }
      transfer.depositId = depositId;
    }
    if (transfer.type === 'PAYOUT' && !transfer.recipient) {
      const user = await User.findById(transfer.userId).select('payoutAccount').lean();
      const country = await Country.findById(transfer.countryId).select('code').lean();
      const account = user?.payoutAccount;
      const phoneNumber = String(account?.phoneNumber || '').replace(/\D/g, '');
      const limits = payoutLimitsForProvider(account?.provider);
      if (country?.code !== 'CG' || !account?.verifiedAt || !['MTN_MOMO_COG', 'AIRTEL_COG'].includes(account?.provider) || !/^242\d{9}$/.test(phoneNumber) || transfer.amount < limits.min || transfer.amount > limits.max) {
        await Transfer.updateOne({ _id: transferId, leaseToken, status: { $ne: 'COMPLETED' } }, { $set: { status: 'WAITING_ACCOUNT', failureReason: 'Compte Mobile Money vérifié et montant compatible requis pour le livreur.' } });
        return Transfer.findById(transferId);
      }
      transfer.recipient = { type: 'MMO', accountDetails: { phoneNumber, provider: account.provider } };
    }
    const submitted = await Transfer.findOneAndUpdate({ _id: transferId, leaseToken, status: { $ne: 'COMPLETED' } },
      { $set: { depositId: transfer.depositId, recipient: transfer.recipient, attemptStartedAt: new Date(), status: 'PROCESSING' } }, { new: true }).select('+recipient');
    if (!submitted) return Transfer.findById(transferId);
    let result;
    try {
      result = submitted.type === 'REFUND'
        ? await initiatePawaPayRefund({ refundId: submitted.providerId, depositId: submitted.depositId, amount: String(submitted.amount), currency: submitted.currency,
          clientReferenceId: String(submitted.orderId), metadata: [{ shoppingOrderId: String(submitted.orderId) }] })
        : await initiatePawaPayPayout({ payoutId: submitted.providerId, recipient: submitted.recipient, amount: String(submitted.amount), currency: submitted.currency,
          clientReferenceId: String(submitted.orderId), customerMessage: 'ACHATS HDMARKET', metadata: [{ shoppingOrderId: String(submitted.orderId) }] });
    } catch (error) {
      const definite = error?.meta?.providerResponse?.status === 'REJECTED' || ([400, 401, 403, 422].includes(error?.meta?.providerStatus) && error?.details?.action !== 'CHECK_STATUS');
      await Transfer.updateOne({ _id: transferId, status: { $ne: 'COMPLETED' }, leaseToken }, { $set: {
        status: definite ? 'FAILED' : 'NEEDS_ATTENTION', failureReason: definite ? 'Transfert refusé. Vérifiez le compte avant de réessayer.' : 'Réponse PawaPay incertaine : vérification en cours.'
      } });
      return Transfer.findById(transferId);
    }
    // Database errors here must never turn a successful transfer into FAILED.
    return await reconcileShoppingTransfer(submitted.providerId, result, submitted.type);
  } finally {
    await Transfer.updateOne({ _id: transferId, leaseToken }, { $set: { leaseUntil: null, leaseToken: '' } });
  }
};

export const processShoppingTransfers = async ({ orderId, limit = 25 } = {}) => {
  const transfers = await Transfer.find({ status: { $in: active }, ...(orderId ? { orderId } : {
    $or: [{ lastCheckedAt: null }, { lastCheckedAt: { $lt: new Date(Date.now() - 60_000) } }]
  }) }).sort({ lastCheckedAt: 1, createdAt: 1 }).limit(limit).select('_id');
  for (const transfer of transfers) {
    await processShoppingTransfer(transfer._id).catch(error => console.error('[shopping-transfer] reconciliation deferred:', error?.code || 'RETRY_REQUIRED'));
  }
  return transfers.length;
};
