import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { requirePermission } from '../middlewares/roleMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { PERMISSIONS } from '../services/rbacService.js';
import {
  activateOnboardingSequence,
  createOnboardingSequence,
  deactivateOnboardingSequence,
  deleteOnboardingSequence,
  duplicateOnboardingSequence,
  getOnboardingSequence,
  getOnboardingSequenceAnalytics,
  listOnboardingSequences,
  updateOnboardingSequence
} from '../controllers/onboardingSequenceController.js';

const router = express.Router();

router.use(protect, requirePermission(PERMISSIONS.MANAGE_ONBOARDING));

router.get('/', listOnboardingSequences);
router.post('/', createOnboardingSequence);
router.get('/:id', validate(schemas.idParam, 'params'), getOnboardingSequence);
router.patch('/:id', validate(schemas.idParam, 'params'), updateOnboardingSequence);
router.delete('/:id', validate(schemas.idParam, 'params'), deleteOnboardingSequence);
router.post('/:id/activate', validate(schemas.idParam, 'params'), activateOnboardingSequence);
router.post('/:id/deactivate', validate(schemas.idParam, 'params'), deactivateOnboardingSequence);
router.post('/:id/duplicate', validate(schemas.idParam, 'params'), duplicateOnboardingSequence);
router.get('/:id/analytics', validate(schemas.idParam, 'params'), getOnboardingSequenceAnalytics);

export default router;
