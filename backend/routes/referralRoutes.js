import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { getMyReferralSummary } from '../controllers/referralController.js';

const router = express.Router();

router.get('/me', protect, getMyReferralSummary);

export default router;
