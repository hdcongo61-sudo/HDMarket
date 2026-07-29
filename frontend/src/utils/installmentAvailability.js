const toTimestamp = (value) => {
  if (!value) return Number.NaN;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
};

export const isInstallmentOfferActive = (product, now = Date.now()) => {
  if (!product?.installmentEnabled) return false;

  const nowTimestamp = toTimestamp(now);
  const startTimestamp = toTimestamp(product.installmentStartDate);
  const endTimestamp = toTimestamp(product.installmentEndDate);

  if (![nowTimestamp, startTimestamp, endTimestamp].every(Number.isFinite)) return false;
  return startTimestamp <= nowTimestamp && endTimestamp > nowTimestamp;
};

export const filterActiveInstallmentProducts = (products, now = Date.now()) =>
  (Array.isArray(products) ? products : []).filter((product) =>
    isInstallmentOfferActive(product, now)
  );

export const getInstallmentFirstPaymentAmount = (product, quantity = 1) => {
  const unitPrice = Number(product?.price || 0);
  const minimumAmount = Number(product?.installmentMinAmount || 0);
  const normalizedQuantity = Math.max(1, Math.trunc(Number(quantity) || 1));
  const subtotal = unitPrice * normalizedQuantity;

  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  if (!Number.isFinite(minimumAmount) || minimumAmount <= 0) return 0;
  return Math.min(subtotal, minimumAmount);
};
