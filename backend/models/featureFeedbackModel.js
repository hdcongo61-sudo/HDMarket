import mongoose from 'mongoose';

const featureFeedbackSchema = new mongoose.Schema(
  {
    feature: { type: mongoose.Schema.Types.ObjectId, ref: 'FeatureFlag', required: true, index: true },
    featureName: { type: String, required: true, trim: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['bug', 'improvement', 'rating'],
      required: true,
      index: true
    },
    rating: { type: Number, min: 1, max: 5, default: null },
    message: { type: String, trim: true, maxlength: 3000, default: '' },
    status: {
      type: String,
      enum: ['new', 'reviewing', 'resolved', 'closed'],
      default: 'new',
      index: true
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

featureFeedbackSchema.index({ featureName: 1, createdAt: -1 });
featureFeedbackSchema.index({ feature: 1, type: 1, createdAt: -1 });

export default mongoose.model('FeatureFeedback', featureFeedbackSchema);
