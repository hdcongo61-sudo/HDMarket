import mongoose from 'mongoose';

export const QUOTATION_STATUSES = Object.freeze([
  'PENDING',
  'COUNTERED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'ORDER_CREATED'
]);

const quotationRequestSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', default: null, index: true },
    status: { type: String, enum: QUOTATION_STATUSES, default: 'PENDING', index: true },
    message: { type: String, trim: true, maxlength: 2000, default: '' },
    sellerMessage: { type: String, trim: true, maxlength: 2000, default: '' },
    deliveryCity: { type: String, trim: true, maxlength: 120, required: true },
    expectedDeliveryDate: { type: Date, default: null },
    estimatedDeliveryDate: { type: Date, default: null },
    requestedPrice: { type: Number, min: 0, default: null },
    currency: { type: String, trim: true, uppercase: true, default: 'XAF' },
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    deliveryFee: { type: Number, min: 0, default: 0 },
    validityPeriodHours: { type: Number, min: 1, max: 24 * 365, default: 48 },
    expirationDate: { type: Date, default: null, index: true },
    pricesLockedAt: { type: Date, default: null },
    respondedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    wasCountered: { type: Boolean, default: false, index: true },
    responseUpdating: { type: Boolean, default: false },
    expiredNotifiedAt: { type: Date, default: null },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    itemCount: { type: Number, min: 1, default: 1 },
    originalSubtotal: { type: Number, min: 0, default: 0 },
    quotedSubtotal: { type: Number, min: 0, default: 0 }
  },
  { timestamps: true }
);

quotationRequestSchema.index({ buyer: 1, createdAt: -1 });
quotationRequestSchema.index({ seller: 1, status: 1, createdAt: -1 });
quotationRequestSchema.index({ status: 1, expirationDate: 1 });
quotationRequestSchema.index({ countryId: 1, status: 1, createdAt: -1 });

export default mongoose.model('QuotationRequest', quotationRequestSchema);
