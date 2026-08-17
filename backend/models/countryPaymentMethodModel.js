import mongoose from 'mongoose';

const countryPaymentMethodSchema = new mongoose.Schema(
  {
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true, index: true },
    provider: { type: String, required: true, trim: true, uppercase: true },
    type: {
      type: String,
      enum: ['MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'CASH', 'WALLET', 'OTHER'],
      default: 'MOBILE_MONEY'
    },
    displayName: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: false, index: true },
    currencies: { type: [String], default: [] },
    configurationReference: { type: String, trim: true, default: '' },
    publicConfiguration: { type: mongoose.Schema.Types.Mixed, default: {} },
    sortOrder: { type: Number, default: 0, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

countryPaymentMethodSchema.index({ countryId: 1, provider: 1 }, { unique: true });
countryPaymentMethodSchema.index({ countryId: 1, enabled: 1, sortOrder: 1 });

export default mongoose.models.CountryPaymentMethod || mongoose.model('CountryPaymentMethod', countryPaymentMethodSchema);
