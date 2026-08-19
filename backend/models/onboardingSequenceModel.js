import mongoose from 'mongoose';
import { notificationActionSchema, notificationChannelsSchema } from './notificationCampaignModel.js';

export const ONBOARDING_DELAY_UNITS = Object.freeze(['minutes', 'hours', 'days']);

// Registry keys from services/notificationConditionEvaluator.js — kept as a
// plain string enum here (not an import) so the model has no dependency on
// the services layer.
export const ONBOARDING_STEP_CONDITIONS = Object.freeze([
  'hasPlacedOrder',
  'hasPublishedProduct',
  'hasCreatedShop',
  'hasUsedBuyForMe',
  'hasUsedDelivery',
  'hasAddedFavorite',
  'hasCompletedProfile'
]);

const stepSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true, min: 0 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    imageUrl: { type: String, trim: true, default: '' },
    icon: { type: String, trim: true, default: '' },
    delayValue: { type: Number, required: true, min: 0, default: 0 },
    delayUnit: { type: String, enum: ONBOARDING_DELAY_UNITS, default: 'hours' },
    action: { type: notificationActionSchema, default: () => ({}) },
    // A step only sends if ALL listed conditions evaluate to false (i.e. the
    // user has NOT already done these things) — see
    // services/notificationConditionEvaluator.js. Empty = always send.
    conditions: {
      type: [{ type: String, enum: ONBOARDING_STEP_CONDITIONS }],
      default: []
    },
    featureFlagId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeatureFlag', default: null },
    channels: { type: notificationChannelsSchema, default: () => ({}) }
  },
  { _id: true }
);

const onboardingSequenceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    // Stable, human-assigned key so the seed script can upsert without ever
    // duplicating or clobbering an admin's edits — see
    // scripts/seedDefaultOnboardingSequence.js.
    slug: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: false, index: true },
    countryRules: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Country' }], default: [] },
    roleRules: { type: [String], default: [] },
    steps: { type: [stepSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

onboardingSequenceSchema.index({ isActive: 1, createdAt: -1 });
onboardingSequenceSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: 'string', $gt: '' } } }
);

export default mongoose.models.OnboardingSequence ||
  mongoose.model('OnboardingSequence', onboardingSequenceSchema);
