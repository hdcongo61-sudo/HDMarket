import crypto from 'crypto';
import Dispute from '../models/disputeModel.js';
import Order from '../models/orderModel.js';
import SellerPayout from '../models/sellerPayoutModel.js';
import SellerSettlement from '../models/sellerSettlementModel.js';
import User from '../models/userModel.js';
import {
  getPawaPayPayoutStatus,
  initiatePawaPayPayout
} from './pawapayService.js';
import { getManyRuntimeConfigs } from './configService.js';
import { createNotification } from '../utils/notificationService.js';
import { invalidateAdminCache, invalidateSellerCache, invalidateUserCache } from '../utils/cache.js';

const PAYABLE_ORDER_STATUSES = ['completed', 'confirmed_by_client', 'picked_up_confirmed'];
const ACTIVE_PAYOUT_STATUSES = ['CREATED', 'PROCESSING', 'ENQUEUED', 'NEEDS_ATTENTION'];
const OPEN_DISPUTE_STATUSES = ['OPEN', 'SELLER_RESPONDED', 'UNDER_REVIEW'];
const PROVIDER_SUCCESS = new Set(['COMPLETED', 'SUCCESSFUL']);
const PROVIDER_FAILURE = new Set(['FAILED', 'REJECTED', 'CANCELLED']);

// PawaPay per-transaction limits for Mobile Money payouts (XAF). A batch that
// aggregates several settlements must never exceed the recipient provider's
// ceiling, or PawaPay rejects the whole payout.
const PAWAPAY_PAYOUT_LIMITS = {
  MTN_MOMO_COG: { min: 1, max: 2_000_000 },
  AIRTEL_COG: { min: 10, max: 1_500_000 }
};
// Conservative fallback (tighter of the two providers) for an account whose
// provider isn't recognized yet — never assume the more permissive ceiling.
const DEFAULT_PAYOUT_LIMITS = { min: 10, max: 1_500_000 };

export const payoutLimitsForProvider = (provider) =>
  PAWAPAY_PAYOUT_LIMITS[String(provider || '')] || DEFAULT_PAYOUT_LIMITS;

// Greedily packs ready settlements (already sorted oldest-release-first) into
// payout-sized batches so no single PawaPay payout exceeds maxAmount. A
// settlement whose own netAmount already exceeds the ceiling can never fit
// any batch — it is returned separately instead of being silently dropped or
// sent in a request PawaPay is guaranteed to reject.
export const chunkSettlementsForPayout = (settlements = [], maxAmount) => {
  const batches = [];
  const oversized = [];
  let current = [];
  let currentTotal = 0;
  for (const settlement of settlements) {
    const net = Number(settlement?.netAmount || 0);
    if (net > maxAmount) {
      oversized.push(settlement);
      continue;
    }
    if (current.length && currentTotal + net > maxAmount) {
      batches.push(current);
      current = [];
      currentTotal = 0;
    }
    current.push(settlement);
    currentTotal += net;
  }
  if (current.length) batches.push(current);
  return { batches, oversized };
};
const settlementCutoverAt = (() => {
  const parsed = new Date(process.env.SELLER_SETTLEMENT_CUTOVER_AT || '');
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
})();

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

const failureText = (value) =>
  String(
    value?.failureMessage ||
    value?.message ||
    value?.failureCode ||
    value ||
    ''
  ).slice(0, 500);

const normalizePayoutPhone = (value) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 9 && digits.startsWith('0')) digits = `242${digits}`;
  if (digits.length === 8) digits = `2420${digits}`;
  return digits;
};

export const resolveSellerSettlementPolicy = (values = {}) => {
  const immediateOnCompletion = !['false', '0', 'no', 'off'].includes(
    String(values.seller_payout_immediate_on_completion ?? true).trim().toLowerCase()
  );
  return {
    commissionRate: Math.min(100, Math.max(0, Number(values.commission_rate ?? 3))),
    immediateOnCompletion,
    minimumPayout: immediateOnCompletion
      ? 0
      : Math.max(0, Number(values.seller_min_payout ?? 5000)),
    holdHours: immediateOnCompletion
      ? 0
      : Math.max(
          0,
          Number(values.seller_settlement_hold_hours ?? 72),
          Number(values.dispute_window_hours ?? 72)
        )
  };
};

