import mongoose from 'mongoose';

const shopConversionRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shopName: { type: String, required: true, trim: true },
    shopAddress: { type: String, required: true, trim: true },
    shopLogo: { type: String, default: '' },
    shopDescription: { type: String, trim: true, default: '' },
    verificationDocuments: {
      shopPaper: { type: String, required: true },
      shopInvoice: { type: String, required: true },
      insidePhoto: { type: String, required: true },
      outsidePhoto: { type: String, required: true }
    },
    paymentProof: { type: String, default: '' },
    paymentAmount: { type: Number, required: true, default: 50000 },
    paymentMethod: {
      type: String,
      // mobile_money remains readable for historical requests; all new requests
      // are created through PawaPay.
      enum: ['pawapay', 'mobile_money'],
      default: 'pawapay',
      index: true
    },
    paymentStatus: {
      type: String,
      enum: ['awaiting_payment', 'paid', 'refunded', 'pending_admin_validation'],
      default: 'awaiting_payment',
      index: true
    },
    operator: { type: String, default: 'PawaPay', trim: true },
    transactionName: { type: String, default: 'PawaPay', trim: true },
    transactionNumber: { type: String, default: '', trim: true },
    pawaPayCheckoutId: { type: String, default: '', trim: true, index: true },
    status: {
      type: String,
      enum: ['awaiting_payment', 'pending', 'approved', 'rejected'],
      default: 'awaiting_payment',
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
shopConversionRequestSchema.index({ transactionNumber: 1 });

export default mongoose.model('ShopConversionRequest', shopConversionRequestSchema);
