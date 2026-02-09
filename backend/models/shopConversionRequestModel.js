import mongoose from 'mongoose';

const shopConversionRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shopName: { type: String, required: true, trim: true },
    shopAddress: { type: String, required: true, trim: true },
    shopLogo: { type: String, default: '' },
    shopDescription: { type: String, trim: true, default: '' },
    paymentProof: { type: String, required: true },
    paymentAmount: { type: Number, required: true, default: 50000 },
    operator: { type: String, enum: ['MTN', 'Airtel'], required: true, default: 'MTN' },
    transactionName: { type: String, required: true, trim: true },
    transactionNumber: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    processedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

shopConversionRequestSchema.index({ user: 1, createdAt: -1 });
shopConversionRequestSchema.index({ status: 1, createdAt: -1 });
shopConversionRequestSchema.index({ user: 1, status: 1 });

export default mongoose.model('ShopConversionRequest', shopConversionRequestSchema);
