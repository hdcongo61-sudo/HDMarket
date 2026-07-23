import { describe, expect, it } from 'vitest';
import {
  getWholesalePricing,
  normalizeWholesaleTiers,
  validateWholesaleConfig
} from './wholesaleUtils.js';

describe('normalizeWholesaleTiers', () => {
  it('sorts tiers by minQty and drops invalid entries', () => {
    const tiers = normalizeWholesaleTiers([
      { minQty: 10, unitPrice: 800 },
      { minQty: 5, unitPrice: 900 },
      { minQty: 'not-a-number', unitPrice: 700 }
    ]);
    expect(tiers).toEqual([
      { minQty: 5, unitPrice: 900 },
      { minQty: 10, unitPrice: 800 }
    ]);
  });
});

describe('validateWholesaleConfig', () => {
  it('rejects wholesale enabled with no tiers', () => {
    const result = validateWholesaleConfig({ wholesaleEnabled: true, wholesaleTiers: [] });
    expect(result.valid).toBe(false);
  });

  it('rejects a tier whose price increases with quantity', () => {
    const result = validateWholesaleConfig({
      wholesaleEnabled: true,
      wholesaleTiers: [
        { minQty: 2, unitPrice: 900 },
        { minQty: 5, unitPrice: 950 }
      ]
    });
    expect(result.valid).toBe(false);
  });

  it('accepts strictly decreasing per-quantity prices', () => {
    const result = validateWholesaleConfig({
      wholesaleEnabled: true,
      wholesaleTiers: [
        { minQty: 2, unitPrice: 900 },
        { minQty: 5, unitPrice: 800 }
      ]
    });
    expect(result.valid).toBe(true);
  });
});

describe('getWholesalePricing', () => {
  const product = {
    price: 1000,
    wholesaleEnabled: true,
    wholesaleTiers: [
      { minQty: 5, unitPrice: 900 },
      { minQty: 10, unitPrice: 800 }
    ]
  };

  it('uses the base price below the first tier threshold', () => {
    const pricing = getWholesalePricing(product, 3);
    expect(pricing.unitPrice).toBe(1000);
    expect(pricing.tierApplied).toBeNull();
    expect(pricing.nextTier).toMatchObject({ minQty: 5, unitPrice: 900 });
    expect(pricing.quantityToNextTier).toBe(2);
  });

  it('applies the highest tier the quantity qualifies for', () => {
    const pricing = getWholesalePricing(product, 12);
    expect(pricing.unitPrice).toBe(800);
    expect(pricing.tierApplied.minQty).toBe(10);
    expect(pricing.nextTier).toBeNull();
    expect(pricing.quantityToNextTier).toBe(0);
    expect(pricing.lineTotal).toBe(9600);
  });

  it('computes savings relative to the base price', () => {
    const pricing = getWholesalePricing(product, 10);
    // base 10*1000=10000, tier 10*800=8000, savings 2000 (20%)
    expect(pricing.savingsAmount).toBe(2000);
    expect(pricing.savingsPercent).toBe(20);
  });

  it('ignores tiers entirely when wholesale is disabled', () => {
    const pricing = getWholesalePricing({ ...product, wholesaleEnabled: false }, 12);
    expect(pricing.unitPrice).toBe(1000);
    expect(pricing.tierApplied).toBeNull();
  });
});
