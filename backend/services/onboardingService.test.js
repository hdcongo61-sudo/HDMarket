import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sequenceFind: vi.fn(),
  sequenceFindById: vi.fn(),
  enrollmentCreate: vi.fn(),
  enrollmentFind: vi.fn(),
  featureFlagFindById: vi.fn(),
  isFeatureEnabled: vi.fn(),
  resolveCampaignDeepLink: vi.fn(),
  shouldSkipStep: vi.fn(),
  createNotification: vi.fn(),
  userFindById: vi.fn()
}));

vi.mock('../models/onboardingSequenceModel.js', () => ({
  default: { find: mocks.sequenceFind, findById: mocks.sequenceFindById }
}));
vi.mock('../models/userOnboardingEnrollmentModel.js', () => ({
  default: { create: mocks.enrollmentCreate, find: mocks.enrollmentFind }
}));
vi.mock('../models/featureFlagModel.js', () => ({ default: { findById: mocks.featureFlagFindById } }));
vi.mock('../models/userModel.js', () => ({ default: { findById: mocks.userFindById } }));
vi.mock('../utils/notificationService.js', () => ({ createNotification: mocks.createNotification }));
vi.mock('./configService.js', () => ({ isFeatureEnabled: mocks.isFeatureEnabled }));
vi.mock('./notificationCampaignService.js', () => ({ resolveCampaignDeepLink: mocks.resolveCampaignDeepLink }));
vi.mock('./notificationConditionEvaluator.js', () => ({ shouldSkipStep: mocks.shouldSkipStep }));

const sortLean = (value) => ({ sort: () => ({ lean: () => Promise.resolve(value) }) });
const selectLean = (value) => ({ select: () => ({ lean: () => Promise.resolve(value) }) });

import {
  enrollUserIfEligible,
  processEnrollmentStep,
  resolveEligibleSequence
} from './onboardingService.js';

const buildSequence = (overrides = {}) => ({
  _id: 'seq-1',
  isActive: true,
  countryRules: [],
  roleRules: [],
  steps: [
    { order: 0, title: 'Welcome', message: 'Hi', delayValue: 0, delayUnit: 'hours', conditions: [], action: {}, channels: { push: true } },
    { order: 1, title: 'Step 2', message: 'More', delayValue: 24, delayUnit: 'hours', conditions: [], action: {}, channels: { push: true } }
  ],
  ...overrides
});

const buildEnrollment = (overrides = {}) => ({
  _id: 'enr-1',
  userId: 'user-1',
  sequenceId: 'seq-1',
  status: 'active',
  currentStep: 0,
  deliveredSteps: [],
  skippedSteps: [],
  save: vi.fn().mockResolvedValue(undefined),
  ...overrides
});

