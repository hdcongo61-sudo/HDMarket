import express from 'express';
import Joi from 'joi';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { idempotencyMiddleware } from '../middlewares/idempotencyMiddleware.js';
import {
  addFeatureTesters,
  archiveFeature,
  createManagedFeature,
  emergencyDisableFeature,
  getFeatureFeedback,
  getFeatureHistory,
  getFeatureMetrics,
  getManagedFeature,
  getMyBetaTesterStatus,
  listBetaTesterRequests,
  listManagedFeatures,
  releaseFeature,
  removeFeatureTester,
  requestBetaTesterAccess,
  requireFeature,
  reviewBetaTesterRequest,
  submitFeatureFeedback,
  trackFeatureUsage,
  updateFeatureConfig,
  updateFeatureStatus,
  updateManagedFeature
} from '../controllers/featureManagementController.js';

const router = express.Router();
const featureMutationIdempotency = idempotencyMiddleware({ ttlMs: 10 * 60 * 1000 });
const featureIdentifier = Joi.string().trim().max(100).required();
const objectId = Joi.string().hex().length(24);

const targetingSchema = Joi.object({
  userIds: Joi.array().items(objectId).max(2000),
  roles: Joi.array().items(Joi.string().trim().max(80)).max(30),
  countries: Joi.array().items(Joi.string().trim().max(120)).max(100),
  countryIds: Joi.array().items(objectId).max(100),
  cities: Joi.array().items(Joi.string().trim().max(120)).max(300),
  communes: Joi.array().items(Joi.string().trim().max(120)).max(500),
  platforms: Joi.array().items(Joi.string().valid('android', 'ios', 'web', 'pwa')).max(4),
  minAppVersion: Joi.string().trim().max(40).allow(''),
  betaTestersOnly: Joi.boolean()
}).unknown(false);

const scheduleSchema = Joi.object({
  releaseAt: Joi.date().allow(null),
  expiresAt: Joi.date().allow(null),
  timezone: Joi.string().trim().max(80).allow('')
}).unknown(false);

const experimentsSchema = Joi.array().items(
  Joi.object({
    key: Joi.string().trim().pattern(/^[a-zA-Z0-9_-]{1,60}$/).required(),
    name: Joi.string().trim().max(120).allow(''),
    rolloutPercentage: Joi.number().min(0).max(100).required(),
    config: Joi.object().unknown(true).default({})
  })
).max(20);

const featurePayloadSchema = Joi.object({
  featureName: Joi.string().trim().pattern(/^[a-z][a-z0-9_:-]{2,79}$/),
  displayName: Joi.string().trim().max(120),
  category: Joi.string().trim().max(80),
  icon: Joi.string().trim().max(80),
  version: Joi.string().trim().max(40),
  enabled: Joi.boolean(),
  emergencyDisabled: Joi.boolean(),
  releaseStage: Joi.string().valid('development', 'beta', 'released', 'archived'),
  scope: Joi.string().valid('GLOBAL', 'COUNTRY', 'CITY', 'USER', 'TESTER'),
  rollout: Joi.string().valid('TEST', 'APPROVED'),
  rolesAllowed: Joi.array().items(Joi.string().trim().max(80)).max(30),
  rolloutPercentage: Joi.number().min(0).max(100),
  description: Joi.string().trim().max(2000).allow(''),
  targeting: targetingSchema,
  dependencies: Joi.array().items(Joi.string().trim().max(100)).max(100),
  remoteConfig: Joi.object().unknown(true),
  schedule: scheduleSchema,
  experiments: experimentsSchema,
  environment: Joi.string().valid('all', 'production', 'staging', 'dev'),
  reason: Joi.string().trim().max(500).allow('')
}).min(1);

// Beta participation is available to every authenticated customer.
router.post('/beta/request', protect, featureMutationIdempotency, requestBetaTesterAccess);
router.get('/beta/me', protect, getMyBetaTesterStatus);

// Feature control centre.
router.get('/', protect, requireRole(['admin']), listManagedFeatures);
router.post('/', protect, requireRole(['admin']), validate(featurePayloadSchema), featureMutationIdempotency, createManagedFeature);
router.get('/beta/requests', protect, requireRole(['admin']), listBetaTesterRequests);
router.patch(
  '/beta/requests/:userId',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ userId: objectId.required() }), 'params'),
  validate(Joi.object({ status: Joi.string().valid('approved', 'rejected').required(), note: Joi.string().trim().max(500).allow('') })),
  featureMutationIdempotency,
  reviewBetaTesterRequest
);

