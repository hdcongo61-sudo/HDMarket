import mongoose from 'mongoose';

// Parcel-delivery-only promo codes (separate from marketplacePromoCodeModel,
// which discounts product orders) — percent/fixed discount, free delivery,
// or restricted to a specific zone.
const deliveryPromotionSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    discountType: { type: String, enum: ['PERCENT', 'FIXED', 'FREE_DELIVERY'], default: 'PERCENT' },
    discountValue: { type: Number, default: 0, min: 0 },
    zoneRestrictionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryZone', default: null },
    maxUses: { type: Number, default: null, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

deliveryPromotionSchema.index({ isActive: 1, expiresAt: 1 });

export default mongoose.model('DeliveryPromotion', deliveryPromotionSchema);
