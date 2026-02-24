import mongoose from 'mongoose';

const featureFlagSchema = new mongoose.Schema(
  {
    featureName: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: false },
    rolesAllowed: { type: [String], default: [] },
    rolloutPercentage: { type: Number, default: 100, min: 0, max: 100 },
    description: { type: String, trim: true, default: '' },
    environment: {
      type: String,
      enum: ['all', 'production', 'staging', 'dev'],
      default: 'all'
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

featureFlagSchema.index({ featureName: 1, environment: 1 }, { unique: true });

export default mongoose.model('FeatureFlag', featureFlagSchema);
