export const DELIVERY_FEE_SOURCE = Object.freeze({
  COMMUNE_FREE: 'COMMUNE_FREE',
  COMMUNE_FIXED: 'COMMUNE_FIXED',
  SHOP_FREE: 'SHOP_FREE',
  PRODUCT_FEE: 'PRODUCT_FEE',
  PICKUP: 'PICKUP'
});

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

/**
 * Deterministic delivery fee priority (highest -> lowest):
 * 1) Commune policy
 * 2) Shop free-delivery toggle
 * 3) Product delivery fee
 */
export const resolveDeliveryPricing = ({
  deliveryMode = 'DELIVERY',
  commune = null,
  shop = null,
  items = []
} = {}) => {
  const normalizedMode = String(deliveryMode || 'DELIVERY').toUpperCase();
  if (normalizedMode !== 'DELIVERY') {
    return {
      deliveryFeeTotal: 0,
      deliveryFeeSource: DELIVERY_FEE_SOURCE.PICKUP
    };
  }

  const policy = String(commune?.deliveryPolicy || 'DEFAULT_RULE').toUpperCase();
  if (policy === 'FREE') {
    return {
      deliveryFeeTotal: 0,
      deliveryFeeSource: DELIVERY_FEE_SOURCE.COMMUNE_FREE
    };
  }

  if (policy === 'FIXED_FEE') {
    return {
      deliveryFeeTotal: Math.max(0, toNumber(commune?.fixedFee, 0)),
      deliveryFeeSource: DELIVERY_FEE_SOURCE.COMMUNE_FIXED
    };
  }

  if (Boolean(shop?.freeDeliveryEnabled)) {
    return {
      deliveryFeeTotal: 0,
      deliveryFeeSource: DELIVERY_FEE_SOURCE.SHOP_FREE
    };
  }

  const maxProductFee = (Array.isArray(items) ? items : []).reduce((max, item) => {
    const product = item?.product || item;
    if (!product) return max;
    if (product.deliveryAvailable === false) return max;
    if (product.deliveryFeeEnabled === false) return max;
    const fee = Math.max(0, toNumber(product.deliveryFee, 0));
    return fee > max ? fee : max;
  }, 0);

  return {
    deliveryFeeTotal: maxProductFee,
    deliveryFeeSource: DELIVERY_FEE_SOURCE.PRODUCT_FEE
  };
};
