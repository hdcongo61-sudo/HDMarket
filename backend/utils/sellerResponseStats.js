import Order from '../models/orderModel.js';
import OrderMessage from '../models/orderMessageModel.js';

const MAX_ORDERS_FOR_STATS = 500;

/**
 * Compute seller response rate and average response time from order messages.
 * - Response rate: % of orders (where buyer sent at least one message) in which the seller replied.
 * - Response time: average time from first buyer message to first seller reply, formatted (e.g. "< 1 h", "2 h", "1 j").
 *
 * @param {mongoose.Types.ObjectId | string} sellerId - Seller user id
 * @returns {{ responseRate: number | null, responseTime: string }}
 */
export async function getSellerResponseStats(sellerId) {
  if (!sellerId) return { responseRate: null, responseTime: '' };

  const sellerIdStr = String(sellerId);

  const orders = await Order.find(
    { 'items.snapshot.shopId': sellerId, isDraft: false },
    { _id: 1, customer: 1 }
  )
    .limit(MAX_ORDERS_FOR_STATS)
    .lean();

  if (orders.length === 0) return { responseRate: null, responseTime: '' };

  const orderIds = orders.map((o) => o._id);
  const orderToCustomer = new Map(orders.map((o) => [String(o._id), String(o.customer)]));

  const messages = await OrderMessage.find({ order: { $in: orderIds } })
    .select('order sender createdAt')
    .sort({ order: 1, createdAt: 1 })
    .lean();

  const byOrder = new Map();
  for (const m of messages) {
    const oid = String(m.order);
    if (!byOrder.has(oid)) byOrder.set(oid, []);
    byOrder.get(oid).push({
      sender: String(m.sender),
      createdAt: m.createdAt ? new Date(m.createdAt).getTime() : 0
    });
  }

  let withBuyerMessage = 0;
  let withSellerReply = 0;
  const responseTimesMs = [];

  for (const o of orders) {
    const oid = String(o._id);
    const buyerId = orderToCustomer.get(oid);
    if (!buyerId) continue;

    const msgs = byOrder.get(oid) || [];
    let firstBuyerAt = null;
    let firstSellerAt = null;

    for (const m of msgs) {
      if (m.sender === buyerId) {
        if (firstBuyerAt == null) firstBuyerAt = m.createdAt;
      } else if (m.sender === sellerIdStr) {
        if (firstBuyerAt != null && firstSellerAt == null) {
          firstSellerAt = m.createdAt;
          break;
        }
      }
    }

    if (firstBuyerAt != null) {
      withBuyerMessage += 1;
      if (firstSellerAt != null) {
        withSellerReply += 1;
        responseTimesMs.push(firstSellerAt - firstBuyerAt);
      }
    }
  }

  const responseRate =
    withBuyerMessage > 0 ? Math.round((withSellerReply / withBuyerMessage) * 100) : null;
  const avgMs =
    responseTimesMs.length > 0
      ? responseTimesMs.reduce((a, b) => a + b, 0) / responseTimesMs.length
      : null;

  const responseTime = formatResponseTime(avgMs);
  return { responseRate, responseTime };
}

function formatResponseTime(avgMs) {
  if (avgMs == null || !Number.isFinite(avgMs) || avgMs < 0) return '';

  const minutes = Math.round(avgMs / (60 * 1000));
  const hours = avgMs / (60 * 60 * 1000);
  const days = avgMs / (24 * 60 * 60 * 1000);

  if (minutes < 60) return '< 1 h';
  if (hours < 24) return `${Math.round(hours)} h`;
  if (days < 2) return '1 j';
  return `${Math.round(days)} j`;
}
