import express from 'express';
import { optionalProtect } from '../middlewares/authMiddleware.js';
import { attachCountryContext } from '../middlewares/countryMiddleware.js';
import { protect } from '../middlewares/authMiddleware.js';
import { globalSearch, getSearchCategories, getQuickFilters, getPopularSearches, trackSearchAnalytics } from '../controllers/searchController.js';

const router = express.Router();
router.use(optionalProtect, attachCountryContext);

router.get('/categories', getSearchCategories);
router.get('/quick-filters', getQuickFilters);
router.get('/popular', getPopularSearches);
router.post('/analytics', trackSearchAnalytics);
router.get('/', globalSearch);

export default router;
