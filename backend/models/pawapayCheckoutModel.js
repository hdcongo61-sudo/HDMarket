import mongoose from 'mongoose';

const pawapayCheckoutSchema = new mongoose.Schema(
  {
    checkoutId: { type: String, required: true, unique: true, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'XAF', uppercase: true, trim: true },
    country: { type: String, default: 'COG', uppercase: true, trim: true },
    purpose: {
      type: String,
      enum: [
        'CHECKOUT_FUNDING',
        'LISTING_FEE_FUNDING',
        'INSTALLMENT_FUNDING',
        'BOOST_FUNDING',
        'SHOP_CONVERSION_FUNDING'
      ],
      default: 'CHECKOUT_FUNDING'
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
      index: true
    },
    promoCode: { type: String, trim: true, uppercase: true, default: '' },
    actionContext: { type: mongoose.Schema.Types.Mixed, default: null },
    returnPath: { type: String, default: '/orders', trim: true },
    status: {
      type: String,
      enum: ['CREATED', 'WAITING_PAYMENT', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED'],
      default: 'CREATED',
      index: true
    },
    paymentState: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED'],
      default: 'PENDING'
    },
    redirectUrl: { type: String, default: '' },
    checkoutCode: { type: String, default: '' },
    expiresAt: { type: Date, default: null },
    providerTransactionId: { type: String, default: '' },
    depositId: { type: String, trim: true, default: '', index: true },
    depositStatus: { type: String, trim: true, uppercase: true, default: '' },
    failureReason: { type: mongoose.Schema.Types.Mixed, default: null },
    callbackPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    confirmedAt: { type: Date, default: null },
    autoValidationState: {
      type: String,
      enum: ['NOT_APPLICABLE', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'NOT_APPLICABLE',
      index: true
    },
    autoValidatedPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null
    },
    autoValidationError: { type: String, trim: true, default: '' },
    autoValidatedAt: { type: Date, default: null },
    completionResult: { type: mongoose.Schema.Types.Mixed, default: null },
    lastProviderStatusCheckAt: { type: Date, default: null }
  },
  { timestamps: true }
);

pawapayCheckoutSchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.PawaPayCheckout || mongoose.model('PawaPayCheckout', pawapayCheckoutSchema);
