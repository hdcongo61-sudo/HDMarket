import { beforeEach, describe, expect, it, vi } from 'vitest';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import ProductDailyView from '../models/productDailyViewModel.js';
import { getOverview, getProductPerformance, getCustomerInsights } from './sellerAnalyticsV2Service.js';
import { sellerOrderRevenue } from '../utils/sellerAnalytics.js';

let orders, views, since;
const seller = 'seller-a';
beforeEach(() => {
  vi.restoreAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-20T12:00:00Z'));
  since = new Date('2026-09-19T00:00:00Z');
  orders = [
    { createdAt: '2026-09-18', customer: { _id: 'buyer', city: 'Brazzaville' }, totalAmount: 10000, items: [{ product: 'product', snapshot: { shopId: seller }, lineTotal: 10000, quantity: 1 }] },
    { createdAt: '2026-09-20', customer: { _id: 'buyer', city: 'Brazzaville' }, totalAmount: 20000, items: [{ product: 'product', snapshot: { shopId: seller }, lineTotal: 20000, quantity: 2 }] }
  ];
  views = [{ product: 'product', day: new Date('2026-09-20'), views: 10 }];
  vi.spyOn(Order, 'find').mockImplementation(() => ({ select: () => ({ lean: async () => orders, populate: () => ({ lean: async () => orders }) }) }));
  vi.spyOn(Product, 'countDocuments').mockResolvedValue(1);
  vi.spyOn(Product, 'find').mockReturnValue({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [{ _id: 'product', viewsCount: 99 }] }) }) }) });
  vi.spyOn(ProductDailyView, 'find').mockImplementation(() => ({ select: () => ({ lean: async () => views }) }));
  vi.spyOn(ProductDailyView, 'findOne').mockImplementation(() => ({ sort: () => ({ select: () => ({ lean: async () => since ? { createdAt: since } : null }) }) }));
});
describe('seller conversion reporting', () => {
  it('attributes discounted merchandise to its seller and excludes delivery fees', () => {
    expect(sellerOrderRevenue({ totalAmount: 16000, deliveryFeeTotal: 1000, items: [
      { snapshot: { shopId: seller }, lineTotal: 10000 }, { snapshot: { shopId: 'another' }, lineTotal: 10000 }
    ] }, seller)).toBe(7500);
  });
  it('queries real ownership and payment fields and aligns paid orders with measured views', async () => {
    const result = await getOverview(seller);
    expect(Order.find).toHaveBeenCalledWith(expect.objectContaining({ 'items.snapshot.shopId': seller, isDraft: { $ne: true }, paymentStatus: { $in: ['PARTIAL', 'PAID_FULL'] }, status: { $ne: 'cancelled' } }));
    expect(result.revenue.current).toBe(30000);
    expect(result.conversion).toEqual({ current: 10, previous: null });
    expect(result.measurement.partial).toBe(true);
  });
  it('reports unavailable measurement as null, not a fabricated zero percent', async () => {
    since = null;
    const result = await getOverview(seller);
    expect(result.conversion.current).toBeNull();
    expect(result.views.current).toBeNull();
  });
  it('uses actual line totals and lifetime views in product reporting', async () => {
    const result = await getProductPerformance(seller);
    expect(result.items[0]).toMatchObject({ views: 99, revenue30: 30000, conversionRate: 10 });
  });
  it('counts returning customers from the same paid orders', async () => {
    expect(await getCustomerInsights(seller)).toMatchObject({ totalCustomers: 1, repeatCustomers: 1, aov: 15000 });
  });
});
