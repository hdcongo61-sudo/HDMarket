import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { cacheMiddleware } from '../utils/cache.js';
import { getUserRecommendations } from '../controllers/recommendationController.js';

const router = express.Router();

// Personalized recommendations — authenticated only, short cache
router.get(
  '/',
  protect,
  cacheMiddleware({ ttl: 120000, scope: 'user' }),
  getUserRecommendations
);

export default router;