describe('onboardingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveCampaignDeepLink.mockResolvedValue('');
    mocks.shouldSkipStep.mockResolvedValue(false);
    mocks.createNotification.mockResolvedValue({ _id: 'notif-1' });
  });

  describe('resolveEligibleSequence', () => {
    it('matches a sequence with no country/role rules to any user', async () => {
      mocks.sequenceFind.mockReturnValue(sortLean([buildSequence()]));
      const user = { _id: 'user-1', role: 'user', countryId: 'country-1' };
      await expect(resolveEligibleSequence(user)).resolves.toMatchObject({ _id: 'seq-1' });
    });

    it('excludes a sequence whose countryRules do not include the user country', async () => {
      mocks.sequenceFind.mockReturnValue(sortLean([buildSequence({ countryRules: ['other-country'] })]));
      const user = { _id: 'user-1', role: 'user', countryId: 'country-1' };
      await expect(resolveEligibleSequence(user)).resolves.toBeNull();
    });

    it('excludes a sequence whose roleRules do not include the user role', async () => {
      mocks.sequenceFind.mockReturnValue(sortLean([buildSequence({ roleRules: ['delivery_agent'] })]));
      const user = { _id: 'user-1', role: 'user' };
      await expect(resolveEligibleSequence(user)).resolves.toBeNull();
    });

    it('returns null when there is no active sequence at all', async () => {
      mocks.sequenceFind.mockReturnValue(sortLean([]));
      await expect(resolveEligibleSequence({ _id: 'user-1', role: 'user' })).resolves.toBeNull();
    });
  });

  describe('enrollUserIfEligible', () => {
    it('does nothing when no sequence is eligible', async () => {
      mocks.sequenceFind.mockReturnValue(sortLean([]));
      const result = await enrollUserIfEligible({ _id: 'user-1', role: 'user' });
      expect(result).toBeNull();
      expect(mocks.enrollmentCreate).not.toHaveBeenCalled();
    });

    it('creates an enrollment and delivers the first step immediately', async () => {
      mocks.sequenceFind.mockReturnValue(sortLean([buildSequence()]));
      const enrollment = buildEnrollment();
      mocks.enrollmentCreate.mockResolvedValue(enrollment);

      const user = { _id: 'user-1', role: 'user' };
      const result = await enrollUserIfEligible(user);

      expect(mocks.enrollmentCreate).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', sequenceId: 'seq-1', status: 'active', currentStep: 0 })
      );
      expect(mocks.createNotification).toHaveBeenCalledTimes(1);
      expect(mocks.createNotification.mock.calls[0][0]).toMatchObject({
        userId: 'user-1',
        type: 'onboarding',
        dedupeKey: 'onboarding:enr-1:0'
      });
      expect(result).toBe(enrollment);
    });

    it('is idempotent: a duplicate-key error from the unique index resolves to null instead of throwing', async () => {
      mocks.sequenceFind.mockReturnValue(sortLean([buildSequence()]));
      const duplicateError = Object.assign(new Error('duplicate'), { code: 11000 });
      mocks.enrollmentCreate.mockRejectedValue(duplicateError);

      await expect(enrollUserIfEligible({ _id: 'user-1', role: 'user' })).resolves.toBeNull();
      expect(mocks.createNotification).not.toHaveBeenCalled();
    });
  });

  describe('processEnrollmentStep', () => {
    it('delivers the current step and schedules the next one', async () => {
      const enrollment = buildEnrollment();
      const sequence = buildSequence();
      mocks.userFindById.mockReturnValue(selectLean({ _id: 'user-1', role: 'user' }));

      const result = await processEnrollmentStep(enrollment, { sequence });

      expect(result.delivered).toBe(true);
      expect(mocks.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ dedupeKey: 'onboarding:enr-1:0', title: 'Welcome' })
      );
      expect(enrollment.deliveredSteps).toEqual([0]);
      expect(enrollment.currentStep).toBe(1);
      expect(enrollment.nextExecutionAt).toBeInstanceOf(Date);
      expect(enrollment.status).toBe('active');
      expect(enrollment.save).toHaveBeenCalled();
    });

    it('skips the step (without delivering) when a behavioral condition is already met', async () => {
      const sequence = buildSequence({
        steps: [
          { order: 0, title: 'Already ordered?', message: 'x', delayValue: 0, delayUnit: 'hours', conditions: ['hasPlacedOrder'], action: {}, channels: {} },
          { order: 1, title: 'Step 2', message: 'y', delayValue: 24, delayUnit: 'hours', conditions: [], action: {}, channels: {} }
        ]
      });
      mocks.shouldSkipStep.mockResolvedValue(true);
      mocks.userFindById.mockReturnValue(selectLean({ _id: 'user-1', role: 'user' }));
      const enrollment = buildEnrollment();

      const result = await processEnrollmentStep(enrollment, { sequence });

      expect(result.delivered).toBe(false);
      expect(mocks.createNotification).not.toHaveBeenCalled();
      expect(enrollment.skippedSteps).toEqual([0]);
      expect(enrollment.currentStep).toBe(1);
    });

    it('skips the step when its feature flag is not enabled for this user', async () => {
      const sequence = buildSequence({
        steps: [
          { order: 0, title: 'Feature step', message: 'x', delayValue: 0, delayUnit: 'hours', conditions: [], featureFlagId: 'flag-1', action: {}, channels: {} }
        ]
      });
      mocks.featureFlagFindById.mockReturnValue(selectLean({ featureName: 'product_videos' }));
      mocks.isFeatureEnabled.mockResolvedValue({ enabled: false });
      mocks.userFindById.mockReturnValue(selectLean({ _id: 'user-1', role: 'user' }));
      const enrollment = buildEnrollment();

      const result = await processEnrollmentStep(enrollment, { sequence });

      expect(result.delivered).toBe(false);
      expect(mocks.createNotification).not.toHaveBeenCalled();
      expect(enrollment.status).toBe('completed'); // no further step after index 0 in this sequence
    });

    it('marks the enrollment completed once every step has been processed', async () => {
      const sequence = buildSequence({
        steps: [{ order: 0, title: 'Only step', message: 'x', delayValue: 0, delayUnit: 'hours', conditions: [], action: {}, channels: {} }]
      });
      mocks.userFindById.mockReturnValue(selectLean({ _id: 'user-1', role: 'user' }));
      const enrollment = buildEnrollment();

      await processEnrollmentStep(enrollment, { sequence });

      expect(enrollment.status).toBe('completed');
      expect(enrollment.completedAt).toBeInstanceOf(Date);
      expect(enrollment.nextExecutionAt).toBeNull();
    });

    it('cancels the enrollment gracefully if the sequence was deleted', async () => {
      mocks.sequenceFindById.mockReturnValue({ lean: () => Promise.resolve(null) });
      const enrollment = buildEnrollment();

      const result = await processEnrollmentStep(enrollment);

      expect(result.reason).toBe('sequence_missing');
      expect(enrollment.status).toBe('cancelled');
    });
  });
});
