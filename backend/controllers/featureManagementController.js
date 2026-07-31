import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import FeatureFlag from '../models/featureFlagModel.js';
import FeatureFeedback from '../models/featureFeedbackModel.js';
import FeatureUsage from '../models/featureUsageModel.js';
import User from '../models/userModel.js';
import AuditLog from '../models/auditLogModel.js';
import {
  getFeatureFlag,
  isFeatureEnabled,
  listFeatureFlags,
  upsertFeatureFlag
} from '../services/configService.js';
import { createAuditLogEntry } from '../services/auditLogService.js';
import { createNotification } from '../utils/notificationService.js';

const FEATURE_STAGES = new Set(['development', 'beta', 'released', 'archived']);
const FEEDBACK_TYPES = new Set(['bug', 'improvement', 'rating']);
const USAGE_EVENTS = new Set(['exposure', 'activation', 'conversion', 'error', 'session']);

const cleanText = (value = '') => String(value || '').trim();
const cleanArray = (value = []) =>
  Array.from(new Set((Array.isArray(value) ? value : []).map(cleanText).filter(Boolean)));
const isFeatureAdmin = (req) => ['admin', 'founder'].includes(String(req.user?.role || '').toLowerCase());

const getFeatureContext = (req) => ({
  role: req.user?.role,
  accountType: req.user?.accountType,
  userId: req.user?.id || req.user?._id,
  country: req.user?.country,
  city: req.user?.city,
  commune: req.user?.commune,
  isBetaTester: Boolean(req.user?.betaTester),
  isDeveloper: ['admin', 'founder'].includes(String(req.user?.role || '').toLowerCase()),
  sessionId: req.headers?.['x-session-id'],
  deviceId: req.headers?.['x-device-id'],
  platform: req.headers?.['x-app-platform'] || req.headers?.['x-platform'],
  appVersion: req.headers?.['x-app-version']
});

const toFeatureAudit = (feature) => ({
  id: feature?._id ? String(feature._id) : null,
  featureName: feature?.featureName || '',
  displayName: feature?.displayName || '',
  enabled: Boolean(feature?.enabled),
  emergencyDisabled: Boolean(feature?.emergencyDisabled),
  releaseStage: feature?.releaseStage || 'development',
  rolloutPercentage: Number(feature?.rolloutPercentage || 0),
  targeting: feature?.targeting || {},
  dependencies: feature?.dependencies || [],
  remoteConfig: feature?.remoteConfig || {}
});

const writeFeatureAudit = async (req, actionType, { before = null, after = null, reason = '' } = {}) =>
  createAuditLogEntry({
    performedBy: req.user?.id,
    actionType,
    previousValue: before ? toFeatureAudit(before) : null,
    newValue: after ? toFeatureAudit(after) : null,
    req,
    meta: {
      scope: 'feature_management',
      featureName: after?.featureName || before?.featureName || '',
      reason: cleanText(reason)
    }
  });

const findFeature = async (identifier, environment = 'all') => {
  const value = cleanText(identifier);
  if (!value) return null;

  if (mongoose.Types.ObjectId.isValid(value)) {
    const byId = await FeatureFlag.findById(value).lean();
    if (byId) return byId;
  }
  return getFeatureFlag(value, { environment });
};

const requireFeature = asyncHandler(async (req, res, next) => {
  const feature = await findFeature(req.params?.id || req.params?.featureKey);
  if (!feature) return res.status(404).json({ message: 'Fonctionnalité introuvable.' });
  req.feature = feature;
  return next();
});

const getFeatureKey = (feature) => cleanText(feature?.featureName);

