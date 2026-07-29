/**
 * Applies a delivery promo code (percent/fixed discount or free delivery),
 * scoped to parcel deliveries only — separate from marketplacePromoCode,
 * which discounts product orders.
 */
import DeliveryPromotion from '../../models/deliveryPromotionModel.js';

export const resolvePromotion = async ({ code, zoneId = null, pricingContext = null }) => {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) return null;

  const promotion = pricingContext
    ? pricingContext.promotions.find((entry) => String(entry.code || '').toUpperCase() === normalizedCode)
    : await DeliveryPromotion.findOne({ code: normalizedCode, isActive: true }).lean();
  if (!promotion) return null;
  if (promotion.expiresAt && new Date(promotion.expiresAt) < new Date()) return null;
  if (Number.isFinite(promotion.maxUses) && Number(promotion.usedCount || 0) >= Number(promotion.maxUses)) return null;
  if (promotion.zoneRestrictionId && String(promotion.zoneRestrictionId) !== String(zoneId || '')) return null;

  return promotion;
};

export const computePromotionDiscount = (promotion, subtotal) => {
  if (!promotion) return { label: '', amount: 0 };
  if (promotion.discountType === 'FREE_DELIVERY') {
    return { label: `Promo ${promotion.code} (livraison gratuite)`, amount: -subtotal };
  }
  if (promotion.discountType === 'FIXED') {
    return { label: `Promo ${promotion.code}`, amount: -Math.min(subtotal, Number(promotion.discountValue || 0)) };
  }
  const percentAmount = Math.round((subtotal * Number(promotion.discountValue || 0)) / 100);
  return { label: `Promo ${promotion.code}`, amount: -Math.min(subtotal, percentAmount) };
};

export const markPromotionUsed = (promotionId) =>
  DeliveryPromotion.updateOne({ _id: promotionId }, { $inc: { usedCount: 1 } });
