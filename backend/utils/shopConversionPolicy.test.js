import { describe, expect, it } from 'vitest';
import {
  isShopConversionAccountChange,
  shouldHonorConversionRequestAmount,
  buildShopConversionCountryFilter
} from './shopConversionPolicy.js';

describe('shop conversion policy', () => {
  it('identifies a person to shop self-upgrade', () => {
    expect(isShopConversionAccountChange({ currentType: 'person', nextType: 'shop' })).toBe(true);
    expect(isShopConversionAccountChange({ currentType: 'shop', nextType: 'shop' })).toBe(false);
  });

  it('honors the immutable request amount', () => {
    expect(shouldHonorConversionRequestAmount({ requestAmount: 50000, checkoutAmount: 50000 })).toBe(true);
    expect(shouldHonorConversionRequestAmount({ requestAmount: 50000, checkoutAmount: 60000 })).toBe(false);
  });

  it('builds country filters for scoped admins', () => {
    expect(buildShopConversionCountryFilter('cg')).toEqual({ countryId: 'cg' });
    expect(buildShopConversionCountryFilter(['cg', 'cd'])).toEqual({ countryId: { $in: ['cg', 'cd'] } });
  });
});
