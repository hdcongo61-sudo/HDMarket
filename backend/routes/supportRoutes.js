import { Router } from 'express';
import { getHelpCenter, updateHelpCenter } from '../controllers/helpCenterController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { requireHelpCenterAccess } from '../middlewares/roleMiddleware.js';

const router = Router();

router.route('/help-center').get(getHelpCenter).put(protect, requireHelpCenterAccess, updateHelpCenter);

export default router;
