import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import ProductDailyView from '../models/productDailyViewModel.js';
import { paidSellerOrderFilter, sellerOrderLines, sellerOrderRevenue } from '../utils/sellerAnalytics.js';

const pct = (part, total) => total > 0 ? Math.round(part / total * 1000) / 10 : null;
const change = (current, previous) => pct(current - previous, previous);
const orderFields = 'items totalAmount deliveryFeeTotal createdAt customer';
const windows = () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start30 = new Date(today);
  start30.setUTCDate(start30.getUTCDate() - 29);
  const startPrev30 = new Date(start30);
  startPrev30.setUTCDate(startPrev30.getUTCDate() - 30);
  return { today, start30, startPrev30 };
};

const measuredViews = async (sellerId, start) => {
  const [rows, first] = await Promise.all([
    ProductDailyView.find({ seller: sellerId, day: { $gte: start } }).select('product day views').lean(),
    ProductDailyView.findOne({}).sort({ createdAt: 1 }).select('createdAt').lean()
  ]);
  return { rows, measuredSince: first?.createdAt ? new Date(first.createdAt) : null };
};

export const getOverview = async (sellerId) => {
  const { today, start30, startPrev30 } = windows();
  const [orders, totalProducts, measurement] = await Promise.all([
    Order.find({ ...paidSellerOrderFilter(sellerId), createdAt: { $gte: startPrev30 } }).select(orderFields).lean(),
    Product.countDocuments({ user: sellerId, status: 'approved' }),
    measuredViews(sellerId, startPrev30)
  ]);
  const orders30 = orders.filter((order) => new Date(order.createdAt) >= start30);
  const ordersPrev = orders.filter((order) => new Date(order.createdAt) < start30);
  const revenue = (list) => Math.round(list.reduce((sum, order) => sum + sellerOrderRevenue(order, sellerId), 0));
  const revenue30 = revenue(orders30);
  const revenuePrev = revenue(ordersPrev);
  const { rows, measuredSince } = measurement;
  const views = rows.filter((row) => new Date(row.day) >= start30).reduce((sum, row) => sum + row.views, 0);
  const previousCovered = measuredSince && measuredSince <= startPrev30;
  const previousViews = previousCovered ? rows.filter((row) => new Date(row.day) < start30).reduce((sum, row) => sum + row.views, 0) : null;
  const measuredStart = measuredSince ? new Date(Math.max(start30.getTime(), measuredSince.getTime())) : null;
  const measuredOrders = measuredStart ? orders30.filter((order) => new Date(order.createdAt) >= measuredStart).length : 0;
  const dailySales = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - 13 + index);
    const date = day.toISOString().slice(0, 10);
    const daily = orders30.filter((order) => new Date(order.createdAt).toISOString().slice(0, 10) === date);
    return { date, orders: daily.length, revenue: revenue(daily) };
  });
  return {
    revenue: { current: revenue30, previous: revenuePrev, change: change(revenue30, revenuePrev) },
    orders: { current: orders30.length, previous: ordersPrev.length, change: change(orders30.length, ordersPrev.length) },
    views: { current: measuredSince ? views : null, previous: previousViews, change: previousCovered ? change(views, previousViews) : null },
    conversion: { current: measuredSince ? pct(measuredOrders, views) : null, previous: previousCovered ? pct(ordersPrev.length, previousViews) : null },
    measurement: { since: measuredSince, partial: !measuredSince || measuredSince > start30, definition: 'paid_orders_per_counted_product_view' },
    totalProducts, dailySales
  };
};

export const getProductPerformance = async (sellerId) => {
  const { start30 } = windows();
  const [products, orders, measurement] = await Promise.all([
    Product.find({ user: sellerId, status: 'approved' }).select('title price discount salesCount viewsCount images').sort({ salesCount: -1 }).limit(50).lean(),
    Order.find({ ...paidSellerOrderFilter(sellerId), createdAt: { $gte: start30 } }).select(orderFields).lean(),
    measuredViews(sellerId, start30)
  ]);
  const revenue = new Map();
  const measuredOrders = new Map();
  const views = new Map();
  const measuredStart = measurement.measuredSince ? new Date(Math.max(start30.getTime(), measurement.measuredSince.getTime())) : null;
  for (const order of orders) {
    const seenProducts = new Set();
    for (const line of sellerOrderLines(order, sellerId)) {
      revenue.set(line.productId, (revenue.get(line.productId) || 0) + line.revenue);
      seenProducts.add(line.productId);
    }
    if (measuredStart && new Date(order.createdAt) >= measuredStart) {
      for (const id of seenProducts) measuredOrders.set(id, (measuredOrders.get(id) || 0) + 1);
    }
  }
  for (const row of measurement.rows) views.set(String(row.product), (views.get(String(row.product)) || 0) + row.views);
  const items = products.map((product) => ({
    _id: product._id, title: product.title, price: product.price, discount: product.discount || 0,
    salesCount: product.salesCount || 0, views: product.viewsCount || 0,
    revenue30: Math.round(revenue.get(String(product._id)) || 0),
    conversionRate: measuredStart ? pct(measuredOrders.get(String(product._id)) || 0, views.get(String(product._id)) || 0) : null
  }));
  return { items, total: items.length, measuredSince: measurement.measuredSince };
};

export const getCustomerInsights = async (sellerId) => {
  const orders = await Order.find(paidSellerOrderFilter(sellerId)).select(orderFields).populate('customer', 'city').lean();
  const cityMap = new Map();
  const customerOrders = new Map();
  const hourMap = new Map();
  const dayMap = new Map();
  for (const order of orders) {
    const id = String(order.customer?._id || '');
    if (id) customerOrders.set(id, (customerOrders.get(id) || 0) + 1);
    const city = order.customer?.city || 'Inconnu';
    cityMap.set(city, (cityMap.get(city) || 0) + 1);
    const date = new Date(order.createdAt);
    hourMap.set(date.getUTCHours(), (hourMap.get(date.getUTCHours()) || 0) + 1);
    dayMap.set(date.getUTCDay(), (dayMap.get(date.getUTCDay()) || 0) + 1);
  }
  const repeatCustomers = [...customerOrders.values()].filter((count) => count > 1).length;
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  return {
    totalCustomers: customerOrders.size, repeatCustomers,
    repeatRate: pct(repeatCustomers, customerOrders.size) ?? 0,
    aov: orders.length ? Math.round(orders.reduce((sum, order) => sum + sellerOrderRevenue(order, sellerId), 0) / orders.length) : 0,
    topCities: [...cityMap].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count })),
    peakHours: [...hourMap].sort((a, b) => a[0] - b[0]).map(([hour, count]) => ({ hour: String(hour).padStart(2, '0') + 'h UTC', count })),
    peakDays: [...dayMap].sort((a, b) => a[0] - b[0]).map(([day, count]) => ({ day: dayNames[day], count })),
    totalOrders: orders.length
  };
};