const settings = async () => resolveSellerSettlementPolicy(
  await getManyRuntimeConfigs([
    'commission_rate',
    'seller_min_payout',
    'seller_payout_immediate_on_completion',
    'seller_settlement_hold_hours',
    'dispute_window_hours'
  ])
);

const updateOrderSettlement = async (settlement, patch = {}) => {
  const statusMap = {
    HELD: 'held',
    WAITING_ACCOUNT: 'waiting_account',
    READY: 'ready',
    PROCESSING: 'processing',
    PAID: 'paid',
    FAILED: 'failed',
    BLOCKED: 'blocked',
    CANCELLED: 'cancelled'
  };
  await Order.updateOne(
    { _id: settlement.order },
    {
      $set: {
        settlementStatus: statusMap[settlement.status] || 'none',
        settlementGrossAmount: settlement.grossAmount,
        settlementCommissionAmount: settlement.commissionAmount,
        settlementNetAmount: settlement.netAmount,
        settlementReleaseAt: settlement.releaseAt,
        settlementPaidAt: settlement.paidAt || null,
        settlementFailureReason: settlement.failureReason || '',
        ...patch
      }
    }
  );
};

const notifySeller = (sellerId, metadata) =>
  createNotification({
    userId: sellerId,
    type: 'admin_broadcast',
    allowSelf: true,
    deepLink: '/my/settlements',
    entityType: 'seller_settlement',
    entityId: String(metadata.payoutId || metadata.orderId || sellerId),
    metadata
  }).catch(() => {});

const notifySettlementStaff = async (metadata) => {
  const staff = await User.find({
    $or: [{ role: 'founder' }, { role: 'admin' }, { canVerifyPayments: true }]
  }).select('_id').lean();
  await Promise.all(staff.map((user) => createNotification({
    userId: user._id,
    type: 'admin_broadcast',
    allowSelf: true,
    deepLink: '/admin/seller-payouts',
    entityType: 'seller_payout',
    entityId: String(metadata.payoutId || ''),
    metadata
  }).catch(() => {})));
};

export const ensureSellerSettlementForOrder = async (orderOrId) => {
  const order = typeof orderOrId === 'object' && orderOrId?._id
    ? orderOrId
    : await Order.findById(orderOrId);
  if (!order) return null;
  if (
    String(order.paymentSource || '').toLowerCase() !== 'pawapay' ||
    !PAYABLE_ORDER_STATUSES.includes(String(order.status || '')) ||
    Number(order.remainingAmount || 0) > 0
  ) {
    return null;
  }

  const existing = await SellerSettlement.findOne({ order: order._id });
  if (existing) return existing;
  const sellerId = order.items?.[0]?.snapshot?.shopId;
  if (!sellerId) return null;

  const config = await settings();
  const grossAmount = Math.max(
    0,
    Math.round(Number(order.paidAmount || 0) - (
      order.refundStatus === 'processed' ? Number(order.refundAmount || 0) : 0
    ))
  );
  if (grossAmount <= 0) return null;
  const commissionAmount = Math.round(grossAmount * config.commissionRate / 100);
  const netAmount = Math.max(0, grossAmount - commissionAmount);
  if (netAmount <= 0) return null;
  const baseline = new Date(order.completedAt || order.clientDeliveryConfirmedAt || order.deliveredAt || new Date());
  const releaseAt = new Date(baseline.getTime() + config.holdHours * 60 * 60 * 1000);
  const seller = await User.findById(sellerId).select('payoutAccount');
  const hasAccount = Boolean(
    seller?.payoutAccount?.verifiedAt &&
    seller?.payoutAccount?.provider &&
    seller?.payoutAccount?.phoneNumber
  );
  const hasBlockingRefund = ['pending', 'failed'].includes(String(order.refundStatus || ''));
  const status = hasBlockingRefund
    ? 'BLOCKED'
    : releaseAt > new Date()
      ? 'HELD'
      : hasAccount
        ? 'READY'
        : 'WAITING_ACCOUNT';

  try {
    const settlement = await SellerSettlement.create({
      order: order._id,
      seller: sellerId,
      grossAmount,
      refundedAmount: order.refundStatus === 'processed' ? Number(order.refundAmount || 0) : 0,
      commissionRate: config.commissionRate,
      commissionAmount,
      netAmount,
      releaseAt,
      status
    });
    await updateOrderSettlement(settlement);
    if (status === 'WAITING_ACCOUNT') {
      await notifySeller(sellerId, {
        title: 'Compte de versement requis',
        message: 'Ajoutez et vérifiez votre compte MTN MoMo ou Airtel Money pour recevoir vos ventes.',
        orderId: String(order._id),
        settlementStatus: status
      });
    }
    if (status === 'READY' && config.immediateOnCompletion) {
      await initiateSellerPayoutBatch(sellerId, [settlement], 0);
    }
    return settlement;
  } catch (error) {
    if (error?.code === 11000) return SellerSettlement.findOne({ order: order._id });
    throw error;
  }
};

