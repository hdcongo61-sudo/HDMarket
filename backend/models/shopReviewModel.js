import mongoose from 'mongoose';

const shopReviewSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, maxLength: 500, trim: true }
  },
  { timestamps: true }
);

shopReviewSchema.index({ shop: 1, user: 1 }, { unique: true });

export default mongoose.model('ShopReview', shopReviewSchema);
