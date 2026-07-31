import mongoose from 'mongoose';

const featureUsageSchema = new mongoose.Schema(
  {
    feature: { type: mongoose.Schema.Types.ObjectId, ref: 'FeatureFlag', required: true, index: true },
    featureName: { type: String, required: true, trim: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    event: {
      type: String,
      enum: ['exposure', 'activation', 'conversion', 'error', 'session'],
      required: true,
      index: true
    },
    variant: { type: String, trim: true, default: '' },
    durationMs: { type: Number, min: 0, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

featureUsageSchema.index({ feature: 1, createdAt: -1 });
featureUsageSchema.index({ featureName: 1, event: 1, createdAt: -1 });
featureUsageSchema.index({ user: 1, feature: 1, createdAt: -1 });

export default mongoose.model('FeatureUsage', featureUsageSchema);
