import mongoose from 'mongoose';

const productViewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    category: { type: String, default: '' },
    viewsCount: { type: Number, default: 1 },
    lastViewedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

productViewSchema.index({ user: 1, product: 1 }, { unique: true });
productViewSchema.index({ user: 1, lastViewedAt: -1 });
productViewSchema.index({ product: 1, lastViewedAt: -1 });

export default mongoose.model('ProductView', productViewSchema);
