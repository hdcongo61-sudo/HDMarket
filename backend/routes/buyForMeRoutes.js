import express from 'express';
import { optionalProtect, protect } from '../middlewares/authMiddleware.js';
import { requireFeatureAccess } from '../middlewares/featureFlagMiddleware.js';
import { deliveryProofUpload } from '../utils/deliveryProofUpload.js';
import { shoppingReceiptUpload, getShoppingMedia, getLegacyShoppingReceipt } from '../controllers/buyForMeMediaController.js';
import { getShoppingDisputesAdmin, patchShoppingDisputeAdmin, getShoppingTransfersAdmin, retryShoppingTransferAdmin } from '../controllers/buyForMeController.js';
import { getCourierShoppingTransfers } from '../controllers/buyForMeCourierController.js';
import { getShoppingLists, getShoppingList, saveShoppingList, deleteShoppingList } from '../controllers/buyForMeListController.js';
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

// Resolve targeting context before evaluating new-request access. Existing
// paid work, recovery and administration remain available when creation is off.
router.use(optionalProtect);
const newRequestAccess = requireFeatureAccess('enable_buy_for_me');

router.get('/capabilities', newRequestAccess, getBuyForMeCapabilities);
router.post('/estimate', protect, newRequestAccess, estimateBuyForMe);
router.post('/item-images', protect, newRequestAccess, deliveryProofUpload.single('image'), uploadBuyForMeItemImage);
router.get('/media/:id', protect, getShoppingMedia);
router.get('/orders/:id/receipt/:index', protect, getLegacyShoppingReceipt);
router.get('/mine', protect, getMyBuyForMeOrders);
router.get('/lists', protect, getShoppingLists);
router.get('/lists/:id', protect, getShoppingList);
router.post('/lists', protect, saveShoppingList);
router.delete('/lists/:id', protect, deleteShoppingList);
router.get('/mine/:id', protect, getMyBuyForMeOrder);
router.post('/mine/:id/cancel', protect, cancelMyBuyForMeOrder);
router.post('/mine/:id/confirm', protect, confirmMyBuyForMeOrder);
router.post('/mine/:id/items/:itemId/respond', protect, respondMyBuyForMeItem);
router.post('/mine/:id/additional-payment/decline', protect, declineMyBuyForMeAdditionalPayment);
router.post('/mine/:id/overage-adjustments', protect, adjustMyBuyForMeOverage);
router.post('/mine/:id/disputes', protect, createMyBuyForMeDispute);

router.get('/courier/jobs', protect, listCourierBuyForMeJobs);
router.get('/courier/transfers', protect, getCourierShoppingTransfers);
router.patch('/courier/jobs/:id/accept', protect, acceptCourierBuyForMeJob);
router.patch('/courier/jobs/:id/reject', protect, rejectCourierBuyForMeJob);
router.patch('/courier/jobs/:id/start-shopping', protect, startCourierBuyForMeShopping);
router.patch('/courier/jobs/:id/items/:itemId', protect, updateCourierBuyForMeItem);
router.post(
  '/courier/jobs/:id/receipt',
  protect,
  shoppingReceiptUpload.fields([{ name: 'receipt', maxCount: 1 }, { name: 'productPhotos', maxCount: 5 }]),
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
router.get('/admin/disputes', protect, getShoppingDisputesAdmin);
router.patch('/admin/disputes/:id', protect, patchShoppingDisputeAdmin);
router.get('/admin/transfers', protect, getShoppingTransfersAdmin);
router.post('/admin/transfers/:id/retry', protect, retryShoppingTransferAdmin);

export default router;
