import mongoose from 'mongoose';

const shopReviewSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, maxLength: 500, trim: true },

    // === Proposal 3: Multi-dimensional ratings ===
    descriptionRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    communicationRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    deliveryRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    // Link to the order that triggered this review
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true
    }
  },
  { timestamps: true }
);

shopReviewSchema.index({ shop: 1, user: 1 }, { unique: true });

export default mongoose.model('ShopReview', shopReviewSchema);
