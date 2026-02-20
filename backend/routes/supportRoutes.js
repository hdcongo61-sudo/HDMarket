import { Router } from 'express';
import {
  addHelpCenterCondition,
  deleteHelpCenterCondition,
  getHelpCenter,
  updateHelpCenterCondition,
  updateHelpCenter
} from '../controllers/helpCenterController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { requireHelpCenterAccess } from '../middlewares/roleMiddleware.js';

const router = Router();

router.route('/help-center').get(getHelpCenter).put(protect, requireHelpCenterAccess, updateHelpCenter);
router.post('/help-center/conditions', protect, requireHelpCenterAccess, addHelpCenterCondition);
router.put('/help-center/conditions/:index', protect, requireHelpCenterAccess, updateHelpCenterCondition);
router.delete(
  '/help-center/conditions/:index',
  protect,
  requireHelpCenterAccess,
  deleteHelpCenterCondition
);

export default router;