const refreshSettlementState = async (settlement, now = new Date(), configOverride = null) => {
  const config = configOverride || await settings();
  const wasAlreadyBlocked = settlement.status === 'BLOCKED';
  const [order, seller, blockingDispute] = await Promise.all([
    Order.findById(settlement.order),
    User.findById(settlement.seller).select('payoutAccount'),
    Dispute.exists({ orderId: settlement.order, status: { $in: OPEN_DISPUTE_STATUSES } })
  ]);
  if (order) {
    const baseline = new Date(
      order.completedAt || order.clientDeliveryConfirmedAt || order.deliveredAt || settlement.createdAt || now
    );
    settlement.releaseAt = new Date(baseline.getTime() + config.holdHours * 60 * 60 * 1000);
  }
  if (!order || order.status === 'cancelled') {
    settlement.status = 'CANCELLED';
    settlement.failureReason = 'Commande annulée.';
  } else if (
    blockingDispute ||
    ['pending', 'failed'].includes(String(order.refundStatus || ''))
  ) {
    settlement.status = 'BLOCKED';
    settlement.failureReason = blockingDispute
      ? 'Versement suspendu pendant le traitement du litige.'
      : 'Versement suspendu pendant le remboursement.';
  } else if (settlement.releaseAt > now) {
    settlement.status = 'HELD';
    settlement.failureReason = '';
  } else if (
    !seller?.payoutAccount?.verifiedAt ||
    !seller?.payoutAccount?.provider ||
    !seller?.payoutAccount?.phoneNumber
  ) {
    settlement.status = 'WAITING_ACCOUNT';
    settlement.failureReason = 'Compte Mobile Money vendeur non vérifié.';
  } else {
    const grossAmount = Math.max(
      0,
      Math.round(Number(order.paidAmount || 0) - (
        order.refundStatus === 'processed' ? Number(order.refundAmount || 0) : 0
      ))
    );
    settlement.grossAmount = grossAmount;
    settlement.refundedAmount = order.refundStatus === 'processed' ? Number(order.refundAmount || 0) : 0;
    settlement.commissionAmount = Math.round(grossAmount * settlement.commissionRate / 100);
    settlement.netAmount = Math.max(0, grossAmount - settlement.commissionAmount);
    const limits = payoutLimitsForProvider(seller.payoutAccount.provider);
    if (settlement.netAmount <= 0) {
      settlement.status = 'CANCELLED';
      settlement.failureReason = '';
    } else if (settlement.netAmount > limits.max) {
      // A single order's payout alone exceeds the provider's per-transaction
      // ceiling — no amount of batching can fix this, it needs a manual
      // split. Stay BLOCKED instead of cycling back to READY every pass.
      settlement.status = 'BLOCKED';
      settlement.failureReason =
        `Montant (${settlement.netAmount} XAF) supérieur à la limite de versement ` +
        `${seller.payoutAccount.provider} (${limits.max} XAF). Nécessite un versement fractionné manuel.`;
    } else {
      settlement.status = 'READY';
      settlement.failureReason = '';
    }
  }
  await settlement.save();
  await updateOrderSettlement(settlement);
  if (settlement.status === 'BLOCKED' && !wasAlreadyBlocked && settlement.failureReason.includes('limite de versement')) {
    await notifySettlementStaff({
      title: 'Versement vendeur bloqué — plafond dépassé',
      message: settlement.failureReason,
      orderId: String(settlement.order),
      settlementStatus: 'BLOCKED',
      amount: settlement.netAmount
    });
  }
  return settlement;
};

