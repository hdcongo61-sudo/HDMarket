import Order from '../models/orderModel.js';
import EscrowAuditLog from '../models/escrowAuditLogModel.js';
import { getManyRuntimeConfigs } from './configService.js';
import { ensureSellerSettlementForOrder } from './sellerSettlementService.js';
import { createNotification } from '../utils/notificationService.js';
import { invalidateAdminCache, invalidateSellerCache, invalidateUserCache } from '../utils/cache.js';

const RELEASEABLE_STATUSES = ['DELIVERED', 'WAITING_BUYER_CONFIRMATION'];

const clampNumber = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

export const getEscrowSettings = async () => {
  const values = await getManyRuntimeConfigs([
    'escrow_auto_release_delay_minutes',
    'escrow_dispute_enabled',
    'escrow_max_dispute_time_minutes',
    'escrow_minimum_deposit_percent',
    'escrow_high_value_order_threshold'
  ]);
  return {
    autoReleaseDelayMinutes: clampNumber(values.escrow_auto_release_delay_minutes, 180, 1, 10080),
    disputeEnabled: !['false', '0', 'no', 'off'].includes(
      String(values.escrow_dispute_enabled ?? true).trim().toLowerCase()
    ),
    maximumDisputeTimeMinutes: clampNumber(values.escrow_max_dispute_time_minutes, 180, 1, 43200),
    minimumDepositPercent: clampNumber(values.escrow_minimum_deposit_percent, 50, 1, 100),
    highValueOrderThreshold: clampNumber(values.escrow_high_value_order_threshold, 500000, 0, 100000000)
  };
};

export const requestAuditContext = (req = {}) => ({
  ipAddress: String(
    req.headers?.['x-forwarded-for']?.split(',')?.[0] || req.ip || req.socket?.remoteAddress || ''
  ).slice(0, 120),
  device: String(req.headers?.['user-agent'] || '').slice(0, 500)
});

export const recordEscrowAudit = async ({
  order,
  actor = null,
  actorRole = 'system',
  action,
  fromStatus = '',
  toStatus = '',
  amount,
  ipAddress = '',
  device = '',
  metadata = {}
}) => {
  const orderId = order?._id || order;
  if (!orderId || !action) return null;
  return EscrowAuditLog.create({
    order: orderId,
    actor: actor || null,
    actorRole,
    action,
    fromStatus,
    toStatus,
    amount: Math.max(0, Number(amount ?? order?.escrowAmount ?? order?.paidAmount ?? 0)),
    ipAddress,
    device,
    metadata
  });
};

const sellerIdsForOrder = (order) =>
  Array.from(
    new Set(
      (order?.items || [])
        .map((item) => String(item?.snapshot?.shopId || '').trim())
        .filter(Boolean)
    )
  );

const invalidateEscrowCaches = async (order) => {
  const sellerIds = sellerIdsForOrder(order);
  await Promise.allSettled([
    invalidateUserCache(order.customer, ['orders', 'notifications']),
    ...sellerIds.map((sellerId) => invalidateSellerCache(sellerId, ['orders', 'settlements'])),
    invalidateAdminCache(['orders', 'payments', 'seller-payouts'])
  ]);
};

