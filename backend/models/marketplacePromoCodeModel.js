import mongoose from 'mongoose';

const marketplacePromoCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 40
    },
    boutiqueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    appliesTo: {
      type: String,
      enum: ['boutique', 'product'],
      required: true,
      default: 'boutique'
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0
    },
    usageLimit: {
      type: Number,
      required: true,
      min: 1
    },
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    usedCount: {
      type: Number,
      default: 0,
      min: 0
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

marketplacePromoCodeSchema.index({ code: 1 });
marketplacePromoCodeSchema.index({ boutiqueId: 1, code: 1 }, { unique: true });
marketplacePromoCodeSchema.index({ boutiqueId: 1, isActive: 1, endDate: 1 });

marketplacePromoCodeSchema.pre('validate', function (next) {
  if (this.code) {
    this.code = this.code.trim().toUpperCase();
  }

  if (this.appliesTo === 'product' && !this.productId) {
    return next(new Error('productId est requis pour un code promo produit.'));
  }
  if (this.appliesTo === 'boutique') {
    this.productId = null;
  }

  if (this.discountType === 'percentage') {
    if (!Number.isFinite(this.discountValue) || this.discountValue <= 0 || this.discountValue > 100) {
      return next(new Error('discountValue doit être compris entre 0 et 100 pour un pourcentage.'));
    }
  } else if (!Number.isFinite(this.discountValue) || this.discountValue <= 0) {
    return next(new Error('discountValue doit être supérieur à 0 pour une remise fixe.'));
  }

  if (
    this.startDate instanceof Date &&
    this.endDate instanceof Date &&
    this.startDate.getTime() >= this.endDate.getTime()
  ) {
    return next(new Error('endDate doit être postérieure à startDate.'));
  }

  if (Number(this.usedCount || 0) > Number(this.usageLimit || 0)) {
    return next(new Error('usedCount ne peut pas dépasser usageLimit.'));
  }

  return next();
});

export default mongoose.model('MarketplacePromoCode', marketplacePromoCodeSchema);