const notifySpecificBetaTesters = async ({ feature, userIds = [], actorId }) => {
  const ids = cleanArray(userIds);
  if (!ids.length || !feature?.featureName) return;
  await Promise.all(
    ids.map((userId) =>
      createNotification({
        userId,
        actorId: actorId || userId,
        type: 'admin_broadcast',
        allowSelf: true,
        title: 'Nouvelle fonctionnalité bêta',
        message: `${feature.displayName || feature.featureName} est maintenant disponible pour vos tests.`,
        deepLink: '/',
        metadata: { featureName: feature.featureName, betaFeature: true }
      })
    )
  );
};

const notifyBetaAudience = async ({ feature, actorId }) => {
  const specificUserIds = cleanArray(feature?.targeting?.userIds);
  const recipients = specificUserIds.length
    ? specificUserIds
    : (await User.find({ betaTester: true, isActive: true }).select('_id').lean()).map((user) => String(user._id));
  await notifySpecificBetaTesters({ feature, userIds: recipients, actorId });
};

const notifyFoundersOfEmergencyDisable = async ({ feature, actorId, reason = '' }) => {
  const founders = await User.find({ role: 'founder', isActive: true }).select('_id').lean();
  await Promise.all(
    founders.map((founder) =>
      createNotification({
        userId: founder._id,
        actorId: actorId || founder._id,
        type: 'admin_broadcast',
        allowSelf: true,
        priority: 'CRITICAL',
        title: 'Interruption d’urgence activée',
        message: `${feature.displayName || feature.featureName} a été désactivée d’urgence.${reason ? ` Motif : ${reason}` : ''}`,
        metadata: { featureName: feature.featureName, emergencyDisabled: true }
      })
    )
  );
};

const summarizeFeatureMetrics = async (featureNames = []) => {
  if (!featureNames.length) return new Map();
  const now = new Date();
  const sinceDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sinceWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const since30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [usage, feedback] = await Promise.all([
    FeatureUsage.aggregate([
      { $match: { featureName: { $in: featureNames }, createdAt: { $gte: since30Days } } },
      {
        $group: {
          _id: '$featureName',
          activeUsers: { $addToSet: '$user' },
          exposures: { $sum: { $cond: [{ $eq: ['$event', 'exposure'] }, 1, 0] } },
          activations: { $sum: { $cond: [{ $eq: ['$event', 'activation'] }, 1, 0] } },
          conversions: { $sum: { $cond: [{ $eq: ['$event', 'conversion'] }, 1, 0] } },
          errors: { $sum: { $cond: [{ $eq: ['$event', 'error'] }, 1, 0] } },
          dailyUsage: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ['$createdAt', sinceDay] }, { $eq: ['$event', 'activation'] }] },
                1,
                0
              ]
            }
          },
          weeklyUsage: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ['$createdAt', sinceWeek] }, { $eq: ['$event', 'activation'] }] },
                1,
                0
              ]
            }
          },
          averageLoadTime: {
            $avg: { $cond: [{ $eq: ['$event', 'exposure'] }, '$durationMs', null] }
          },
          averageSessionDuration: {
            $avg: { $cond: [{ $eq: ['$event', 'session'] }, '$durationMs', null] }
          }
        }
      }
    ]),
    FeatureFeedback.aggregate([
      { $match: { featureName: { $in: featureNames } } },
      {
        $group: {
          _id: '$featureName',
          feedbackCount: { $sum: 1 },
          bugReports: { $sum: { $cond: [{ $eq: ['$type', 'bug'] }, 1, 0] } },
          averageRating: { $avg: { $cond: [{ $eq: ['$type', 'rating'] }, '$rating', null] } }
        }
      }
    ])
  ]);
  const byFeature = new Map();
  usage.forEach((entry) => {
    byFeature.set(entry._id, {
      activeUsers: entry.activeUsers.filter(Boolean).length,
      exposures: Number(entry.exposures || 0),
      activations: Number(entry.activations || 0),
      conversions: Number(entry.conversions || 0),
      errors: Number(entry.errors || 0),
      dailyUsage: Number(entry.dailyUsage || 0),
      weeklyUsage: Number(entry.weeklyUsage || 0),
      monthlyUsage: Number(entry.activations || 0),
      averageLoadTime: Number(entry.averageLoadTime || 0),
      averageSessionDuration: Number(entry.averageSessionDuration || 0),
      conversionRate: entry.exposures ? Number(((entry.conversions / entry.exposures) * 100).toFixed(2)) : 0,
      errorRate: entry.exposures ? Number(((entry.errors / entry.exposures) * 100).toFixed(2)) : 0,
      crashRate: entry.exposures ? Number(((entry.errors / entry.exposures) * 100).toFixed(2)) : 0
    });
  });
  feedback.forEach((entry) => {
    byFeature.set(entry._id, {
      ...(byFeature.get(entry._id) || {}),
      feedbackCount: Number(entry.feedbackCount || 0),
      bugReports: Number(entry.bugReports || 0),
      averageRating: Number(entry.averageRating || 0)
    });
  });
  return byFeature;
};

