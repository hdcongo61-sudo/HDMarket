import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { sanitizeShopHours } from '../utils/shopHours.js';
import { resolvePermissionsForUser } from '../services/rbacService.js';
import { blacklistToken } from '../services/sessionSecurityService.js';
import {
  consumePasswordResetToken,
  issuePasswordResetLinkForUser
} from '../services/passwordResetService.js';
import {
  buildPhoneCandidates,
  checkVerificationCode,
  isEmailConfigured,
  normalizePhone,
  sendVerificationCode
} from '../utils/firebaseVerification.js';

const genToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

const buildAuthResponse = (user, token) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  phoneVerified: Boolean(user.phoneVerified),
  role: user.role,
  permissions: resolvePermissionsForUser(user),
  accountType: user.accountType,
  shopVerified: Boolean(user.shopVerified),
  shopName: user.shopName || null,
  shopAddress: user.shopAddress || null,
  shopLogo: user.shopLogo || null,
  followersCount: Number(user.followersCount || 0),
  followingShops: Array.isArray(user.followingShops) ? user.followingShops : [],
  canReadFeedback: Boolean(user.canReadFeedback),
  canVerifyPayments: Boolean(user.canVerifyPayments),
  canManageBoosts: Boolean(user.canManageBoosts),
  canManageComplaints: Boolean(user.canManageComplaints),
  canManageProducts: Boolean(user.canManageProducts),
  canManageDelivery: Boolean(user.canManageDelivery),
  canManageChatTemplates: Boolean(user.canManageChatTemplates),
  canManageHelpCenter: Boolean(user.canManageHelpCenter),
  country: user.country,
  address: user.address || '',
  city: user.city,
  commune: user.commune || '',
  preferredLanguage: user.preferredLanguage || 'fr',
  preferredCurrency: user.preferredCurrency || 'XAF',
  preferredCity: user.preferredCity || user.city || '',
  theme: user.theme || 'system',
  gender: user.gender,
  shopDescription: user.shopDescription || '',
  shopHours: sanitizeShopHours(user.shopHours || []),
  token
});

export const register = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    role,
    city,
    commune,
    address,
    gender,
    verificationCode
  } = req.body;
  if (!name || !email || !password || !phone || !city || !gender || !address?.trim()) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  // Skip email verification when: production (testing) OR email not configured (local dev without SMTP)
  const isProduction = process.env.NODE_ENV === 'production';
  const skipEmailVerification = isProduction || !isEmailConfigured();
  if (!skipEmailVerification) {
    if (!verificationCode) {
      return res.status(400).json({ message: 'Code de vérification manquant.' });
    }
  }

  // Validate email
  if (!email || !email.trim()) {
    return res.status(400).json({ message: 'Adresse email manquante.' });
  }
  const normalizedEmail = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Adresse email invalide.' });
  }

  // Check if email already exists
  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) return res.status(400).json({ message: 'Email already used' });

  // Validate phone
  const trimmedPhone =
    typeof phone === 'string'
      ? phone.trim()
      : phone !== null && phone !== undefined
      ? String(phone).trim()
      : '';
  if (!trimmedPhone) {
    return res.status(400).json({ message: 'Numéro de téléphone manquant.' });
  }
  const normalizedPhone = normalizePhone(trimmedPhone);
  if (!normalizedPhone) {
    return res.status(400).json({ message: 'Numéro de téléphone invalide.' });
  }
  const phoneCandidates = buildPhoneCandidates(trimmedPhone);
  const phoneTaken = await User.findOne({ phone: { $in: phoneCandidates } });
  if (phoneTaken) return res.status(400).json({ message: 'Téléphone déjà utilisé' });

  // Verify code using email (skipped in production or when email not configured)
  const normalizedRole = role === 'admin' ? 'admin' : role === 'manager' ? 'manager' : 'user';
  if (!skipEmailVerification) {
    const verificationCheck = await checkVerificationCode(normalizedEmail, verificationCode, 'registration');
    if (verificationCheck?.status !== 'approved') {
      return res.status(400).json({
        message: verificationCheck?.message || 'Code de vérification invalide.'
      });
    }
  }

  const user = await User.create({
    name,
    email: normalizedEmail,
    password,
    phone: normalizedPhone,
    phoneVerified: true,
    role: normalizedRole,
    accountType: 'person',
    country: 'République du Congo',
    address: address.trim(),
    city,
    commune: String(commune || '').trim(),
    gender
  });
  const token = genToken(user);
  res.status(201).json(buildAuthResponse(user, token));
});

export const login = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;
  const normalizedPhone = phone?.trim();

  if (!normalizedPhone) {
    return res.status(400).json({ message: 'Numéro de téléphone manquant' });
  }
  const phoneCandidates = buildPhoneCandidates(normalizedPhone);
  const user = await User.findOne({ phone: { $in: phoneCandidates } });
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Numéro de téléphone ou mot de passe incorrect.' });
  }
  if (user.isBlocked) {
    const reason = user.blockedReason ? ` Motif : ${user.blockedReason}` : '';
    return res.status(403).json({
      message: `Votre compte est suspendu. Contactez l'administrateur pour plus d'informations.${reason}`,
      reason: user.blockedReason || '',
      code: 'ACCOUNT_BLOCKED'
    });
  }
  if (!user.isActive) {
    return res.status(403).json({
      message: 'Votre compte est désactivé. Contactez le support.',
      code: 'ACCOUNT_INACTIVE'
    });
  }
  if (user.isLocked) {
    const reason = user.lockReason ? ` Motif : ${user.lockReason}` : '';
    return res.status(403).json({
      message: `Votre compte est verrouillé.${reason}`,
      reason: user.lockReason || '',
      code: 'ACCOUNT_LOCKED'
    });
  }
  const token = genToken(user);
  res.json(buildAuthResponse(user, token));
});

