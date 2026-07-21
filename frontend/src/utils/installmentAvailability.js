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
