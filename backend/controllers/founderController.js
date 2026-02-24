import asyncHandler from 'express-async-handler';
import nodemailer from 'nodemailer';
import User from '../models/userModel.js';
import AuditLog from '../models/auditLogModel.js';
import { createAuditLogEntry } from '../services/auditLogService.js';
import { issuePasswordResetLinkForUser } from '../services/passwordResetService.js';
import { resolvePermissionsForUser } from '../services/rbacService.js';
import { createNotification } from '../utils/notificationService.js';
import { isEmailConfigured } from '../utils/firebaseVerification.js';

const toManagedUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  permissions: resolvePermissionsForUser(user),
  isActive: Boolean(user.isActive),
  isLocked: Boolean(user.isLocked),
  lockReason: user.lockReason || '',
  lockedAt: user.lockedAt || null,
  accountType: user.accountType || 'person',
  updatedAt: user.updatedAt
});

const emailTransport = () => {
  if (!isEmailConfigured()) return null;
  const service = process.env.EMAIL_SERVICE || 'gmail';
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service,
    auth: { user, pass }
  });
};

const sendRoleChangeEmail = async ({ email, name, role }) => {
  if (!email || !isEmailConfigured()) return false;
  const transporter = emailTransport();
  if (!transporter) return false;
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const roleLabel = role === 'admin' ? 'Administrateur' : role === 'founder' ? 'Fondateur' : 'Utilisateur';
  await transporter.sendMail({
    from,
    to: String(email).toLowerCase().trim(),
    subject: 'Mise à jour de votre rôle HDMarket',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #111827;">Mise à jour des accès</h2>
        <p>Bonjour ${String(name || 'Utilisateur')},</p>
        <p>Votre rôle sur HDMarket a été mis à jour: <strong>${roleLabel}</strong>.</p>
        <p style="color: #6B7280; font-size: 14px;">Si vous pensez qu'il s'agit d'une erreur, contactez le support.</p>
      </div>
    `
  });
  return true;
};

const denyFounderTarget = (targetUser) => {
  if (String(targetUser?.role || '').toLowerCase() === 'founder') {
    const error = new Error('Le compte fondateur ne peut pas être modifié.');
    error.status = 403;
    throw error;
  }
};
const getTargetUserId = (req) => req.params?.userId || req.params?.id;

const assertActorCanManageTarget = ({ actorRole, targetRole }) => {
  const normalizedActor = String(actorRole || '').toLowerCase();
  const normalizedTarget = String(targetRole || '').toLowerCase();
  if (normalizedActor === 'founder') return;
  if (normalizedTarget === 'founder' || normalizedTarget === 'admin') {
    const error = new Error('Action non autorisée sur ce compte.');
    error.status = 403;
    throw error;
  }
};

export const promoteAdmin = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(getTargetUserId(req));
  if (!targetUser) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }
  denyFounderTarget(targetUser);

  const previousValue = {
    role: targetUser.role,
    permissions: Array.isArray(targetUser.permissions) ? targetUser.permissions : []
  };

  if (targetUser.role !== 'admin') {
    targetUser.role = 'admin';
    targetUser.updatedBy = req.user.id;
    targetUser.lastModifiedBy = req.user.id;
    await targetUser.save();
  }

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: targetUser._id,
    actionType: 'role_promoted_admin',
    previousValue,
    newValue: {
      role: targetUser.role,
      permissions: resolvePermissionsForUser(targetUser)
    },
    req
  });

  await createNotification({
    userId: targetUser._id,
    actorId: req.user.id,
    type: 'admin_broadcast',
    metadata: {
      title: 'Votre rôle a été mis à jour',
      body: 'Vous êtes désormais administrateur.'
    },
    allowSelf: false
  }).catch(() => null);

  await sendRoleChangeEmail({
    email: targetUser.email,
    name: targetUser.name,
    role: targetUser.role
  }).catch(() => null);

  return res.json({
    success: true,
    user: toManagedUser(targetUser)
  });
});

export const revokeAdmin = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(getTargetUserId(req));
  if (!targetUser) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }
  denyFounderTarget(targetUser);

  const previousValue = {
    role: targetUser.role,
    permissions: Array.isArray(targetUser.permissions) ? targetUser.permissions : []
  };

  targetUser.role = 'user';
  targetUser.updatedBy = req.user.id;
  targetUser.lastModifiedBy = req.user.id;
  await targetUser.save();

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: targetUser._id,
    actionType: 'role_revoked_admin',
    previousValue,
    newValue: {
      role: targetUser.role,
      permissions: resolvePermissionsForUser(targetUser)
    },
    req
  });

  await createNotification({
    userId: targetUser._id,
    actorId: req.user.id,
    type: 'admin_broadcast',
    metadata: {
      title: 'Mise à jour des accès',
      body: 'Vos accès administrateur ont été révoqués.'
    },
    allowSelf: false
  }).catch(() => null);

  await sendRoleChangeEmail({
    email: targetUser.email,
    name: targetUser.name,
    role: targetUser.role
  }).catch(() => null);

  return res.json({
    success: true,
    user: toManagedUser(targetUser)
  });
});

export const lockUserAccount = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(getTargetUserId(req));
  if (!targetUser) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }
  assertActorCanManageTarget({
    actorRole: req.user?.role,
    targetRole: targetUser.role
  });

  const reason = String(req.body?.reason || '').trim();
  const previousValue = {
    isLocked: Boolean(targetUser.isLocked),
    isActive: Boolean(targetUser.isActive),
    lockReason: targetUser.lockReason || ''
  };

  targetUser.isLocked = true;
  targetUser.isActive = false;
  targetUser.lockReason = reason;
  targetUser.lockedAt = new Date();
  targetUser.updatedBy = req.user.id;
  targetUser.lastModifiedBy = req.user.id;
  targetUser.sessionsInvalidatedAt = new Date();
  await targetUser.save();

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: targetUser._id,
    actionType: 'account_locked',
    previousValue,
    newValue: {
      isLocked: true,
      isActive: false,
      lockReason: targetUser.lockReason || ''
    },
    req
  });

  return res.json({
    success: true,
    user: toManagedUser(targetUser)
  });
});

export const unlockUserAccount = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(getTargetUserId(req));
  if (!targetUser) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }
  assertActorCanManageTarget({
    actorRole: req.user?.role,
    targetRole: targetUser.role
  });

  const previousValue = {
    isLocked: Boolean(targetUser.isLocked),
    isActive: Boolean(targetUser.isActive),
    lockReason: targetUser.lockReason || ''
  };

  targetUser.isLocked = false;
  targetUser.isActive = true;
  targetUser.lockReason = '';
  targetUser.lockedAt = null;
  targetUser.updatedBy = req.user.id;
  targetUser.lastModifiedBy = req.user.id;
  await targetUser.save();

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: targetUser._id,
    actionType: 'account_unlocked',
    previousValue,
    newValue: {
      isLocked: false,
      isActive: true,
      lockReason: ''
    },
    req
  });

  return res.json({
    success: true,
    user: toManagedUser(targetUser)
  });
});

export const forceLogoutUser = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(getTargetUserId(req));
  if (!targetUser) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }
  assertActorCanManageTarget({
    actorRole: req.user?.role,
    targetRole: targetUser.role
  });

  const previousValue = {
    sessionsInvalidatedAt: targetUser.sessionsInvalidatedAt || null
  };
  targetUser.sessionsInvalidatedAt = new Date();
  targetUser.updatedBy = req.user.id;
  targetUser.lastModifiedBy = req.user.id;
  await targetUser.save();

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: targetUser._id,
    actionType: 'force_logout_user',
    previousValue,
    newValue: { sessionsInvalidatedAt: targetUser.sessionsInvalidatedAt },
    req
  });

  return res.json({
    success: true,
    user: toManagedUser(targetUser)
  });
});

export const forcePasswordResetUser = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(getTargetUserId(req));
  if (!targetUser) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }
  denyFounderTarget(targetUser);

  const resetResult = await issuePasswordResetLinkForUser({
    user: targetUser,
    triggeredBy: 'founder',
    performedBy: req.user.id,
    req,
    allowManualFallback: true
  }).catch((error) => {
    if (error?.status) {
      const typedError = new Error(error.message);
      typedError.status = error.status;
      throw typedError;
    }
    throw error;
  });

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: targetUser._id,
    actionType: 'force_password_reset',
    previousValue: null,
    newValue: {
      via: resetResult?.emailSent ? 'email_link' : 'manual_link_fallback',
      emailSent: Boolean(resetResult?.emailSent)
    },
    req
  });

  return res.json({
    success: true,
    message: resetResult?.emailSent
      ? 'Lien de réinitialisation envoyé.'
      : "Email indisponible. Un lien de réinitialisation manuel a été généré.",
    emailSent: Boolean(resetResult?.emailSent),
    resetLink: resetResult?.resetUrl || null,
    fallbackReason: resetResult?.fallbackReason || null
  });
});

export const triggerPasswordResetForManagedUser = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(getTargetUserId(req));
  if (!targetUser) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }
  assertActorCanManageTarget({
    actorRole: req.user?.role,
    targetRole: targetUser.role
  });

  const resetResult = await issuePasswordResetLinkForUser({
    user: targetUser,
    triggeredBy: req.user?.role === 'founder' ? 'founder' : 'admin',
    performedBy: req.user.id,
    req,
    allowManualFallback: true
  }).catch((error) => {
    if (error?.status) {
      const typedError = new Error(error.message);
      typedError.status = error.status;
      throw typedError;
    }
    throw error;
  });

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: targetUser._id,
    actionType: 'admin_trigger_password_reset',
    previousValue: null,
    newValue: {
      byRole: req.user?.role || 'admin',
      emailSent: Boolean(resetResult?.emailSent)
    },
    req
  });

  return res.json({
    success: true,
    message: resetResult?.emailSent
      ? 'Lien de réinitialisation envoyé.'
      : "Email indisponible. Un lien de réinitialisation manuel a été généré.",
    emailSent: Boolean(resetResult?.emailSent),
    resetLink: resetResult?.resetUrl || null,
    fallbackReason: resetResult?.fallbackReason || null
  });
});

export const setManagedUserPassword = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(getTargetUserId(req));
  if (!targetUser) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  assertActorCanManageTarget({
    actorRole: req.user?.role,
    targetRole: targetUser.role
  });
  if (String(req.user?.role || '').toLowerCase() === 'founder') {
    denyFounderTarget(targetUser);
  }

  const nextPassword = String(req.body?.newPassword || '');
  const forceLogout = req.body?.forceLogout !== false;

  const previousValue = {
    hadPasswordResetToken: Boolean(targetUser.passwordResetToken),
    sessionsInvalidatedAt: targetUser.sessionsInvalidatedAt || null
  };

  targetUser.password = nextPassword;
  targetUser.passwordResetToken = null;
  targetUser.passwordResetExpires = null;
  if (forceLogout) {
    targetUser.sessionsInvalidatedAt = new Date();
  }
  targetUser.updatedBy = req.user.id;
  targetUser.lastModifiedBy = req.user.id;
  await targetUser.save();

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: targetUser._id,
    actionType: 'admin_set_password_direct',
    previousValue,
    newValue: {
      byRole: req.user?.role || 'admin',
      forceLogout
    },
    req
  });

  return res.json({
    success: true,
    message: 'Mot de passe mis à jour directement.',
    user: toManagedUser(targetUser)
  });
});

export const listFounderAuditLogs = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query?.page || 1));
  const limit = Math.min(100, Math.max(10, Number(req.query?.limit || 20)));
  const skip = (page - 1) * limit;
  const query = {};

  if (req.query?.actionType) {
    query.actionType = String(req.query.actionType).trim();
  }
  if (req.query?.targetUser) {
    query.targetUser = req.query.targetUser;
  }
  if (req.query?.performedBy) {
    query.performedBy = req.query.performedBy;
  }

  const [items, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('performedBy', 'name email role')
      .populate('targetUser', 'name email role')
      .lean(),
    AuditLog.countDocuments(query)
  ]);

  return res.json({
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    items
  });
});
