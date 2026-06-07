import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import {
  inviteAssistant,
  acceptInvitation,
  rejectInvitation,
  removeAssistant,
  leaveShop,
  updatePermissions,
  getShopAssistant,
  getMyAssistantShop,
  getMyPendingInvitations,
  getAssistantAuditLogs
} from '../controllers/shopAssistantController.js';

const router = Router();

router.use(protect);

// Shop-scoped routes
router.route('/:shopId/assistant/invite').post(inviteAssistant);
router.route('/:shopId/assistant/accept').post(acceptInvitation);
router.route('/:shopId/assistant/reject').post(rejectInvitation);
router.route('/:shopId/assistant/leave').post(leaveShop);
router.route('/:shopId/assistant').get(getShopAssistant).delete(removeAssistant);
router.route('/:shopId/assistant/permissions').put(updatePermissions);
router.get('/:shopId/assistant/audit', getAssistantAuditLogs);

// User-scoped route
router.get('/me/assistant-shop', getMyAssistantShop);
router.get('/me/assistant-invitations', getMyPendingInvitations);

export default router;
