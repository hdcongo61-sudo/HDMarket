import express from 'express';
import { cacheMiddleware } from '../utils/cache.js';
import { getHomeFeed } from '../controllers/homeController.js';

const router = express.Router();

router.get('/feed', cacheMiddleware({ ttl: 120000 }), getHomeFeed);

export default router;