router.put(
  '/:id',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ id: featureIdentifier }), 'params'),
  requireFeature,
  validate(featurePayloadSchema),
  featureMutationIdempotency,
  updateManagedFeature
);
router.patch(
  '/:id/status',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ id: featureIdentifier }), 'params'),
  requireFeature,
  validate(Joi.object({ enabled: Joi.boolean(), emergencyDisabled: Joi.boolean(), releaseStage: Joi.string().valid('development', 'beta', 'released', 'archived'), reason: Joi.string().trim().max(500).allow('') }).min(1)),
  featureMutationIdempotency,
  updateFeatureStatus
);
router.patch(
  '/:id/config',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ id: featureIdentifier }), 'params'),
  requireFeature,
  validate(Joi.object({ remoteConfig: Joi.object().unknown(true), config: Joi.object().unknown(true), reason: Joi.string().trim().max(500).allow('') }).or('remoteConfig', 'config')),
  featureMutationIdempotency,
  updateFeatureConfig
);
router.post(
  '/:id/testers',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ id: featureIdentifier }), 'params'),
  requireFeature,
  validate(Joi.object({ userId: objectId, userIds: Joi.array().items(objectId).min(1).max(2000), reason: Joi.string().trim().max(500).allow('') }).or('userId', 'userIds')),
  featureMutationIdempotency,
  addFeatureTesters
);
router.delete(
  '/:id/testers/:userId',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ id: featureIdentifier, userId: objectId.required() }), 'params'),
  requireFeature,
  featureMutationIdempotency,
  removeFeatureTester
);
router.post(
  '/:id/emergency-disable',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ id: featureIdentifier }), 'params'),
  requireFeature,
  validate(Joi.object({ reason: Joi.string().trim().max(500).allow('') })),
  featureMutationIdempotency,
  emergencyDisableFeature
);
router.post(
  '/:id/release',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ id: featureIdentifier }), 'params'),
  requireFeature,
  validate(Joi.object({ reason: Joi.string().trim().max(500).allow('') })),
  featureMutationIdempotency,
  releaseFeature
);
router.post(
  '/:id/archive',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ id: featureIdentifier }), 'params'),
  requireFeature,
  validate(Joi.object({ reason: Joi.string().trim().max(500).allow('') })),
  featureMutationIdempotency,
  archiveFeature
);
router.get(
  '/:id/history',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ id: featureIdentifier }), 'params'),
  requireFeature,
  getFeatureHistory
);
router.get(
  '/:id/feedback',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ id: featureIdentifier }), 'params'),
  requireFeature,
  getFeatureFeedback
);
router.get(
  '/:id/metrics',
  protect,
  requireRole(['admin']),
  validate(Joi.object({ id: featureIdentifier }), 'params'),
  requireFeature,
  getFeatureMetrics
);

// User-facing integration endpoints. They only disclose a feature when access
// resolves for the authenticated user.
router.post(
  '/:id/feedback',
  protect,
  validate(Joi.object({ id: featureIdentifier }), 'params'),
  requireFeature,
  validate(Joi.object({ type: Joi.string().valid('bug', 'improvement', 'rating').required(), rating: Joi.number().integer().min(1).max(5), message: Joi.string().trim().max(3000).allow(''), metadata: Joi.object().unknown(true) })),
  featureMutationIdempotency,
  submitFeatureFeedback
);
router.post(
  '/:id/events',
  protect,
  validate(Joi.object({ id: featureIdentifier }), 'params'),
  requireFeature,
  validate(Joi.object({ event: Joi.string().valid('exposure', 'activation', 'conversion', 'error', 'session').required(), variant: Joi.string().trim().max(80).allow(''), durationMs: Joi.number().min(0).max(86_400_000), metadata: Joi.object().unknown(true) })),
  trackFeatureUsage
);
router.get('/:featureKey', protect, validate(Joi.object({ featureKey: featureIdentifier }), 'params'), getManagedFeature);

export default router;
