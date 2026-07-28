/**
 * Parcel pricing engine — admin configuration CRUD (zones, zone-price
 * matrix, landmarks, package types, weight rules, delivery speed, peak
 * hours, promotions) plus the two shop-facing lookups the request form
 * needs. Admin's general settings (base price, surcharges, toggles...) and
 * commune/city CRUD stay on the existing /admin/config/runtime,
 * /admin/communes and /admin/cities endpoints — see AdminDeliveryPricing.jsx.
 */
import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import {
  listZonesAdmin,
  createZoneAdmin,
  updateZoneAdmin,
  deleteZoneAdmin,
  listZonePricesAdmin,
  upsertZonePriceAdmin,
  deleteZonePriceAdmin,
  listLandmarksAdmin,
  createLandmarkAdmin,
  updateLandmarkAdmin,
  deleteLandmarkAdmin,
  listPackageTypesAdmin,
  createPackageTypeAdmin,
  updatePackageTypeAdmin,
  deletePackageTypeAdmin,
  listWeightRulesAdmin,
  createWeightRuleAdmin,
  updateWeightRuleAdmin,
  deleteWeightRuleAdmin,
  listSpeedRulesAdmin,
  createSpeedRuleAdmin,
  updateSpeedRuleAdmin,
  deleteSpeedRuleAdmin,
  listPeakHoursAdmin,
  createPeakHourAdmin,
  updatePeakHourAdmin,
  deletePeakHourAdmin,
  listPromotionsAdmin,
  createPromotionAdmin,
  updatePromotionAdmin,
  deletePromotionAdmin,
  getDeliveryPricingOptions,
  searchLandmarksPublic
} from '../controllers/deliveryPricingEngineController.js';

const router = express.Router();
const requireAdmin = [protect, requireRole(['admin', 'founder'])];

// Shop-facing
router.get('/options', protect, getDeliveryPricingOptions);
router.get('/landmarks/search', protect, searchLandmarksPublic);

// Admin — zones
router.get('/admin/zones', ...requireAdmin, listZonesAdmin);
router.post('/admin/zones', ...requireAdmin, createZoneAdmin);
router.patch('/admin/zones/:id', ...requireAdmin, updateZoneAdmin);
router.delete('/admin/zones/:id', ...requireAdmin, deleteZoneAdmin);

// Admin — zone price matrix
router.get('/admin/zone-prices', ...requireAdmin, listZonePricesAdmin);
router.post('/admin/zone-prices', ...requireAdmin, upsertZonePriceAdmin);
router.delete('/admin/zone-prices/:id', ...requireAdmin, deleteZonePriceAdmin);

// Admin — landmarks
router.get('/admin/landmarks', ...requireAdmin, listLandmarksAdmin);
router.post('/admin/landmarks', ...requireAdmin, createLandmarkAdmin);
router.patch('/admin/landmarks/:id', ...requireAdmin, updateLandmarkAdmin);
router.delete('/admin/landmarks/:id', ...requireAdmin, deleteLandmarkAdmin);

// Admin — package types
router.get('/admin/package-types', ...requireAdmin, listPackageTypesAdmin);
router.post('/admin/package-types', ...requireAdmin, createPackageTypeAdmin);
router.patch('/admin/package-types/:id', ...requireAdmin, updatePackageTypeAdmin);
router.delete('/admin/package-types/:id', ...requireAdmin, deletePackageTypeAdmin);

// Admin — weight rules
router.get('/admin/weight-rules', ...requireAdmin, listWeightRulesAdmin);
router.post('/admin/weight-rules', ...requireAdmin, createWeightRuleAdmin);
router.patch('/admin/weight-rules/:id', ...requireAdmin, updateWeightRuleAdmin);
router.delete('/admin/weight-rules/:id', ...requireAdmin, deleteWeightRuleAdmin);

// Admin — delivery speed rules
router.get('/admin/speed-rules', ...requireAdmin, listSpeedRulesAdmin);
router.post('/admin/speed-rules', ...requireAdmin, createSpeedRuleAdmin);
router.patch('/admin/speed-rules/:id', ...requireAdmin, updateSpeedRuleAdmin);
router.delete('/admin/speed-rules/:id', ...requireAdmin, deleteSpeedRuleAdmin);

// Admin — peak hours
router.get('/admin/peak-hours', ...requireAdmin, listPeakHoursAdmin);
router.post('/admin/peak-hours', ...requireAdmin, createPeakHourAdmin);
router.patch('/admin/peak-hours/:id', ...requireAdmin, updatePeakHourAdmin);
router.delete('/admin/peak-hours/:id', ...requireAdmin, deletePeakHourAdmin);

// Admin — promotions
router.get('/admin/promotions', ...requireAdmin, listPromotionsAdmin);
router.post('/admin/promotions', ...requireAdmin, createPromotionAdmin);
router.patch('/admin/promotions/:id', ...requireAdmin, updatePromotionAdmin);
router.delete('/admin/promotions/:id', ...requireAdmin, deletePromotionAdmin);

export default router;
