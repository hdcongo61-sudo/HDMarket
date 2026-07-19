import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/userModel.js';
import PhoneBlacklist from '../models/phoneBlacklistModel.js';
import { buildSession } from '../services/sessionFactory.js';
import { blacklistToken } from '../services/sessionSecurityService.js';
import {
  consumePasswordResetToken,
  issuePasswordResetLinkForUser
} from '../services/passwordResetService.js';
import {
  buildPhoneCandidates,
  checkVerificationCode,
  isEmailConfigured,
  isCongoBrazzavillePhone,
  normalizePhone,
  sendVerificationCode
} from '../utils/firebaseVerification.js';
import { getRuntimeConfig } from '../services/configService.js';
import { getFirebaseAdminAuth } from '../utils/firebaseAdmin.js';

const genToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

/**
 * Build the login/register response using the canonical session factory.
 * The only difference: we include the raw `token` string at top level.
 */
const buildAuthResponse = (user, token) => {
  const decoded = jwt.decode(token) || {};
  const session = buildSession(user, decoded, token);
  return session;
};

const toBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'oui', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'non', 'off', ''].includes(normalized)) return false;
  }
  return fallback;
};

const PROVIDER_CONFIG = Object.freeze({
  google: { firebaseId: 'google.com', label: 'Google' },
  apple: { firebaseId: 'apple.com', label: 'Apple' }
});

const verifyProviderCredential = async (idToken, providerName) => {
  const provider = PROVIDER_CONFIG[providerName];
  if (!provider) {
    const error = new Error('Unsupported authentication provider.');
    error.statusCode = 400;
    error.code = 'UNSUPPORTED_PROVIDER';
    throw error;
  }
  const firebaseAuth = getFirebaseAdminAuth();
  if (!firebaseAuth) {
    const error = new Error(`${provider.label} authentication is not configured.`);
    error.statusCode = 503;
    error.code = 'PROVIDER_NOT_CONFIGURED';
    throw error;
  }

  try {
    const decoded = await firebaseAuth.verifyIdToken(String(idToken || ''), true);
    if (decoded?.firebase?.sign_in_provider !== provider.firebaseId) {
      const error = new Error(`Invalid ${provider.label} credential.`);
      error.statusCode = 401;
      error.code = 'INVALID_PROVIDER_TOKEN';
      throw error;
    }
    if (!decoded.email || decoded.email_verified !== true) {
      const error = new Error(`A verified ${provider.label} email is required.`);
      error.statusCode = 401;
      error.code = 'PROVIDER_EMAIL_NOT_VERIFIED';
      throw error;
    }
    return decoded;
  } catch (error) {
    if (error.statusCode) throw error;
    const invalidError = new Error(`${provider.label} authentication could not be verified.`);
    invalidError.statusCode = 401;
    invalidError.code = 'INVALID_PROVIDER_TOKEN';
    throw invalidError;
  }
};

const assertUserCanSignIn = (user, res) => {
  if (user.isBlocked) {
    res.status(403).json({ message: 'Votre compte est suspendu.', code: 'ACCOUNT_BLOCKED' });
    return false;
  }
  if (!user.isActive) {
    res.status(403).json({ message: 'Votre compte est désactivé.', code: 'ACCOUNT_INACTIVE' });
    return false;
  }
  if (user.isLocked) {
    res.status(403).json({ message: 'Votre compte est verrouillé.', code: 'ACCOUNT_LOCKED' });
    return false;
  }
  return true;
};

