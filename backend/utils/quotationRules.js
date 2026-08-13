export const QUOTATION_ACTIVE_STATUSES = Object.freeze(['PENDING', 'COUNTERED', 'ACCEPTED']);
export const QUOTATION_SELLER_RESPONSE_STATUSES = Object.freeze(['PENDING', 'COUNTERED']);
export const QUOTATION_VALIDITY_HOURS = new Set([24, 48, 168, 336]);

export const quotationIsExpired = (quotation, now = new Date()) => {
  if (!quotation?.expirationDate) return false;
  const expiration = new Date(quotation.expirationDate);
  return !Number.isNaN(expiration.getTime()) && expiration.getTime() <= new Date(now).getTime();
};

export const quotationCanCreateOrder = (quotation, now = new Date()) =>
  quotation?.status === 'ACCEPTED' &&
  Boolean(quotation?.pricesLockedAt) &&
  !quotationIsExpired(quotation, now);

export const quotationSavings = ({ originalSubtotal = 0, quotedSubtotal = 0 } = {}) =>
  Math.max(0, Number(originalSubtotal || 0) - Number(quotedSubtotal || 0));