export const sendRegisterCode = asyncHandler(async (req, res) => {
  const { email } = req.body;
  // In production: skip sending verification email for registration
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Adresse email manquante.' });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Adresse email invalide.' });
    }
    const emailTaken = await User.findOne({ email: normalizedEmail });
    if (emailTaken) {
      return res.status(400).json({ message: 'Email déjà utilisé' });
    }
    return res.json({ message: 'Inscription possible sans code en production.' });
  }

  if (!isEmailConfigured()) {
    return res.status(503).json({
      message: "Email n'est pas configuré. Définissez EMAIL_USER et EMAIL_PASSWORD."
    });
  }

  if (!email || !email.trim()) {
    return res.status(400).json({ message: 'Adresse email manquante.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Adresse email invalide.' });
  }

  // Check if email already exists
  const emailTaken = await User.findOne({ email: normalizedEmail });
  if (emailTaken) {
    return res.status(400).json({ message: 'Email déjà utilisé' });
  }

  await sendVerificationCode(normalizedEmail, 'registration');
  res.json({ message: 'Code de vérification envoyé par email.' });
});

export const sendPasswordResetCode = asyncHandler(async (req, res) => {
  const { email, phone } = req.body || {};
  let normalizedEmail = String(email || '').toLowerCase().trim();
  if (!normalizedEmail && phone) {
    const phoneCandidates = buildPhoneCandidates(phone);
    const byPhone = await User.findOne({ phone: { $in: phoneCandidates } }).select('email');
    normalizedEmail = String(byPhone?.email || '').toLowerCase().trim();
  }
  // In production: skip sending verification email to facilitate testing
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    if (normalizedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ message: 'Adresse email invalide.' });
      }
    }
    return res.json({ message: 'En production, utilisez directement le formulaire de réinitialisation avec un code quelconque pour tester.' });
  }

  if (!isEmailConfigured()) {
    return res.status(503).json({
      message: "Email n'est pas configuré. Définissez EMAIL_USER et EMAIL_PASSWORD."
    });
  }
  
  if (!normalizedEmail) {
    return res.status(400).json({ message: 'Adresse email manquante.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Adresse email invalide.' });
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (user) {
    await sendVerificationCode(normalizedEmail, 'password_reset');
  }
  res.json({ message: 'Si un compte existe, un code a été envoyé par email.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, phone, verificationCode, newPassword } = req.body || {};
  let normalizedEmail = String(email || '').toLowerCase().trim();
  if (!normalizedEmail && phone) {
    const phoneCandidates = buildPhoneCandidates(phone);
    const byPhone = await User.findOne({ phone: { $in: phoneCandidates } }).select('email');
    normalizedEmail = String(byPhone?.email || '').toLowerCase().trim();
  }
  // In production: skip email verification check to facilitate testing
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction && !isEmailConfigured()) {
    return res.status(503).json({
      message: "Email n'est pas configuré. Définissez EMAIL_USER et EMAIL_PASSWORD."
    });
  }
  
  if (!normalizedEmail) {
    return res.status(400).json({ message: 'Adresse email manquante.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Adresse email invalide.' });
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return res.status(404).json({ message: 'Compte introuvable.' });
  }
  
  // In production: skip verification code check to facilitate testing
  if (!isProduction) {
    const verificationCheck = await checkVerificationCode(normalizedEmail, verificationCode, 'password_reset');
    if (verificationCheck?.status !== 'approved') {
      return res.status(400).json({ 
        message: verificationCheck?.message || 'Code de vérification invalide.' 
      });
    }
  }
  
  user.password = newPassword;
  user.phoneVerified = true; // Keep for backward compatibility
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  user.sessionsInvalidatedAt = new Date();
  await user.save();
  res.json({ message: 'Mot de passe mis à jour.' });
});

export const requestPasswordResetLink = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!email || !String(email).trim()) {
    return res.status(400).json({ message: 'Adresse email manquante.' });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Adresse email invalide.' });
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (user) {
    try {
      await issuePasswordResetLinkForUser({
        user,
        triggeredBy: 'user',
        performedBy: user._id,
        req
      });
    } catch (error) {
      if (error?.status) {
        return res.status(error.status).json({ message: error.message });
      }
      throw error;
    }
  }
  res.json({ message: 'Si un compte existe, un lien de réinitialisation a été envoyé.' });
});

export const resetPasswordWithToken = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !String(token).trim()) {
    return res.status(400).json({ message: 'Token manquant.' });
  }
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }

  const updatedUser = await consumePasswordResetToken({ token, newPassword, req });
  if (!updatedUser) {
    return res.status(400).json({ message: 'Token invalide ou expiré.' });
  }
  res.json({ message: 'Mot de passe réinitialisé avec succès.' });
});

export const logoutSession = asyncHandler(async (req, res) => {
  const token = String(req.authToken || '').trim();
  if (!token) {
    return res.status(400).json({ message: 'Token de session manquant.' });
  }
  await blacklistToken(token, {
    exp: req.authDecoded?.exp,
    reason: 'user_logout'
  });
  res.json({ success: true });
});
