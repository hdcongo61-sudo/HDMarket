import express from 'express';
import { cacheMiddleware } from '../utils/cache.js';
import { getPublicCurrencies } from '../controllers/settingsController.js';

const router = express.Router();

router.get('/', cacheMiddleware({ ttl: 1800000 }), getPublicCurrencies);

export default router;
