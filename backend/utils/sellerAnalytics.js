export const paidSellerOrderFilter = (sellerId) => ({
  'items.snapshot.shopId': sellerId,
  isDraft: { $ne: true },
  status: { $ne: 'cancelled' },
  paymentStatus: { $in: ['PARTIAL', 'PAID_FULL'] },
  // Manual transaction codes can set paidAmount before review. Only confirmed
  // online checkouts or fulfilled legacy orders count as paid conversions.
  $or: [
    { paymentSource: 'pawapay', paymentCheckoutId: { $type: 'string', $ne: '' } },
    { status: { $in: ['delivered', 'picked_up_confirmed', 'confirmed_by_client', 'completed'] } }
  ]
});

export const sellerOrderLines = (order, sellerId) => {
  const items = order.items || [];
  const lineAmount = (item) => Number(item.lineTotal ?? Number(item.unitPrice || 0) * Number(item.quantity || 1));
  const subtotal = items.reduce((sum, item) => sum + lineAmount(item), 0);
  const merchandiseTotal = Math.max(0, Number(order.totalAmount || 0) - Number(order.deliveryFeeTotal || 0));
  // Attribute order-level discounts proportionally; never credit another seller's lines.
  const ratio = subtotal > 0 ? Math.min(1, merchandiseTotal / subtotal) : 0;
  return items.filter((item) => String(item.snapshot?.shopId || '') === String(sellerId))
    .map((item) => ({ productId: String(item.product?._id || item.product || ''), quantity: Number(item.quantity || 1), revenue: lineAmount(item) * ratio }));
};

export const sellerOrderRevenue = (order, sellerId) => sellerOrderLines(order, sellerId).reduce((sum, item) => sum + item.revenue, 0);