export const startEscrowBuyerConfirmation = async ({
  order: orderOrId,
  actor = null,
  actorRole = 'seller',
  now = new Date(),
  audit = {}
}) => {
  const order = orderOrId?._id ? orderOrId : await Order.findById(orderOrId);
  if (!order) return null;
  if (String(order.paymentSource || '').toLowerCase() !== 'pawapay' || Number(order.paidAmount || 0) <= 0) {
    return order;
  }
  if (['RELEASED', 'REFUNDED', 'ON_HOLD'].includes(order.escrowStatus)) return order;

  const settings = await getEscrowSettings();
  const fromStatus = order.escrowStatus || 'IN_ESCROW';
  order.fulfillmentMethod = order.deliveryMode === 'PICKUP' ? 'STORE_PICKUP' : 'DELIVERY';
  order.escrowAmount = Math.max(0, Number(order.paidAmount || 0));
  order.deliveryCompletedAt = order.deliveryCompletedAt || now;
  order.sellerMarkedDeliveredAt = order.sellerMarkedDeliveredAt || now;
  order.escrowStatus = 'WAITING_BUYER_CONFIRMATION';
  order.autoReleaseAt = new Date(now.getTime() + settings.autoReleaseDelayMinutes * 60 * 1000);
  order.disputeOpened = false;
  order.disputeOpenedAt = null;
  await order.save();

  if (['WAITING_PAYMENT', 'IN_ESCROW'].includes(fromStatus)) {
    const fundingRecorded = await EscrowAuditLog.exists({ order: order._id, action: 'ESCROW_FUNDED' });
    if (!fundingRecorded) {
      await recordEscrowAudit({
        order,
        actor: null,
        actorRole: 'system',
        action: 'ESCROW_FUNDED',
        fromStatus: 'WAITING_PAYMENT',
        toStatus: 'IN_ESCROW',
        amount: order.escrowAmount,
        metadata: { paymentSource: order.paymentSource }
      }).catch((error) => console.error('[escrow] funding audit failed:', error?.message || error));
    }
  }

  await recordEscrowAudit({
    order,
    actor,
    actorRole,
    action: order.fulfillmentMethod === 'STORE_PICKUP'
      ? 'SELLER_MARKED_COLLECTED'
      : 'SELLER_MARKED_DELIVERED',
    fromStatus,
    toStatus: order.escrowStatus,
    ...audit,
    metadata: { autoReleaseAt: order.autoReleaseAt, fulfillmentMethod: order.fulfillmentMethod }
  }).catch((error) => console.error('[escrow] delivery audit failed:', error?.message || error));

  await createNotification({
    userId: order.customer,
    actorId: actor,
    type: order.fulfillmentMethod === 'STORE_PICKUP' ? 'order_picked_up' : 'order_delivered',
    priority: 'HIGH',
    actionRequired: true,
    deepLink: `/orders/detail/${order._id}`,
    entityType: 'order',
    entityId: String(order._id),
    metadata: {
      orderId: order._id,
      escrowStatus: order.escrowStatus,
      autoReleaseAt: order.autoReleaseAt,
      message: order.fulfillmentMethod === 'STORE_PICKUP'
        ? 'Votre commande a été marquée comme récupérée. Signalez immédiatement tout problème.'
        : 'Le vendeur a marqué votre commande comme livrée. Confirmez la réception ou signalez un problème.'
    },
    pushEnabled: true,
    allowSelf: true
  }).catch(() => {});
  await invalidateEscrowCaches(order);
  return order;
};

export const releaseEscrowForOrder = async ({
  order: orderOrId,
  actor = null,
  actorRole = 'system',
  reason = 'AUTO_RELEASE',
  now = new Date(),
  audit = {}
}) => {
  const orderId = orderOrId?._id || orderOrId;
  const allowedStatuses = reason === 'DISPUTE_RESOLVED_SELLER'
    ? [...RELEASEABLE_STATUSES, 'ON_HOLD']
    : RELEASEABLE_STATUSES;
  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      escrowStatus: { $in: allowedStatuses },
      disputeOpened: { $ne: true }
    },
    {
      $set: {
        escrowStatus: 'RELEASED',
        escrowReleasedAt: now,
        escrowReleaseReason: reason,
        autoReleaseAt: null,
        status: 'completed',
        completedAt: now,
        ...(reason === 'BUYER_CONFIRMED'
          ? { buyerConfirmedAt: now, clientDeliveryConfirmedAt: now, deliveryStatus: 'verified' }
          : {})
      }
    },
    { new: true }
  );
  if (!order) return Order.findById(orderId);

  const action = reason === 'BUYER_CONFIRMED'
    ? 'BUYER_CONFIRMED'
    : reason === 'AUTO_RELEASE'
      ? 'ESCROW_RELEASED_AUTOMATICALLY'
      : 'ESCROW_RELEASED_MANUALLY';
  await recordEscrowAudit({
    order,
    actor,
    actorRole,
    action,
    fromStatus: reason === 'DISPUTE_RESOLVED_SELLER' ? 'ON_HOLD' : 'WAITING_BUYER_CONFIRMATION',
    toStatus: 'RELEASED',
    ...audit,
    metadata: { reason }
  }).catch((error) => console.error('[escrow] release audit failed:', error?.message || error));

  await ensureSellerSettlementForOrder(order).catch((error) => {
    // The release is already committed. The settlement recovery worker will
    // retry RELEASED orders whose settlementStatus is still empty.
    console.error('[escrow] seller settlement creation failed:', error?.message || error);
  });
  const sellerIds = sellerIdsForOrder(order);
  await Promise.allSettled([
    createNotification({
      userId: order.customer,
      actorId: actor,
      type: 'order_completed',
      deepLink: `/orders/detail/${order._id}`,
      entityType: 'order',
      entityId: String(order._id),
      metadata: { orderId: order._id, escrowStatus: 'RELEASED', reason },
      pushEnabled: true,
      allowSelf: true
    }),
    ...sellerIds.map((sellerId) => createNotification({
      userId: sellerId,
      actorId: actor,
      type: 'order_completed',
      deepLink: `/seller/orders/detail/${order._id}`,
      entityType: 'order',
      entityId: String(order._id),
      metadata: {
        orderId: order._id,
        escrowStatus: 'RELEASED',
        escrowAmount: order.escrowAmount,
        reason
      },
      pushEnabled: true,
      allowSelf: true
    }))
  ]);
  await invalidateEscrowCaches(order);
  return order;
};

