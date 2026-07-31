import mongoose from 'mongoose';

const targetingSchema = new mongoose.Schema(
  {
    userIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    roles: { type: [String], default: [] },
    countries: { type: [String], default: [] },
    cities: { type: [String], default: [] },
    communes: { type: [String], default: [] },
    platforms: {
      type: [String],
      enum: ['android', 'ios', 'web', 'pwa'],
      default: []
    },
    minAppVersion: { type: String, trim: true, default: '' },
    betaTestersOnly: { type: Boolean, default: false }
  },
  { _id: false }
);

const scheduleSchema = new mongoose.Schema(
  {
    releaseAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    timezone: { type: String, trim: true, default: 'Africa/Brazzaville' }
  },
  { _id: false }
);

const experimentSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true, required: true },
    name: { type: String, trim: true, default: '' },
    rolloutPercentage: { type: Number, default: 0, min: 0, max: 100 },
    config: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { _id: false }
);

const featureFlagSchema = new mongoose.Schema(
  {
    featureName: { type: String, required: true, trim: true },
    displayName: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: 'other' },
    icon: { type: String, trim: true, default: 'Sparkles' },
    version: { type: String, trim: true, default: '1.0.0' },
    enabled: { type: Boolean, default: false },
    emergencyDisabled: { type: Boolean, default: false, index: true },
    releaseStage: {
      type: String,
      enum: ['development', 'beta', 'released', 'archived'],
      default: 'development',
      index: true
    },
    rolesAllowed: { type: [String], default: [] },
    rolloutPercentage: { type: Number, default: 100, min: 0, max: 100 },
    description: { type: String, trim: true, default: '' },
    targeting: { type: targetingSchema, default: () => ({}) },
    dependencies: { type: [String], default: [] },
    remoteConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
    schedule: { type: scheduleSchema, default: () => ({}) },
    experiments: { type: [experimentSchema], default: [] },
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
featureFlagSchema.index({ releaseStage: 1, enabled: 1, environment: 1 });
featureFlagSchema.index({ 'schedule.releaseAt': 1, 'schedule.expiresAt': 1 });

export default mongoose.model('FeatureFlag', featureFlagSchema);