export const listManagedFeatures = asyncHandler(async (req, res) => {
  const payload = await listFeatureFlags({ environment: req.query?.environment });
  const names = payload.items.map((item) => item.featureName);
  const [metrics, totalUsers] = await Promise.all([
    summarizeFeatureMetrics(names),
    User.countDocuments({ isActive: true })
  ]);
  return res.json({
    ...payload,
    totalUsers,
    items: payload.items.map((item) => ({
      ...item,
      metrics: {
        activeUsers: 0,
        exposures: 0,
        activations: 0,
        conversions: 0,
        errors: 0,
        dailyUsage: 0,
        weeklyUsage: 0,
        monthlyUsage: 0,
        averageLoadTime: 0,
        averageSessionDuration: 0,
        conversionRate: 0,
        errorRate: 0,
        crashRate: 0,
        feedbackCount: 0,
        bugReports: 0,
        averageRating: 0,
        ...(metrics.get(item.featureName) || {})
      }
    }))
  });
});

export const getManagedFeature = asyncHandler(async (req, res) => {
  const feature = await findFeature(req.params?.featureKey, req.query?.environment);
  if (!feature) return res.status(404).json({ message: 'Fonctionnalité introuvable.' });
  if (!isFeatureAdmin(req)) {
    const result = await isFeatureEnabled(getFeatureKey(feature), getFeatureContext(req));
    return res.json({
      featureName: feature.featureName,
      enabled: result.enabled,
      variant: result.variant || 'control',
      config: result.enabled ? result.config || {} : {},
      betaFeedbackEnabled: Boolean(result.enabled && result.releaseStage === 'beta')
    });
  }
  const metrics = await summarizeFeatureMetrics([feature.featureName]);
  return res.json({ ...feature, metrics: metrics.get(feature.featureName) || {} });
});

export const createManagedFeature = asyncHandler(async (req, res) => {
  const featureName = cleanText(req.body?.featureName).toLowerCase();
  if (!/^[a-z][a-z0-9_:-]{2,79}$/.test(featureName)) {
    return res.status(400).json({ message: 'La clé interne doit contenir lettres minuscules, chiffres, _ ou -.' });
  }
  const existing = await FeatureFlag.findOne({ featureName, environment: req.body?.environment || 'all' }).lean();
  if (existing) return res.status(409).json({ message: 'Cette clé de fonctionnalité existe déjà.' });

  const feature = await upsertFeatureFlag(featureName, req.body, {
    environment: req.body?.environment,
    updatedBy: req.user.id
  });
  await writeFeatureAudit(req, 'feature_created', { after: feature, reason: req.body?.reason });
  return res.status(201).json({ message: 'Fonctionnalité créée.', item: feature });
});

export const updateManagedFeature = asyncHandler(async (req, res) => {
  const before = req.feature;
  const feature = await upsertFeatureFlag(getFeatureKey(before), req.body, {
    environment: before.environment,
    updatedBy: req.user.id
  });
  await writeFeatureAudit(req, 'feature_updated', { before, after: feature, reason: req.body?.reason });
  return res.json({ message: 'Fonctionnalité mise à jour.', item: feature });
});

