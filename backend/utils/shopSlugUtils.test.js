import { describe, expect, it, vi } from 'vitest';
import { ensureShopSlug } from './shopSlugUtils.js';

const makeShop = (slug) => ({
  _id: 'shop-id', slug, shopName: 'Élégance Boutique',
  constructor: {
    exists: vi.fn().mockResolvedValue(false),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 })
  }
});

describe('shop name URLs', () => {
  it('repairs numeric URLs and preserves the old identifier as an alias', async () => {
    const shop = makeShop('1782162322025');
    expect(await ensureShopSlug(shop)).toBe('elegance-boutique');
    expect(shop.constructor.updateOne).toHaveBeenCalledWith(
      { _id: 'shop-id', slug: '1782162322025' },
      { $set: { slug: 'elegance-boutique' }, $addToSet: { shopSlugAliases: '1782162322025' } }
    );
  });
  it('keeps existing name URLs stable', async () => {
    const shop = makeShop('elegance-boutique');
    expect(await ensureShopSlug(shop)).toBe('elegance-boutique');
    expect(shop.constructor.updateOne).not.toHaveBeenCalled();
  });
  it('disambiguates duplicate shop names', async () => {
    const shop = makeShop('12345');
    shop.constructor.exists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await ensureShopSlug(shop)).toBe('elegance-boutique-1');
  });
  it('creates a name URL when no slug exists', async () => {
    expect(await ensureShopSlug(makeShop(''))).toBe('elegance-boutique');
  });
});
