import express from 'express';
import { cacheMiddleware } from '../utils/cache.js';
import { etagMiddleware } from '../middlewares/etagMiddleware.js';
import { getHomeFeed } from '../controllers/homeController.js';

const router = express.Router();

router.get('/feed', cacheMiddleware({ ttl: 120000 }), etagMiddleware({ maxAge: 120 }), getHomeFeed);

export default router;