export const updateFeatureStatus = asyncHandler(async (req, res) => {
  const stage = cleanText(req.body?.releaseStage).toLowerCase();
  if (stage && !FEATURE_STAGES.has(stage)) return res.status(400).json({ message: 'Statut de release invalide.' });
  const payload = {
    ...(Object.prototype.hasOwnProperty.call(req.body || {}, 'enabled') ? { enabled: req.body.enabled } : {}),
    ...(Object.prototype.hasOwnProperty.call(req.body || {}, 'emergencyDisabled')
      ? { emergencyDisabled: req.body.emergencyDisabled }
      : {}),
    ...(stage ? { releaseStage: stage } : {})
  };
  const feature = await upsertFeatureFlag(
    getFeatureKey(req.feature),
    payload,
    { environment: req.feature.environment, updatedBy: req.user.id }
  );
  if (stage === 'beta' && req.feature.releaseStage !== 'beta' && feature.enabled && !feature.emergencyDisabled) {
    await notifyBetaAudience({ feature, actorId: req.user.id });
  }
  await writeFeatureAudit(req, 'feature_status_updated', {
    before: req.feature,
    after: feature,
    reason: req.body?.reason
  });
  return res.json({ message: 'Statut mis à jour.', item: feature });
});

export const updateFeatureConfig = asyncHandler(async (req, res) => {
  const config = req.body?.remoteConfig ?? req.body?.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return res.status(400).json({ message: 'remoteConfig doit être un objet JSON.' });
  }
  const feature = await upsertFeatureFlag(
    getFeatureKey(req.feature),
    { remoteConfig: config },
    { environment: req.feature.environment, updatedBy: req.user.id }
  );
  await writeFeatureAudit(req, 'feature_remote_config_updated', {
    before: req.feature,
    after: feature,
    reason: req.body?.reason
  });
  return res.json({ message: 'Configuration distante mise à jour.', item: feature });
});

export const addFeatureTesters = asyncHandler(async (req, res) => {
  const userIds = cleanArray(req.body?.userIds || (req.body?.userId ? [req.body.userId] : []));
  if (!userIds.length || userIds.some((userId) => !mongoose.Types.ObjectId.isValid(userId))) {
    return res.status(400).json({ message: 'Sélectionnez au moins un utilisateur valide.' });
  }
  const users = await User.find({ _id: { $in: userIds }, isActive: true }).select('_id').lean();
  if (users.length !== userIds.length) return res.status(404).json({ message: 'Un ou plusieurs utilisateurs sont introuvables.' });
  const current = cleanArray(req.feature.targeting?.userIds);
  const addedUserIds = userIds.filter((id) => !current.includes(id));
  const feature = await upsertFeatureFlag(
    getFeatureKey(req.feature),
    { targeting: { ...(req.feature.targeting || {}), userIds: [...current, ...userIds] } },
    { environment: req.feature.environment, updatedBy: req.user.id }
  );
  await notifySpecificBetaTesters({ feature, userIds: addedUserIds, actorId: req.user.id });
  await writeFeatureAudit(req, 'feature_testers_added', { before: req.feature, after: feature, reason: req.body?.reason });
  return res.json({ message: 'Testeurs ajoutés.', item: feature });
});

export const removeFeatureTester = asyncHandler(async (req, res) => {
  const userId = cleanText(req.params?.userId);
  if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ message: 'Utilisateur invalide.' });
  const feature = await upsertFeatureFlag(
    getFeatureKey(req.feature),
    {
      targeting: {
        ...(req.feature.targeting || {}),
        userIds: cleanArray(req.feature.targeting?.userIds).filter((id) => id !== userId)
      }
    },
    { environment: req.feature.environment, updatedBy: req.user.id }
  );
  await writeFeatureAudit(req, 'feature_tester_removed', { before: req.feature, after: feature });
  return res.json({ message: 'Testeur retiré.', item: feature });
});

