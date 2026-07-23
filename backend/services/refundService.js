import crypto from 'crypto';
import Order from '../models/orderModel.js';
import PawaPayCheckout from '../models/pawapayCheckoutModel.js';
import Refund from '../models/refundModel.js';
import User from '../models/userModel.js';
import {
  getPawaPayCheckoutStatus,
  getPawaPayRefundStatus,
  initiatePawaPayRefund
} from './pawapayService.js';
import { createNotification } from '../utils/notificationService.js';
import { invalidateAdminCache, invalidateSellerCache, invalidateUserCache } from '../utils/cache.js';

const SUCCESS = new Set(['COMPLETED', 'SUCCESSFUL']);
const FAILURE = new Set(['FAILED', 'REJECTED', 'CANCELLED']);
const ACTIVE = ['CREATED', 'PROCESSING', 'NEEDS_ATTENTION'];

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
        deepLink: `/order/detail/${order._id}`,
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
  const refund = await Refund.findOne({ refundId });
  if (!refund) return null;
  const data = providerData(payload) || {};
  const status = String(data.status || payload?.status || '').toUpperCase();
  const wasTerminal = SUCCESS.has(refund.status) || FAILURE.has(refund.status);
  const receivedAmount = Number(data.amount ?? payload?.amount);
  const receivedCurrency = String(data.currency || payload?.currency || '').toUpperCase();

  refund.rawResponse = clean(payload);
  refund.providerTransactionId = String(data.providerTransactionId || '');
  refund.failureReason = clean(data.failureReason || data.rejectionReason || null);
  if (Number.isFinite(receivedAmount) && Math.abs(receivedAmount - Number(refund.amount)) > 0.01) {
    refund.status = 'NEEDS_ATTENTION';
    refund.failureReason = {
      failureCode: 'AMOUNT_MISMATCH',
      expectedAmount: refund.amount,
      receivedAmount
    };
  } else if (receivedCurrency && receivedCurrency !== refund.currency) {
    refund.status = 'NEEDS_ATTENTION';
    refund.failureReason = {
      failureCode: 'CURRENCY_MISMATCH',
      expectedCurrency: refund.currency,
      receivedCurrency
    };
  } else if (SUCCESS.has(status)) {
    refund.status = 'COMPLETED';
    refund.completedAt ||= new Date();
  } else if (FAILURE.has(status)) {
    refund.status = 'FAILED';
    refund.failedAt ||= new Date();
  } else {
    refund.status = 'PROCESSING';
  }
  await refund.save();

  const order = await Order.findById(refund.order);
  if (order) {
    order.refundId = refund.refundId;
    order.refundAmount = refund.amount;
    order.refundMethod = 'pawapay';
    if (refund.status === 'COMPLETED') {
      order.refundStatus = 'processed';
      order.refundedAt = refund.completedAt;
      order.refundFailureReason = '';
    } else if (refund.status === 'FAILED') {
      order.refundStatus = 'failed';
      order.refundedAt = null;
      order.refundFailureReason = failureMessage(payload) || 'Le remboursement PawaPay a échoué.';
    } else {
      order.refundStatus = 'pending';
      order.refundedAt = null;
    }
    await order.save();
    await Promise.allSettled([
      invalidateUserCache(order.customer, ['orders', 'notifications']),
      order.items?.[0]?.snapshot?.shopId
        ? invalidateSellerCache(order.items[0].snapshot.shopId, ['orders', 'notifications'])
        : Promise.resolve(),
      invalidateAdminCache(['admin', 'orders'])
    ]);
    if (!wasTerminal && (refund.status === 'COMPLETED' || refund.status === 'FAILED')) {
      await notifyTerminalRefund(refund, order, refund.status === 'COMPLETED');
    }
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
  const duplicate = await Refund.findOne({ order: order._id, status: { $in: ACTIVE } }).sort({ createdAt: -1 });
  if (duplicate) return duplicate;
  const depositBusy = await Refund.findOne({ depositId, status: { $in: ACTIVE } });
  if (depositBusy) {
    throw Object.assign(new Error('Un remboursement lié à ce paiement est déjà en cours. Réessayez après sa confirmation.'), {
      status: 409
    });
  }
  const totals = await Refund.aggregate([
    { $match: { depositId, status: 'COMPLETED' } },
    { $group: { _id: null, amount: { $sum: '$amount' } } }
  ]);
  const checkout = await PawaPayCheckout.findOne({ depositId }).lean();
  const maximum = Number(checkout?.amount || order.paidAmount || 0);
  const alreadyRefunded = Number(totals[0]?.amount || 0);
  if (requestedAmount - (maximum - alreadyRefunded) > 0.01) {
    throw Object.assign(new Error('Le montant dépasse le solde remboursable du paiement PawaPay.'), { status: 400 });
  }

  const refund = await Refund.create({
    refundId: crypto.randomUUID(),
    depositId,
    checkoutId: String(order.paymentCheckoutId || order.paymentTransactionCode || ''),
    order: order._id,
    customer: order.customer,
    requestedBy,
    dispute,
    source,
    amount: requestedAmount,
    currency: 'XAF'
  });
  order.refundStatus = 'pending';
  order.refundAmount = requestedAmount;
  order.refundRequestedBy = requestedBy;
  order.refundRequestedAt = new Date();
  order.refundMethod = 'pawapay';
  order.refundId = refund.refundId;
  order.refundedAt = null;
  order.refundFailureReason = '';
  await order.save();

  try {
    const response = await initiatePawaPayRefund({
      refundId: refund.refundId,
      depositId,
      amount: String(requestedAmount),
      currency: 'XAF',
      clientReferenceId: String(order._id),
      metadata: [
        { orderId: String(order._id) },
        { source }
      ]
    });
    refund.status = 'PROCESSING';
    refund.initiatedAt = new Date();
    refund.rawResponse = clean(response);
    await refund.save();
  } catch (error) {
    refund.rawResponse = clean(error?.meta?.providerResponse || null);
    refund.failureReason = clean(error?.details || error?.message);
    if (error?.action === 'CHECK_STATUS' || error?.retryable) {
      refund.status = 'NEEDS_ATTENTION';
    } else {
      refund.status = 'FAILED';
      refund.failedAt = new Date();
      order.refundStatus = 'failed';
      order.refundFailureReason = String(error?.message || 'Le remboursement PawaPay a échoué.').slice(0, 500);
      await order.save();
      await notifyTerminalRefund(refund, order, false);
    }
    await refund.save();
  }
  return refund;
};

export const reconcilePendingRefunds = async ({ limit = 25 } = {}) => {
  const refunds = await Refund.find({
    status: { $in: ['PROCESSING', 'NEEDS_ATTENTION'] },
    $or: [
      { lastProviderStatusCheckAt: null },
      { lastProviderStatusCheckAt: { $lt: new Date(Date.now() - 60_000) } }
    ]
  }).sort({ createdAt: 1 }).limit(limit);
  for (const refund of refunds) {
    refund.lastProviderStatusCheckAt = new Date();
    await refund.save();
    try {
      const status = await getPawaPayRefundStatus(refund.refundId, { timeoutMs: 12_000 });
      await reconcileRefund(refund.refundId, status);
    } catch {
      // A callback or the next scheduled pass will safely retry this status check.
    }
  }
  return refunds.length;
};
