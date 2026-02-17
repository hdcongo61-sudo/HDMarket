import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    payerName: { type: String, required: true },
    transactionNumber: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    commissionBaseAmount: { type: Number, min: 0, default: 0 },
    commissionDiscountAmount: { type: Number, min: 0, default: 0 },
    commissionDueAmount: { type: Number, min: 0, default: 0 },
    waivedByPromo: { type: Boolean, default: false },
    promoCode: { type: mongoose.Schema.Types.ObjectId, ref: 'PromoCode', default: null },
    promoCodeValue: { type: String, trim: true, uppercase: true, default: '' },
    promoDiscountType: {
      type: String,
      enum: [null, 'percentage', 'full_waiver'],
      default: null
    },
    promoDiscountValue: { type: Number, min: 0, max: 100, default: 0 },
    operator: { type: String, enum: ['MTN', 'Airtel', 'Orange', 'Moov', 'Other'], required: true },
    status: { type: String, enum: ['waiting', 'verified', 'rejected'], default: 'waiting' },
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    validatedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

paymentSchema.index({ promoCode: 1, createdAt: -1 });
paymentSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Payment', paymentSchema);
