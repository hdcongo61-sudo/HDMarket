import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { deliveryProofUpload } from '../utils/deliveryProofUpload.js';
import {
  listCourierParcelAssignments,
  getCourierParcelAssignmentById,
  acceptCourierParcelAssignment,
  rejectCourierParcelAssignment,
  updateCourierParcelStage,
  uploadCourierParcelProof,
  pingParcelAgentLocation
} from '../controllers/courierParcelController.js';

const router = express.Router();

router.get('/', protect, listCourierParcelAssignments);
router.get('/:id', protect, getCourierParcelAssignmentById);
router.patch('/:id/accept', protect, acceptCourierParcelAssignment);
router.patch('/:id/reject', protect, rejectCourierParcelAssignment);
router.patch('/:id/stage', protect, updateCourierParcelStage);
router.post(
  '/:id/proof',
  protect,
  deliveryProofUpload.fields([
    { name: 'photos', maxCount: 3 },
    { name: 'signatureFile', maxCount: 1 }
  ]),
  uploadCourierParcelProof
);
router.post('/location/ping', protect, pingParcelAgentLocation);

export default router;
