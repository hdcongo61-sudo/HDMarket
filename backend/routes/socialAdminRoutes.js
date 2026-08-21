import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requireAnyPermission, requirePermission } from '../middlewares/roleMiddleware.js';
import { requireFeatureAccess } from '../middlewares/featureFlagMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { PERMISSIONS } from '../services/rbacService.js';
import {
  listSocialConnections,
  upsertSocialConnection,
  disconnectSocialConnection,
  testSocialConnection,
  listSocialInteractions,
  getAdminSocialAnalytics,
  getSocialHealth
} from '../controllers/socialAdminController.js';

const router = express.Router();

router.use(protect, requireFeatureAccess('social_commerce'));

router.get(
  '/connections',
  requireAnyPermission([PERMISSIONS.MANAGE_SOCIAL_COMMERCE, PERMISSIONS.MANAGE_SOCIAL_CHANNELS]),
  listSocialConnections
);
// Provider credentials are founder-only (spec §46) — MANAGE_SOCIAL_CHANNELS
// is granted only to the founder role in rbacService.js, never to admin.
router.post(
  '/connections/:channel',
  requirePermission(PERMISSIONS.MANAGE_SOCIAL_CHANNELS),
  validate(schemas.socialConnectionUpsert),
  upsertSocialConnection
);
router.delete('/connections/:id', requirePermission(PERMISSIONS.MANAGE_SOCIAL_CHANNELS), disconnectSocialConnection);
router.post(
  '/connections/:channel/test',
  requireAnyPermission([PERMISSIONS.MANAGE_SOCIAL_COMMERCE, PERMISSIONS.MANAGE_SOCIAL_CHANNELS]),
  testSocialConnection
);

router.get(
  '/interactions',
  requireAnyPermission([PERMISSIONS.MANAGE_SOCIAL_COMMERCE, PERMISSIONS.VIEW_SOCIAL_ANALYTICS]),
  listSocialInteractions
);
router.get(
  '/analytics',
  requireAnyPermission([PERMISSIONS.MANAGE_SOCIAL_COMMERCE, PERMISSIONS.VIEW_SOCIAL_ANALYTICS]),
  getAdminSocialAnalytics
);
router.get(
  '/health',
  requireAnyPermission([PERMISSIONS.MANAGE_SOCIAL_COMMERCE, PERMISSIONS.MANAGE_SOCIAL_CHANNELS]),
  getSocialHealth
);

export default router;
