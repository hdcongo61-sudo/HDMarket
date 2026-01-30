import crypto from 'crypto';
import VerificationCode from '../models/verificationCodeModel.js';
import nodemailer from 'nodemailer';

// Email configuration
const getEmailConfig = () => {
  // Support multiple email providers
  const emailService = process.env.EMAIL_SERVICE || 'gmail';
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;
  const emailFrom = process.env.EMAIL_FROM || emailUser;

  return {
    service: emailService,
    user: emailUser,
    password: emailPassword,
    from: emailFrom
  };
};

export const isEmailConfigured = () => {
  const { user, password } = getEmailConfig();
  return Boolean(user && password);
};

// Create email transporter
const getEmailTransporter = () => {
  const config = getEmailConfig();
  if (!config.user || !config.password) {
    throw new Error('Email n\'est pas configuré. Définissez EMAIL_USER et EMAIL_PASSWORD.');
  }

  return nodemailer.createTransport({
    service: config.service,
    auth: {
      user: config.user,
      pass: config.password
    }
  });
};

// Generate 6-digit verification code
const generateCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Send verification email
const sendVerificationEmail = async (email, code, type) => {
  if (!isEmailConfigured()) {
    throw new Error('Email n\'est pas configuré. Définissez EMAIL_USER et EMAIL_PASSWORD.');
  }

  const transporter = getEmailTransporter();
  const config = getEmailConfig();

  let subject = '';
  let html = '';

  switch (type) {
    case 'registration':
      subject = 'Code de vérification - Création de compte HDMarket';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4F46E5;">Bienvenue sur HDMarket !</h2>
          <p>Votre code de vérification pour créer votre compte est :</p>
          <div style="background: #F3F4F6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #4F46E5; font-size: 32px; margin: 0; letter-spacing: 4px;">${code}</h1>
          </div>
          <p style="color: #6B7280; font-size: 14px;">Ce code est valide pendant 10 minutes.</p>
          <p style="color: #6B7280; font-size: 14px;">Si vous n'avez pas demandé ce code, ignorez cet email.</p>
        </div>
      `;
      break;
    case 'password_reset':
      subject = 'Code de vérification - Réinitialisation de mot de passe HDMarket';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4F46E5;">Réinitialisation de mot de passe</h2>
          <p>Votre code de vérification pour réinitialiser votre mot de passe est :</p>
          <div style="background: #F3F4F6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #4F46E5; font-size: 32px; margin: 0; letter-spacing: 4px;">${code}</h1>
          </div>
          <p style="color: #6B7280; font-size: 14px;">Ce code est valide pendant 10 minutes.</p>
          <p style="color: #6B7280; font-size: 14px;">Si vous n'avez pas demandé ce code, ignorez cet email.</p>
        </div>
      `;
      break;
    case 'password_change':
      subject = 'Code de vérification - Changement de mot de passe HDMarket';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4F46E5;">Changement de mot de passe</h2>
          <p>Votre code de vérification pour changer votre mot de passe est :</p>
          <div style="background: #F3F4F6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #4F46E5; font-size: 32px; margin: 0; letter-spacing: 4px;">${code}</h1>
          </div>
          <p style="color: #6B7280; font-size: 14px;">Ce code est valide pendant 10 minutes.</p>
          <p style="color: #6B7280; font-size: 14px;">Si vous n'avez pas demandé ce code, ignorez cet email.</p>
        </div>
      `;
      break;
    default:
      subject = 'Code de vérification HDMarket';
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p>Votre code de vérification est :</p>
          <div style="background: #F3F4F6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #4F46E5; font-size: 32px; margin: 0; letter-spacing: 4px;">${code}</h1>
          </div>
          <p style="color: #6B7280; font-size: 14px;">Ce code est valide pendant 10 minutes.</p>
        </div>
      `;
  }

  try {
    await transporter.sendMail({
      from: config.from,
      to: email,
      subject,
      html
    });
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Impossible d\'envoyer l\'email de vérification.');
  }
};

// Send verification code
export const sendVerificationCode = async (email, type = 'registration') => {
  if (!email || !email.trim()) {
    const err = new Error('Adresse email manquante.');
    err.status = 400;
    throw err;
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    const err = new Error('Adresse email invalide.');
    err.status = 400;
    throw err;
  }

  if (!isEmailConfigured()) {
    const err = new Error('Email n\'est pas configuré. Définissez EMAIL_USER et EMAIL_PASSWORD.');
    err.status = 503;
    throw err;
  }

  // Invalidate previous unused codes for this email and type
  await VerificationCode.updateMany(
    { email: normalizedEmail, type, used: false },
    { used: true }
  );

  // Generate new code
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Save code to database
  await VerificationCode.create({
    email: normalizedEmail,
    code,
    type,
    expiresAt
  });

  // Send email
  await sendVerificationEmail(normalizedEmail, code, type);

  return { code, expiresAt };
};

// Verify code
export const checkVerificationCode = async (email, code, type = 'registration') => {
  if (!email || !email.trim()) {
    const err = new Error('Adresse email manquante.');
    err.status = 400;
    throw err;
  }

  if (!code || !code.trim()) {
    const err = new Error('Code de vérification manquant.');
    err.status = 400;
    throw err;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedCode = code.trim();

  // Find verification code
  const verification = await VerificationCode.findOne({
    email: normalizedEmail,
    code: normalizedCode,
    type,
    used: false,
    expiresAt: { $gt: new Date() }
  });

  if (!verification) {
    // Increment attempts for this email/type
    await VerificationCode.updateMany(
      { email: normalizedEmail, type, used: false },
      { $inc: { attempts: 1 } }
    );
    return { status: 'rejected', message: 'Code de vérification invalide ou expiré.' };
  }

  // Check if too many attempts
  if (verification.attempts >= 5) {
    await VerificationCode.updateOne(
      { _id: verification._id },
      { used: true }
    );
    return { status: 'rejected', message: 'Trop de tentatives. Veuillez demander un nouveau code.' };
  }

  // Mark as used
  await VerificationCode.updateOne(
    { _id: verification._id },
    { used: true }
  );

  return { status: 'approved', message: 'Code vérifié avec succès.' };
};

// Keep phone normalization utilities for backward compatibility
export const normalizePhone = (phone) => {
  const raw = typeof phone === 'string' ? phone.trim() : phone ? String(phone).trim() : '';
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (raw.startsWith('+')) {
    return `+${digits}`;
  }
  if (digits.startsWith('00')) {
    return `+${digits.slice(2)}`;
  }
  if (digits.startsWith('242')) {
    return `+${digits}`;
  }
  return `+242${digits}`;
};

export const buildPhoneCandidates = (phone) => {
  const raw = typeof phone === 'string' ? phone.trim() : phone ? String(phone).trim() : '';
  if (!raw) return [];
  const compact = raw.replace(/\s+/g, '');
  const normalized = normalizePhone(raw);
  const candidates = [raw, compact, normalized].filter(Boolean);
  return Array.from(new Set(candidates));
};