const providerLogin = async (req, res, providerName) => {
  const decoded = await verifyProviderCredential(req.body?.idToken, providerName);
  const normalizedEmail = String(decoded.email).toLowerCase().trim();
  let user = await User.findOne({
    $or: [{ [`authProviders.${providerName}.uid`]: decoded.uid }, { email: normalizedEmail }]
  });

  if (!user) {
    return res.status(200).json({
      profileRequired: true,
      provider: providerName,
      profile: {
        name: String(decoded.name || '').trim(),
        email: normalizedEmail,
        picture: String(decoded.picture || '').trim()
      }
    });
  }

  if (!assertUserCanSignIn(user, res)) return;
  if (!user.get(`authProviders.${providerName}.uid`)) {
    user.set(`authProviders.${providerName}.uid`, decoded.uid);
    user.set(`authProviders.${providerName}.linkedAt`, new Date());
    if (!user.profileImage && decoded.picture) user.profileImage = decoded.picture;
    await user.save();
  }

  const token = genToken(user);
  return res.json(buildAuthResponse(user, token));
};

const providerRegister = async (req, res, providerName) => {
  const { idToken, phone, city, commune, address, gender, acceptedLegalTerms, legalVersion } = req.body || {};
  const decoded = await verifyProviderCredential(idToken, providerName);
  const normalizedEmail = String(decoded.email).toLowerCase().trim();
  const name = String(req.body?.name || decoded.name || '').trim();

  if (!name || !phone || !city || !address?.trim() || !gender || acceptedLegalTerms !== true || legalVersion !== '2026-07-18') {
    return res.status(400).json({ message: 'Missing fields', code: 'PROFILE_FIELDS_REQUIRED' });
  }
  const existingUser = await User.findOne({
    $or: [{ email: normalizedEmail }, { [`authProviders.${providerName}.uid`]: decoded.uid }]
  });
  if (existingUser) {
    return res.status(409).json({ message: 'Un compte existe déjà avec cet email.', code: 'ACCOUNT_EXISTS' });
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ message: 'Numéro de téléphone invalide.' });
  }
  const registrationPhoneCgOnly = toBoolean(
    await getRuntimeConfig('registration_phone_cg_only', { fallback: true }),
    true
  );
  if (registrationPhoneCgOnly && !isCongoBrazzavillePhone(normalizedPhone)) {
    return res.status(400).json({
      message: 'Inscription refusée: seuls les numéros de la République du Congo (+242) sont autorisés.',
      code: 'REGISTRATION_PHONE_COUNTRY_BLOCKED'
    });
  }
  if (await User.exists({ phone: { $in: buildPhoneCandidates(phone) } })) {
    return res.status(409).json({ message: 'Téléphone déjà utilisé', code: 'PHONE_ALREADY_USED' });
  }
  if (await PhoneBlacklist.exists({
    isActive: true,
    $or: [{ phoneNormalized: normalizedPhone }, { phoneVariants: { $in: buildPhoneCandidates(phone) } }]
  })) {
    return res.status(403).json({ message: 'Ce numéro est blacklisté.', code: 'PHONE_BLACKLISTED' });
  }

  const user = await User.create({
    name,
    email: normalizedEmail,
    password: crypto.randomBytes(32).toString('hex'),
    phone: normalizedPhone,
    phoneVerified: false,
    role: 'user',
    accountType: 'person',
    country: 'République du Congo',
    address: address.trim(),
    city,
    commune: String(commune || '').trim(),
    gender,
    profileImage: String(decoded.picture || '').trim(),
    authProviders: { [providerName]: { uid: decoded.uid, linkedAt: new Date() } },
    legalAcceptance: { accepted: true, termsVersion: legalVersion, privacyVersion: legalVersion, acceptedAt: new Date(), source: providerName }
  });
  const token = genToken(user);
  return res.status(201).json(buildAuthResponse(user, token));
};

const providerRegistrationProfile = async (req, res, providerName) => {
  const decoded = await verifyProviderCredential(req.body?.idToken, providerName);
  const normalizedEmail = String(decoded.email).toLowerCase().trim();
  const existingUser = await User.exists({
    $or: [{ [`authProviders.${providerName}.uid`]: decoded.uid }, { email: normalizedEmail }]
  });
  if (existingUser) {
    return res.status(409).json({
      message: 'Un compte existe déjà avec cet email. Utilisez la page de connexion.',
      code: 'ACCOUNT_EXISTS'
    });
  }
  return res.json({
    profileRequired: true,
    provider: providerName,
    profile: {
      name: String(decoded.name || '').trim(),
      email: normalizedEmail,
      picture: String(decoded.picture || '').trim()
    }
  });
};

