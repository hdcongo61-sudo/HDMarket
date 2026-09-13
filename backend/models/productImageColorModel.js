import mongoose from 'mongoose';

/**
 * Cache of the average color of a product's primary image, keyed by product +
 * image URL. Built lazily by services/visualSearchService.js via Cloudinary's
 * 1×1 pixelate trick so the image-search sweep never refetches the same image.
 */
const productImageColorSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    imageUrl: { type: String, required: true, trim: true },
    color: {
      r: { type: Number, min: 0, max: 255, required: true },
      g: { type: Number, min: 0, max: 255, required: true },
      b: { type: Number, min: 0, max: 255, required: true }
    },
    fetchedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

productImageColorSchema.index({ productId: 1, imageUrl: 1 }, { unique: true });
productImageColorSchema.index({ fetchedAt: 1 });

export default mongoose.model('ProductImageColor', productImageColorSchema);
