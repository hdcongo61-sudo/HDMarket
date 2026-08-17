import express from 'express';
import { optionalProtect } from '../middlewares/authMiddleware.js';
import { attachCountryContext } from '../middlewares/countryMiddleware.js';
import { cacheMiddleware } from '../utils/cache.js';
import { getHomeFeed } from '../controllers/homeController.js';

const router = express.Router();
router.use(optionalProtect, attachCountryContext);

router.get('/feed', cacheMiddleware({ ttl: 120000 }), getHomeFeed);

export default router;
