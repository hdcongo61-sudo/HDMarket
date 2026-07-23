import mongoose from 'mongoose';

const pawapayEventSchema = new mongoose.Schema(
  {
    resourceType: {
      type: String,
      enum: ['checkout', 'deposit', 'payout', 'refund'],
      required: true
    },
    resourceId: { type: String, required: true, trim: true },
    status: { type: String, required: true, trim: true, uppercase: true },
    amount: { type: Number, default: null },
    currency: { type: String, trim: true, uppercase: true, default: '' },
    country: { type: String, trim: true, uppercase: true, default: '' },
    providerTransactionId: { type: String, trim: true, default: '' },
    failureReason: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    payloadDigest: { type: String, required: true },
    callbackCount: { type: Number, default: 0, min: 0 },
    firstReceivedAt: { type: Date, default: Date.now },
    lastReceivedAt: { type: Date, default: Date.now },
    matchedPayment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    matchedRefund: { type: mongoose.Schema.Types.ObjectId, ref: 'Refund', default: null },
    matchedPayout: { type: mongoose.Schema.Types.ObjectId, ref: 'SellerPayout', default: null },
    reconciliationStatus: {
      type: String,
      enum: ['UNMATCHED', 'MATCHED', 'AMOUNT_MISMATCH', 'CURRENCY_MISMATCH'],
      default: 'UNMATCHED'
    }
  },
  { timestamps: true }
);

pawapayEventSchema.index({ resourceType: 1, resourceId: 1 }, { unique: true });
pawapayEventSchema.index({ reconciliationStatus: 1, lastReceivedAt: -1 });

export default mongoose.models.PawaPayEvent || mongoose.model('PawaPayEvent', pawapayEventSchema);
