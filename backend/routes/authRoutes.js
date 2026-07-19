import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  login,
  register,
  googleProviderLogin,
  googleProviderRegister,
  appleProviderLogin,
  appleProviderRegister,
  googleProviderRegistrationProfile,
  appleProviderRegistrationProfile,
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
import { requireAuthProvider } from '../middlewares/authProviderAvailability.js';

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

router.post('/register', requireAuthProvider('auth_email_registration_enabled', 'La création de compte par email'), upload.single('shopLogo'), validate(schemas.register), register);
router.post('/register/send-code', authLimiter, requireAuthProvider('auth_email_registration_enabled', 'La création de compte par email'), validate(schemas.registerSendCode), sendRegisterCode);
router.post('/login', authLimiter, requireAuthProvider('auth_email_login_enabled', 'La connexion par mot de passe'), validate(schemas.login), login);
router.post('/provider/google', authLimiter, requireAuthProvider('auth_google_login_enabled', 'La connexion avec Google'), validate(schemas.googleProviderLogin), googleProviderLogin);
router.post('/provider/google/register', authLimiter, requireAuthProvider('auth_google_registration_enabled', 'La création de compte avec Google'), validate(schemas.googleProviderRegister), googleProviderRegister);
router.post('/provider/google/registration-profile', authLimiter, requireAuthProvider('auth_google_registration_enabled', 'La création de compte avec Google'), validate(schemas.googleProviderLogin), googleProviderRegistrationProfile);
router.post('/provider/apple', authLimiter, requireAuthProvider('auth_apple_login_enabled', 'La connexion avec Apple'), validate(schemas.appleProviderLogin), appleProviderLogin);
router.post('/provider/apple/register', authLimiter, requireAuthProvider('auth_apple_registration_enabled', 'La création de compte avec Apple'), validate(schemas.appleProviderRegister), appleProviderRegister);
router.post('/provider/apple/registration-profile', authLimiter, requireAuthProvider('auth_apple_registration_enabled', 'La création de compte avec Apple'), validate(schemas.appleProviderLogin), appleProviderRegistrationProfile);
router.post('/password/forgot', authLimiter, validate(schemas.passwordForgot), sendPasswordResetCode);
router.post('/password/reset', authLimiter, validate(schemas.passwordReset), resetPassword);
router.post('/password/forgot-link', authLimiter, validate(schemas.passwordForgotLink), requestPasswordResetLink);
router.post('/password/reset-token', authLimiter, validate(schemas.passwordResetToken), resetPasswordWithToken);
router.post('/logout', protect, logoutSession);

export default router;
