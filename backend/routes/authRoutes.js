import express from 'express';
import rateLimit from 'express-rate-limit';
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

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      message: 'Trop de tentatives. Réessayez dans 15 minutes.',
      code: 'RATE_LIMIT_ERROR'
    })
});

const router = express.Router();

router.post('/register', upload.single('shopLogo'), validate(schemas.register), register);
router.post('/register/send-code', authLimiter, validate(schemas.registerSendCode), sendRegisterCode);
router.post('/login', authLimiter, validate(schemas.login), login);
router.post('/password/forgot', authLimiter, validate(schemas.passwordForgot), sendPasswordResetCode);
router.post('/password/reset', authLimiter, validate(schemas.passwordReset), resetPassword);
router.post('/password/forgot-link', authLimiter, validate(schemas.passwordForgotLink), requestPasswordResetLink);
router.post('/password/reset-token', authLimiter, validate(schemas.passwordResetToken), resetPasswordWithToken);
router.post('/logout', protect, logoutSession);

export default router;
