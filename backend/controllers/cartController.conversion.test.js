import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import Cart from '../models/cartModel.js';
import Product from '../models/productModel.js';
import Bundle from '../models/bundleModel.js';
import GuestCartMerge from '../models/guestCartMergeModel.js';
import City from '../models/cityModel.js';
import Commune from '../models/communeModel.js';

vi.mock('../utils/cache.js', () => ({ invalidateUserCache: vi.fn() }));
vi.mock('../utils/slugUtils.js', () => ({ ensureModelSlugsForItems: vi.fn() }));
vi.mock('../utils/publicProductVisibility.js', () => ({
  getVerifiedProductIds: vi.fn(async () => ['111111111111111111111111', '222222222222222222222222']),
  isListingFeeSettledForProduct: vi.fn(async (product) => Boolean(product?.listingFeeSettled))
}));
const { previewGuestCart, mergeGuestCart, estimateCartDelivery } = await import('./cartController.js');
const countryId = 'cccccccccccccccccccccccc';
const sellerId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const productId = '111111111111111111111111';
const countryContext = { countryId, code: 'CG', currency: { code: 'XAF' } };
let products, cart, receipts;
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });
const call = async (handler, body) => {
  const res = response();
  const next = vi.fn();
  await handler({ body, user: { id: 'bbbbbbbbbbbbbbbbbbbbbbbb' }, countryContext }, res, next);
  if (next.mock.calls.length) throw next.mock.calls[0][0];
  return res;
};
beforeEach(() => {
  vi.restoreAllMocks();
  receipts = new Set();
  products = [{ _id: productId, title: 'Article', price: 10000, status: 'approved', countryId, currency: 'XAF', listingFeeSettled: true,
    user: { _id: sellerId, freeDeliveryEnabled: false }, deliveryFee: 1200,
    attributes: [{ name: 'Taille', type: 'select', required: true, options: ['S', 'L'], optionPrices: { s: 8000, l: 12000 } }] }];
  cart = { countryId, currency: 'XAF', items: [], save: vi.fn() };
  vi.spyOn(Product, 'find').mockImplementation(() => ({ select: () => ({ populate: async () => products }) }));
  vi.spyOn(Bundle, 'find').mockImplementation(() => ({ lean: async () => [] }));
  vi.spyOn(Cart, 'findOne').mockImplementation(() => ({
    session: async () => cart,
    populate: async () => ({ ...cart, items: cart.items.map((item) => ({ ...item, product: products.find((product) => String(product._id) === String(item.product)) })) })
  }));
  vi.spyOn(GuestCartMerge, 'exists').mockImplementation((filter) => ({ session: async () => receipts.has(filter.mergeId) }));
  vi.spyOn(GuestCartMerge, 'create').mockImplementation(async ([receipt]) => receipts.add(receipt.mergeId));
  vi.spyOn(mongoose.connection, 'transaction').mockImplementation(async (callback) => callback({}));
  vi.spyOn(City, 'findOne').mockReturnValue({ lean: async () => ({ _id: 'city', countryId }) });
  vi.spyOn(Commune, 'findOne').mockReturnValue({ lean: async () => ({ _id: 'commune', countryId, deliveryPolicy: 'FIXED_FEE', fixedFee: 750 }) });
});
const selection = (value = 'S', quantity = 1) => ({ productId, quantity, selectedAttributes: [{ name: 'Taille', value }] });

describe('guest shopping and delivery', () => {
  it('prices variants from the catalog and rejects unavailable or cross-country items', async () => {
    products.push({ ...products[0], _id: '222222222222222222222222', countryId: 'dddddddddddddddddddddddd' });
    const res = await call(previewGuestCart, { items: [selection('L', 2), { productId: products[1]._id, quantity: 1 }, selection('missing')] });
    expect(res.json.mock.calls[0][0]).toMatchObject({ totals: { quantity: 2, subtotal: 24000 }, rejected: [{ productId: products[1]._id }, { productId }] });
    expect(cart.save).not.toHaveBeenCalled();
  });
  it('adds guest quantities to matching variants only and replays a merge without duplicates', async () => {
    cart.items = [{ product: productId, quantity: 2, selectedAttributes: [{ name: 'Taille', value: 'S' }] }];
    const body = { mergeId: 'test-merge-1', items: [selection('S', 3), selection('L', 1)] };
    await call(mergeGuestCart, body);
    await call(mergeGuestCart, body);
    expect(cart.items.map((item) => item.quantity)).toEqual([5, 1]);
    expect(cart.save).toHaveBeenCalledTimes(1);
    expect(GuestCartMerge.create).toHaveBeenCalledTimes(1);
  });
  it('retries a concurrent first-cart collision without duplicating items', async () => {
    mongoose.connection.transaction.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: 11000 }));
    await call(mergeGuestCart, { mergeId: 'test-merge-2', items: [selection()] });
    expect(mongoose.connection.transaction).toHaveBeenCalledTimes(2);
    expect(cart.items[0].quantity).toBe(1);
  });
  it('estimates commune fees once per seller and includes selected-option prices', async () => {
    const res = await call(estimateCartDelivery, { items: [selection('S', 2), selection('L')], cityId: 'city', communeId: 'commune' });
    expect(res.json.mock.calls[0][0]).toMatchObject({ subtotal: 28000, deliveryFeeTotal: 750, total: 28750, bySeller: { [sellerId]: { fee: 750, source: 'COMMUNE_FIXED' } } });
  });
  it('rejects an unavailable destination instead of returning a zero fee', async () => {
    Commune.findOne.mockReturnValue({ lean: async () => null });
    const res = await call(estimateCartDelivery, { items: [selection()], cityId: 'city', communeId: 'missing' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].total).toBeUndefined();
  });
});
