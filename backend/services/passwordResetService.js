import User from '../models/userModel.js';
import { getRuntimeConfig } from './configService.js';
import { createAuditLogEntry } from './auditLogService.js';
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  sendPasswordResetLinkEmail
} from '../utils/passwordResetEmail.js';

const sanitizeMinutes = (value, fallback = 30) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(5, Math.min(120, Math.floor(parsed)));
};

export const getPasswordResetTtlMinutes = async () => {
  const configured = await getRuntimeConfig('password_reset_token_minutes', { fallback: 30 });
  return sanitizeMinutes(configured, 30);
};

const buildPasswordResetUrl = (token) => {
  const appUrl = process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  return `${appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
};

export const issuePasswordResetLinkForUser = async ({
  user,
  triggeredBy = 'user',
  performedBy = null,
  req = null,
  allowManualFallback = false
} = {}) => {
  if (!user?._id) return null;
  if (!user?.email || !String(user.email).trim()) {
    const error = new Error("Ce compte n'a pas d'adresse email utilisable pour la réinitialisation.");
    error.status = 400;
    throw error;
  }
  const ttlMinutes = await getPasswordResetTtlMinutes();
  const rawToken = generatePasswordResetToken();
  const hashedToken = hashPasswordResetToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = expiresAt;
  user.lastModifiedBy = performedBy || user._id;
  await user.save();

  let emailSent = true;
  let fallbackReason = '';
  try {
    await sendPasswordResetLinkEmail({
      email: user.email,
      token: rawToken,
      expiresMinutes: ttlMinutes,
      triggeredBy
    });
  } catch (error) {
    const status = Number(error?.status || 0);
    const shouldFallback = allowManualFallback && (status === 503 || status === 0);
    if (!shouldFallback) {
      throw error;
    }
    emailSent = false;
    fallbackReason =
      error?.message ||
      "Email n'est pas configuré. Le lien de réinitialisation doit être transmis manuellement.";
  }

  await createAuditLogEntry({
    performedBy: performedBy || user._id,
    targetUser: user._id,
    actionType: 'password_reset_link_sent',
    previousValue: null,
    newValue: { triggeredBy, expiresAt, emailSent },
    req,
    meta: {
      channel: emailSent ? 'email' : 'manual_link_fallback',
      fallbackReason: fallbackReason || undefined
    }
  });

  return {
    expiresAt,
    emailSent,
    resetUrl: emailSent ? null : buildPasswordResetUrl(rawToken),
    fallbackReason: fallbackReason || null
  };
};

export const consumePasswordResetToken = async ({ token, newPassword, req = null } = {}) => {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken || !newPassword) return null;
  const hashed = hashPasswordResetToken(normalizedToken);
  const user = await User.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: new Date() }
  });

  if (!user) return null;

  user.password = newPassword;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  user.phoneVerified = true;
  user.sessionsInvalidatedAt = new Date();
  user.lastModifiedBy = user._id;
  await user.save();

  await createAuditLogEntry({
    performedBy: user._id,
    targetUser: user._id,
    actionType: 'password_reset_completed',
    previousValue: null,
    newValue: { via: 'token_link' },
    req
  });

  return user;
};
