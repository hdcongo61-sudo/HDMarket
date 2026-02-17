import mongoose from 'mongoose';

const promoCodeUsageSchema = new mongoose.Schema(
  {
    promoCode: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PromoCode',
      required: true
    },
    codeSnapshot: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null
    },
    discountType: {
      type: String,
      enum: ['percentage', 'full_waiver'],
      required: true
    },
    discountValue: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    baseCommissionAmount: {
      type: Number,
      min: 0,
      required: true
    },
    discountAmount: {
      type: Number,
      min: 0,
      required: true
    },
    commissionDueAmount: {
      type: Number,
      min: 0,
      required: true
    },
    referralTag: {
      type: String,
      trim: true,
      default: ''
    },
    ipAddress: {
      type: String,
      default: null
    },
    userAgent: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

promoCodeUsageSchema.index({ promoCode: 1, seller: 1 }, { unique: true });
promoCodeUsageSchema.index({ seller: 1, createdAt: -1 });
promoCodeUsageSchema.index({ promoCode: 1, createdAt: -1 });
promoCodeUsageSchema.index({ createdAt: -1 });

export default mongoose.model('PromoCodeUsage', promoCodeUsageSchema);
