import mongoose from 'mongoose';

const sellerPayoutSchema = new mongoose.Schema(
  {
    payoutId: { type: String, required: true, unique: true, trim: true },
    batchKey: { type: String, required: true, unique: true, trim: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    settlements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SellerSettlement' }],
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'XAF', uppercase: true, trim: true },
    provider: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['CREATED', 'PROCESSING', 'ENQUEUED', 'COMPLETED', 'FAILED', 'NEEDS_ATTENTION', 'CANCELLED'],
      default: 'CREATED',
      index: true
    },
    providerTransactionId: { type: String, trim: true, default: '' },
    failureReason: { type: mongoose.Schema.Types.Mixed, default: null },
    rawResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    initiatedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    lastProviderStatusCheckAt: { type: Date, default: null }
  },
  { timestamps: true }
);

sellerPayoutSchema.index({ seller: 1, createdAt: -1 });
sellerPayoutSchema.index({ status: 1, lastProviderStatusCheckAt: 1 });

export default mongoose.models.SellerPayout || mongoose.model('SellerPayout', sellerPayoutSchema);
