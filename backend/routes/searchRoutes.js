import express from 'express';
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

router.get('/categories', getSearchCategories);
router.get('/quick-filters', getQuickFilters);
router.get('/popular', getPopularSearches);
router.post('/analytics', trackSearchAnalytics);
router.post('/by-color', imageSearchRateLimiter, searchByImageColor);
router.get('/', globalSearch);

export default router;
