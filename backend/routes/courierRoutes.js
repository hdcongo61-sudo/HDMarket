import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { deliveryProofUpload } from '../utils/deliveryProofUpload.js';
import {
  getDeliveryAgentMe,
  getDeliveryAgentStats,
  listCourierAssignments,
  getCourierAssignmentById,
  acceptCourierAssignment,
  rejectCourierAssignment,
  updateCourierAssignmentStage,
  uploadCourierProof,
  getCourierModeBootstrap,
  pingDeliveryAgentLocation,
  logDeliveryAgentLogout
} from '../controllers/courierDeliveryController.js';

const router = express.Router();

router.get('/bootstrap', protect, getCourierModeBootstrap);
router.get('/me', protect, getDeliveryAgentMe);
router.get('/stats', protect, getDeliveryAgentStats);
router.get(
  '/assignments',
  protect,
  validate(schemas.courierAssignmentsListQuery, 'query'),
  listCourierAssignments
);
router.get('/assignments/:id', protect, validate(schemas.idParam, 'params'), getCourierAssignmentById);
router.patch('/assignments/:id/accept', protect, validate(schemas.idParam, 'params'), acceptCourierAssignment);
router.patch(
  '/assignments/:id/reject',
  protect,
  validate(schemas.idParam, 'params'),
  validate(schemas.courierAssignmentReject),
  rejectCourierAssignment
);
router.patch(
  '/assignments/:id/stage',
  protect,
  validate(schemas.idParam, 'params'),
  validate(schemas.courierAssignmentStage),
  updateCourierAssignmentStage
);
router.post(
  '/assignments/:id/proof',
  protect,
  validate(schemas.idParam, 'params'),
  deliveryProofUpload.fields([
    { name: 'photos', maxCount: 3 },
    { name: 'signatureFile', maxCount: 1 }
  ]),
  validate(schemas.courierAssignmentProof),
  uploadCourierProof
);
router.post('/location/ping', protect, validate(schemas.deliveryLocationPing), pingDeliveryAgentLocation);
router.post('/logout-event', protect, logDeliveryAgentLogout);

export default router;
