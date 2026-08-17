import mongoose from 'mongoose';

export const COUNTRY_STATUSES = Object.freeze(['DRAFT', 'TEST', 'ACTIVE', 'DISABLED']);

const currencySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, match: /^[A-Z]{3}$/ },
    symbol: { type: String, required: true, trim: true, maxlength: 12 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    decimals: { type: Number, default: 0, min: 0, max: 8 }
  },
  { _id: false }
);

const countrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    officialName: { type: String, required: true, trim: true, maxlength: 180 },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      match: [/^[A-Z]{2}$/, 'Le code pays doit respecter ISO 3166-1 alpha-2.']
    },
    iso3: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      match: [/^[A-Z]{3}$/, 'Le code pays doit respecter ISO 3166-1 alpha-3.']
    },
    phoneCode: {
      type: String,
      required: true,
      trim: true,
      match: [/^\+[1-9]\d{0,3}$/, "L'indicatif doit être au format international."]
    },
    flagEmoji: { type: String, trim: true, default: '🌍', maxlength: 12 },
    defaultLanguage: { type: String, required: true, trim: true, lowercase: true, default: 'fr' },
    supportedLanguages: { type: [String], default: ['fr'] },
    timezone: { type: String, required: true, trim: true, default: 'Africa/Brazzaville' },
    currency: { type: currencySchema, required: true },
    supportedCurrencies: { type: [currencySchema], default: [] },
    status: { type: String, enum: COUNTRY_STATUSES, default: 'DRAFT', index: true },
    isDefault: { type: Boolean, default: false, index: true },
    sortOrder: { type: Number, default: 0, min: 0 },
    settings: {
      crossBorder: {
        enabled: { type: Boolean, default: false }
      },
      locationLabels: {
        region: { type: String, trim: true, default: 'Région / Province' },
        city: { type: String, trim: true, default: 'Ville' },
        district: { type: String, trim: true, default: 'Commune / District' },
        neighborhood: { type: String, trim: true, default: 'Quartier' }
      },
      delivery: {
        enabled: { type: Boolean, default: true },
        configured: { type: Boolean, default: false }
      },
      fees: { type: mongoose.Schema.Types.Mixed, default: {} },
      boosts: { type: mongoose.Schema.Types.Mixed, default: {} },
      ads: { type: mongoose.Schema.Types.Mixed, default: {} },
      legal: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    featureOverrides: { type: mongoose.Schema.Types.Mixed, default: {} },
    testerUserIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    countryAdminUserIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    disabledAt: { type: Date, default: null },
    activatedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

countrySchema.index({ status: 1, sortOrder: 1, name: 1 });
countrySchema.index({ testerUserIds: 1, status: 1 });
countrySchema.index({ countryAdminUserIds: 1, status: 1 });
countrySchema.index(
  { isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true }, name: 'one_default_country' }
);

countrySchema.pre('validate', function normalizeCountry(next) {
  this.code = String(this.code || '').trim().toUpperCase();
  this.iso3 = String(this.iso3 || '').trim().toUpperCase();
  this.phoneCode = String(this.phoneCode || '').replace(/\s+/g, '');
  this.defaultLanguage = String(this.defaultLanguage || 'fr').trim().toLowerCase();
  this.supportedLanguages = Array.from(
    new Set([this.defaultLanguage, ...(this.supportedLanguages || [])].map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))
  );
  const currencies = [this.currency, ...(this.supportedCurrencies || [])].filter(Boolean);
  const seen = new Set();
  this.supportedCurrencies = currencies.filter((item) => {
    const code = String(item?.code || '').trim().toUpperCase();
    if (!code || seen.has(code)) return false;
    seen.add(code);
    return true;
  });
  next();
});

export default mongoose.models.Country || mongoose.model('Country', countrySchema);
