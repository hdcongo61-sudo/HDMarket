import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requireAnyPermission } from '../middlewares/roleMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { deliveryProofUpload } from '../utils/deliveryProofUpload.js';
import {
  getCourierModeBootstrap,
  listCourierAssignments,
  getCourierAssignmentById,
  acceptCourierAssignment,
  rejectCourierAssignment,
  updateCourierAssignmentStage,
  uploadCourierProof,
  getDeliveryAgentMe,
  getDeliveryAgentStats,
  pingDeliveryAgentLocation,
  logDeliveryAgentLogout
} from '../controllers/courierDeliveryController.js';

const router = express.Router();
const requireCourierAccess = requireAnyPermission([
  'courier_view_assignments',
  'courier_accept_assignment',
  'courier_update_status',
  'courier_upload_proof'
]);

const forceStage =
  (stage) =>
  (req, _res, next) => {
    req.body = { ...(req.body || {}), stage };
    next();
  };

router.get('/bootstrap', protect, requireCourierAccess, getCourierModeBootstrap);
router.get('/me', protect, requireCourierAccess, getDeliveryAgentMe);
router.get('/stats', protect, requireCourierAccess, getDeliveryAgentStats);
router.get(
  '/jobs',
  protect,
  requireCourierAccess,
  validate(schemas.courierAssignmentsListQuery, 'query'),
  listCourierAssignments
);
router.get('/jobs/:id', protect, requireCourierAccess, validate(schemas.idParam, 'params'), getCourierAssignmentById);
router.patch('/jobs/:id/accept', protect, requireCourierAccess, validate(schemas.idParam, 'params'), acceptCourierAssignment);
router.patch(
  '/jobs/:id/reject',
  protect,
  requireCourierAccess,
  validate(schemas.idParam, 'params'),
  validate(schemas.courierAssignmentReject),
  rejectCourierAssignment
);
router.patch(
  '/jobs/:id/pickup',
  protect,
  requireCourierAccess,
  validate(schemas.idParam, 'params'),
  forceStage('PICKED_UP'),
  validate(schemas.courierAssignmentStage),
  updateCourierAssignmentStage
);
router.patch(
  '/jobs/:id/in-transit',
  protect,
  requireCourierAccess,
  validate(schemas.idParam, 'params'),
  forceStage('IN_TRANSIT'),
  validate(schemas.courierAssignmentStage),
  updateCourierAssignmentStage
);
router.patch(
  '/jobs/:id/delivered',
  protect,
  requireCourierAccess,
  validate(schemas.idParam, 'params'),
  forceStage('DELIVERED'),
  validate(schemas.courierAssignmentStage),
  updateCourierAssignmentStage
);
router.patch(
  '/jobs/:id/failed',
  protect,
  requireCourierAccess,
  validate(schemas.idParam, 'params'),
  forceStage('FAILED'),
  validate(schemas.courierAssignmentStage),
  updateCourierAssignmentStage
);
router.patch(
  '/jobs/:id/stage',
  protect,
  requireCourierAccess,
  validate(schemas.idParam, 'params'),
  validate(schemas.courierAssignmentStage),
  updateCourierAssignmentStage
);
router.post(
  '/jobs/:id/proof',
  protect,
  requireCourierAccess,
  validate(schemas.idParam, 'params'),
  deliveryProofUpload.fields([
    { name: 'photos', maxCount: 3 },
    { name: 'signatureFile', maxCount: 1 }
  ]),
  validate(schemas.courierAssignmentProof),
  uploadCourierProof
);
router.post('/location/ping', protect, requireCourierAccess, validate(schemas.deliveryLocationPing), pingDeliveryAgentLocation);
router.post('/logout-event', protect, requireCourierAccess, logDeliveryAgentLogout);

export default router;
