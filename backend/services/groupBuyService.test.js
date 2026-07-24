import { describe, expect, it } from 'vitest';
import { calculateGroupBuyUnitPrice } from './groupBuyService.js';

describe('group buy variant pricing', () => {
  it('applies the group discount percentage to a higher-priced option', () => {
    expect(
      calculateGroupBuyUnitPrice({
        currentUnitPrice: 15_000,
        originalPrice: 10_000,
        groupPrice: 8_000
      })
    ).toBe(12_000);
  });

  it('never increases the selected option price', () => {
    expect(
      calculateGroupBuyUnitPrice({
        currentUnitPrice: 10_000,
        originalPrice: 10_000,
        groupPrice: 12_000
      })
    ).toBe(10_000);
  });
});
