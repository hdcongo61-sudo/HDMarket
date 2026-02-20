import mongoose from 'mongoose';

const BOOST_TYPES = [
  'PRODUCT_BOOST',
  'LOCAL_PRODUCT_BOOST',
  'SHOP_BOOST',
  'HOMEPAGE_FEATURED'
];

const seasonalPricingSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true, maxlength: 120 },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    multiplier: { type: Number, min: 0, required: true, default: 1 },
    isActive: { type: Boolean, default: true, index: true },
    appliesTo: { type: [String], enum: BOOST_TYPES, default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

seasonalPricingSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

seasonalPricingSchema.pre('validate', function validateSeasonalCampaign(next) {
  if (!Number.isFinite(this.multiplier) || this.multiplier <= 0) {
    this.multiplier = 1;
  }
  if (
    this.startDate instanceof Date &&
    this.endDate instanceof Date &&
    this.startDate.getTime() >= this.endDate.getTime()
  ) {
    return next(new Error('La date de fin doit être postérieure à la date de début.'));
  }
  next();
});

export default mongoose.model('SeasonalPricing', seasonalPricingSchema);
