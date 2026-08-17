import express from 'express';
import { cacheMiddleware } from '../utils/cache.js';
import { getPublicCities } from '../controllers/settingsController.js';
import { optionalProtect } from '../middlewares/authMiddleware.js';
import { attachCountryContext } from '../middlewares/countryMiddleware.js';

const router = express.Router();

router.get('/', optionalProtect, attachCountryContext, cacheMiddleware({ ttl: 1800000 }), getPublicCities);

export default router;
