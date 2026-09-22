import mongoose from 'mongoose';

const pawapayCheckoutSchema = new mongoose.Schema(
  {
    checkoutId: { type: String, required: true, unique: true, trim: true },
    requestFingerprint: { type: String, default: '', select: false },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'XAF', uppercase: true, trim: true },
    country: { type: String, default: 'COG', uppercase: true, trim: true },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', default: null, index: true },
    purpose: {
      type: String,
      enum: [
        'IMAGE_EDIT_FUNDING',
        'CHECKOUT_FUNDING',
        'LISTING_FEE_FUNDING',
        'INSTALLMENT_FUNDING',
        'BOOST_FUNDING',
        'SHOP_CONVERSION_FUNDING',
        'PARCEL_REQUEST_FUNDING',
        'BUY_FOR_ME_FUNDING',
        'BUY_FOR_ME_ADDITIONAL_FUNDING',
        'GLOBAL_NOTIFICATION_FUNDING'
      ],
      default: 'CHECKOUT_FUNDING'
    },
    imageEditJob: { type: mongoose.Schema.Types.ObjectId, ref: 'ImageEditJob', default: null },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
      index: true
    },
    promoCode: { type: String, trim: true, uppercase: true, default: '' },
    listingFeeSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    actionContext: { type: mongoose.Schema.Types.Mixed, default: null },
    sponsorshipSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    installmentSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    orderSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    orderReservationKey: { type: String, default: '', index: true },
    orderPromosReserved: { type: Boolean, default: false, index: true },
    installmentReservationKey: { type: String, default: '', index: true },
    buyForMeSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
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
    checkoutCode: { type: String, trim: true, default: '', index: true },
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
    autoValidatedListingFeePayment: { type: mongoose.Schema.Types.ObjectId, ref: 'ListingFeePayment', default: null },
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
pawapayCheckoutSchema.index({ countryId: 1, status: 1, createdAt: -1 });

export default mongoose.models.PawaPayCheckout || mongoose.model('PawaPayCheckout', pawapayCheckoutSchema);