const initiateSellerPayoutBatch = async (sellerId, readySettlements, minimumPayout) => {
  const amount = readySettlements.reduce((sum, item) => sum + Number(item.netAmount || 0), 0);
  if (!readySettlements.length || amount < 1) return null;
  const seller = await User.findById(sellerId).select('name shopName payoutAccount');
  if (!seller?.payoutAccount?.verifiedAt) return null;
  const phoneNumber = normalizePayoutPhone(seller.payoutAccount.phoneNumber);
  const provider = String(seller.payoutAccount.provider || '');
  if (!phoneNumber || !provider) return null;

  const limits = payoutLimitsForProvider(provider);
  const effectiveMinimum = Math.max(Number(minimumPayout || 0), limits.min);
  if (amount < effectiveMinimum) return null;
  // Defense in depth: the caller is expected to chunk batches within
  // limits.max before calling this. If it somehow didn't, refuse rather than
  // send a request PawaPay is guaranteed to reject.
  if (amount > limits.max) {
    console.error(
      `[seller-settlements] refused oversized payout batch for seller ${sellerId}: ` +
        `${amount} XAF exceeds ${provider} limit of ${limits.max} XAF.`
    );
    return null;
  }

  const settlementIds = readySettlements.map((item) => String(item._id)).sort();
  const batchKey = crypto.createHash('sha256').update(settlementIds.join(':')).digest('hex');
  let payout;
  try {
    payout = await SellerPayout.create({
      payoutId: crypto.randomUUID(),
      batchKey,
      seller: sellerId,
      settlements: readySettlements.map((item) => item._id),
      amount,
      provider,
      phoneNumber
    });
  } catch (error) {
    if (error?.code === 11000) return SellerPayout.findOne({ batchKey });
    throw error;
  }

  const claimed = await SellerSettlement.updateMany(
    { _id: { $in: payout.settlements }, status: 'READY', payout: null },
    { $set: { status: 'PROCESSING', payout: payout._id, failureReason: '' } }
  );
  if (claimed.modifiedCount !== payout.settlements.length) {
    payout.status = 'CANCELLED';
    payout.failureReason = { failureCode: 'SETTLEMENT_CLAIM_CONFLICT' };
    await payout.save();
    await SellerSettlement.updateMany(
      { payout: payout._id },
      { $set: { status: 'READY', payout: null } }
    );
    return payout;
  }
  await Promise.all(readySettlements.map((item) => {
    item.status = 'PROCESSING';
    item.payout = payout._id;
    return updateOrderSettlement(item, { settlementPayoutId: payout.payoutId });
  }));

  try {
    const response = await initiatePawaPayPayout({
      payoutId: payout.payoutId,
      recipient: {
        type: 'MMO',
        accountDetails: { phoneNumber, provider }
      },
      amount: String(amount),
      currency: 'XAF',
      clientReferenceId: `SELLER-${String(sellerId).slice(-8)}`,
      customerMessage: 'VENTES HDMARKET',
      metadata: [
        { sellerId: String(sellerId) },
        { settlementCount: readySettlements.length }
      ]
    });
    payout.status = 'PROCESSING';
    payout.initiatedAt = new Date();
    payout.rawResponse = clean(response);
    await payout.save();
  } catch (error) {
    payout.rawResponse = clean(error?.meta?.providerResponse || null);
    payout.failureReason = clean(error?.details || error?.message);
    if (error?.action === 'CHECK_STATUS' || error?.retryable) {
      payout.status = 'NEEDS_ATTENTION';
    } else {
      payout.status = 'FAILED';
      payout.failedAt = new Date();
      await SellerSettlement.updateMany(
        { payout: payout._id },
        { $set: { status: 'FAILED', failureReason: failureText(error?.message) } }
      );
      await Order.updateMany(
        { _id: { $in: readySettlements.map((item) => item.order) } },
        { $set: { settlementStatus: 'failed', settlementFailureReason: failureText(error?.message) } }
      );
      await notifySeller(sellerId, {
        title: 'Versement PawaPay échoué',
        message: 'Le versement de vos ventes a échoué. HDMarket a été averti.',
        payoutId: payout.payoutId,
        payoutStatus: 'FAILED',
        amount
      });
    }
    await payout.save();
  }
  return payout;
};

