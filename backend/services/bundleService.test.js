import { afterEach, describe, expect, it, vi } from 'vitest';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import Bundle from '../models/bundleModel.js';
import { getBundleSuggestions } from './bundleService.js';
const query = value => ({ select: () => query(value), sort: () => query(value), limit: () => query(value), lean: async () => value });
afterEach(() => vi.restoreAllMocks());
describe('frequently bought together', () => {
  it('uses only orders containing the selected product and excludes that product from recommendations', async () => {
    vi.spyOn(Product, 'findById').mockReturnValue(query({ _id: 'main', user: 'seller', price: 1000, title: 'Téléphone' }));
    const findOrders = vi.spyOn(Order, 'find').mockReturnValue(query([{ items: [{ product: 'main' }, { product: 'case' }, { product: 'case' }] }]));
    const findProducts = vi.spyOn(Product, 'find').mockReturnValue(query([{ _id: 'case', price: 200, title: 'Coque' }]));
    vi.spyOn(Bundle, 'findOneAndUpdate').mockResolvedValue({});
    const result = await getBundleSuggestions('main');
    expect(findOrders).toHaveBeenCalledWith(expect.objectContaining({ 'items.product': 'main', seller: 'seller' }));
    expect(findProducts).toHaveBeenCalledWith(expect.objectContaining({ _id: { $in: ['case'] }, user: 'seller', status: 'approved' }));
    expect(result.totalPrice).toBe(1200); expect(result.bundlePrice).toBe(1140);
  });
  it('does not show a discount when all related products are unavailable', async () => {
    vi.spyOn(Product, 'findById').mockReturnValue(query({ _id: 'main', user: 'seller', price: 1000 }));
    vi.spyOn(Order, 'find').mockReturnValue(query([{ items: [{ product: 'main' }, { product: 'deleted' }] }]));
    vi.spyOn(Product, 'find').mockReturnValue(query([]));
    const save = vi.spyOn(Bundle, 'findOneAndUpdate');
    const result = await getBundleSuggestions('main');
    expect(result.bundle).toEqual([]); expect(result.savings).toBe(0); expect(result.bundlePrice).toBe(1000); expect(save).not.toHaveBeenCalled();
  });
});
