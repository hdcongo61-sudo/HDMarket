import {
  buildSelectedAttributesSelectionKey,
  resolveSelectedAttributesPrice
} from './productAttributes';

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundCurrency = (value) => Number(toNumber(value, 0).toFixed(2));

const normalizeQuantity = (value, fallback = 1) => {
  const parsed = Math.trunc(toNumber(value, fallback));
  return Math.max(0, parsed);
};

const normalizeWholesaleTiers = (tiers = []) =>
  (Array.isArray(tiers) ? tiers : [])
    .map((tier) => ({
      minQty: Math.trunc(toNumber(tier?.minQty, NaN)),
      unitPrice: roundCurrency(tier?.unitPrice),
      label: String(tier?.label || '').trim()
    }))
    .filter((tier) => Number.isFinite(tier.minQty) && tier.minQty > 0 && tier.unitPrice > 0)
    .sort((a, b) => a.minQty - b.minQty);

export const getCartItemProductId = (item = {}) =>
  String(item?.product?._id || item?.product || '').trim();

export const getCartItemSelectionKey = (item = {}) =>
  String(
    item?.selectionKey ||
      buildSelectedAttributesSelectionKey(item?.selectedAttributes || [])
  ).trim();

export const buildCartItemMutationKey = ({
  productId,
  selectionKey = '',
  selectedAttributes = []
} = {}) =>
  `${String(productId || '').trim()}::${String(
    selectionKey || buildSelectedAttributesSelectionKey(selectedAttributes)
  ).trim()}`;

export const getOptimisticCartLinePricing = (product = {}, quantity = 1, selectedAttributes = []) => {
  const qty = Math.max(1, normalizeQuantity(quantity, 1));
  // Variant price (e.g. size) replaces the base price and skips wholesale tiers.
  const variant = resolveSelectedAttributesPrice({
    productAttributes: product?.attributes,
    selectedAttributes,
    basePrice: product?.price
  });
  if (variant.applied) {
    const unitPrice = roundCurrency(variant.unitPrice);
    return {
      quantity: qty,
      unitPrice,
      lineTotal: roundCurrency(unitPrice * qty),
      variantPriceApplied: true,
      wholesale: { applied: false, tier: null, savingsAmount: 0, savingsPercent: 0 }
    };
  }
  const baseUnitPrice = roundCurrency(product?.price);
  const tiers = product?.wholesaleEnabled ? normalizeWholesaleTiers(product?.wholesaleTiers) : [];
  let activeTier = null;

  for (const tier of tiers) {
    if (qty >= tier.minQty) {
      activeTier = tier;
    } else {
      break;
    }
  }

  const unitPrice = activeTier ? roundCurrency(activeTier.unitPrice) : baseUnitPrice;
  const lineTotal = roundCurrency(unitPrice * qty);
  const baseTotal = roundCurrency(baseUnitPrice * qty);
  const savingsAmount = Math.max(0, roundCurrency(baseTotal - lineTotal));

  return {
    quantity: qty,
    unitPrice,
    lineTotal,
    wholesale: {
      applied: Boolean(activeTier),
      tier: activeTier
        ? {
            minQty: Number(activeTier.minQty || 0),
            unitPrice: roundCurrency(activeTier.unitPrice),
            label: activeTier.label || ''
          }
        : null,
      savingsAmount,
      savingsPercent: baseTotal > 0 ? Number(((savingsAmount / baseTotal) * 100).toFixed(2)) : 0
    }
  };
};

export const recalculateCart = (cart = {}) => {
  const items = (Array.isArray(cart?.items) ? cart.items : [])
    .filter((item) => item?.product)
    .map((item) => {
      const pricing = getOptimisticCartLinePricing(item.product, item.quantity, item.selectedAttributes);
      return {
        ...item,
        quantity: pricing.quantity,
        unitPrice: pricing.unitPrice,
        lineTotal: pricing.lineTotal,
        wholesale: pricing.wholesale
      };
    });

  const totals = items.reduce(
    (acc, item) => {
      acc.quantity += Number(item.quantity || 0);
      acc.subtotal = roundCurrency(acc.subtotal + Number(item.lineTotal || 0));
      return acc;
    },
    { quantity: 0, subtotal: 0 }
  );

  return {
    items,
    totals,
    updatedAt: cart?.updatedAt || new Date().toISOString()
  };
};

export const patchCartItemQuantity = (
  cart = {},
  { productId, quantity, selectionKey = '', selectedAttributes = [] } = {}
) => {
  const requestedProductId = String(productId || '').trim();
  const requestedSelectionKey = String(
    selectionKey || buildSelectedAttributesSelectionKey(selectedAttributes)
  ).trim();
  const nextQuantity = normalizeQuantity(quantity, 0);
  let matched = false;

  const nextItems = (Array.isArray(cart?.items) ? cart.items : [])
    .map((item) => {
      const sameItem =
        getCartItemProductId(item) === requestedProductId &&
        getCartItemSelectionKey(item) === requestedSelectionKey;
      if (!sameItem) return item;
      matched = true;
      if (nextQuantity <= 0) return null;
      return {
        ...item,
        quantity: nextQuantity
      };
    })
    .filter(Boolean);

  if (!matched) return recalculateCart(cart);
  return recalculateCart({ ...cart, items: nextItems });
};

export const removeCartItem = (cart = {}, item = {}) =>
  patchCartItemQuantity(cart, {
    productId: getCartItemProductId(item),
    quantity: 0,
    selectionKey: getCartItemSelectionKey(item),
    selectedAttributes: item?.selectedAttributes || []
  });