export const emergencyDisableFeature = asyncHandler(async (req, res) => {
  const feature = await upsertFeatureFlag(
    getFeatureKey(req.feature),
    { emergencyDisabled: true },
    { environment: req.feature.environment, updatedBy: req.user.id }
  );
  await notifyFoundersOfEmergencyDisable({ feature, actorId: req.user.id, reason: req.body?.reason });
  await writeFeatureAudit(req, 'feature_emergency_disabled', {
    before: req.feature,
    after: feature,
    reason: req.body?.reason
  });
  return res.json({ message: 'Interruption d’urgence activée.', item: feature });
});

export const releaseFeature = asyncHandler(async (req, res) => {
  const feature = await upsertFeatureFlag(
    getFeatureKey(req.feature),
    { enabled: true, emergencyDisabled: false, releaseStage: 'released' },
    { environment: req.feature.environment, updatedBy: req.user.id }
  );
  await writeFeatureAudit(req, 'feature_released', { before: req.feature, after: feature, reason: req.body?.reason });
  return res.json({ message: 'Fonctionnalité publiée.', item: feature });
});

export const archiveFeature = asyncHandler(async (req, res) => {
  const feature = await upsertFeatureFlag(
    getFeatureKey(req.feature),
    { enabled: false, releaseStage: 'archived' },
    { environment: req.feature.environment, updatedBy: req.user.id }
  );
  await writeFeatureAudit(req, 'feature_archived', { before: req.feature, after: feature, reason: req.body?.reason });
  return res.json({ message: 'Fonctionnalité archivée.', item: feature });
});

export const getFeatureHistory = asyncHandler(async (req, res) => {
  const entries = await AuditLog.find({
    'meta.scope': 'feature_management',
    'meta.featureName': getFeatureKey(req.feature)
  })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(req.query?.limit || 100), 1), 500))
    .populate('performedBy', 'name email role')
    .lean();
  return res.json(entries);
});

export const getFeatureFeedback = asyncHandler(async (req, res) => {
  const feedback = await FeatureFeedback.find({ featureName: getFeatureKey(req.feature) })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(req.query?.limit || 100), 1), 500))
    .populate('user', 'name email phone role shopName')
    .lean();
  return res.json(feedback);
});

export const getFeatureMetrics = asyncHandler(async (req, res) => {
  const metrics = await summarizeFeatureMetrics([getFeatureKey(req.feature)]);
  return res.json({
    featureName: getFeatureKey(req.feature),
    metrics: metrics.get(getFeatureKey(req.feature)) || {}
  });
});

export const requestBetaTesterAccess = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });
  if (user.betaTester) {
    return res.json({ message: 'Vous êtes déjà testeur bêta.', status: 'approved', betaTester: true });
  }
  if (user.betaTesterApplication?.status === 'pending') {
    return res.json({ message: 'Votre demande est déjà en cours de traitement.', status: 'pending' });
  }
  user.betaTesterApplication = {
    status: 'pending',
    requestedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: cleanText(req.body?.note)
  };
  await user.save();
  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: req.user.id,
    actionType: 'beta_tester_access_requested',
    req,
    meta: { scope: 'feature_management' }
  });
  return res.status(201).json({ message: 'Demande bêta envoyée.', status: 'pending' });
});

export const getMyBetaTesterStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('betaTester betaTesterApplication').lean();
  return res.json({
    betaTester: Boolean(user?.betaTester),
    application: user?.betaTesterApplication || { status: 'none' }
  });
});

