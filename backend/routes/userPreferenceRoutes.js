import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import { updateUserPreferences } from '../controllers/settingsController.js';

const router = express.Router();

router.patch('/preferences', protect, validate(schemas.userPreferencesUpdate), updateUserPreferences);

export default router;
