import mongoose from 'mongoose';

const sellerSettlementSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    grossAmount: { type: Number, required: true, min: 0 },
    refundedAmount: { type: Number, default: 0, min: 0 },
    commissionRate: { type: Number, required: true, min: 0, max: 100 },
    commissionAmount: { type: Number, required: true, min: 0 },
    netAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'XAF', uppercase: true, trim: true },
    releaseAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['HELD', 'WAITING_ACCOUNT', 'READY', 'PROCESSING', 'PAID', 'FAILED', 'BLOCKED', 'CANCELLED'],
      default: 'HELD',
      index: true
    },
    payout: { type: mongoose.Schema.Types.ObjectId, ref: 'SellerPayout', default: null, index: true },
    failureReason: { type: String, trim: true, default: '' },
    paidAt: { type: Date, default: null }
  },
  { timestamps: true }
);

sellerSettlementSchema.index({ seller: 1, status: 1, releaseAt: 1 });

export default mongoose.models.SellerSettlement ||
  mongoose.model('SellerSettlement', sellerSettlementSchema);