export const reconcileSellerPayout = async (payoutId, payload) => {
  const payout = await SellerPayout.findOne({ payoutId });
  if (!payout) return null;
  const data = providerData(payload) || {};
  const status = String(data.status || payload?.status || '').toUpperCase();
  const receivedAmount = Number(data.amount ?? payload?.amount);
  const currency = String(data.currency || payload?.currency || '').toUpperCase();
  const receivedPhone = normalizePayoutPhone(data.recipient?.accountDetails?.phoneNumber);
  const receivedProvider = String(data.recipient?.accountDetails?.provider || '');
  const wasTerminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(payout.status);
  const mismatch =
    (Number.isFinite(receivedAmount) && Math.abs(receivedAmount - payout.amount) > 0.01) ||
    (currency && currency !== payout.currency) ||
    (receivedPhone && receivedPhone !== payout.phoneNumber) ||
    (receivedProvider && receivedProvider !== payout.provider);

  payout.rawResponse = clean(payload);
  payout.providerTransactionId = String(data.providerTransactionId || '');
  payout.failureReason = clean(data.failureReason || null);
  if (mismatch) {
    payout.status = 'NEEDS_ATTENTION';
    payout.failureReason = { failureCode: 'PAYOUT_RECONCILIATION_MISMATCH' };
  } else if (PROVIDER_SUCCESS.has(status)) {
    payout.status = 'COMPLETED';
    payout.completedAt ||= new Date();
  } else if (PROVIDER_FAILURE.has(status)) {
    payout.status = 'FAILED';
    payout.failedAt ||= new Date();
  } else if (status === 'ENQUEUED') {
    payout.status = 'ENQUEUED';
  } else {
    payout.status = 'PROCESSING';
  }
  await payout.save();

  if (payout.status === 'COMPLETED') {
    await SellerSettlement.updateMany(
      { payout: payout._id },
      { $set: { status: 'PAID', paidAt: payout.completedAt, failureReason: '' } }
    );
    await Order.updateMany(
      { settlementPayoutId: payout.payoutId },
      {
        $set: {
          settlementStatus: 'paid',
          settlementPaidAt: payout.completedAt,
          settlementFailureReason: ''
        }
      }
    );
    if (!wasTerminal) {
      const metadata = {
        title: 'Versement vendeur confirmé',
        message: `${Number(payout.amount).toLocaleString('fr-FR')} FCFA ont été envoyés sur le compte Mobile Money du vendeur.`,
        payoutId: payout.payoutId,
        payoutStatus: 'COMPLETED',
        amount: payout.amount,
        providerTransactionId: payout.providerTransactionId
      };
      await Promise.all([notifySeller(payout.seller, metadata), notifySettlementStaff(metadata)]);
    }
  } else if (payout.status === 'FAILED') {
    const reason = failureText(data.failureReason) || 'Le versement PawaPay a échoué.';
    await SellerSettlement.updateMany(
      { payout: payout._id },
      { $set: { status: 'FAILED', failureReason: reason } }
    );
    await Order.updateMany(
      { settlementPayoutId: payout.payoutId },
      { $set: { settlementStatus: 'failed', settlementFailureReason: reason } }
    );
    if (!wasTerminal) {
      const metadata = {
        title: 'Versement vendeur échoué',
        message: 'Le versement PawaPay n’a pas abouti et nécessite une intervention.',
        payoutId: payout.payoutId,
        payoutStatus: 'FAILED',
        amount: payout.amount
      };
      await Promise.all([notifySeller(payout.seller, metadata), notifySettlementStaff(metadata)]);
    }
  }
  await Promise.allSettled([
    invalidateSellerCache(payout.seller, ['orders', 'dashboard', 'notifications']),
    invalidateUserCache(payout.seller, ['orders', 'notifications']),
    invalidateAdminCache(['admin', 'orders'])
  ]);
  return payout;
};

