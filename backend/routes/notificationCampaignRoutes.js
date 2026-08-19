import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { PERMISSIONS } from '../services/rbacService.js';
import {
  cancelNotificationCampaign,
  createNotificationCampaign,
  deleteNotificationCampaign,
  getNotificationCampaign,
  getNotificationCampaignAnalytics,
  listNotificationCampaigns,
  pauseNotificationCampaign,
  previewNotificationCampaignAudience,
  resumeNotificationCampaign,
  sendNotificationCampaign,
  updateNotificationCampaign
} from '../controllers/notificationCampaignController.js';

const router = express.Router();

router.use(protect);

router.get('/audience-preview', requirePermission(PERMISSIONS.MANAGE_NOTIFICATION_CAMPAIGNS), previewNotificationCampaignAudience);
router.get('/', requirePermission(PERMISSIONS.MANAGE_NOTIFICATION_CAMPAIGNS), listNotificationCampaigns);
router.post('/', requirePermission(PERMISSIONS.MANAGE_NOTIFICATION_CAMPAIGNS), createNotificationCampaign);
router.get('/:id', requirePermission(PERMISSIONS.MANAGE_NOTIFICATION_CAMPAIGNS), validate(schemas.idParam, 'params'), getNotificationCampaign);
router.patch('/:id', requirePermission(PERMISSIONS.MANAGE_NOTIFICATION_CAMPAIGNS), validate(schemas.idParam, 'params'), updateNotificationCampaign);
router.delete('/:id', requirePermission(PERMISSIONS.MANAGE_NOTIFICATION_CAMPAIGNS), validate(schemas.idParam, 'params'), deleteNotificationCampaign);
router.post('/:id/send', requirePermission(PERMISSIONS.SEND_NOTIFICATION_CAMPAIGNS), validate(schemas.idParam, 'params'), sendNotificationCampaign);
router.post('/:id/pause', requirePermission(PERMISSIONS.SEND_NOTIFICATION_CAMPAIGNS), validate(schemas.idParam, 'params'), pauseNotificationCampaign);
router.post('/:id/resume', requirePermission(PERMISSIONS.SEND_NOTIFICATION_CAMPAIGNS), validate(schemas.idParam, 'params'), resumeNotificationCampaign);
router.post('/:id/cancel', requirePermission(PERMISSIONS.SEND_NOTIFICATION_CAMPAIGNS), validate(schemas.idParam, 'params'), cancelNotificationCampaign);
router.get('/:id/analytics', requirePermission(PERMISSIONS.VIEW_NOTIFICATION_ANALYTICS), validate(schemas.idParam, 'params'), getNotificationCampaignAnalytics);

export default router;
