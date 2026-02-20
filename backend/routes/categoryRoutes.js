import express from 'express';
import { cacheMiddleware } from '../utils/cache.js';
import { getPublicCategoryTree } from '../controllers/categoryController.js';
import { validateCategory } from '../middlewares/categoryValidation.js';

const router = express.Router();

router.get(
  '/tree',
  validateCategory.treeQuery,
  cacheMiddleware({ ttl: 5 * 60 * 1000 }),
  getPublicCategoryTree
);

export default router;
