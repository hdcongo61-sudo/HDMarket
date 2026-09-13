import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { getUserOnboardingState } from '../services/onboardingService.js';

const router = express.Router();
router.use(protect);

router.get('/me', async (req, res, next) => {
  try {
    const state = await getUserOnboardingState(req.user.id);
    res.json({ onboarding: state });
  } catch (error) {
    next(error);
  }
});

export default router;
