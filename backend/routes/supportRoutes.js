import { Router } from 'express';
import { getHelpCenter, updateHelpCenter } from '../controllers/helpCenterController.js';
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = Router();

router.route('/help-center').get(getHelpCenter).put(protect, admin, updateHelpCenter);

export default router;
