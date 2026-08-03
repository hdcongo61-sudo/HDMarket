import mongoose from 'mongoose';
import { generateUniqueSlug } from '../utils/slugUtils.js';
import { TAG_STATUSES, TAG_TYPES, TAG_VISIBILITIES } from '../constants/tagConstants.js';

const tagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    normalizedName: { type: String, required: true, trim: true, lowercase: true, index: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'TagCategory', default: null, index: true },
    type: { type: String, enum: TAG_TYPES, default: 'system', index: true },
    color: { type: String, trim: true, default: '#2563EB' },
    icon: { type: String, trim: true, maxlength: 100, default: '' },
    visibility: { type: String, enum: TAG_VISIBILITIES, default: 'public', index: true },
    status: { type: String, enum: TAG_STATUSES, default: 'draft', index: true },
    priority: { type: Number, min: 0, max: 100000, default: 0, index: true },
    popularityScore: { type: Number, min: 0, default: 0, index: true },
    usageCount: { type: Number, min: 0, default: 0, index: true },
    searchCount: { type: Number, min: 0, default: 0, index: true },
    clickCount: { type: Number, min: 0, default: 0, index: true },
    conversionCount: { type: Number, min: 0, default: 0, index: true },
    aliases: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    featured: { type: Boolean, default: false, index: true },
    homepageTitle: { type: String, trim: true, maxlength: 100, default: '' },
    campaignStartsAt: { type: Date, default: null, index: true },
    campaignEndsAt: { type: Date, default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

tagSchema.index({ status: 1, visibility: 1, deletedAt: 1, featured: 1, priority: -1 });
tagSchema.index({ status: 1, visibility: 1, popularityScore: -1, usageCount: -1 });
tagSchema.index({ type: 1, status: 1, createdBy: 1, createdAt: -1 });
tagSchema.index({ aliases: 1 });
tagSchema.index({ name: 'text', aliases: 'text', description: 'text' });

tagSchema.pre('validate', async function normalizeTag(next) {
  this.normalizedName = String(this.name || '').trim().toLocaleLowerCase('fr');
  this.aliases = Array.from(
    new Set((this.aliases || []).map((value) => String(value).trim().toLocaleLowerCase('fr')).filter(Boolean))
  ).slice(0, 30);
  if (this.campaignStartsAt && this.campaignEndsAt && this.campaignEndsAt <= this.campaignStartsAt) {
    return next(new Error('Campaign end date must be after its start date.'));
  }
  if (this.slug && !this.isModified('name')) return next();
  try {
    this.slug = await generateUniqueSlug(this.constructor, this.name, this._id, 'slug');
    return next();
  } catch (error) {
    return next(error);
  }
});

tagSchema.methods.isPubliclyAvailable = function isPubliclyAvailable(now = new Date()) {
  if (this.deletedAt || this.status !== 'active' || this.visibility !== 'public') return false;
  if (this.campaignStartsAt && this.campaignStartsAt > now) return false;
  if (this.campaignEndsAt && this.campaignEndsAt < now) return false;
  return true;
};

export default mongoose.model('Tag', tagSchema);