export const googleProviderLogin = asyncHandler((req, res) => providerLogin(req, res, 'google'));
export const googleProviderRegister = asyncHandler((req, res) => providerRegister(req, res, 'google'));
export const appleProviderLogin = asyncHandler((req, res) => providerLogin(req, res, 'apple'));
export const appleProviderRegister = asyncHandler((req, res) => providerRegister(req, res, 'apple'));
export const googleProviderRegistrationProfile = asyncHandler((req, res) => providerRegistrationProfile(req, res, 'google'));
export const appleProviderRegistrationProfile = asyncHandler((req, res) => providerRegistrationProfile(req, res, 'apple'));

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
    verificationCode,
    acceptedLegalTerms,
    legalVersion
  } = req.body;
  if (!name || !email || !password || !phone || !city || !gender || !address?.trim() || acceptedLegalTerms !== true || legalVersion !== '2026-07-18') {
    return res.status(400).json({ message: 'Missing fields' });
  }
  // Skip email verification only when email is not configured (local dev without SMTP)
  const skipEmailVerification = !isEmailConfigured();
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
  const registrationPhoneCgOnlyRaw = await getRuntimeConfig('registration_phone_cg_only', {
    fallback: true
  });
  const registrationPhoneCgOnly = toBoolean(registrationPhoneCgOnlyRaw, true);
  if (registrationPhoneCgOnly && !isCongoBrazzavillePhone(normalizedPhone)) {
    return res.status(400).json({
      message:
        "Inscription refusée: seuls les numéros de la République du Congo (+242) sont autorisés.",
      code: 'REGISTRATION_PHONE_COUNTRY_BLOCKED'
    });
  }
  const phoneCandidates = buildPhoneCandidates(trimmedPhone);
  const phoneTaken = await User.findOne({ phone: { $in: phoneCandidates } });
  if (phoneTaken) return res.status(400).json({ message: 'Téléphone déjà utilisé' });
  const blacklistedPhone = await PhoneBlacklist.findOne({
    isActive: true,
    $or: [{ phoneNormalized: normalizedPhone }, { phoneVariants: { $in: phoneCandidates } }]
  })
    .select('_id')
    .lean();
  if (blacklistedPhone) {
    return res.status(403).json({
      message: "Ce numéro est blacklisté et ne peut plus créer de compte.",
      code: 'PHONE_BLACKLISTED'
    });
  }

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
    gender,
    legalAcceptance: { accepted: true, termsVersion: legalVersion, privacyVersion: legalVersion, acceptedAt: new Date(), source: 'email' }
  });
  const token = genToken(user);
  res.status(201).json(buildAuthResponse(user, token));
});

export const login = asyncHandler(async (req, res) => {
  const { phone, email, identifier, password } = req.body;
  const rawIdentifier = String(identifier || email || phone || '').trim();

  if (!rawIdentifier) {
    return res.status(400).json({
      message: 'Adresse email ou numéro de téléphone manquant.',
      code: 'IDENTIFIER_REQUIRED'
    });
  }
  const isEmailIdentifier = rawIdentifier.includes('@');
  const user = isEmailIdentifier
    ? await User.findOne({ email: rawIdentifier.toLowerCase() })
    : await User.findOne({ phone: { $in: buildPhoneCandidates(rawIdentifier) } });
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({
      message:
        "L’adresse email, le numéro de téléphone ou le mot de passe est incorrect, ou ce compte n’existe pas.",
      code: 'INVALID_CREDENTIALS'
    });
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
  if (!user) {
    return res.status(404).json({ message: 'Compte introuvable.' });
  }
  
  const verificationCheck = await checkVerificationCode(normalizedEmail, verificationCode, 'password_reset');
  if (verificationCheck?.status !== 'approved') {
    return res.status(400).json({
      message: verificationCheck?.message || 'Code de vérification invalide.'
    });
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
