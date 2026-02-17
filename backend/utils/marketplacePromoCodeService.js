import mongoose from 'mongoose';
import MarketplacePromoCode from '../models/marketplacePromoCodeModel.js';

const roundCurrency = (value) => Number(Number(value || 0).toFixed(2));

export const normalizeMarketplacePromoCode = (value) => String(value || '').trim().toUpperCase();

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const buildError = (message, status = 400, reason = 'promo_invalid') => {
  const error = new Error(message);
  error.status = status;
  error.reason = reason;
  return error;
};

const isPromoActiveNow = (promo, now = new Date()) => {
  if (!promo?.isActive) return false;
  const start = promo.startDate ? new Date(promo.startDate) : null;
  const end = promo.endDate ? new Date(promo.endDate) : null;
  if (!start || Number.isNaN(start.getTime())) return false;
  if (!end || Number.isNaN(end.getTime())) return false;
  return now >= start && now <= end;
};

const promoUsedByClient = (promo, clientId) => {
  const key = String(clientId || '');
  return Array.isArray(promo?.usedBy)
    ? promo.usedBy.some((id) => String(id) === key)
    : false;
};

const buildOrderLines = (items = []) =>
  (Array.isArray(items) ? items : []).map((item) => {
    const productId = item?.product?._id || item?.productId || item?.product;
    const qty = Math.max(1, Number(item?.quantity || 1));
    const price = Number(item?.unitPrice ?? item?.snapshot?.price ?? item?.price ?? 0);
    return {
      productId: productId ? String(productId) : '',
      quantity: qty,
      unitPrice: roundCurrency(price),
      subtotal: roundCurrency(price * qty)
    };
  });

const resolveEligibleAmount = ({ promo, lines }) => {
  if (!promo || !Array.isArray(lines) || !lines.length) return 0;
  if (promo.appliesTo === 'boutique') {
    return roundCurrency(lines.reduce((sum, line) => sum + Number(line.subtotal || 0), 0));
  }
  const productKey = String(promo.productId || '');
  return roundCurrency(
    lines
      .filter((line) => String(line.productId || '') === productKey)
      .reduce((sum, line) => sum + Number(line.subtotal || 0), 0)
  );
};

const computeDiscountAmount = ({ promo, eligibleAmount }) => {
  const subtotal = roundCurrency(eligibleAmount);
  if (!promo || subtotal <= 0) return 0;
  if (promo.discountType === 'percentage') {
    const rate = Math.max(0, Math.min(100, Number(promo.discountValue || 0)));
    return roundCurrency((subtotal * rate) / 100);
  }
  const fixed = Math.max(0, Number(promo.discountValue || 0));
  return roundCurrency(Math.min(subtotal, fixed));
};

const validatePromoForClient = ({ promo, clientId, lines, now = new Date() }) => {
  if (!promo) {
    return { valid: false, reason: 'not_found', message: 'Code promo introuvable.' };
  }
  if (!promo.isActive) {
    return { valid: false, reason: 'inactive', message: 'Ce code promo est désactivé.' };
  }
  if (!isPromoActiveNow(promo, now)) {
    const startsAt = new Date(promo.startDate);
    if (startsAt > now) {
      return { valid: false, reason: 'not_started', message: 'Ce code promo n’est pas encore actif.' };
    }
    return { valid: false, reason: 'expired', message: 'Ce code promo est expiré.' };
  }
  if (Number(promo.usedCount || 0) >= Number(promo.usageLimit || 0)) {
    return {
      valid: false,
      reason: 'usage_limit_reached',
      message: 'Ce code promo a atteint sa limite d’utilisation.'
    };
  }
  if (promoUsedByClient(promo, clientId)) {
    return { valid: false, reason: 'already_used', message: 'Vous avez déjà utilisé ce code promo.' };
  }
  const eligibleAmount = resolveEligibleAmount({ promo, lines });
  if (eligibleAmount <= 0) {
    return {
      valid: false,
      reason: 'not_applicable',
      message:
        promo.appliesTo === 'product'
          ? 'Ce code promo ne s’applique pas à ce produit.'
          : 'Ce code promo ne s’applique pas à cette commande.'
    };
  }
  return { valid: true, reason: 'ok', message: 'Code promo valide.', eligibleAmount };
};

