import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import OnboardingSequence, {
  ONBOARDING_DELAY_UNITS,
  ONBOARDING_STEP_CONDITIONS
} from '../models/onboardingSequenceModel.js';
import UserOnboardingEnrollment from '../models/userOnboardingEnrollmentModel.js';
import Notification from '../models/notificationModel.js';
import { createAuditLogEntry } from '../services/auditLogService.js';

const actorId = (req) => req.user?.id || req.user?._id || null;
const clean = (value = '') => String(value || '').trim();

const sanitizeStep = (step = {}, index) => ({
  order: Number.isFinite(Number(step.order)) ? Number(step.order) : index,
  title: clean(step.title).slice(0, 120),
  message: clean(step.message).slice(0, 500),
  imageUrl: clean(step.imageUrl),
  icon: clean(step.icon),
  delayValue: Math.max(0, Number(step.delayValue) || 0),
  delayUnit: ONBOARDING_DELAY_UNITS.includes(step.delayUnit) ? step.delayUnit : 'hours',
  action: {
    enabled: Boolean(step.action?.enabled),
    label: clean(step.action?.label).slice(0, 60),
    type: ['internal_route', 'product', 'shop', 'category', 'feature', 'external_url', 'none'].includes(
      step.action?.type
    )
      ? step.action.type
      : 'none',
    target: clean(step.action?.target).slice(0, 500)
  },
  conditions: Array.isArray(step.conditions)
    ? step.conditions.filter((key) => ONBOARDING_STEP_CONDITIONS.includes(key))
    : [],
  featureFlagId: mongoose.isValidObjectId(step.featureFlagId) ? step.featureFlagId : null,
  channels: {
    inApp: step.channels?.inApp !== false,
    push: step.channels?.push !== false,
    email: Boolean(step.channels?.email),
    sms: Boolean(step.channels?.sms)
  }
});

const buildSequencePayload = (body = {}, actor) => {
  const name = clean(body.name);
  if (!name) throw Object.assign(new Error('Le nom de la séquence est requis.'), { status: 400 });
  const steps = Array.isArray(body.steps) ? body.steps.map(sanitizeStep) : [];
  return {
    name,
    description: clean(body.description).slice(0, 500),
    countryRules: Array.isArray(body.countryRules) ? body.countryRules.filter(mongoose.isValidObjectId) : [],
    roleRules: Array.isArray(body.roleRules) ? body.roleRules.map(clean).filter(Boolean) : [],
    steps,
    updatedBy: actor
  };
};

export const listOnboardingSequences = asyncHandler(async (req, res) => {
  const sequences = await OnboardingSequence.find({}).sort({ createdAt: -1 }).populate('createdBy', 'name email').lean();
  const enrollmentCounts = await UserOnboardingEnrollment.aggregate([
    { $group: { _id: { sequenceId: '$sequenceId', status: '$status' }, count: { $sum: 1 } } }
  ]);
  const countsBySequence = new Map();
  enrollmentCounts.forEach((row) => {
    const key = String(row._id.sequenceId);
    const existing = countsBySequence.get(key) || {};
    existing[row._id.status] = row.count;
    countsBySequence.set(key, existing);
  });
  res.json({
    items: sequences.map((sequence) => ({
      ...sequence,
      enrollmentCounts: countsBySequence.get(String(sequence._id)) || {}
    }))
  });
});

export const getOnboardingSequence = asyncHandler(async (req, res) => {
  const sequence = await OnboardingSequence.findById(req.params.id).populate('createdBy', 'name email').lean();
  if (!sequence) return res.status(404).json({ message: 'Séquence introuvable.' });
  res.json({ item: sequence });
});

export const createOnboardingSequence = asyncHandler(async (req, res) => {
  const payload = buildSequencePayload(req.body, actorId(req));
  const sequence = await OnboardingSequence.create({ ...payload, createdBy: actorId(req) });
  await createAuditLogEntry({
    performedBy: actorId(req),
    actionType: 'ONBOARDING_SEQUENCE_CREATED',
    newValue: { sequenceId: String(sequence._id), name: sequence.name, steps: sequence.steps.length },
    req,
    meta: { module: 'onboarding' }
  });
  res.status(201).json({ item: sequence });
});

export const updateOnboardingSequence = asyncHandler(async (req, res) => {
  const sequence = await OnboardingSequence.findById(req.params.id);
  if (!sequence) return res.status(404).json({ message: 'Séquence introuvable.' });
  const payload = buildSequencePayload({ ...sequence.toObject(), ...req.body }, actorId(req));
  Object.assign(sequence, payload);
  await sequence.save();
  res.json({ item: sequence });
});

