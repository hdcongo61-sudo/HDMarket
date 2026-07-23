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
        'WALLET_TOPUP',
        'CHECKOUT_FUNDING',
        'LISTING_FEE_FUNDING',
        'INSTALLMENT_FUNDING',
        'BOOST_FUNDING',
        'SHOP_CONVERSION_FUNDING'
      ],
      default: 'WALLET_TOPUP'
    },
    returnPath: { type: String, default: '/wallet', trim: true },
    status: {
      type: String,
      enum: ['CREATED', 'WAITING_PAYMENT', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED'],
      default: 'CREATED',
      index: true
    },
    creditState: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'CREDITED', 'FAILED'],
      default: 'PENDING'
    },
    redirectUrl: { type: String, default: '' },
    checkoutCode: { type: String, default: '' },
    expiresAt: { type: Date, default: null },
    providerTransactionId: { type: String, default: '' },
    failureReason: { type: mongoose.Schema.Types.Mixed, default: null },
    callbackPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    creditedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

pawapayCheckoutSchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.PawaPayCheckout || mongoose.model('PawaPayCheckout', pawapayCheckoutSchema);
