import mongoose from 'mongoose';

const BOOST_TYPES = [
  'PRODUCT_BOOST',
  'LOCAL_PRODUCT_BOOST',
  'SHOP_BOOST',
  'HOMEPAGE_FEATURED'
];

const SUPPORTED_CITIES = ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'];

const boostPricingHistorySchema = new mongoose.Schema(
  {
    basePrice: { type: Number, min: 0, required: true },
    priceType: { type: String, enum: ['per_day', 'per_week', 'fixed'], required: true },
    multiplier: { type: Number, min: 0, default: 1 },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const boostPricingSchema = new mongoose.Schema(
  {
    type: { type: String, enum: BOOST_TYPES, required: true, index: true },
    city: { type: String, enum: [...SUPPORTED_CITIES, null], default: null, index: true },
    basePrice: { type: Number, min: 0, required: true },
    priceType: { type: String, enum: ['per_day', 'per_week', 'fixed'], required: true },
    multiplier: { type: Number, min: 0, default: 1 },
    isActive: { type: Boolean, default: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    history: { type: [boostPricingHistorySchema], default: [] }
  },
  { timestamps: true }
);

boostPricingSchema.index({ type: 1, city: 1 }, { unique: true });
boostPricingSchema.index({ type: 1, isActive: 1, city: 1 });

boostPricingSchema.pre('validate', function normalizePricingCity(next) {
  if (typeof this.city === 'string') {
    const normalized = this.city.trim();
    this.city = normalized ? normalized : null;
  }
  if (!Number.isFinite(this.multiplier) || this.multiplier <= 0) {
    this.multiplier = 1;
  }
  next();
});

export { BOOST_TYPES, SUPPORTED_CITIES };
export default mongoose.model('BoostPricing', boostPricingSchema);
