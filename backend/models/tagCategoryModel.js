import mongoose from 'mongoose';
import { generateUniqueSlug } from '../utils/slugUtils.js';

const tagCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    color: { type: String, trim: true, default: '#64748B' },
    icon: { type: String, trim: true, maxlength: 100, default: '' },
    order: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

tagCategorySchema.index({ isActive: 1, deletedAt: 1, order: 1, name: 1 });

tagCategorySchema.pre('validate', async function assignSlug(next) {
  if (this.slug && !this.isModified('name')) return next();
  try {
    this.slug = await generateUniqueSlug(this.constructor, this.name, this._id, 'slug');
    return next();
  } catch (error) {
    return next(error);
  }
});

export default mongoose.model('TagCategory', tagCategorySchema);

