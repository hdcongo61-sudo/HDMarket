import mongoose from 'mongoose';
import crypto from 'crypto';
import { generateUniqueSlug } from '../utils/slugUtils.js';

const productSchema = new mongoose.Schema(
  {
    confirmationNumber: {
      type: String,
      index: true,
      unique: true,
      sparse: true
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    discount: { type: Number, min: 0, max: 100, default: 0 },
    priceBeforeDiscount: { type: Number, min: 0 },
    images: [{ type: String }],
    video: { type: String },
    pdf: { type: String },
    category: { type: String, required: true },
    condition: { type: String, enum: ['new', 'used'], default: 'new' },
    lastStatusBeforeDisable: {
      type: String,
      enum: [null, 'pending', 'approved', 'rejected'],
      default: null
    },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'disabled'], default: 'pending' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    country: { type: String, default: 'République du Congo' },
    city: {
      type: String,
      enum: ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'],
      default: 'Brazzaville'
    },
    validationDate: { type: Date, default: null, index: true },
    whatsappClicks: { type: Number, default: 0, min: 0 },
    favoritesCount: { type: Number, default: 0, min: 0 },
    salesCount: { type: Number, default: 0, min: 0 },
    disabledByAdmin: { type: Boolean, default: false },
    disabledBySuspension: { type: Boolean, default: false },
    boosted: { type: Boolean, default: false, alias: 'isBoosted' },
    boostScore: { type: Number, default: 0 },
    boostedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    boostedAt: { type: Date, default: null },
    boostedByName: { type: String, default: null },
    boostStartDate: { type: Date, default: null },
    boostEndDate: { type: Date, default: null, alias: 'boostExpirationDate' },
    certified: { type: Boolean, default: false },
    certifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    certifiedAt: { type: Date, default: null },
    installmentEnabled: { type: Boolean, default: false, index: true },
    installmentMinAmount: { type: Number, default: 0, min: 0 },
    installmentDuration: { type: Number, default: null, min: 1 },
    installmentStartDate: { type: Date, default: null, index: true },
    installmentEndDate: { type: Date, default: null, index: true },
    installmentLatePenaltyRate: { type: Number, default: 0, min: 0, max: 100 },
    installmentMaxMissedPayments: { type: Number, default: 3, min: 1, max: 12 },
    installmentRequireGuarantor: { type: Boolean, default: false },
    installmentSuspendedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// Indexes for search & sorting
productSchema.index({ title: 'text', description: 'text' });
productSchema.index({ status: 1, category: 1, price: 1, createdAt: -1 });
productSchema.index({ salesCount: -1, status: 1 });
productSchema.index({ installmentEnabled: 1, installmentStartDate: 1, installmentEndDate: 1, status: 1 });
productSchema.index({ status: 1, city: 1, boosted: -1, validationDate: -1, createdAt: -1 });

productSchema.add({
  slug: { type: String, unique: true, index: true, lowercase: true, trim: true }
});

const buildConfirmationCandidate = () => {
  const candidate = crypto.randomInt(100000, 1000000);
  return candidate.toString().padStart(6, '0');
};

const assignConfirmationNumber = async (doc) => {
  if (!doc) return;
  if (doc.confirmationNumber) return;
  const Model = doc.constructor;
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = buildConfirmationCandidate();
    const existing = await Model.findOne({ confirmationNumber: candidate }).lean();
    if (!existing) {
      doc.confirmationNumber = candidate;
      return;
    }
  }
  throw new Error('Impossible de générer un numéro de confirmation unique pour ce produit.');
};

productSchema.pre('validate', async function (next) {
  if (!this.slug || this.isModified('title')) {
    try {
      const source = this.title || String(this._id);
      this.slug = await generateUniqueSlug(this.constructor, source, this._id, 'slug');
    } catch (error) {
      return next(error);
    }
  }
  if (!this.confirmationNumber) {
    try {
      await assignConfirmationNumber(this);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

productSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'approved') {
    this.validationDate = new Date();
  }
  if (!this.validationDate && this.status === 'approved') {
    this.validationDate = new Date();
  }
  next();
});

export default mongoose.model('Product', productSchema);
