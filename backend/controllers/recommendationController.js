import asyncHandler from 'express-async-handler';
import { getRecommendations } from '../services/recommendationService.js';

/**
 * GET /api/products/recommendations
 * Returns personalized product recommendations for the authenticated user
 * Query params: page, limit, exclude (comma-separated product IDs)
 */
export const getUserRecommendations = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  if (!userId) {
    return res.status(401).json({ message: 'Authentification requise.' });
  }

  const userCity = String(req.user?.city || req.user?.preferredCity || '').trim();
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const excludeRaw = String(req.query.exclude || '');
  const excludeProductIds = excludeRaw
    ? excludeRaw.split(',').map((id) => id.trim()).filter(Boolean)
    : [];

  const result = await getRecommendations({
    userId,
    userCity,
    page,
    limit,
    excludeProductIds
  });

  res.json(result);
});
