import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, schemas } from '../middlewares/validate.js';
import {
  registerDeviceToken,
  unregisterDeviceToken
} from '../controllers/deviceController.js';

const router = express.Router();

router.use(protect);

router.post('/register', validate(schemas.deviceTokenRegister), registerDeviceToken);
router.post('/unregister', validate(schemas.deviceTokenRemove), unregisterDeviceToken);

export default router;
