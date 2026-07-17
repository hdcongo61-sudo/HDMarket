import { describe, expect, it } from 'vitest';
import { buildProductPath, buildProductShareUrl, buildShopPath } from './links';

describe('internal link builders', () => {
  it('uses list pages instead of nonexistent empty detail routes', () => {
    expect(buildProductPath(null)).toBe('/products');
    expect(buildShopPath(null)).toBe('/shops/verified');
  });

  it('prefers usable slugs and falls back to ids', () => {
    expect(buildProductPath({ slug: 'telephone-pro', _id: 'product-id' })).toBe('/product/telephone-pro');
    expect(buildProductPath({ slug: '1782162322025', _id: 'product-id' })).toBe('/product/product-id');
    expect(buildShopPath({ slug: 'boutique-hd', _id: 'shop-id' })).toBe('/shop/boutique-hd');
  });

  it('does not produce a broken share detail URL without a product', () => {
    expect(buildProductShareUrl(null, 'https://hdmarket.example')).toBe('https://hdmarket.example');
  });
});
