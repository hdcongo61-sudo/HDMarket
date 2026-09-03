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
import {
  checkPhoneVerificationCode,
  hasRecentlyVerifiedPhone,
  isPhoneOtpConfigured,
  sendPhoneVerificationCode
} from '../utils/phoneVerification.js';
import { getRuntimeConfig } from '../services/configService.js';
import { getFirebaseAdminAuth } from '../utils/firebaseAdmin.js';
import { resolveReferrerForRegistration } from '../services/referralService.js';
import {
  createNotification,
  createValidationTaskNotification
} from '../utils/notificationService.js';
import { resolveCanonicalLocation } from '../services/locationSelectionService.js';
import { resolveCountryContext } from '../services/countryService.js';
import { capitalizeName } from '../utils/nameFormatting.js';
import { enrollUserIfEligible } from '../services/onboardingService.js';

// Session tokens are deliberately short-lived by default. The `rememberMe`
// flag ("Rester connecté") selects the longer expiry; ops can tune both via
// JWT_EXPIRES_IN / JWT_REMEMBER_EXPIRES_IN (jsonwebtoken duration strings).
const genToken = (user, { rememberMe = true } = {}) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: rememberMe
      ? process.env.JWT_REMEMBER_EXPIRES_IN || '7d'
      : process.env.JWT_EXPIRES_IN || '12h'
  });

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
  const { idToken, phone, city, commune, cityId, communeId, address, gender, acceptedLegalTerms, legalVersion, referralCode } = req.body || {};
  const decoded = await verifyProviderCredential(idToken, providerName);
  const normalizedEmail = String(decoded.email).toLowerCase().trim();
  const name = capitalizeName(req.body?.name || decoded.name || '');

  if (!name || !phone || !city || !address?.trim() || !gender || acceptedLegalTerms !== true || legalVersion !== '2026-07-18') {
    return res.status(400).json({ message: 'Missing fields', code: 'PROFILE_FIELDS_REQUIRED' });
  }
  const existingUser = await User.findOne({
    $or: [{ email: normalizedEmail }, { [`authProviders.${providerName}.uid`]: decoded.uid }]
  });
  if (existingUser) {
    return res.status(409).json({ message: 'Un compte existe déjà avec cet email.', code: 'ACCOUNT_EXISTS' });
  }

  const countryContext = await resolveCountryContext({
    requestedCountry: req.body?.countryId || req.body?.countryCode || null,
    user: null
  });
  const normalizedPhone = normalizePhone(phone, countryContext.country.phoneCode);
  if (!normalizedPhone) {
    return res.status(400).json({ message: 'Numéro de téléphone invalide.' });
  }
  const registrationPhoneCgOnly = toBoolean(
    await getRuntimeConfig('registration_phone_cg_only', { fallback: true }),
    true
  );
  if (countryContext.country.code === 'CG' && registrationPhoneCgOnly && !isCongoBrazzavillePhone(normalizedPhone)) {
    return res.status(400).json({
      message: 'Inscription refusée: seuls les numéros de la République du Congo (+242) sont autorisés.',
      code: 'REGISTRATION_PHONE_COUNTRY_BLOCKED'
    });
  }
  if (!normalizedPhone.startsWith(countryContext.country.phoneCode)) {
    return res.status(400).json({ message: `Le numéro doit correspondre à l'indicatif ${countryContext.country.phoneCode}.`, code: 'PHONE_COUNTRY_MISMATCH' });
  }
  if (await User.exists({ phone: { $in: buildPhoneCandidates(phone, countryContext.country.phoneCode) } })) {
    return res.status(409).json({ message: 'Téléphone déjà utilisé', code: 'PHONE_ALREADY_USED' });
  }
  if (await PhoneBlacklist.exists({
    isActive: true,
    $or: [{ phoneNormalized: normalizedPhone }, { phoneVariants: { $in: buildPhoneCandidates(phone, countryContext.country.phoneCode) } }]
  })) {
    return res.status(403).json({ message: 'Ce numéro est blacklisté.', code: 'PHONE_BLACKLISTED' });
  }

  const referrer = await resolveReferrerForRegistration({ referralCode, newUserPhone: normalizedPhone });
  const location = await resolveCanonicalLocation({
    cityId,
    communeId,
    cityName: city,
    communeName: commune,
    countryId: countryContext.countryId,
    allowLegacyCountryFallback: countryContext.country.code === 'CG'
  });

  const user = await User.create({
    name,
    email: normalizedEmail,
    password: crypto.randomBytes(32).toString('hex'),
    phone: normalizedPhone,
    phoneVerified: false,
    role: 'user',
    accountType: 'person',
    country: countryContext.country.officialName,
    countryId: countryContext.countryId,
    selectedCountryId: countryContext.countryId,
    preferredCurrency: countryContext.country.currency.code,
    address: address.trim(),
    cityId: location.cityId,
    communeId: location.communeId,
    city: location.cityName,
    commune: location.communeName,
    gender,
    referredBy: referrer?._id || null,
    profileImage: String(decoded.picture || '').trim(),
    authProviders: { [providerName]: { uid: decoded.uid, linkedAt: new Date() } },
    legalAcceptance: { accepted: true, termsVersion: legalVersion, privacyVersion: legalVersion, acceptedAt: new Date(), source: providerName }
  });
  if (referrer) {
    createNotification({
      userId: referrer._id,
      actorId: user._id,
      type: 'referral_joined',
      allowSelf: false,
      priority: 'LOW',
      pushEnabled: true,
      metadata: {
        title: 'Un filleul a rejoint HDMarket',
        message: `${name} s’est inscrit avec votre code de parrainage. La récompense arrive après sa première commande livrée.`
      },
      entityType: 'user',
      entityId: String(user._id),
      deepLink: '/referrals',
      actionLink: '/referrals'
    }).catch(() => {});
  }
  // Fire-and-forget — the onboarding system must never block or fail
  // registration (see services/onboardingService.js). Existing users are
  // never touched here; this only ever runs at account creation.
  enrollUserIfEligible(user).catch((error) => {
    console.error('Onboarding enrollment failed', error);
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
    cityId,
    communeId,
    address,
    gender,
    acceptedLegalTerms,
    legalVersion,
    referralCode
  } = req.body;
  if (!name || !password || !phone || !city || !gender || !address?.trim() || acceptedLegalTerms !== true || legalVersion !== '2026-07-18') {
    return res.status(400).json({ message: 'Missing fields' });
  }
  // Enforce the same minimum as the frontend strength meter — the API must not
  // accept weaker passwords even if the form is bypassed (API clients).
  if (typeof password !== 'string' || String(password).length < 8) {
    return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }
  const normalizedName = capitalizeName(name);

  // Email is optional — phone-first registration. When provided, it must
  // still be well-formed and unique; when omitted, the account is created
  // with email: null and can be added later from the profile.
  const trimmedEmail = typeof email === 'string' ? email.trim() : '';
  let normalizedEmail = null;
  if (trimmedEmail) {
    normalizedEmail = trimmedEmail.toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Adresse email invalide.' });
    }
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ message: 'Email already used' });
  }

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
  const countryContext = await resolveCountryContext({
    requestedCountry: req.body?.countryId || req.body?.countryCode || null,
    user: null
  });
  const normalizedPhone = normalizePhone(trimmedPhone, countryContext.country.phoneCode);
  if (!normalizedPhone) {
    return res.status(400).json({ message: 'Numéro de téléphone invalide.' });
  }
  const registrationPhoneCgOnlyRaw = await getRuntimeConfig('registration_phone_cg_only', {
    fallback: true
  });
  const registrationPhoneCgOnly = toBoolean(registrationPhoneCgOnlyRaw, true);
  if (countryContext.country.code === 'CG' && registrationPhoneCgOnly && !isCongoBrazzavillePhone(normalizedPhone)) {
    return res.status(400).json({
      message:
        "Inscription refusée: seuls les numéros de la République du Congo (+242) sont autorisés.",
      code: 'REGISTRATION_PHONE_COUNTRY_BLOCKED'
    });
  }
  if (!normalizedPhone.startsWith(countryContext.country.phoneCode)) {
    return res.status(400).json({ message: `Le numéro doit correspondre à l'indicatif ${countryContext.country.phoneCode}.`, code: 'PHONE_COUNTRY_MISMATCH' });
  }
  const phoneCandidates = buildPhoneCandidates(trimmedPhone, countryContext.country.phoneCode);
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

  // Phone verification is mandatory by default, but admins can turn it off
  // temporarily (e.g. SMS provider down or too costly) via runtime config —
  // same bypass semantics as the local-dev case: account is created with an
  // unverified phone rather than blocking registration outright.
  const smsVerificationRequired = toBoolean(
    await getRuntimeConfig('registration_sms_verification_required', { fallback: true }),
    true
  );
  const skipPhoneVerification = !smsVerificationRequired || !isPhoneOtpConfigured();
  const phoneVerified = !skipPhoneVerification;
  if (!skipPhoneVerification) {
    const recentlyVerified = await hasRecentlyVerifiedPhone(normalizedPhone, 'registration');
    if (!recentlyVerified) {
      return res.status(400).json({
        message: 'Veuillez vérifier votre numéro de téléphone avec le code reçu par SMS.',
        code: 'PHONE_NOT_VERIFIED'
      });
    }
  }

  const referrer = await resolveReferrerForRegistration({ referralCode, newUserPhone: normalizedPhone });
  const location = await resolveCanonicalLocation({
    cityId,
    communeId,
    cityName: city,
    communeName: commune,
    countryId: countryContext.countryId,
    allowLegacyCountryFallback: countryContext.country.code === 'CG'
  });

  const user = await User.create({
    name: normalizedName,
    email: normalizedEmail,
    password,
    phone: normalizedPhone,
    phoneVerified,
    role: normalizedRole,
    accountType: 'person',
    country: countryContext.country.officialName,
    countryId: countryContext.countryId,
    selectedCountryId: countryContext.countryId,
    preferredCurrency: countryContext.country.currency.code,
    address: address.trim(),
    cityId: location.cityId,
    communeId: location.communeId,
    city: location.cityName,
    commune: location.communeName,
    gender,
    referredBy: referrer?._id || null,
    legalAcceptance: { accepted: true, termsVersion: legalVersion, privacyVersion: legalVersion, acceptedAt: new Date(), source: 'phone' }
  });
  if (referrer) {
    createNotification({
      userId: referrer._id,
      actorId: user._id,
      type: 'referral_joined',
      allowSelf: false,
      priority: 'LOW',
      pushEnabled: true,
      metadata: {
        title: 'Un filleul a rejoint HDMarket',
        message: `${name} s’est inscrit avec votre code de parrainage. La récompense arrive après sa première commande livrée.`
      },
      entityType: 'user',
      entityId: String(user._id),
      deepLink: '/referrals',
      actionLink: '/referrals'
    }).catch(() => {});
  }
  // Fire-and-forget — the onboarding system must never block or fail
  // registration (see services/onboardingService.js). Existing users are
  // never touched here; this only ever runs at account creation.
  enrollUserIfEligible(user).catch((error) => {
    console.error('Onboarding enrollment failed', error);
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
  const loginCountry = !isEmailIdentifier
    ? await resolveCountryContext({ requestedCountry: req.body?.countryId || req.body?.countryCode || null, user: null })
    : null;
  const user = isEmailIdentifier
    ? await User.findOne({ email: rawIdentifier.toLowerCase() })
    : await User.findOne({ phone: { $in: buildPhoneCandidates(rawIdentifier, loginCountry.country.phoneCode) } });

  // Temporary brute-force cooldown — checked before the password itself so a
  // locked-out attacker learns nothing about whether their guess was right.
  if (user?.loginLockedUntil && user.loginLockedUntil > new Date()) {
    const minutesLeft = Math.max(1, Math.ceil((user.loginLockedUntil.getTime() - Date.now()) / 60000));
    return res.status(429).json({
      message: `Trop de tentatives échouées. Réessayez dans ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`,
      code: 'ACCOUNT_TEMPORARILY_LOCKED',
      retryAfterMinutes: minutesLeft
    });
  }

  const passwordValid = user ? await user.matchPassword(password) : false;
  if (!user || !passwordValid) {
    if (user) {
      const maxAttempts = Math.max(
        3,
        Number(await getRuntimeConfig('max_login_attempts', { fallback: 10 })) || 10
      );
      const lockoutMinutes = Math.max(
        1,
        Number(await getRuntimeConfig('login_lockout_minutes', { fallback: 15 })) || 15
      );
      user.failedLoginAttempts = Number(user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= maxAttempts) {
        user.loginLockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
        user.failedLoginAttempts = 0;
      }
      await user.save();
    }
    return res.status(401).json({
      message:
        "L’adresse email, le numéro de téléphone ou le mot de passe est incorrect, ou ce compte n’existe pas.",
      code: 'INVALID_CREDENTIALS'
    });
  }

  // A correct password clears any accumulated failed-attempt count.
  if (Number(user.failedLoginAttempts || 0) > 0 || user.loginLockedUntil) {
    user.failedLoginAttempts = 0;
    user.loginLockedUntil = null;
    await user.save();
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
  const token = genToken(user, { rememberMe: req.body?.rememberMe !== false });
  res.json(buildAuthResponse(user, token));
});

export const requestAccountReactivation = asyncHandler(async (req, res) => {
  const rawIdentifier = String(
    req.body?.identifier || req.body?.email || req.body?.phone || ''
  ).trim();
  const password = String(req.body?.password || '');
  const message = String(req.body?.message || '').trim().slice(0, 500);
  if (!rawIdentifier || !password) {
    return res.status(400).json({
      code: 'REACTIVATION_CREDENTIALS_REQUIRED',
      message: 'Votre identifiant et votre mot de passe sont requis.'
    });
  }

  const isEmailIdentifier = rawIdentifier.includes('@');
  const user = isEmailIdentifier
    ? await User.findOne({ email: rawIdentifier.toLowerCase() })
    : await User.findOne({ phone: { $in: buildPhoneCandidates(rawIdentifier) } });
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({
      code: 'INVALID_CREDENTIALS',
      message: 'Identifiant ou mot de passe incorrect.'
    });
  }
  if (user.isActive) {
    return res.status(409).json({
      code: 'ACCOUNT_ALREADY_ACTIVE',
      message: 'Ce compte est déjà actif. Vous pouvez vous connecter.'
    });
  }
  if (user.deactivationSource !== 'self') {
    return res.status(403).json({
      code: 'REACTIVATION_NOT_SELF_SERVICE',
      message: 'Ce compte ne peut pas être réactivé par cette procédure. Contactez le support.'
    });
  }
  if (user.reactivationRequest?.status === 'pending') {
    return res.json({
      success: true,
      alreadyPending: true,
      code: 'REACTIVATION_ALREADY_PENDING',
      message: 'Votre demande est déjà en attente de traitement.'
    });
  }

  user.reactivationRequest = {
    status: 'pending',
    message,
    requestedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: ''
  };
  await user.save();

  try {
    const reviewers = await User.find({
      role: { $in: ['admin', 'founder'] },
      isActive: true,
      isBlocked: { $ne: true },
      isLocked: { $ne: true }
    })
      .select('_id')
      .lean();
    await createValidationTaskNotification({
      recipients: reviewers.map((reviewer) => reviewer._id),
      actorId: user._id,
      title: 'Demande de réactivation',
      message: `${user.name || user.email} souhaite réactiver son compte.${
        message ? ` Message : ${message}` : ''
      }`,
      deepLink: '/admin/users?status=reactivation_pending',
      actionType: 'REVIEW',
      entityType: 'user',
      entityId: `account-reactivation:${user._id}`,
      validationType: 'other',
      priority: 'HIGH',
      targetRole: ['ADMIN', 'FOUNDER'],
      metadata: {
        actionLabel: 'Examiner la demande',
        reactivationUserId: String(user._id),
        requestedAt: user.reactivationRequest.requestedAt
      }
    });
  } catch (notificationError) {
    console.error(
      'Failed to notify administrators about account reactivation:',
      notificationError?.message || notificationError
    );
  }

  return res.status(201).json({
    success: true,
    code: 'REACTIVATION_REQUESTED',
    message: 'Votre demande de réactivation a été envoyée à l’administration.'
  });
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

export const sendRegisterPhoneCode = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  if (!phone || !String(phone).trim()) {
    return res.status(400).json({ message: 'Numéro de téléphone manquant.' });
  }
  if (!isPhoneOtpConfigured()) {
    return res.status(503).json({
      message: 'L’envoi de SMS n’est pas configuré. Définissez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_FROM_NUMBER.'
    });
  }

  const countryContext = await resolveCountryContext({
    requestedCountry: req.body?.countryId || req.body?.countryCode || null,
    user: null
  });
  const normalizedPhone = normalizePhone(phone, countryContext.country.phoneCode);
  if (!normalizedPhone) {
    return res.status(400).json({ message: 'Numéro de téléphone invalide.' });
  }
  const registrationPhoneCgOnly = toBoolean(
    await getRuntimeConfig('registration_phone_cg_only', { fallback: true }),
    true
  );
  if (countryContext.country.code === 'CG' && registrationPhoneCgOnly && !isCongoBrazzavillePhone(normalizedPhone)) {
    return res.status(400).json({
      message: 'Inscription refusée: seuls les numéros de la République du Congo (+242) sont autorisés.',
      code: 'REGISTRATION_PHONE_COUNTRY_BLOCKED'
    });
  }
  if (!normalizedPhone.startsWith(countryContext.country.phoneCode)) {
    return res.status(400).json({ message: `Le numéro doit correspondre à l'indicatif ${countryContext.country.phoneCode}.`, code: 'PHONE_COUNTRY_MISMATCH' });
  }
  const phoneCandidates = buildPhoneCandidates(phone, countryContext.country.phoneCode);
  const phoneTaken = await User.findOne({ phone: { $in: phoneCandidates } });
  if (phoneTaken) {
    return res.status(400).json({ message: 'Téléphone déjà utilisé' });
  }
  const blacklistedPhone = await PhoneBlacklist.exists({
    isActive: true,
    $or: [
      { phoneNormalized: normalizedPhone },
      { phoneVariants: { $in: phoneCandidates } }
    ]
  });
  if (blacklistedPhone) {
    return res.status(403).json({
      message: 'Ce numéro est blacklisté et ne peut plus créer de compte.',
      code: 'PHONE_BLACKLISTED'
    });
  }

  await sendPhoneVerificationCode(normalizedPhone, 'registration');
  res.json({ message: 'Code de vérification envoyé par SMS.' });
});

