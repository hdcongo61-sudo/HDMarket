import mongoose from 'mongoose';

const listingFeePaymentSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    oldPrice: { type: Number, required: true, min: 0 },
    newPrice: { type: Number, required: true, min: 0 },
    oldFee: { type: Number, required: true, min: 0 },
    requiredFee: { type: Number, required: true, min: 0 },
    remainingFee: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String, trim: true, default: '' },
    transactionReference: { type: String, trim: true, default: '' },
    payerName: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true
    },
    submittedAt: { type: Date, default: null, index: true },
    validatedAt: { type: Date, default: null },
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

listingFeePaymentSchema.index({ productId: 1, createdAt: -1 });
listingFeePaymentSchema.index({ sellerId: 1, createdAt: -1 });
listingFeePaymentSchema.index({ status: 1, submittedAt: -1 });
listingFeePaymentSchema.index(
  { transactionReference: 1 },
  {
    unique: true,
    partialFilterExpression: { transactionReference: { $type: 'string', $gt: '' } }
  }
);
listingFeePaymentSchema.index(
  { productId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'PENDING' }
  }
);

export default mongoose.models.ListingFeePayment ||
  mongoose.model('ListingFeePayment', listingFeePaymentSchema);
