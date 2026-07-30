import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { deliveryProofUpload } from '../utils/deliveryProofUpload.js';
import {
  cancelAdminBuyForMeOrder,
  cancelMyBuyForMeOrder,
  adjustMyBuyForMeOverage,
  confirmMyBuyForMeOrder,
  createMyBuyForMeDispute,
  declineMyBuyForMeAdditionalPayment,
  estimateBuyForMe,
  getAdminBuyForMeConfig,
  getAdminBuyForMeOrders,
  getAdminBuyForMeStats,
  getBuyForMeCapabilities,
  getMyBuyForMeOrder,
  getMyBuyForMeOrders,
  patchAdminBuyForMeConfig,
  assignAdminBuyForMeDriver,
  respondMyBuyForMeItem,
  uploadBuyForMeItemImage
} from '../controllers/buyForMeController.js';
import {
  acceptCourierBuyForMeJob,
  deliverCourierBuyForMeOrder,
  listCourierBuyForMeJobs,
  rejectCourierBuyForMeJob,
  startCourierBuyForMeDelivery,
  startCourierBuyForMeShopping,
  updateCourierBuyForMeItem,
  uploadCourierBuyForMeReceipt
} from '../controllers/buyForMeCourierController.js';

const router = express.Router();

router.get('/capabilities', getBuyForMeCapabilities);
router.post('/estimate', protect, estimateBuyForMe);
router.post('/item-images', protect, deliveryProofUpload.single('image'), uploadBuyForMeItemImage);
router.get('/mine', protect, getMyBuyForMeOrders);
router.get('/mine/:id', protect, getMyBuyForMeOrder);
router.post('/mine/:id/cancel', protect, cancelMyBuyForMeOrder);
router.post('/mine/:id/confirm', protect, confirmMyBuyForMeOrder);
router.post('/mine/:id/items/:itemId/respond', protect, respondMyBuyForMeItem);
router.post('/mine/:id/additional-payment/decline', protect, declineMyBuyForMeAdditionalPayment);
router.post('/mine/:id/overage-adjustments', protect, adjustMyBuyForMeOverage);
router.post('/mine/:id/disputes', protect, createMyBuyForMeDispute);

router.get('/courier/jobs', protect, listCourierBuyForMeJobs);
router.patch('/courier/jobs/:id/accept', protect, acceptCourierBuyForMeJob);
router.patch('/courier/jobs/:id/reject', protect, rejectCourierBuyForMeJob);
router.patch('/courier/jobs/:id/start-shopping', protect, startCourierBuyForMeShopping);
router.patch('/courier/jobs/:id/items/:itemId', protect, updateCourierBuyForMeItem);
router.post(
  '/courier/jobs/:id/receipt',
  protect,
  deliveryProofUpload.fields([{ name: 'receipt', maxCount: 1 }, { name: 'productPhotos', maxCount: 5 }]),
  uploadCourierBuyForMeReceipt
);
router.patch('/courier/jobs/:id/start-delivery', protect, startCourierBuyForMeDelivery);
router.patch('/courier/jobs/:id/delivered', protect, deliverCourierBuyForMeOrder);

router.get('/admin/config', protect, getAdminBuyForMeConfig);
router.patch('/admin/config', protect, patchAdminBuyForMeConfig);
router.get('/admin/orders', protect, getAdminBuyForMeOrders);
router.get('/admin/stats', protect, getAdminBuyForMeStats);
router.post('/admin/orders/:id/assign', protect, assignAdminBuyForMeDriver);
router.post('/admin/orders/:id/cancel', protect, cancelAdminBuyForMeOrder);

export default router;
