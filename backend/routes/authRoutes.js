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
  sendRegisterPhoneCode,
  verifyRegisterPhoneCode,
  sendPasswordResetCode,
  resetPassword,
  sendPasswordResetPhoneCode,
  resetPasswordWithPhoneCode,
  logoutSession,
  requestPasswordResetLink,
  resetPasswordWithToken,
  requestAccountReactivation
} from '../controllers/authController.js';
import { validate, schemas } from '../middlewares/validate.js';
import { protect } from '../middlewares/authMiddleware.js';
import { upload } from '../utils/upload.js';
import { requireAuthProvider } from '../middlewares/authProviderAvailability.js';

// Stricter limiter for credential endpoints (login, register, provider auth,
// verification codes): shared mobile-carrier IPs make very low limits unsafe,
// so keep the default modest and let ops tune it via AUTH_RATE_LIMIT_MAX.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 20),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      message: 'Trop de tentatives. Réessayez dans 15 minutes.',
      code: 'RATE_LIMIT_ERROR'
    }),
  skip: (req) => process.env.NODE_ENV === 'development' && req.ip === '::1'
});

const router = express.Router();

router.post('/register', authLimiter, requireAuthProvider('auth_email_registration_enabled', 'La création de compte'), upload.single('shopLogo'), validate(schemas.register), register);
router.post('/register/send-code', authLimiter, requireAuthProvider('auth_email_registration_enabled', 'La création de compte'), validate(schemas.registerSendCode), sendRegisterCode);
router.post('/register/phone/send-code', authLimiter, requireAuthProvider('auth_email_registration_enabled', 'La création de compte'), validate(schemas.registerPhoneSendCode), sendRegisterPhoneCode);
router.post('/register/phone/verify-code', authLimiter, requireAuthProvider('auth_email_registration_enabled', 'La création de compte'), validate(schemas.registerPhoneVerifyCode), verifyRegisterPhoneCode);
router.post('/login', authLimiter, requireAuthProvider('auth_email_login_enabled', 'La connexion par mot de passe'), validate(schemas.login), login);
router.post('/reactivation-request', authLimiter, requestAccountReactivation);
router.post('/provider/google', authLimiter, requireAuthProvider('auth_google_login_enabled', 'La connexion avec Google'), validate(schemas.googleProviderLogin), googleProviderLogin);
router.post('/provider/google/register', authLimiter, requireAuthProvider('auth_google_registration_enabled', 'La création de compte avec Google'), validate(schemas.googleProviderRegister), googleProviderRegister);
router.post('/provider/google/registration-profile', authLimiter, requireAuthProvider('auth_google_registration_enabled', 'La création de compte avec Google'), validate(schemas.googleProviderLogin), googleProviderRegistrationProfile);
router.post('/provider/apple', authLimiter, requireAuthProvider('auth_apple_login_enabled', 'La connexion avec Apple'), validate(schemas.appleProviderLogin), appleProviderLogin);
router.post('/provider/apple/register', authLimiter, requireAuthProvider('auth_apple_registration_enabled', 'La création de compte avec Apple'), validate(schemas.appleProviderRegister), appleProviderRegister);
router.post('/provider/apple/registration-profile', authLimiter, requireAuthProvider('auth_apple_registration_enabled', 'La création de compte avec Apple'), validate(schemas.appleProviderLogin), appleProviderRegistrationProfile);
router.post('/password/forgot', authLimiter, validate(schemas.passwordForgot), sendPasswordResetCode);
router.post('/password/reset', authLimiter, validate(schemas.passwordReset), resetPassword);
router.post('/password/forgot-phone', authLimiter, validate(schemas.passwordForgotPhone), sendPasswordResetPhoneCode);
router.post('/password/reset-phone', authLimiter, validate(schemas.passwordResetPhone), resetPasswordWithPhoneCode);
router.post('/password/forgot-link', authLimiter, validate(schemas.passwordForgotLink), requestPasswordResetLink);
router.post('/password/reset-token', authLimiter, validate(schemas.passwordResetToken), resetPasswordWithToken);
router.post('/logout', protect, logoutSession);

export default router;
