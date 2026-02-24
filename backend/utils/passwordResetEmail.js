import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { isEmailConfigured } from './firebaseVerification.js';

const getEmailConfig = () => {
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

const getEmailTransporter = () => {
  const config = getEmailConfig();
  if (!config.user || !config.password) {
    throw new Error("Email n'est pas configuré. Définissez EMAIL_USER et EMAIL_PASSWORD.");
  }
  return nodemailer.createTransport({
    service: config.service,
    auth: {
      user: config.user,
      pass: config.password
    }
  });
};

export const generatePasswordResetToken = () => crypto.randomBytes(32).toString('hex');

export const hashPasswordResetToken = (token) =>
  crypto.createHash('sha256').update(String(token || '')).digest('hex');

export const sendPasswordResetLinkEmail = async ({
  email,
  token,
  expiresMinutes = 30,
  triggeredBy = 'user'
} = {}) => {
  if (!email || !String(email).trim()) {
    const err = new Error('Adresse email manquante.');
    err.status = 400;
    throw err;
  }
  if (!token || !String(token).trim()) {
    const err = new Error('Token de réinitialisation manquant.');
    err.status = 400;
    throw err;
  }
  if (!isEmailConfigured()) {
    const err = new Error("Email n'est pas configuré. Définissez EMAIL_USER et EMAIL_PASSWORD.");
    err.status = 503;
    throw err;
  }

  const transporter = getEmailTransporter();
  const config = getEmailConfig();
  const appUrl = process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const resetUrl = `${appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  const actorLabel = triggeredBy === 'admin' ? 'par un administrateur' : triggeredBy === 'founder' ? 'par le fondateur' : 'depuis votre compte';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #111827;">Réinitialisation de mot de passe</h2>
      <p>Une demande de réinitialisation a été effectuée ${actorLabel}.</p>
      <p style="margin: 20px 0;">
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 18px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px;">
          Réinitialiser mon mot de passe
        </a>
      </p>
      <p style="color: #6B7280; font-size: 14px;">Ce lien est valide pendant ${expiresMinutes} minutes et ne peut être utilisé qu'une seule fois.</p>
      <p style="color: #6B7280; font-size: 14px;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: config.from,
    to: String(email).toLowerCase().trim(),
    subject: 'Réinitialisation de mot de passe - HDMarket',
    html
  });
};
