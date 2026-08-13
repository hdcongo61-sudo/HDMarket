import crypto from 'crypto';
import VerificationCode from '../models/verificationCodeModel.js';
import { getRuntimeConfig } from '../services/configService.js';
import { isTwilioMessagingConfigured, sendSms } from './twilioMessaging.js';
import { normalizePhone } from './firebaseVerification.js';

export const isPhoneOtpConfigured = () => isTwilioMessagingConfigured();

const generateCode = () => crypto.randomInt(100000, 999999).toString();

const smsBodyFor = (code, type) => {
  switch (type) {
    case 'registration':
      return `HDMarket: votre code de vérification est ${code}. Valide 10 minutes. Ne le partagez avec personne.`;
    case 'password_reset':
      return `HDMarket: votre code de réinitialisation de mot de passe est ${code}. Valide 10 minutes.`;
    default:
      return `HDMarket: votre code de vérification est ${code}. Valide 10 minutes.`;
  }
};

// Send an SMS OTP for the given phone + purpose. Mirrors sendVerificationCode
// (email) in utils/firebaseVerification.js: invalidate previous unused codes,
// generate + persist a fresh one, then dispatch it.
export const sendPhoneVerificationCode = async (phone, type = 'registration') => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    const err = new Error('Numéro de téléphone invalide.');
    err.status = 400;
    throw err;
  }

  if (!isPhoneOtpConfigured()) {
    const err = new Error(
      'L’envoi de SMS n’est pas configuré. Définissez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_FROM_NUMBER.'
    );
    err.status = 503;
    throw err;
  }

  await VerificationCode.updateMany(
    { phone: normalizedPhone, type, used: false },
    { used: true }
  );

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await VerificationCode.create({
    phone: normalizedPhone,
    code,
    type,
    expiresAt
  });

  await sendSms(normalizedPhone, smsBodyFor(code, type));

  return { expiresAt };
};

// Verify a phone OTP. On success the record is marked used + usedAt is
// stamped, which lets `hasRecentlyVerifiedPhone` confirm the verification
// happened without ever re-checking (and re-consuming) the same code.
export const checkPhoneVerificationCode = async (phone, code, type = 'registration') => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    const err = new Error('Numéro de téléphone invalide.');
    err.status = 400;
    throw err;
  }
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) {
    return { status: 'rejected', message: 'Code de vérification manquant.' };
  }

  const verification = await VerificationCode.findOne({
    phone: normalizedPhone,
    code: normalizedCode,
    type,
    used: false,
    expiresAt: { $gt: new Date() }
  });

  if (!verification) {
    await VerificationCode.updateMany(
      { phone: normalizedPhone, type, used: false },
      { $inc: { attempts: 1 } }
    );
    return { status: 'rejected', message: 'Code de vérification invalide ou expiré.' };
  }

  const configuredMaxAttempts = await getRuntimeConfig('max_login_attempts', { fallback: 5 });
  const maxAttempts = Math.max(1, Number.isFinite(Number(configuredMaxAttempts)) ? Number(configuredMaxAttempts) : 5);
  if (verification.attempts >= maxAttempts) {
    await VerificationCode.updateOne({ _id: verification._id }, { used: true, usedAt: new Date() });
    return { status: 'rejected', message: 'Trop de tentatives. Veuillez demander un nouveau code.' };
  }

  await VerificationCode.updateOne(
    { _id: verification._id },
    { used: true, usedAt: new Date() }
  );

  return { status: 'approved', message: 'Code vérifié avec succès.' };
};

// Proof-of-verification check for a later step (e.g. final registration
// submit) without re-sending the one-time code: true if this phone was
// successfully verified for `type` within the last `withinMinutes`.
export const hasRecentlyVerifiedPhone = async (phone, type = 'registration', withinMinutes = 30) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return false;
  const since = new Date(Date.now() - withinMinutes * 60 * 1000);
  const record = await VerificationCode.exists({
    phone: normalizedPhone,
    type,
    used: true,
    usedAt: { $gte: since }
  });
  return Boolean(record);
};
