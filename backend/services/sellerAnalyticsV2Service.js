/**
 * Enhanced Seller Analytics Service V2
 * Proposal 9: Rich analytics dashboard with trends, product performance & customer insights.
 */

import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import ProductView from '../models/productViewModel.js';
import User from '../models/userModel.js';

const COMPLETED_STATUSES = [
  'delivery_proof_submitted', 'delivered', 'picked_up_confirmed',
  'confirmed_by_client', 'completed'
];

const toNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const pct = (part, total) => total ? Math.round((part / total) * 100 * 10) / 10 : 0;

// ─── OVERVIEW ─────────────────────────────────────────

export const getOverview = async (sellerId) => {
  const now = new Date();
  const start30 = new Date(now);
  start30.setDate(start30.getDate() - 30);
  const startPrev30 = new Date(start30);
  startPrev30.setDate(startPrev30.getDate() - 30);

  // Orders in last 30 days
  const [orders30, ordersPrev30, allProducts] = await Promise.all([
    Order.find({ seller: sellerId, status: { $in: COMPLETED_STATUSES }, createdAt: { $gte: start30 } })
      .select('totalAmount createdAt')
      .lean(),
    Order.find({ seller: sellerId, status: { $in: COMPLETED_STATUSES }, createdAt: { $gte: startPrev30, $lt: start30 } })
      .select('totalAmount')
      .lean(),
    Product.find({ user: sellerId, status: 'approved' })
      .select('_id title price discount salesCount views images')
      .lean()
  ]);

  // Revenue
  const revenue30 = orders30.reduce((s, o) => s + toNumber(o.totalAmount), 0);
  const revenuePrev30 = ordersPrev30.reduce((s, o) => s + toNumber(o.totalAmount), 0);
  const revenueChange = pct(revenue30 - revenuePrev30, revenuePrev30 || 1);

  // Orders count
  const ordersCount30 = orders30.length;
  const ordersCountPrev30 = ordersPrev30.length;
  const ordersChange = pct(ordersCount30 - ordersCountPrev30, ordersCountPrev30 || 1);

  // Total views (last 30 days)
  const viewsAgg = await ProductView.aggregate([
    { $match: { seller: { $exists: true, $ne: null }, viewedAt: { $gte: start30 } } },
    { $match: { seller: String(sellerId) } },
    { $count: 'total' }
  ]);
  const totalViews = viewsAgg[0]?.total || 0;

  // Views previous 30 days
  const viewsPrevAgg = await ProductView.aggregate([
    { $match: { seller: { $exists: true, $ne: null }, viewedAt: { $gte: startPrev30, $lt: start30 } } },
    { $match: { seller: String(sellerId) } },
    { $count: 'total' }
  ]);
  const totalViewsPrev = viewsPrevAgg[0]?.total || 0;
  const viewsChange = pct(totalViews - totalViewsPrev, totalViewsPrev || 1);

  // Conversion rate (orders / views)
  const conversionRate = totalViews > 0 ? pct(ordersCount30, totalViews) : 0;
  const conversionPrev = totalViewsPrev > 0 ? pct(ordersCountPrev30, totalViewsPrev) : 0;

  // Total products
  const totalProducts = allProducts.length;

  // Sales trend (daily for last 14 days)
  const dailySales = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const dayOrders = orders30.filter(o => {
      const d = new Date(o.createdAt);
      return d >= dayStart && d <= dayEnd;
    });
    dailySales.push({
      date: day.toISOString().slice(0, 10),
      orders: dayOrders.length,
      revenue: dayOrders.reduce((s, o) => s + toNumber(o.totalAmount), 0)
    });
  }

  return {
    revenue: { current: revenue30, previous: revenuePrev30, change: revenueChange },
    orders: { current: ordersCount30, previous: ordersCountPrev30, change: ordersChange },
    views: { current: totalViews, previous: totalViewsPrev, change: viewsChange },
    conversion: { current: conversionRate, previous: conversionPrev },
    totalProducts,
    dailySales
  };
};

// ─── PRODUCT PERFORMANCE ──────────────────────────────

export const getProductPerformance = async (sellerId) => {
  const products = await Product.find({ user: sellerId, status: 'approved' })
    .select('title price discount salesCount views images')
    .sort({ salesCount: -1 })
    .limit(50)
    .lean();

  const now = new Date();
  const start30 = new Date(now);
  start30.setDate(start30.getDate() - 30);

  // Get orders in last 30 days to compute revenue per product
  const orders30 = await Order.find({
    seller: sellerId,
    status: { $in: COMPLETED_STATUSES },
    createdAt: { $gte: start30 }
  })
    .select('items.product items.price items.quantity totalAmount')
    .lean();

  const productRevenue = new Map();
  for (const order of orders30) {
    for (const item of order.items || []) {
      const pid = String(item.product || '');
      const rev = toNumber(item.price) * toNumber(item.quantity || 1);
      productRevenue.set(pid, (productRevenue.get(pid) || 0) + rev);
    }
  }

  const items = products.map((p) => {
    const pid = String(p._id);
    return {
      _id: p._id,
      title: p.title,
      price: p.price,
      discount: p.discount || 0,
      salesCount: p.salesCount || 0,
      views: p.views || 0,
      revenue30: productRevenue.get(pid) || 0,
      conversionRate: (p.views || 0) > 0
        ? pct(p.salesCount || 0, p.views || 1)
        : 0
    };
  });

  return { items, total: items.length };
};

// ─── CUSTOMER INSIGHTS ────────────────────────────────

export const getCustomerInsights = async (sellerId) => {
  const orders = await Order.find({
    seller: sellerId,
    status: { $in: COMPLETED_STATUSES }
  })
    .select('customer createdAt totalAmount')
    .populate('customer', 'city commune name')
    .lean();

  // Top cities
  const cityMap = new Map();
  const customerSet = new Set();
  const hourMap = new Map();
  const dayMap = new Map();
  let repeatCustomers = 0;
  const customerOrderCount = new Map();

  for (const order of orders) {
    const custId = String(order.customer?._id || '');
    const city = order.customer?.city || 'Inconnu';

    if (custId) {
      customerSet.add(custId);
      customerOrderCount.set(custId, (customerOrderCount.get(custId) || 0) + 1);
    }

    cityMap.set(city, (cityMap.get(city) || 0) + 1);

    const hour = new Date(order.createdAt).getHours();
    hourMap.set(hour, (hourMap.get(hour) || 0) + 1);

    const day = new Date(order.createdAt).getDay();
    dayMap.set(day, (dayMap.get(day) || 0) + 1);
  }

  // Count repeat customers
  for (const [, count] of customerOrderCount) {
    if (count > 1) repeatCustomers++;
  }

  // Format cities
  const topCities = [...cityMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  // Format peak hours
  const peakHours = [...hourMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, count]) => ({ hour: `${String(hour).padStart(2, '0')}h`, count }));

  // Format peak days
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const peakDays = [...dayMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, count]) => ({ day: dayNames[day] || '?', count }));

  const aov = orders.length > 0
    ? Math.round(orders.reduce((s, o) => s + toNumber(o.totalAmount), 0) / orders.length)
    : 0;

  return {
    totalCustomers: customerSet.size,
    repeatCustomers,
    repeatRate: customerSet.size > 0 ? pct(repeatCustomers, customerSet.size) : 0,
    aov,
    topCities,
    peakHours,
    peakDays,
    totalOrders: orders.length
  };
};