export const deleteOnboardingSequence = asyncHandler(async (req, res) => {
  const sequence = await OnboardingSequence.findById(req.params.id);
  if (!sequence) return res.status(404).json({ message: 'Séquence introuvable.' });
  if (sequence.isActive) {
    return res.status(409).json({ message: 'Désactivez la séquence avant de la supprimer.' });
  }
  await sequence.deleteOne();
  res.json({ message: 'Séquence supprimée.' });
});

export const activateOnboardingSequence = asyncHandler(async (req, res) => {
  const sequence = await OnboardingSequence.findById(req.params.id);
  if (!sequence) return res.status(404).json({ message: 'Séquence introuvable.' });
  if (!sequence.steps.length) {
    return res.status(400).json({ message: 'Ajoutez au moins une étape avant d’activer la séquence.' });
  }
  sequence.isActive = true;
  await sequence.save();
  console.log(`[onboarding] sequence activated id=${sequence._id} by=${actorId(req)}`);
  res.json({ message: 'Séquence activée — s’appliquera aux nouvelles inscriptions à partir de maintenant.', item: sequence });
});

export const deactivateOnboardingSequence = asyncHandler(async (req, res) => {
  const sequence = await OnboardingSequence.findById(req.params.id);
  if (!sequence) return res.status(404).json({ message: 'Séquence introuvable.' });
  sequence.isActive = false;
  await sequence.save();
  // Freeze in-flight enrollments rather than letting the worker keep trying
  // to advance a sequence an admin just turned off.
  const { modifiedCount } = await UserOnboardingEnrollment.updateMany(
    { sequenceId: sequence._id, status: 'active' },
    { $set: { status: 'paused' } }
  );
  console.log(`[onboarding] sequence deactivated id=${sequence._id} pausedEnrollments=${modifiedCount}`);
  res.json({ message: `Séquence désactivée. ${modifiedCount} inscription(s) en cours mise(s) en pause.`, item: sequence });
});

export const duplicateOnboardingSequence = asyncHandler(async (req, res) => {
  const sequence = await OnboardingSequence.findById(req.params.id).lean();
  if (!sequence) return res.status(404).json({ message: 'Séquence introuvable.' });
  const copy = await OnboardingSequence.create({
    name: `${sequence.name} (copie)`,
    description: sequence.description,
    countryRules: sequence.countryRules,
    roleRules: sequence.roleRules,
    steps: sequence.steps,
    isActive: false,
    createdBy: actorId(req)
  });
  res.status(201).json({ item: copy });
});

export const getOnboardingSequenceAnalytics = asyncHandler(async (req, res) => {
  const sequenceId = req.params.id;
  const sequence = await OnboardingSequence.findById(sequenceId).lean();
  if (!sequence) return res.status(404).json({ message: 'Séquence introuvable.' });

  const [enrollmentRows, stepEngagement, stepCompletion] = await Promise.all([
    UserOnboardingEnrollment.aggregate([
      { $match: { sequenceId: new mongoose.Types.ObjectId(sequenceId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Notification.aggregate([
      { $match: { entityType: 'onboardingEnrollment', 'metadata.sequenceId': String(sequenceId) } },
      {
        $group: {
          _id: '$metadata.stepOrder',
          delivered: { $sum: 1 },
          opened: { $sum: { $cond: [{ $ne: ['$readAt', null] }, 1, 0] } },
          clicked: { $sum: { $cond: [{ $gt: ['$clickCount', 0] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    UserOnboardingEnrollment.aggregate([
      { $match: { sequenceId: new mongoose.Types.ObjectId(sequenceId) } },
      { $unwind: { path: '$skippedSteps', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$skippedSteps', skipped: { $sum: 1 } } }
    ])
  ]);

  const enrollmentCounts = Object.fromEntries(enrollmentRows.map((row) => [row._id, row.count]));
  const totalEnrolled = enrollmentRows.reduce((sum, row) => sum + row.count, 0);
  const skippedByStep = new Map(stepCompletion.map((row) => [row._id, row.skipped]));

  res.json({
    totalEnrolled,
    enrollmentCounts,
    sequenceCompletionRate: totalEnrolled
      ? Math.round(((enrollmentCounts.completed || 0) / totalEnrolled) * 100)
      : 0,
    steps: stepEngagement.map((row) => ({
      stepOrder: row._id,
      delivered: row.delivered,
      opened: row.opened,
      clicked: row.clicked,
      skipped: skippedByStep.get(row._id) || 0,
      openRate: row.delivered ? Math.round((row.opened / row.delivered) * 100) : 0,
      clickThroughRate: row.delivered ? Math.round((row.clicked / row.delivered) * 100) : 0
    }))
  });
});
