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
  getMyAssistantShop
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

// User-scoped route
router.get('/me/assistant-shop', getMyAssistantShop);

export default router;
