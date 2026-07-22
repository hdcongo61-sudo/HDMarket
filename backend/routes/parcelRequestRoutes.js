import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { deliveryProofUpload } from '../utils/deliveryProofUpload.js';
import {
  getParcelDeliveryCapabilities,
  postEstimateParcelPrice,
  postCreateParcelRequest,
  getMyParcelRequests,
  getMyParcelRequestById,
  postCancelParcelRequest,
  getAdminParcelRequests,
  postAdminAssignParcelCourier,
  getAdminParcelRequestStats,
  postAdminCancelParcelRequest
} from '../controllers/parcelRequestController.js';

const router = express.Router();

router.get('/capabilities', getParcelDeliveryCapabilities);
router.post('/estimate', protect, postEstimateParcelPrice);
router.post('/', protect, deliveryProofUpload.single('proofImage'), postCreateParcelRequest);
router.get('/mine', protect, getMyParcelRequests);
router.get('/mine/:id', protect, getMyParcelRequestById);
router.post('/mine/:id/cancel', protect, postCancelParcelRequest);

router.get('/admin/list', protect, getAdminParcelRequests);
router.get('/admin/stats', protect, getAdminParcelRequestStats);
router.post('/admin/:id/assign', protect, postAdminAssignParcelCourier);
router.post('/admin/:id/cancel', protect, postAdminCancelParcelRequest);

export default router;
