import mongoose from 'mongoose';
import { generatePaymentReference } from '../utils/generatePaymentReference.js';

const PAYMENT_STATUSES = [
  'PENDING_PAYMENT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED',
  'AMOUNT_MISMATCH',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
  // Legacy listing-fee statuses kept for backward compatibility.
  'waiting',
  'verified',
  'rejected'
];

const VERIFIED_STATUSES = new Set(['VERIFIED', 'verified']);
const REJECTED_STATUSES = new Set(['REJECTED', 'rejected']);
const LOCKED_BUYER_STATUSES = new Set(['VERIFIED', 'verified', 'REJECTED', 'rejected', 'REFUNDED']);
const ORDER_PAYMENT_TYPES = new Set(['ORDER_PAYMENT', 'DELIVERY_FEE', 'INSTALLMENT']);

const normalizeTransactionId = (value) => {
  const normalized = String(value || '').trim().replace(/\s+/g, '');
  return normalized || undefined;
};

const normalizeCurrency = (value) => String(value || 'XAF').trim().toUpperCase() || 'XAF';

const createHttpError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const mapLegacyOperator = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'MTN') return 'MTN_MONEY';
  if (normalized === 'AIRTEL') return 'AIRTEL_MONEY';
  if (normalized === 'ORANGE') return 'ORANGE_MONEY';
  return normalized || 'OTHER';
};

const proofImageSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: '' },
    publicId: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const gatewaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ['MTN', 'AIRTEL', 'CINETPAY', 'FLUTTERWAVE', 'PAYDUNYA', 'PAWAPAY', 'NONE'],
      default: 'NONE'
    },
    externalTransactionId: { type: String, trim: true, default: '' },
    externalReference: { type: String, trim: true, default: '' },
    webhookEventId: { type: String, trim: true, default: '' },
    rawResponse: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required() {
        return ORDER_PAYMENT_TYPES.has(this.paymentType);
      }
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    paymentReference: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    transactionId: {
      type: String,
      trim: true,
      set: normalizeTransactionId
    },
    expectedAmount: {
      type: Number,
      required: true,
      min: 0
    },
    amountPaid: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      default: 'XAF',
      set: normalizeCurrency
    },
    operator: {
      type: String,
      enum: ['MTN_MONEY', 'AIRTEL_MONEY', 'ORANGE_MONEY', 'CASH', 'CARD', 'OTHER'],
      required: true,
      set: mapLegacyOperator
    },
    paymentType: {
      type: String,
      enum: ['ORDER_PAYMENT', 'LISTING_FEE', 'BOOST_FEE', 'DELIVERY_FEE', 'INSTALLMENT'],
      required: true,
      default: 'ORDER_PAYMENT'
    },
    verificationMethod: {
      type: String,
      enum: ['MANUAL', 'API', 'WEBHOOK'],
      default: 'MANUAL'
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'PENDING_PAYMENT'
    },
    payerName: {
      type: String,
      trim: true
    },
    payerPhoneNumber: {
      type: String,
      trim: true
    },
    paymentDate: {
      type: Date
    },
    proofImage: {
      type: proofImageSchema,
      default: () => ({})
    },
    adminNote: {
      type: String,
      trim: true
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: {
      type: Date
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectedAt: {
      type: Date
    },
    gateway: {
      type: gatewaySchema,
      default: () => ({})
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    // Legacy listing-fee fields used by the current product validation flow.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    transactionNumber: { type: String, trim: true },
    amount: { type: Number, min: 0 },
    commissionBaseAmount: { type: Number, min: 0, default: 0 },
    commissionReferencePrice: { type: Number, min: 0, default: 0 },
    commissionDiscountAmount: { type: Number, min: 0, default: 0 },
    commissionDueAmount: { type: Number, min: 0, default: 0 },
    paymentMethod: {
      type: String,
      enum: ['mobile_money', 'pawapay', 'promo'],
      default: 'mobile_money',
      index: true
    },
    waivedByPromo: { type: Boolean, default: false },
    promoCode: { type: mongoose.Schema.Types.ObjectId, ref: 'PromoCode', default: null },
    promoCodeValue: { type: String, trim: true, uppercase: true, default: '' },
    promoDiscountType: {
      type: String,
      enum: [null, 'percentage', 'full_waiver'],
      default: null
    },
    promoDiscountValue: { type: Number, min: 0, max: 100, default: 0 },
    validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    validatedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: Date.now },
    // Stale listing-fee moderation reminders (paid annonce awaiting admin treatment).
    moderationReminderLastSentAt: { type: Date, default: null },
    moderationReminderCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

paymentSchema.index(
  { paymentReference: 1 },
  {
    unique: true,
    partialFilterExpression: { paymentReference: { $type: 'string' } }
  }
);
paymentSchema.index(
  { transactionId: 1 },
  {
    unique: true,
    partialFilterExpression: { transactionId: { $type: 'string' } }
  }
);
paymentSchema.index({ status: 1 });
paymentSchema.index({ buyer: 1 });
paymentSchema.index({ order: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ operator: 1 });
paymentSchema.index({ paymentType: 1 });

// Legacy indexes retained for existing admin/listing-fee screens.
paymentSchema.index({ promoCode: 1, createdAt: -1 });
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, submittedAt: -1 });
paymentSchema.index({ product: 1, status: 1, createdAt: -1 });
paymentSchema.index({ validatedBy: 1, status: 1, validatedAt: -1 });
paymentSchema.index({ transactionNumber: 1 });

