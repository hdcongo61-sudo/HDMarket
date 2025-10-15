import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    value: { type: Number, required: true, min: 1, max: 5 }
  },
  { timestamps: true }
);

ratingSchema.index({ product: 1, user: 1 }, { unique: true });

export default mongoose.model('Rating', ratingSchema);