export const holdEscrowForDispute = async ({ order: orderOrId, actor, audit = {}, disputeId }) => {
  const orderId = orderOrId?._id || orderOrId;
  const current = await Order.findById(orderId);
  if (!current) return null;
  const fromStatus = current.escrowStatus;
  current.escrowStatus = 'ON_HOLD';
  current.disputeOpened = true;
  current.disputeOpenedAt = new Date();
  current.autoReleaseAt = null;
  current.status = 'dispute_opened';
  if (!['none', 'cancelled'].includes(current.settlementStatus)) current.settlementStatus = 'blocked';
  await current.save();
  await recordEscrowAudit({
    order: current,
    actor,
    actorRole: 'buyer',
    action: 'DISPUTE_OPENED',
    fromStatus,
    toStatus: 'ON_HOLD',
    ...audit,
    metadata: { disputeId: String(disputeId || '') }
  }).catch((error) => console.error('[escrow] dispute audit failed:', error?.message || error));
  await invalidateEscrowCaches(current);
  return current;
};

export const markEscrowRefunded = async ({ order: orderOrId, actor = null, audit = {}, disputeId = null }) => {
  const orderId = orderOrId?._id || orderOrId;
  const order = await Order.findByIdAndUpdate(
    orderId,
    {
      $set: {
        escrowStatus: 'REFUNDED',
        autoReleaseAt: null,
        disputeOpened: false,
        settlementStatus: 'cancelled'
      }
    },
    { new: true }
  );
  if (!order) return null;
  await recordEscrowAudit({
    order,
    actor,
    actorRole: actor ? 'admin' : 'system',
    action: 'REFUND_PROCESSED',
    fromStatus: 'ON_HOLD',
    toStatus: 'REFUNDED',
    ...audit,
    metadata: { disputeId: String(disputeId || '') }
  }).catch((error) => console.error('[escrow] refund audit failed:', error?.message || error));
  await invalidateEscrowCaches(order);
  return order;
};

export const processEscrowAutoReleases = async ({ limit = 100, now = new Date() } = {}) => {
  const due = await Order.find({
    escrowStatus: 'WAITING_BUYER_CONFIRMATION',
    autoReleaseAt: { $ne: null, $lte: now },
    disputeOpened: { $ne: true }
  })
    .sort({ autoReleaseAt: 1 })
    .limit(Math.max(1, Math.min(Number(limit) || 100, 500)))
    .select('_id');
  let released = 0;
  for (const item of due) {
    // Atomic claim inside releaseEscrowForOrder prevents duplicate payouts when
    // more than one worker is running.
    const result = await releaseEscrowForOrder({ order: item._id, reason: 'AUTO_RELEASE', now });
    if (result?.escrowStatus === 'RELEASED') released += 1;
  }
  return { scanned: due.length, released };
};

export const listEscrowAuditForOrder = (orderId) =>
  EscrowAuditLog.find({ order: orderId })
    .sort({ createdAt: 1 })
    .populate('actor', 'name email role')
    .lean();
