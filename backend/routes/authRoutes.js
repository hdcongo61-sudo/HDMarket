import express from 'express';
import {
  login,
  register,
  sendRegisterCode,
  sendPasswordResetCode,
  resetPassword,
  logoutSession,
  requestPasswordResetLink,
  resetPasswordWithToken
} from '../controllers/authController.js';
import { validate, schemas } from '../middlewares/validate.js';
import { protect } from '../middlewares/authMiddleware.js';
import { upload } from '../utils/upload.js';

const router = express.Router();

router.post('/register', upload.single('shopLogo'), validate(schemas.register), register);
router.post('/register/send-code', validate(schemas.registerSendCode), sendRegisterCode);
router.post('/login', validate(schemas.login), login);
router.post('/password/forgot', validate(schemas.passwordForgot), sendPasswordResetCode);
router.post('/password/reset', validate(schemas.passwordReset), resetPassword);
router.post('/password/forgot-link', validate(schemas.passwordForgotLink), requestPasswordResetLink);
router.post('/password/reset-token', validate(schemas.passwordResetToken), resetPasswordWithToken);
router.post('/logout', protect, logoutSession);

export default router;
