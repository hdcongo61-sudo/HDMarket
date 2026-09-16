import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../utils/publicProductVisibility.js', () => ({ getVerifiedProductIds: vi.fn(async () => ['product']) }));
vi.mock('../services/configService.js', () => ({ getRuntimeConfig: vi.fn(async () => 8) }));
import { getProductVideoFeed } from './productVideoController.js';
import Product from '../models/productModel.js';
import ProductVideo from '../models/productVideoModel.js';
import ProductVideoEngagement from '../models/productVideoEngagementModel.js';

afterEach(() => vi.restoreAllMocks());

async function requestPage(cursor, filter = 'newest', count = 200) {
  const records = Array.from({ length: count }, (_, index) => ({
    _id: String(index), product: { _id: 'product' }, seller: { _id: 'seller' },
    createdAt: new Date(2026, 0, 1, 0, 0, count - index), sponsored: false
  }));
  vi.spyOn(Product, 'find').mockReturnValue({ distinct: async () => ['product'] });
  vi.spyOn(ProductVideoEngagement, 'find').mockReturnValue({ lean: async () => [] });
  let offset = 0;
  let limit = 0;
  const query = {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn(value => { offset = value; return query; }),
    limit: vi.fn(value => { limit = value; return query; }),
    populate: vi.fn().mockReturnThis(),
    lean: async () => records.slice(offset, offset + limit)
  };
  const find = vi.spyOn(ProductVideo, 'find').mockReturnValue(query);
  const res = { json: vi.fn() };
  const next = vi.fn();
  await getProductVideoFeed({ query: { cursor, limit: 8, filter }, headers: {} }, res, next);
  expect(next).not.toHaveBeenCalled();
  return { body: res.json.mock.calls[0][0], find };
}

describe('video discovery pagination', () => {
  it('continues beyond the former 160-video limit', async () => {
    const { body } = await requestPage(160);
    expect(body.items.map(item => item._id)).toEqual(['160', '161', '162', '163', '164', '165', '166', '167']);
    expect(body.nextCursor).toBe(168);
    expect(body.hasMore).toBe(true);
  });
  it('ends at the last page without skipping its remaining videos', async () => {
    const { body } = await requestPage(192, 'newest', 195);
    expect(body.items.map(item => item._id)).toEqual(['192', '193', '194']);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
  });
  it('filters followed sellers before database pagination', async () => {
    const { find } = await requestPage(0, 'following');
    expect(find.mock.calls[0][0].seller).toEqual({ $in: [] });
  });
});
