import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requireComplaintAccess } from '../middlewares/roleMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { disputeUpload } from '../utils/disputeUpload.js';
import {
  createDispute,
  getDisputeDetails,
  listAdminDisputes,
  listClientDisputes,
  listSellerDisputes,
  resolveAdminDispute,
  respondSellerDispute,
  runDisputeDeadlineChecks
} from '../controllers/disputeController.js';

const router = express.Router();

router.use(protect);

router.get('/me', listClientDisputes);
router.post(
  '/',
  disputeUpload.array('proofImages', 5),
  validate(schemas.disputeCreate),
  createDispute
);

router.get('/seller', listSellerDisputes);
router.patch(
  '/:id/seller-response',
  validate(schemas.idParam, 'params'),
  disputeUpload.array('sellerProofImages', 5),
  validate(schemas.disputeSellerResponse),
  respondSellerDispute
);

router.get('/admin', requireComplaintAccess, listAdminDisputes);
router.patch(
  '/admin/:id/decision',
  requireComplaintAccess,
  validate(schemas.idParam, 'params'),
  validate(schemas.disputeAdminDecision),
  resolveAdminDispute
);
router.post('/admin/deadline-check', requireComplaintAccess, runDisputeDeadlineChecks);

router.get('/:id', validate(schemas.idParam, 'params'), getDisputeDetails);

export default router;
