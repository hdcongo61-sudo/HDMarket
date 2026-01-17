import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { upload } from '../utils/upload.js';
import {
  getDashboardStats,
  listUsers,
  updateUserAccountType,
  blockUser,
  unblockUser,
  updateShopVerification,
  listVerifiedShopsAdmin,
  updateUserRole
} from '../controllers/adminController.js';
import { getAdminUserStats } from '../controllers/userController.js';
import {
  listBoostProductCandidatesAdmin,
  toggleProductBoost,
  certifyProduct,
  listAdminProducts
} from '../controllers/productController.js';
import {
  listComplaintsAdmin,
  updateComplaintStatus
} from '../controllers/complaintController.js';
import {
  createProhibitedWord,
  listProhibitedWords,
  deleteProhibitedWord
} from '../controllers/prohibitedWordController.js';
import {
  createChatTemplate,
  sendSupportMessage
} from '../controllers/chatController.js';
import { updateAppLogoDesktop, updateAppLogoMobile, updateHeroBanner, updatePromoBanner } from '../controllers/siteSettingController.js';
import {
  listDeliveryGuysAdmin,
  createDeliveryGuyAdmin,
  updateDeliveryGuyAdmin,
  deleteDeliveryGuyAdmin
} from '../controllers/deliveryGuyController.js';

const router = express.Router();

router.use(protect, requireRole(['admin', 'manager']));

router.get('/stats', getDashboardStats);
router.get('/users', listUsers);
router.get('/users/:id/stats', validate(schemas.idParam, 'params'), getAdminUserStats);
router.patch(
  '/users/:id/account-type',
  validate(schemas.idParam, 'params'),
  validate(schemas.adminUserAccountType),
  updateUserAccountType
);
router.patch(
  '/users/:id/block', 
  validate(schemas.idParam, 'params'),
  validate(schemas.adminBlockUser),
  blockUser
);
router.patch(
  '/users/:id/unblock',
  validate(schemas.idParam, 'params'),
  unblockUser
);
router.patch(
  '/users/:id/shop-verification',
  validate(schemas.idParam, 'params'),
  validate(schemas.adminShopVerification),
  updateShopVerification
);
router.patch(
  '/users/:id/role',
  validate(schemas.idParam, 'params'),
  validate(schemas.adminUserRole),
  updateUserRole
);
router.get('/shops/verified', listVerifiedShopsAdmin);
router.get('/products', listAdminProducts);
router.get('/products/boosts', listBoostProductCandidatesAdmin);
router.patch('/products/:id/boost', toggleProductBoost);
router.patch(
  '/products/:id/certify',
  validate(schemas.idParam, 'params'),
  validate(schemas.adminProductCertification),
  certifyProduct
);
router.get('/complaints', listComplaintsAdmin);
router.post('/chat/templates', createChatTemplate);
router.post('/chat/support-message', sendSupportMessage);
router.patch(
  '/complaints/:id/status',
  validate(schemas.idParam, 'params'),
  validate(schemas.complaintStatusUpdate),
  updateComplaintStatus
);
router.get('/prohibited-words', listProhibitedWords);
router.post(
  '/prohibited-words',
  validate(schemas.prohibitedWordCreate),
  createProhibitedWord
);
router.delete('/prohibited-words/:id', validate(schemas.idParam, 'params'), deleteProhibitedWord);
router.put('/hero-banner', upload.single('heroBanner'), updateHeroBanner);
router.put('/app-logo/desktop', upload.single('appLogoDesktop'), updateAppLogoDesktop);
router.put('/app-logo/mobile', upload.single('appLogoMobile'), updateAppLogoMobile);
router.put(
  '/promo-banner',
  upload.fields([
    { name: 'promoBanner', maxCount: 1 },
    { name: 'promoBannerMobile', maxCount: 1 }
  ]),
  updatePromoBanner
);
router.get('/delivery-guys', listDeliveryGuysAdmin);
router.post(
  '/delivery-guys',
  validate(schemas.deliveryGuyCreate),
  createDeliveryGuyAdmin
);
router.patch(
  '/delivery-guys/:id',
  validate(schemas.idParam, 'params'),
  validate(schemas.deliveryGuyUpdate),
  updateDeliveryGuyAdmin
);
router.delete('/delivery-guys/:id', validate(schemas.idParam, 'params'), deleteDeliveryGuyAdmin);

export default router;
