import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { sanitizeShopHours } from '../utils/shopHours.js';
import {
  buildPhoneCandidates,
  checkVerificationCode,
  isTwilioConfigured,
  normalizePhone,
  sendVerificationCode
} from '../utils/twilioVerify.js';

const genToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

export const register = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    role,
    city,
    address,
    gender,
    verificationCode
  } = req.body;
  if (!name || !email || !password || !phone || !city || !gender || !address?.trim()) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  if (!verificationCode) {
    return res.status(400).json({ message: 'Code de vérification manquant.' });
  }
  if (!isTwilioConfigured()) {
    return res.status(503).json({
      message:
        'Twilio n’est pas configuré. Définissez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_VERIFY_SERVICE_SID.'
    });
  }
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
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ message: 'Email already used' });
  const phoneCandidates = buildPhoneCandidates(trimmedPhone);
  const phoneTaken = await User.findOne({ phone: { $in: phoneCandidates } });
  if (phoneTaken) return res.status(400).json({ message: 'Téléphone déjà utilisé' });
  const normalizedRole = role === 'admin' ? 'admin' : role === 'manager' ? 'manager' : 'user';
  const verificationCheck = await checkVerificationCode(trimmedPhone, verificationCode);
  if (verificationCheck?.status !== 'approved') {
    return res.status(400).json({ message: 'Code de vérification invalide.' });
  }

  const user = await User.create({
    name,
    email,
    password,
    phone: normalizedPhone,
    phoneVerified: true,
    role: normalizedRole,
    accountType: 'person',
    country: 'République du Congo',
    address: address.trim(),
    city,
    gender
  });
  const token = genToken(user);
  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    phoneVerified: Boolean(user.phoneVerified),
    role: user.role,
    accountType: user.accountType,
    shopVerified: Boolean(user.shopVerified),
    shopName: user.shopName || null,
    shopAddress: user.shopAddress || null,
    shopLogo: user.shopLogo || null,
    followersCount: Number(user.followersCount || 0),
    followingShops: Array.isArray(user.followingShops) ? user.followingShops : [],
    country: user.country,
    address: user.address || '',
    city: user.city,
    gender: user.gender,
    shopDescription: user.shopDescription || '',
    shopHours: sanitizeShopHours(user.shopHours || []),
    token
  });
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
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  if (user.isBlocked) {
    const reason = user.blockedReason ? ` Motif : ${user.blockedReason}` : '';
    return res.status(403).json({
      message: `Votre compte est suspendu. Contactez l’administrateur pour plus d’informations.${reason}`,
      reason: user.blockedReason || '',
      code: 'ACCOUNT_BLOCKED'
    });
  }
  const token = genToken(user);
  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    phoneVerified: Boolean(user.phoneVerified),
    role: user.role,
    accountType: user.accountType,
    shopVerified: Boolean(user.shopVerified),
    shopName: user.shopName || null,
    shopAddress: user.shopAddress || null,
    shopLogo: user.shopLogo || null,
    followersCount: Number(user.followersCount || 0),
    followingShops: Array.isArray(user.followingShops) ? user.followingShops : [],
    country: user.country,
    address: user.address || '',
    city: user.city,
    gender: user.gender,
    shopDescription: user.shopDescription || '',
    shopHours: sanitizeShopHours(user.shopHours || []),
    token
  });
});

export const sendRegisterCode = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  if (!isTwilioConfigured()) {
    return res.status(503).json({
      message:
        'Twilio n’est pas configuré. Définissez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_VERIFY_SERVICE_SID.'
    });
  }
  const trimmedPhone =
    typeof phone === 'string'
      ? phone.trim()
      : phone !== null && phone !== undefined
      ? String(phone).trim()
      : '';
  if (!trimmedPhone) {
    return res.status(400).json({ message: 'Numéro de téléphone manquant.' });
  }
  const phoneCandidates = buildPhoneCandidates(trimmedPhone);
  const phoneTaken = await User.findOne({ phone: { $in: phoneCandidates } });
  if (phoneTaken) {
    return res.status(400).json({ message: 'Téléphone déjà utilisé' });
  }
  await sendVerificationCode(trimmedPhone, 'sms');
  res.json({ message: 'Code envoyé.' });
});

export const sendPasswordResetCode = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  if (!isTwilioConfigured()) {
    return res.status(503).json({
      message:
        'Twilio n’est pas configuré. Définissez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_VERIFY_SERVICE_SID.'
    });
  }
  const trimmedPhone =
    typeof phone === 'string'
      ? phone.trim()
      : phone !== null && phone !== undefined
      ? String(phone).trim()
      : '';
  if (!trimmedPhone) {
    return res.status(400).json({ message: 'Numéro de téléphone manquant.' });
  }
  const phoneCandidates = buildPhoneCandidates(trimmedPhone);
  const user = await User.findOne({ phone: { $in: phoneCandidates } });
  if (user) {
    await sendVerificationCode(trimmedPhone, 'sms');
  }
  res.json({ message: 'Si un compte existe, un code a été envoyé.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { phone, verificationCode, newPassword } = req.body;
  if (!isTwilioConfigured()) {
    return res.status(503).json({
      message:
        'Twilio n’est pas configuré. Définissez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_VERIFY_SERVICE_SID.'
    });
  }
  const trimmedPhone =
    typeof phone === 'string'
      ? phone.trim()
      : phone !== null && phone !== undefined
      ? String(phone).trim()
      : '';
  if (!trimmedPhone) {
    return res.status(400).json({ message: 'Numéro de téléphone manquant.' });
  }
  const phoneCandidates = buildPhoneCandidates(trimmedPhone);
  const user = await User.findOne({ phone: { $in: phoneCandidates } });
  if (!user) {
    return res.status(404).json({ message: 'Compte introuvable.' });
  }
  const verificationCheck = await checkVerificationCode(trimmedPhone, verificationCode);
  if (verificationCheck?.status !== 'approved') {
    return res.status(400).json({ message: 'Code de vérification invalide.' });
  }
  user.password = newPassword;
  user.phoneVerified = true;
  await user.save();
  res.json({ message: 'Mot de passe mis à jour.' });
});
