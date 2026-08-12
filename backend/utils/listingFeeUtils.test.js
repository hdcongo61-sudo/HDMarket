import { describe, expect, it } from 'vitest';
import {
  calculateListingFee,
  normalizeListingFeeRate,
  roundMoney
} from './listingFeeUtils.js';

describe('listing fee reconciliation math', () => {
  it('charges only the difference after a price increase', () => {
    expect(calculateListingFee({ price: 80000, rate: 0.03, paid: 600 })).toEqual({
      requiredFee: 2400,
      remainingFee: 1800,
      paidFee: 600
    });
  });

  it('never returns a negative remaining fee', () => {
    expect(calculateListingFee({ price: 10000, rate: 0.03, paid: 600 })).toEqual({
      requiredFee: 300,
      remainingFee: 0,
      paidFee: 600
    });
  });

  it('accepts configured percentage values and rounds money safely', () => {
    expect(normalizeListingFeeRate(3)).toBe(0.03);
    expect(normalizeListingFeeRate(0.03)).toBe(0.03);
    expect(roundMoney(10.005)).toBe(10.01);
  });
});
