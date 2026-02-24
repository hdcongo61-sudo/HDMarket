import express from 'express';
import rateLimit from 'express-rate-limit';
import { founderIntelligence } from '../controllers/founderAnalyticsController.js';
import {
  forceLogoutUser,
  forcePasswordResetUser,
  listFounderAuditLogs,
  lockUserAccount,
  promoteAdmin,
  revokeAdmin,
  unlockUserAccount
} from '../controllers/founderController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { requireFounder, requirePermission } from '../middlewares/roleMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';

const router = express.Router();

const founderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Math.max(10, Number(process.env.FOUNDER_RATE_LIMIT_PER_MIN || 20)),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many founder analytics requests. Please retry in one minute.' }
});

router.get('/intelligence', founderLimiter, protect, requireFounder, requirePermission('access_founder_analytics'), founderIntelligence);
router.get('/audit-logs', founderLimiter, protect, requireFounder, requirePermission('view_logs'), listFounderAuditLogs);
router.post('/promote-admin/:id', protect, requireFounder, requirePermission('assign_roles'), validate(schemas.idParam, 'params'), promoteAdmin);
router.post('/revoke-admin/:id', protect, requireFounder, requirePermission('revoke_roles'), validate(schemas.idParam, 'params'), revokeAdmin);
router.post('/lock-user/:id', protect, requireFounder, requirePermission('lock_accounts'), validate(schemas.idParam, 'params'), lockUserAccount);
router.post('/unlock-user/:id', protect, requireFounder, requirePermission('lock_accounts'), validate(schemas.idParam, 'params'), unlockUserAccount);
router.post(
  '/force-logout/:id',
  protect,
  requireFounder,
  requirePermission('force_logout'),
  validate(schemas.idParam, 'params'),
  forceLogoutUser
);
router.post(
  '/force-reset-password/:id',
  founderLimiter,
  protect,
  requireFounder,
  requirePermission('reset_passwords'),
  validate(schemas.idParam, 'params'),
  forcePasswordResetUser
);

export default router;