export const previewMarketplacePromoForOrder = async ({
  code,
  boutiqueId,
  clientId,
  items,
  now = new Date()
}) => {
  const normalizedCode = normalizeMarketplacePromoCode(code);
  const lines = buildOrderLines(items);
  const baseAmount = roundCurrency(lines.reduce((sum, line) => sum + Number(line.subtotal || 0), 0));

  if (!normalizedCode) {
    return {
      valid: false,
      code: null,
      message: 'Veuillez saisir un code promo.',
      reason: 'missing_code',
      pricing: {
        baseAmount,
        eligibleAmount: 0,
        discountAmount: 0,
        finalAmount: baseAmount
      }
    };
  }

  const promo = await MarketplacePromoCode.findOne({
    boutiqueId: toObjectId(boutiqueId),
    code: normalizedCode
  }).lean();

  const validation = validatePromoForClient({ promo, clientId, lines, now });
  if (!validation.valid) {
    return {
      valid: false,
      code: normalizedCode,
      message: validation.message,
      reason: validation.reason,
      pricing: {
        baseAmount,
        eligibleAmount: 0,
        discountAmount: 0,
        finalAmount: baseAmount
      }
    };
  }

  const eligibleAmount = roundCurrency(validation.eligibleAmount || 0);
  const discountAmount = computeDiscountAmount({ promo, eligibleAmount });
  const finalAmount = roundCurrency(Math.max(0, baseAmount - discountAmount));

  return {
    valid: true,
    code: normalizedCode,
    message: 'Code promo appliqué.',
    reason: 'ok',
    promo: {
      id: promo._id,
      code: promo.code,
      appliesTo: promo.appliesTo,
      productId: promo.productId || null,
      discountType: promo.discountType,
      discountValue: Number(promo.discountValue || 0)
    },
    pricing: {
      baseAmount,
      eligibleAmount,
      discountAmount,
      finalAmount
    }
  };
};

export const consumeMarketplacePromoForOrder = async ({
  code,
  boutiqueId,
  clientId,
  items,
  now = new Date(),
  session = null
}) => {
  const normalizedCode = normalizeMarketplacePromoCode(code);
  const lines = buildOrderLines(items);
  const baseAmount = roundCurrency(lines.reduce((sum, line) => sum + Number(line.subtotal || 0), 0));

  if (!normalizedCode) {
    return {
      applied: false,
      promo: null,
      pricing: {
        baseAmount,
        eligibleAmount: 0,
        discountAmount: 0,
        finalAmount: baseAmount
      }
    };
  }

  const clientObjectId = toObjectId(clientId);
  const boutiqueObjectId = toObjectId(boutiqueId);
  if (!clientObjectId || !boutiqueObjectId) {
    throw buildError('Client ou boutique invalide pour le code promo.', 400, 'invalid_target');
  }

  const productIds = Array.from(
    new Set(
      lines
        .map((line) => toObjectId(line.productId))
        .filter(Boolean)
        .map((id) => String(id))
    )
  ).map((id) => new mongoose.Types.ObjectId(id));

  const filter = {
    boutiqueId: boutiqueObjectId,
    code: normalizedCode,
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    usedBy: { $ne: clientObjectId },
    $expr: { $lt: ['$usedCount', '$usageLimit'] },
    $or: [
      { appliesTo: 'boutique' },
      { appliesTo: 'product', productId: { $in: productIds } }
    ]
  };

  const promo = await MarketplacePromoCode.findOneAndUpdate(
    filter,
    {
      $addToSet: { usedBy: clientObjectId },
      $inc: { usedCount: 1 }
    },
    {
      new: true,
      session
    }
  );

  if (!promo) {
    const preview = await previewMarketplacePromoForOrder({
      code: normalizedCode,
      boutiqueId,
      clientId,
      items,
      now
    });
    throw buildError(preview.message || 'Code promo invalide ou expiré.', 400, preview.reason || 'promo_invalid');
  }

  const eligibleAmount = resolveEligibleAmount({ promo, lines });
  if (eligibleAmount <= 0) {
    await MarketplacePromoCode.updateOne(
      { _id: promo._id },
      { $inc: { usedCount: -1 }, $pull: { usedBy: clientObjectId } },
      { session }
    );
    throw buildError('Ce code promo ne s’applique pas à cette commande.', 400, 'not_applicable');
  }

  const discountAmount = computeDiscountAmount({ promo, eligibleAmount });
  const finalAmount = roundCurrency(Math.max(0, baseAmount - discountAmount));

  if (Number(promo.usedCount || 0) >= Number(promo.usageLimit || 0) && promo.isActive) {
    await MarketplacePromoCode.updateOne(
      { _id: promo._id },
      { $set: { isActive: false } },
      { session }
    );
    promo.isActive = false;
  }

  return {
    applied: true,
    promo,
    pricing: {
      baseAmount,
      eligibleAmount: roundCurrency(eligibleAmount),
      discountAmount,
      finalAmount
    }
  };
};

export const rollbackConsumedMarketplacePromo = async ({ promoId, clientId, session = null }) => {
  const promoObjectId = toObjectId(promoId);
  const clientObjectId = toObjectId(clientId);
  if (!promoObjectId || !clientObjectId) return;

  await MarketplacePromoCode.updateOne(
    {
      _id: promoObjectId,
      usedBy: clientObjectId,
      usedCount: { $gt: 0 }
    },
    {
      $pull: { usedBy: clientObjectId },
      $inc: { usedCount: -1 },
      $set: { isActive: true }
    },
    { session }
  );
};
