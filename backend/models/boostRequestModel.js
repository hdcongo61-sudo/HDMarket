import mongoose from 'mongoose';
import { SUPPORTED_CITIES } from './boostPricingModel.js';

const BOOST_TYPES = [
  'PRODUCT_BOOST',
  'LOCAL_PRODUCT_BOOST',
  'SHOP_BOOST',
  'HOMEPAGE_FEATURED'
];

const BOOST_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'EXPIRED'];

const boostPaymentProofSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: '' },
    path: { type: String, trim: true, default: '' },
    mimeType: { type: String, trim: true, default: '' },
    size: { type: Number, default: 0, min: 0 },
    uploadedAt: { type: Date, default: null }
  },
  { _id: false }
);

const boostRequestSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    boostType: { type: String, enum: BOOST_TYPES, required: true, index: true },
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    city: { type: String, enum: [...SUPPORTED_CITIES, null], default: null, index: true },
    duration: { type: Number, min: 1, default: 1 },
    unitPrice: { type: Number, min: 0, required: true },
    basePrice: { type: Number, min: 0, required: true },
    priceType: { type: String, enum: ['per_day', 'per_week', 'fixed'], required: true },
    pricingMultiplier: { type: Number, min: 0, default: 1 },
    seasonalMultiplier: { type: Number, min: 0, default: 1 },
    seasonalCampaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'SeasonalPricing', default: null },
    seasonalCampaignName: { type: String, trim: true, default: '' },
    totalPrice: { type: Number, min: 0, required: true },
    paymentOperator: { type: String, trim: true, default: '' },
    paymentSenderName: { type: String, trim: true, default: '' },
    paymentTransactionId: { type: String, trim: true, default: '' },
    paymentProofImage: { type: boostPaymentProofSchema, default: () => ({}) },
    status: { type: String, enum: BOOST_REQUEST_STATUSES, default: 'PENDING', index: true },
    startDate: { type: Date, default: null, index: true },
    endDate: { type: Date, default: null, index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, default: '' },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectedAt: { type: Date, default: null },
    impressions: { type: Number, default: 0, min: 0 },
    clicks: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

boostRequestSchema.index({ status: 1, startDate: 1, endDate: 1 });
boostRequestSchema.index({ sellerId: 1, createdAt: -1 });
boostRequestSchema.index({ boostType: 1, city: 1, status: 1 });
boostRequestSchema.index({ productIds: 1, status: 1, endDate: 1 });

boostRequestSchema.pre('validate', function validateBoostRequest(next) {
  if (typeof this.city === 'string') {
    const normalized = this.city.trim();
    this.city = normalized ? normalized : null;
  }
  if (!Number.isFinite(this.pricingMultiplier) || this.pricingMultiplier <= 0) {
    this.pricingMultiplier = 1;
  }
  if (!Number.isFinite(this.seasonalMultiplier) || this.seasonalMultiplier <= 0) {
    this.seasonalMultiplier = 1;
  }
  this.paymentOperator = String(this.paymentOperator || '').trim();
  this.paymentSenderName = String(this.paymentSenderName || '').trim();
  this.paymentTransactionId = String(this.paymentTransactionId || '').replace(/\D/g, '');
  if (this.isNew) {
    if (!this.paymentOperator) {
      return next(new Error('L’opérateur Mobile Money est requis.'));
    }
    if (!this.paymentSenderName) {
      return next(new Error('Le nom de l’expéditeur est requis.'));
    }
    if (!/^\d{10}$/.test(this.paymentTransactionId)) {
      return next(new Error('L’ID de transaction doit contenir exactement 10 chiffres.'));
    }
  }
  if (
    this.startDate instanceof Date &&
    this.endDate instanceof Date &&
    this.startDate.getTime() >= this.endDate.getTime()
  ) {
    return next(new Error('La date de fin doit être postérieure à la date de début.'));
  }
  if (
    ['PRODUCT_BOOST', 'LOCAL_PRODUCT_BOOST', 'HOMEPAGE_FEATURED'].includes(this.boostType) &&
    (!Array.isArray(this.productIds) || this.productIds.length === 0)
  ) {
    return next(new Error('Au moins un produit est requis pour ce type de boost.'));
  }
  if (this.boostType === 'SHOP_BOOST') {
    this.productIds = [];
  }
  next();
});

export { BOOST_TYPES, BOOST_REQUEST_STATUSES };
export default mongoose.model('BoostRequest', boostRequestSchema);
