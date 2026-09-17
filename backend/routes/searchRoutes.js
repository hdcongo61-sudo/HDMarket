import express from 'express';
import multer from 'multer';
import { getSearchAiCapabilities, runSearchAi } from '../controllers/searchAiController.js';
import rateLimit from 'express-rate-limit';
import { optionalProtect } from '../middlewares/authMiddleware.js';
import { attachCountryContext } from '../middlewares/countryMiddleware.js';
import { protect } from '../middlewares/authMiddleware.js';
import { globalSearch, getSearchCategories, getQuickFilters, getPopularSearches, trackSearchAnalytics } from '../controllers/searchController.js';
import { searchByImageColor } from '../controllers/visualSearchController.js';

const router = express.Router();
router.use(optionalProtect, attachCountryContext);

const imageSearchRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    res.status(options.statusCode || 429).json({
      success: false,
      message: 'Trop de recherches par image. Réessayez dans un instant.',
      code: 'IMAGE_SEARCH_RATE_LIMITED'
    });
  }
});

// Public search remains available to guests, with IP and process-wide cost guards.
const aiSearchLimiter = rateLimit({ windowMs: 3600000, max: 20, standardHeaders: true, legacyHeaders: false, message: { message: 'Limite de recherches IA atteinte. Utilisez la recherche classique ou réessayez plus tard.' } });
const aiDailyLimiter = rateLimit({ windowMs: 86400000, max: Math.max(1, Number(process.env.SEARCH_AI_DAILY_LIMIT) || 500), keyGenerator: () => 'search-ai', standardHeaders: false, legacyHeaders: false, message: { message: 'Quota IA temporairement atteint. La recherche classique reste disponible.' } });
router.get('/ai/capabilities', getSearchAiCapabilities);
router.post('/ai/image', aiSearchLimiter, aiDailyLimiter, runSearchAi('image'));
router.post('/ai/voice', aiSearchLimiter, aiDailyLimiter, runSearchAi('voice'));
router.post('/ai/transcribe', aiSearchLimiter, aiDailyLimiter, multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 0 } }).single('audio'), runSearchAi('audio'));
router.get('/categories', getSearchCategories);
router.get('/quick-filters', getQuickFilters);
router.get('/popular', getPopularSearches);
router.post('/analytics', trackSearchAnalytics);
router.post('/by-color', imageSearchRateLimiter, searchByImageColor);
router.get('/', globalSearch);

export default router;
