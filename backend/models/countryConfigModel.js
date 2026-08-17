import mongoose from 'mongoose';

const countryConfigSchema = new mongoose.Schema(
  {
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true, unique: true, index: true },
    version: { type: Number, default: 1, min: 1 },
    effectiveFrom: { type: Date, default: Date.now },
    locations: { type: mongoose.Schema.Types.Mixed, default: {} },
    payments: { type: mongoose.Schema.Types.Mixed, default: {} },
    delivery: { type: mongoose.Schema.Types.Mixed, default: {} },
    fees: { type: mongoose.Schema.Types.Mixed, default: {} },
    features: { type: mongoose.Schema.Types.Mixed, default: {} },
    boosts: { type: mongoose.Schema.Types.Mixed, default: {} },
    ads: { type: mongoose.Schema.Types.Mixed, default: {} },
    legal: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

countryConfigSchema.index({ countryId: 1, version: -1 });

export default mongoose.models.CountryConfig || mongoose.model('CountryConfig', countryConfigSchema);
