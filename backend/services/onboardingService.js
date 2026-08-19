import OnboardingSequence from '../models/onboardingSequenceModel.js';
import UserOnboardingEnrollment from '../models/userOnboardingEnrollmentModel.js';
import FeatureFlag from '../models/featureFlagModel.js';
import User from '../models/userModel.js';
import { createNotification } from '../utils/notificationService.js';
import { isFeatureEnabled } from './configService.js';
import { resolveCampaignDeepLink } from './notificationCampaignService.js';
import { shouldSkipStep } from './notificationConditionEvaluator.js';

const DELAY_UNIT_MS = Object.freeze({
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000
});

const computeDelayMs = (step) => (Number(step?.delayValue) || 0) * (DELAY_UNIT_MS[step?.delayUnit] || DELAY_UNIT_MS.hours);

const orderedSteps = (sequence) => [...(sequence.steps || [])].sort((a, b) => a.order - b.order);

const buildFeatureContext = (user) => ({
  role: user.role,
  accountType: user.accountType,
  userId: String(user._id),
  country: user.country,
  countryId: user.countryId ? String(user.countryId) : undefined,
  city: user.city,
  commune: user.commune,
  isBetaTester: Boolean(user.betaTester),
  isDeveloper: ['admin', 'founder'].includes(String(user.role || '').toLowerCase())
});

/**
 * Picks the single active sequence eligible for this user (country + role
 * rules, empty = applies to everyone). If several match, the most recently
 * activated one wins — admins are expected to keep at most one broad default
 * active at a time, but this keeps behavior deterministic if they don't.
 */
export const resolveEligibleSequence = async (user) => {
  const filter = { isActive: true };
  const query = OnboardingSequence.find(filter).sort({ updatedAt: -1 });
  const candidates = await query.lean();
  return (
    candidates.find((sequence) => {
      const countryOk =
        !sequence.countryRules?.length ||
        sequence.countryRules.some((id) => String(id) === String(user.countryId || ''));
      const roleOk = !sequence.roleRules?.length || sequence.roleRules.includes(user.role);
      return countryOk && roleOk;
    }) || null
  );
};

/**
 * Registration-time hook (authController.js) — fire-and-forget, must never
 * throw into the request path. Idempotent via the {userId,sequenceId}
 * unique index: a second call for the same user is a silent no-op.
 */
export const enrollUserIfEligible = async (user) => {
  if (!user?._id) return null;
  const sequence = await resolveEligibleSequence(user);
  if (!sequence) return null;

  let enrollment;
  try {
    enrollment = await UserOnboardingEnrollment.create({
      userId: user._id,
      sequenceId: sequence._id,
      status: 'active',
      currentStep: 0,
      nextExecutionAt: new Date()
    });
  } catch (error) {
    if (Number(error?.code) === 11000) return null; // already enrolled — fine
    throw error;
  }

  console.log(`[onboarding] user enrolled user=${user._id} sequence=${sequence._id}`);
  // Deliver the first eligible step immediately rather than waiting for the
  // next recurring worker tick, so "Welcome" actually feels immediate.
  await processEnrollmentStep(enrollment, { sequence, user }).catch((error) => {
    console.error('[onboarding] initial step delivery failed', error);
  });
  return enrollment;
};

/**
 * Advances one enrollment by exactly one step: deliver, or skip (feature
 * flag / behavioral condition) and move on. Always leaves the enrollment in
 * a consistent state (active with a future nextExecutionAt, or completed).
 */
