import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { getMyRewardPoints, postCheckIn } from '../controllers/rewardPointsController.js';

const router = express.Router();

router.get('/me', protect, getMyRewardPoints);
router.post('/checkin', protect, postCheckIn);

export default router;