export const verifyRegisterPhoneCode = asyncHandler(async (req, res) => {
  const { phone, verificationCode } = req.body;
  if (!phone || !String(phone).trim()) {
    return res.status(400).json({ message: 'Numéro de téléphone manquant.' });
  }
  const countryContext = await resolveCountryContext({
    requestedCountry: req.body?.countryId || req.body?.countryCode || null,
    user: null
  });
  const normalizedPhone = normalizePhone(phone, countryContext.country.phoneCode);
  const result = await checkPhoneVerificationCode(normalizedPhone, verificationCode, 'registration');
  if (result?.status !== 'approved') {
    return res.status(400).json({ message: result?.message || 'Code de vérification invalide.' });
  }
  res.json({ message: 'Numéro de téléphone vérifié.' });
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

// Phone-first password recovery: Forgot Password → Phone Number → OTP → New
// Password. Email recovery (sendPasswordResetCode/resetPassword above)
// remains available separately for accounts that have added an email.
export const sendPasswordResetPhoneCode = asyncHandler(async (req, res) => {
  const { phone } = req.body || {};
  if (!phone || !String(phone).trim()) {
    return res.status(400).json({ message: 'Numéro de téléphone manquant.' });
  }
  if (!isPhoneOtpConfigured()) {
    return res.status(503).json({
      message: 'L’envoi de SMS n’est pas configuré. Définissez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_FROM_NUMBER.'
    });
  }
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ message: 'Numéro de téléphone invalide.' });
  }

  // Avoid confirming/denying account existence in the response — same
  // privacy posture as the email flow above.
  const user = await User.findOne({ phone: { $in: buildPhoneCandidates(phone) } }).select('_id');
  if (user) {
    await sendPhoneVerificationCode(normalizedPhone, 'password_reset');
  }
  res.json({ message: 'Si un compte existe, un code a été envoyé par SMS.' });
});

export const resetPasswordWithPhoneCode = asyncHandler(async (req, res) => {
  const { phone, verificationCode, newPassword } = req.body || {};
  if (!phone || !String(phone).trim()) {
    return res.status(400).json({ message: 'Numéro de téléphone manquant.' });
  }
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ message: 'Numéro de téléphone invalide.' });
  }

  const user = await User.findOne({ phone: { $in: buildPhoneCandidates(phone) } });
  if (!user) {
    return res.status(404).json({ message: 'Compte introuvable.' });
  }

  const verificationCheck = await checkPhoneVerificationCode(normalizedPhone, verificationCode, 'password_reset');
  if (verificationCheck?.status !== 'approved') {
    return res.status(400).json({
      message: verificationCheck?.message || 'Code de vérification invalide.'
    });
  }

  user.password = newPassword;
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
