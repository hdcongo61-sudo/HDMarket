export const LISTING_FEE_STATUSES = [
  'NOT_REQUIRED',
  'PAID',
  'PAYMENT_REQUIRED',
  'UNDER_REVIEW'
];

export const roundMoney = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
};

export const normalizeListingFeeRate = (value, fallbackPercent = 3) => {
  const numeric = Number(value);
  const fallback = Number(fallbackPercent) / 100;
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return numeric > 1 ? numeric / 100 : numeric;
};

export const calculateListingFee = ({ price, rate, paid = 0 }) => {
  const safePrice = Math.max(0, Number(price) || 0);
  const safeRate = Math.max(0, normalizeListingFeeRate(rate));
  const safePaid = Math.max(0, roundMoney(paid));
  const requiredFee = roundMoney(safePrice * safeRate);
  const remainingFee = roundMoney(Math.max(0, requiredFee - safePaid));

  return {
    requiredFee,
    remainingFee,
    paidFee: safePaid
  };
};
