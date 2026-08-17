import express from 'express';
import { optionalProtect, protect } from '../middlewares/authMiddleware.js';
import { cacheMiddleware } from '../utils/cache.js';
import { getPublicCountry, listPublicCountries, selectCountry } from '../controllers/countryController.js';

const router = express.Router();

router.get('/', optionalProtect, cacheMiddleware({ domain: 'countries', scope: 'auto', ttl: 5 * 60 * 1000 }), listPublicCountries);
router.patch('/selection', protect, selectCountry);
router.get('/:id', optionalProtect, cacheMiddleware({ domain: 'countries', scope: 'auto', ttl: 5 * 60 * 1000 }), getPublicCountry);

export default router;
