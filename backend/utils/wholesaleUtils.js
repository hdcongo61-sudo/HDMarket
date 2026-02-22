const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundCurrency = (value) => Number(toNumber(value, 0).toFixed(2));

const normalizeBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(text)) return true;
  if (['false', '0', 'no', 'off'].includes(text)) return false;
  return fallback;
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value.tiers)) return value.tiers;
    if (Object.prototype.hasOwnProperty.call(value, 'minQty')) return [value];
  }
  return [];
};

const normalizeTierLabel = (value) => String(value || '').trim();

export const normalizeWholesaleTiers = (input, { maxTiers = 10 } = {}) => {
  const source = asArray(input).slice(0, maxTiers);

  const normalized = source
    .map((tier) => {
      const minQty = Math.trunc(toNumber(tier?.minQty, NaN));
      const unitPrice = roundCurrency(tier?.unitPrice);
      const label = normalizeTierLabel(tier?.label);
      return {
        minQty,
        unitPrice,
        ...(label ? { label } : {})
      };
    })
    .filter((tier) => Number.isFinite(tier.minQty) && Number.isFinite(tier.unitPrice));

  normalized.sort((a, b) => a.minQty - b.minQty);
  return normalized;
};

export const validateWholesaleConfig = ({
  wholesaleEnabled,
  wholesaleTiers,
  minQtyFloor = 2,
  maxTiers = 10,
  allowFlatPrice = true
} = {}) => {
  const normalizedEnabled = normalizeBoolean(wholesaleEnabled, false);
  const tiers = normalizeWholesaleTiers(wholesaleTiers, { maxTiers });

  if (!normalizedEnabled) {
    return {
      valid: true,
      normalized: {
        wholesaleEnabled: false,
        wholesaleTiers: tiers
      }
    };
  }

  if (!tiers.length) {
    return {
      valid: false,
      message: 'Ajoutez au moins un palier pour activer la vente en gros.'
    };
  }

  if (tiers.length > maxTiers) {
    return {
      valid: false,
      message: `Vous pouvez définir au maximum ${maxTiers} paliers.`
    };
  }

  const seen = new Set();
  let previousPrice = null;

  for (const tier of tiers) {
    if (!Number.isInteger(tier.minQty) || tier.minQty < minQtyFloor) {
      return {
        valid: false,
        message: `Chaque palier doit avoir une quantité minimum >= ${minQtyFloor}.`
      };
    }

    if (!Number.isFinite(tier.unitPrice) || tier.unitPrice <= 0) {
      return {
        valid: false,
        message: 'Chaque palier doit avoir un prix unitaire valide (> 0).'
      };
    }

    if (seen.has(tier.minQty)) {
      return {
        valid: false,
        message: 'Chaque palier doit avoir une quantité minimum unique.'
      };
    }
    seen.add(tier.minQty);

    if (previousPrice !== null) {
      const goesUp = tier.unitPrice > previousPrice;
      if (goesUp && !allowFlatPrice) {
        return {
          valid: false,
          message: 'Le prix unitaire doit diminuer quand la quantité augmente.'
        };
      }
      if (goesUp && allowFlatPrice) {
        return {
          valid: false,
          message: 'Le prix unitaire ne peut pas augmenter entre deux paliers.'
        };
      }
    }

    previousPrice = tier.unitPrice;
  }

  return {
    valid: true,
    normalized: {
      wholesaleEnabled: true,
      wholesaleTiers: tiers
    }
  };
};

export const getWholesaleTierForQuantity = (product, quantity = 1) => {
  if (!product?.wholesaleEnabled) return null;
  const tiers = normalizeWholesaleTiers(product.wholesaleTiers);
  if (!tiers.length) return null;

  const qty = Math.max(1, Math.trunc(toNumber(quantity, 1)));
  let active = null;
  for (const tier of tiers) {
    if (qty >= tier.minQty) {
      active = tier;
    } else {
      break;
    }
  }

  return active;
};

export const getUnitPrice = (product, quantity = 1) => {
  const basePrice = roundCurrency(product?.price);
  const tier = getWholesaleTierForQuantity(product, quantity);
  if (!tier) {
    return basePrice;
  }
  return roundCurrency(tier.unitPrice);
};

export const getWholesalePricing = (product, quantity = 1) => {
  const qty = Math.max(1, Math.trunc(toNumber(quantity, 1)));
  const baseUnitPrice = roundCurrency(product?.price);
  const tier = getWholesaleTierForQuantity(product, qty);
  const unitPrice = tier ? roundCurrency(tier.unitPrice) : baseUnitPrice;
  const lineTotal = roundCurrency(unitPrice * qty);
  const baseTotal = roundCurrency(baseUnitPrice * qty);
  const savingsAmount = Math.max(0, roundCurrency(baseTotal - lineTotal));
  const savingsPercent =
    baseTotal > 0 ? Number(((savingsAmount / baseTotal) * 100).toFixed(2)) : 0;

  return {
    quantity: qty,
    baseUnitPrice,
    unitPrice,
    lineTotal,
    tierApplied: tier
      ? {
          minQty: Number(tier.minQty || 0),
          unitPrice: roundCurrency(tier.unitPrice),
          label: normalizeTierLabel(tier.label)
        }
      : null,
    savingsAmount,
    savingsPercent,
    wholesaleEnabled: Boolean(product?.wholesaleEnabled)
  };
};

export const getWholesaleMinTierQty = (product) => {
  const tiers = normalizeWholesaleTiers(product?.wholesaleTiers);
  if (!tiers.length) return null;
  return Number(tiers[0]?.minQty || 0) || null;
};

export const getWholesaleFirstTierUnitPrice = (product) => {
  const tiers = normalizeWholesaleTiers(product?.wholesaleTiers);
  if (!tiers.length) return null;
  return roundCurrency(tiers[0]?.unitPrice || 0);
};
