import { roundMoney } from './listingFeeUtils.js';

export const getPawaPayListingAmount = (dueAmount) =>
  Number(dueAmount) > 0 ? Math.max(10, Math.ceil(Number(dueAmount))) : 0;

// Settlement must never reprice a confirmed checkout using today's settings.
// Older checkouts have no quote; their confirmed amount is still authoritative.
export const getConfirmedListingFee = (checkout) => {
  const amountPaid = roundMoney(checkout.amount);
  if (checkout.paymentState !== 'CONFIRMED' || !(amountPaid > 0)) {
    throw new Error('Le paiement de publication doit être confirmé.');
  }
  const quote = checkout.listingFeeSnapshot;
  const hasQuote = quote && Number(quote.dueAmount) > 0;
  return {
    amountPaid,
    baseAmount: hasQuote ? Number(quote.baseAmount) : amountPaid,
    dueAmount: hasQuote ? Number(quote.dueAmount) : amountPaid,
    discountAmount: hasQuote ? Number(quote.discountAmount || 0) : 0,
    referencePrice: hasQuote ? Number(quote.referencePrice) : null,
    ratePercent: hasQuote ? Number(quote.ratePercent) : null,
    promo: hasQuote ? quote.promo : null
  };
};