export const listBetaTesterRequests = asyncHandler(async (req, res) => {
  const status = cleanText(req.query?.status);
  const filter = status && ['pending', 'approved', 'rejected', 'none'].includes(status)
    ? { 'betaTesterApplication.status': status }
    : { 'betaTesterApplication.status': { $ne: 'none' } };
  const users = await User.find(filter)
    .sort({ 'betaTesterApplication.requestedAt': -1 })
    .limit(Math.min(Math.max(Number(req.query?.limit || 100), 1), 500))
    .select('name email phone role accountType shopName betaTester betaTesterApplication city commune')
    .populate('betaTesterApplication.reviewedBy', 'name email')
    .lean();
  return res.json(users);
});

export const reviewBetaTesterRequest = asyncHandler(async (req, res) => {
  const status = cleanText(req.body?.status).toLowerCase();
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Le statut doit être approved ou rejected.' });
  }
  const user = await User.findById(req.params?.userId);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });
  const before = { betaTester: Boolean(user.betaTester), application: user.betaTesterApplication || {} };
  user.betaTester = status === 'approved';
  user.betaTesterApplication = {
    status,
    requestedAt: user.betaTesterApplication?.requestedAt || new Date(),
    reviewedAt: new Date(),
    reviewedBy: req.user.id,
    reviewNote: cleanText(req.body?.note)
  };
  await user.save();
  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: user._id,
    actionType: 'beta_tester_request_reviewed',
    previousValue: before,
    newValue: { betaTester: user.betaTester, application: user.betaTesterApplication },
    req,
    meta: { scope: 'feature_management', status }
  });
  return res.json({ message: 'Demande bêta mise à jour.', betaTester: user.betaTester, status });
});

export const submitFeatureFeedback = asyncHandler(async (req, res) => {
  const featureName = getFeatureKey(req.feature);
  const access = await isFeatureEnabled(featureName, getFeatureContext(req));
  if (!access.enabled) return res.status(403).json({ message: 'Cette fonctionnalité ne vous est pas accessible.' });
  const type = cleanText(req.body?.type).toLowerCase();
  if (!FEEDBACK_TYPES.has(type)) return res.status(400).json({ message: 'Type de retour invalide.' });
  if (!req.feature._id) {
    return res.status(409).json({ message: 'La fonctionnalité doit être configurée par un administrateur avant de recevoir des retours.' });
  }
  const rating = req.body?.rating === undefined || req.body?.rating === null ? null : Number(req.body.rating);
  if (type === 'rating' && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return res.status(400).json({ message: 'Une note entre 1 et 5 est requise.' });
  }
  if (type !== 'rating' && !cleanText(req.body?.message)) {
    return res.status(400).json({ message: 'Décrivez votre retour.' });
  }
  const feedback = await FeatureFeedback.create({
    feature: req.feature._id,
    featureName,
    user: req.user.id,
    type,
    rating,
    message: cleanText(req.body?.message),
    metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {}
  });
  return res.status(201).json({ message: 'Merci pour votre retour.', item: feedback });
});

export const trackFeatureUsage = asyncHandler(async (req, res) => {
  const featureName = getFeatureKey(req.feature);
  const access = await isFeatureEnabled(featureName, getFeatureContext(req));
  if (!access.enabled) return res.status(403).json({ message: 'Cette fonctionnalité ne vous est pas accessible.' });
  const event = cleanText(req.body?.event).toLowerCase();
  if (!USAGE_EVENTS.has(event)) return res.status(400).json({ message: 'Événement invalide.' });
  if (!req.feature._id) {
    return res.status(409).json({ message: 'La fonctionnalité doit être configurée avant le suivi d’usage.' });
  }
  const durationMs = req.body?.durationMs === undefined ? null : Number(req.body.durationMs);
  const item = await FeatureUsage.create({
    feature: req.feature._id,
    featureName,
    user: req.user.id,
    event,
    variant: cleanText(req.body?.variant || access.variant),
    durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : null,
    metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {}
  });
  return res.status(201).json({ item });
});

export { requireFeature };
