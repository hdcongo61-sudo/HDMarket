import mongoose from 'mongoose';

export const ONBOARDING_ENROLLMENT_STATUSES = Object.freeze([
  'active',
  'completed',
  'paused',
  'cancelled'
]);

const userOnboardingEnrollmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sequenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingSequence', required: true, index: true },
    status: { type: String, enum: ONBOARDING_ENROLLMENT_STATUSES, default: 'active', index: true },
    // Order of the next step to evaluate — not necessarily "delivered", since
    // a step can be skipped by a condition without stopping the sequence.
    currentStep: { type: Number, default: 0, min: 0 },
    deliveredSteps: { type: [Number], default: [] },
    skippedSteps: { type: [Number], default: [] },
    // The worker's due-query field (services/onboardingService.js
    // deliverDueSteps) — indexed together with status so the recurring job
    // never scans the full collection.
    nextExecutionAt: { type: Date, default: null, index: true },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// One enrollment per user per sequence — enrollUserIfEligible() relies on
// this to be idempotent if ever called twice for the same user.
userOnboardingEnrollmentSchema.index({ userId: 1, sequenceId: 1 }, { unique: true });
userOnboardingEnrollmentSchema.index({ status: 1, nextExecutionAt: 1 });

export default mongoose.models.UserOnboardingEnrollment ||
  mongoose.model('UserOnboardingEnrollment', userOnboardingEnrollmentSchema);
