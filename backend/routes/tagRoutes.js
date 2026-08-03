import express from 'express';
import rateLimit from 'express-rate-limit';
import { optionalProtect, protect } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import {
  addTagsToEntity,
  bulkTagAction,
  createAdminTag,
  createTagCategory,
  deleteTagCategory,
  exportTags,
  getFeaturedTagSections,
  getPublicEntityTags,
  getPublicTag,
  getRelatedTaggedProducts,
  getTagAnalytics,
  getTagSuggestions,
  importTags,
  listAdminTags,
  listPublicTags,
  listTagCategories,
  mergeTags,
  removeTagsFromEntity,
  replaceTagsOnEntity,
  requestSellerTag,
  restoreTag,
  reviewSellerTag,
  seedDefaultTagCategories,
  softDeleteTag,
  trackTagEvent,
  updateAdminTag,
  updateTagCategory
} from '../controllers/tagController.js';

const router = express.Router();
const adminOnly = [protect, requireRole(['admin'])];
const tagEventLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});

// Customer discovery and reusable entity endpoints.
router.get('/', listPublicTags);
router.get('/featured/sections', getFeaturedTagSections);
router.get('/categories', optionalProtect, listTagCategories);
router.get('/entities/:entityType/:entityId', getPublicEntityTags);
router.get('/products/:id/related', getRelatedTaggedProducts);
router.post('/:id/events', tagEventLimiter, trackTagEvent);

// Seller experience.
router.post('/suggestions', protect, getTagSuggestions);
router.post('/requests', protect, requestSellerTag);
router.put('/entities/:entityType/:entityId', protect, replaceTagsOnEntity);
router.post('/entities/:entityType/:entityId', protect, addTagsToEntity);
router.delete('/entities/:entityType/:entityId', protect, removeTagsFromEntity);

// Administration. Static paths intentionally precede /:identifier.
router.get('/admin/all', ...adminOnly, listAdminTags);
router.get('/admin/analytics', ...adminOnly, getTagAnalytics);
router.get('/admin/export', ...adminOnly, exportTags);
router.post('/admin/import', ...adminOnly, importTags);
router.post('/admin/bulk', ...adminOnly, bulkTagAction);
router.post('/admin/categories/seed', ...adminOnly, seedDefaultTagCategories);
router.post('/admin/categories', ...adminOnly, createTagCategory);
router.put('/admin/categories/:id', ...adminOnly, updateTagCategory);
router.delete('/admin/categories/:id', ...adminOnly, deleteTagCategory);
router.post('/admin', ...adminOnly, createAdminTag);
router.put('/admin/:id', ...adminOnly, updateAdminTag);
router.delete('/admin/:id', ...adminOnly, softDeleteTag);
router.post('/admin/:id/restore', ...adminOnly, restoreTag);
router.post('/admin/:id/review', ...adminOnly, reviewSellerTag);
router.post('/admin/:id/merge', ...adminOnly, mergeTags);

router.get('/:identifier', getPublicTag);

export default router;
