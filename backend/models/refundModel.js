import mongoose from 'mongoose';

const refundSchema = new mongoose.Schema(
  {
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', default: null, index: true },
    refundId: { type: String, required: true, unique: true, trim: true },
    operationKey: { type: String, default: '', index: true },
    installmentBatchId: { type: String, default: '', index: true },
    depositId: { type: String, required: true, trim: true, index: true },
    checkoutId: { type: String, trim: true, default: '', index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dispute: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispute', default: null },
    source: {
      type: String,
      enum: ['SELLER_CANCELLATION', 'ORDER_CANCELLATION', 'DISPUTE_FULL', 'DISPUTE_PARTIAL', 'ADMIN'],
      required: true
    },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'XAF', uppercase: true, trim: true },
    status: {
      type: String,
      enum: ['CREATED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'NEEDS_ATTENTION'],
      default: 'CREATED',
      index: true
    },
    providerTransactionId: { type: String, trim: true, default: '' },
    failureReason: { type: mongoose.Schema.Types.Mixed, default: null },
    rawResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    initiatedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    effectsAppliedAt: { type: Date, default: null },
    effectsPending: { type: Boolean, default: false },
    terminalNotifiedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    lastProviderStatusCheckAt: { type: Date, default: null }
  },
  { timestamps: true }
);

refundSchema.index({ depositId: 1, status: 1 });
refundSchema.index({ order: 1, createdAt: -1 });

export default mongoose.models.Refund || mongoose.model('Refund', refundSchema);
