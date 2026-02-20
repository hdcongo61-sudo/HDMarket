import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    level: { type: Number, enum: [0, 1], required: true, default: 0 },
    order: { type: Number, default: 0 },
    path: { type: String, required: true, trim: true, lowercase: true },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    iconKey: { type: String, trim: true, default: '' },
    imageUrl: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
    cities: [{ type: String, trim: true }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

categorySchema.index(
  { country: 1, slug: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: { $eq: false }
    }
  }
);
categorySchema.index({ country: 1, path: 1 }, { unique: true });
categorySchema.index({ parentId: 1, order: 1 });
categorySchema.index({ isActive: 1, isDeleted: 1 });
categorySchema.index({ country: 1, isActive: 1, isDeleted: 1 });

export default mongoose.model('Category', categorySchema);
