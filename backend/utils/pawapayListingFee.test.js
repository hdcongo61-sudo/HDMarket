import { describe, expect, it } from 'vitest';
import { getConfirmedListingFee, getPawaPayListingAmount } from './pawapayListingFee.js';
import { calculateCommissionBreakdown } from './promoCodeUtils.js';
import { calculateListingFee } from './listingFeeUtils.js';

describe('publication payment amounts', () => {
  it.each([180, 190])('preserves a confirmed legacy payment of %s when its quote is missing', (amount) => {
    expect(getConfirmedListingFee({ amount, paymentState: 'CONFIRMED' })).toMatchObject({
      amountPaid: amount, baseAmount: amount, dueAmount: amount, discountAmount: 0
    });
  });

  it('settles the original discounted quote even when the rate or promo later changes', () => {
    const listingFeeSnapshot = {
      baseAmount: 190, dueAmount: 142.5, discountAmount: 47.5,
      referencePrice: 190000, ratePercent: 0.1, promo: { discountValue: 25 }
    };
    expect(getConfirmedListingFee({ amount: 143, paymentState: 'CONFIRMED', listingFeeSnapshot })).toMatchObject({
      amountPaid: 143, baseAmount: 190, dueAmount: 142.5, discountAmount: 47.5, ratePercent: 0.1
    });
  });

  it('rejects unconfirmed payments and does not convert a missing rate into a free payment', () => {
    expect(() => getConfirmedListingFee({ amount: 180, paymentState: 'PENDING' })).toThrow();
    expect(getPawaPayListingAmount(0)).toBe(0);
    expect(getPawaPayListingAmount(0.5)).toBe(10);
    expect(getPawaPayListingAmount(142.5)).toBe(143);
  });

  it.each([0, 0.1, 1, 3])('uses the same %s percent for listing and payment calculations', (ratePercent) => {
    expect(calculateListingFee({ price: 190000, rate: ratePercent / 100 }).requiredFee)
      .toBe(calculateCommissionBreakdown({ productPrice: 190000, commissionRate: ratePercent }).dueAmount);
  });
});