paymentSchema.methods.isVerified = function isVerified() {
  return VERIFIED_STATUSES.has(String(this.status || ''));
};

paymentSchema.methods.isPending = function isPending() {
  return ['PENDING_PAYMENT', 'SUBMITTED', 'UNDER_REVIEW', 'waiting'].includes(String(this.status || ''));
};

paymentSchema.methods.hasAmountMismatch = function hasAmountMismatch() {
  return String(this.status || '') === 'AMOUNT_MISMATCH';
};

paymentSchema.methods.canBeModifiedByBuyer = function canBeModifiedByBuyer() {
  return !LOCKED_BUYER_STATUSES.has(String(this.status || ''));
};

paymentSchema.methods.assertBuyerMutationAllowed = function assertBuyerMutationAllowed(buyerId) {
  if (buyerId && String(this.buyer || this.user || '') !== String(buyerId)) {
    throw createHttpError('Ce paiement ne correspond pas a votre commande.', 403);
  }

  if (!this.canBeModifiedByBuyer()) {
    throw createHttpError('Un paiement deja verifie ou rejete ne peut plus etre modifie.', 409);
  }

  return true;
};

paymentSchema.statics.assertBuyerOwnsOrder = async function assertBuyerOwnsOrder(orderId, buyerId) {
  const { default: Order } = await import('./orderModel.js');
  const order = await Order.findById(orderId).select('_id customer createdBy').lean();

  if (!order) {
    throw createHttpError('Commande introuvable.', 404);
  }

  const buyer = String(buyerId || '');
  const ownsOrder = [order.customer, order.createdBy].some((ownerId) => String(ownerId || '') === buyer);

  if (!ownsOrder) {
    throw createHttpError('Vous ne pouvez pas soumettre un paiement pour cette commande.', 403);
  }

  return order;
};

paymentSchema.statics.assertCanReview = function assertCanReview(user) {
  const role = String(user?.role || '').toLowerCase();
  if (!['admin', 'founder'].includes(role)) {
    throw createHttpError('Seul un administrateur peut verifier ou rejeter ce paiement.', 403);
  }

  return true;
};

paymentSchema.pre('validate', function normalizePayment(next) {
  if (!this.paymentReference) {
    this.paymentReference = generatePaymentReference();
  }

  if (this.product && !this.order && this.paymentType === 'ORDER_PAYMENT') {
    this.paymentType = 'LISTING_FEE';
  }

  if (!this.paymentType) {
    this.paymentType = this.product ? 'LISTING_FEE' : 'ORDER_PAYMENT';
  }

  if (!this.buyer && this.user) {
    this.buyer = this.user;
  }

  if (!this.user && this.buyer) {
    this.user = this.buyer;
  }

  if (!this.seller && this.paymentType === 'LISTING_FEE' && this.user) {
    this.seller = this.user;
  }

  if (this.expectedAmount == null) {
    const legacyAmount = this.commissionDueAmount != null ? this.commissionDueAmount : this.amount;
    this.expectedAmount = Number(legacyAmount || 0);
  }

  if (this.amountPaid == null && this.amount != null) {
    this.amountPaid = Number(this.amount || 0);
  }

  if (!this.transactionId && this.transactionNumber && this.transactionNumber !== '0000000000') {
    this.transactionId = this.transactionNumber;
  }

  if (!this.transactionNumber && this.transactionId) {
    this.transactionNumber = this.transactionId;
  }

  if (!this.operator) {
    this.operator = 'OTHER';
  }

  if (!this.currency) {
    this.currency = 'XAF';
  }

  next();
});

paymentSchema.pre('save', function normalizePaymentStatus(next) {
  if (this.transactionId) {
    this.transactionId = normalizeTransactionId(this.transactionId);
  }

  const amountPaidExists = this.amountPaid !== undefined && this.amountPaid !== null;
  const expected = Number(this.expectedAmount);
  const paid = Number(this.amountPaid);
  const hasComparableAmounts = amountPaidExists && Number.isFinite(expected) && Number.isFinite(paid);
  const isLockedReviewStatus = VERIFIED_STATUSES.has(String(this.status || '')) || REJECTED_STATUSES.has(String(this.status || ''));
  const usesLegacyListingStatus = this.paymentType === 'LISTING_FEE' && ['waiting', 'verified', 'rejected'].includes(String(this.status || ''));

  if (usesLegacyListingStatus) {
    return next();
  }

  if (hasComparableAmounts && paid !== expected) {
    this.status = 'AMOUNT_MISMATCH';
  } else if (hasComparableAmounts && paid === expected && this.transactionId && !isLockedReviewStatus) {
    this.status = 'SUBMITTED';
  }

  if (this.status === 'VERIFIED' && !this.verifiedAt) {
    this.verifiedAt = new Date();
  }

  if (this.status === 'REJECTED' && !this.rejectedAt) {
    this.rejectedAt = new Date();
  }

  next();
});

export { PAYMENT_STATUSES };

export default mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