export const processEnrollmentStep = async (enrollment, { sequence: preloadedSequence, user: preloadedUser } = {}) => {
  const sequence = preloadedSequence || (await OnboardingSequence.findById(enrollment.sequenceId).lean());
  if (!sequence) {
    enrollment.status = 'cancelled';
    enrollment.nextExecutionAt = null;
    await enrollment.save();
    return { delivered: false, reason: 'sequence_missing' };
  }

  const steps = orderedSteps(sequence);
  const step = steps.find((item) => item.order === enrollment.currentStep);
  if (!step) {
    enrollment.status = 'completed';
    enrollment.completedAt = new Date();
    enrollment.nextExecutionAt = null;
    await enrollment.save();
    console.log(`[onboarding] sequence completed user=${enrollment.userId} sequence=${sequence._id}`);
    return { delivered: false, reason: 'sequence_completed' };
  }

  const user =
    preloadedUser ||
    (await User.findById(enrollment.userId).select(
      'role accountType countryId country city commune betaTester'
    ).lean());
  if (!user) {
    enrollment.status = 'cancelled';
    enrollment.nextExecutionAt = null;
    await enrollment.save();
    return { delivered: false, reason: 'user_missing' };
  }

  let skip = false;
  let skipReason = '';
  if (step.featureFlagId) {
    const flag = await FeatureFlag.findById(step.featureFlagId).select('featureName').lean();
    if (flag?.featureName) {
      const result = await isFeatureEnabled(flag.featureName, buildFeatureContext(user)).catch(() => ({
        enabled: false
      }));
      if (!result.enabled) {
        skip = true;
        skipReason = 'feature_not_available';
      }
    }
  }
  if (!skip && step.conditions?.length) {
    const alreadyDone = await shouldSkipStep(enrollment.userId, step.conditions);
    if (alreadyDone) {
      skip = true;
      skipReason = 'condition_already_met';
    }
  }

  if (skip) {
    enrollment.skippedSteps = Array.from(new Set([...(enrollment.skippedSteps || []), step.order]));
    console.log(`[onboarding] step skipped user=${enrollment.userId} step=${step.order} reason=${skipReason}`);
  } else {
    const deepLink = await resolveCampaignDeepLink(step.action);
    const channels = ['IN_APP', ...(step.channels?.push !== false ? ['PUSH'] : [])];
    await createNotification({
      userId: enrollment.userId,
      actorId: enrollment.userId,
      allowSelf: true,
      type: 'onboarding',
      channels,
      entityType: 'onboardingEnrollment',
      entityId: String(enrollment._id),
      dedupeKey: `onboarding:${enrollment._id}:${step.order}`,
      deepLink,
      actionLink: deepLink,
      title: step.title,
      message: step.message,
      metadata: { sequenceId: String(sequence._id), stepOrder: step.order, imageUrl: step.imageUrl || '', icon: step.icon || '' }
    });
    enrollment.deliveredSteps = Array.from(new Set([...(enrollment.deliveredSteps || []), step.order]));
    console.log(`[onboarding] step delivered user=${enrollment.userId} step=${step.order}`);
  }

  const nextStep = steps.find((item) => item.order > step.order);
  if (nextStep) {
    enrollment.currentStep = nextStep.order;
    enrollment.nextExecutionAt = new Date(Date.now() + computeDelayMs(nextStep));
  } else {
    enrollment.status = 'completed';
    enrollment.completedAt = new Date();
    enrollment.nextExecutionAt = null;
    console.log(`[onboarding] sequence completed user=${enrollment.userId} sequence=${sequence._id}`);
  }
  await enrollment.save();
  return { delivered: !skip, reason: skipReason || undefined };
};

/**
 * Recurring-worker entry point (queues/notificationCampaignQueue.js). Only
 * ever touches enrollments that are actually due — indexed on
 * {status,nextExecutionAt} — never scans the User collection.
 */
export const deliverDueSteps = async ({ limit = 200 } = {}) => {
  const due = await UserOnboardingEnrollment.find({
    status: 'active',
    nextExecutionAt: { $lte: new Date() }
  })
    .limit(limit)
    .lean(false);

  let processed = 0;
  for (const enrollment of due) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await processEnrollmentStep(enrollment);
      processed += 1;
    } catch (error) {
      console.error(`[onboarding] step processing failed enrollment=${enrollment._id}`, error);
    }
  }
  return { processed, matched: due.length };
};

export default { resolveEligibleSequence, enrollUserIfEligible, processEnrollmentStep, deliverDueSteps };