export const processSellerSettlements = async ({ limit = 100 } = {}) => {
  const config = await settings();
  const candidates = await Order.find({
    paymentSource: 'pawapay',
    status: { $in: PAYABLE_ORDER_STATUSES },
    remainingAmount: { $lte: 0 },
    settlementStatus: { $in: ['none', null] },
    $or: [
      { completedAt: { $gte: settlementCutoverAt } },
      { clientDeliveryConfirmedAt: { $gte: settlementCutoverAt } }
    ]
  }).sort({ completedAt: 1 }).limit(limit);
  for (const order of candidates) {
    await ensureSellerSettlementForOrder(order);
  }

  const refreshable = await SellerSettlement.find({
    status: { $in: ['HELD', 'WAITING_ACCOUNT', 'BLOCKED'] }
  }).sort({ releaseAt: 1 }).limit(limit);
  for (const settlement of refreshable) {
    await refreshSettlementState(settlement, new Date(), config);
  }

  const sellers = await SellerSettlement.distinct('seller', { status: 'READY', payout: null });
  let initiated = 0;
  for (const sellerId of sellers) {
    const ready = await SellerSettlement.find({
      seller: sellerId,
      status: 'READY',
      payout: null
    }).sort({ releaseAt: 1 }).limit(100);
    if (!ready.length) continue;

    const seller = await User.findById(sellerId).select('payoutAccount');
    const limits = payoutLimitsForProvider(seller?.payoutAccount?.provider);
    // Split into payout-sized batches so no single PawaPay payout exceeds the
    // recipient provider's per-transaction ceiling (e.g. 1.5M XAF for Airtel).
    const { batches, oversized } = chunkSettlementsForPayout(ready, limits.max);

    for (const settlement of oversized) {
      // refreshSettlementState should already keep an over-ceiling settlement
      // BLOCKED before it reaches READY — this only guards a settlement that
      // was force-flipped back to READY outside that path (e.g. a payout retry).
      const wasAlreadyBlocked = settlement.status === 'BLOCKED';
      settlement.status = 'BLOCKED';
      settlement.payout = null;
      settlement.failureReason =
        `Montant (${settlement.netAmount} XAF) supérieur à la limite de versement ` +
        `${seller?.payoutAccount?.provider || 'inconnue'} (${limits.max} XAF). Nécessite un versement fractionné manuel.`;
      await settlement.save();
      await updateOrderSettlement(settlement);
      if (!wasAlreadyBlocked) {
        await notifySettlementStaff({
          title: 'Versement vendeur bloqué — plafond dépassé',
          message: settlement.failureReason,
          orderId: String(settlement.order),
          settlementStatus: 'BLOCKED',
          amount: settlement.netAmount
        });
      }
    }

    for (const batch of batches) {
      const payout = await initiateSellerPayoutBatch(sellerId, batch, config.minimumPayout);
      if (payout && !['CANCELLED', 'FAILED'].includes(payout.status)) initiated += 1;
    }
  }
  return { created: candidates.length, refreshed: refreshable.length, initiated };
};

export const reconcilePendingSellerPayouts = async ({ limit = 25 } = {}) => {
  const payouts = await SellerPayout.find({
    status: { $in: ACTIVE_PAYOUT_STATUSES },
    $or: [
      { lastProviderStatusCheckAt: null },
      { lastProviderStatusCheckAt: { $lt: new Date(Date.now() - 60_000) } }
    ]
  }).sort({ createdAt: 1 }).limit(limit);
  for (const payout of payouts) {
    payout.lastProviderStatusCheckAt = new Date();
    await payout.save();
    try {
      const status = await getPawaPayPayoutStatus(payout.payoutId, { timeoutMs: 12_000 });
      await reconcileSellerPayout(payout.payoutId, status);
    } catch {
      // Callback or next pass will reconcile the same merchant-generated ID.
    }
  }
  return payouts.length;
};

export const retryFailedSellerPayout = async (payoutId) => {
  const payout = await SellerPayout.findOne({ payoutId });
  if (!payout || payout.status !== 'FAILED') return null;
  await SellerSettlement.updateMany(
    { payout: payout._id, status: 'FAILED' },
    { $set: { status: 'READY', payout: null, failureReason: '' } }
  );
  payout.batchKey = `${payout.batchKey}:retry:${Date.now()}`;
  payout.status = 'CANCELLED';
  await payout.save();
  return processSellerSettlements();
};

export { normalizePayoutPhone };
