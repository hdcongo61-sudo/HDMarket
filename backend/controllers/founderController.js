import asyncHandler from 'express-async-handler';
import nodemailer from 'nodemailer';
import User from '../models/userModel.js';
import AuditLog from '../models/auditLogModel.js';
import Product from '../models/productModel.js';
import Payment from '../models/paymentModel.js';
import Comment from '../models/commentModel.js';
import Rating from '../models/ratingModel.js';
import ShopReview from '../models/shopReviewModel.js';
import Cart from '../models/cartModel.js';
import OrderMessage from '../models/orderMessageModel.js';
import Notification from '../models/notificationModel.js';
import DeliveryGuy from '../models/deliveryGuyModel.js';
import DeliveryRequest from '../models/deliveryRequestModel.js';
import PushToken from '../models/pushTokenModel.js';
import UserSession from '../models/userSessionModel.js';
import VerificationCode from '../models/verificationCodeModel.js';
import Report from '../models/reportModel.js';
import Complaint from '../models/complaintModel.js';
import Dispute from '../models/disputeModel.js';
import AccountTypeChange from '../models/accountTypeChangeModel.js';
import PhoneBlacklist from '../models/phoneBlacklistModel.js';
import { createAuditLogEntry } from '../services/auditLogService.js';
import { issuePasswordResetLinkForUser } from '../services/passwordResetService.js';
import { resolvePermissionsForUser } from '../services/rbacService.js';
import { createNotification } from '../utils/notificationService.js';
import { buildPhoneCandidates, isEmailConfigured, normalizePhone } from '../utils/firebaseVerification.js';

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

const FOUNDER_HARD_DELETE_ACTION = 'founder_hard_delete_account';
const FOUNDER_PHONE_BLACKLIST_ADDED_ACTION = 'founder_phone_blacklist_added';
const FOUNDER_PHONE_BLACKLIST_REVERSED_ACTION = 'founder_phone_blacklist_reversed';

const escapeRegex = (value = '') => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toDeletionCandidate = (user) => ({
  _id: user._id,
  name: user.name || '',
  email: user.email || '',
  phone: user.phone || '',
  role: user.role || 'user',
  accountType: user.accountType || 'person',
  shopName: user.shopName || '',
  profileImage: user.profileImage || user.shopLogo || '',
  createdAt: user.createdAt || null,
  updatedAt: user.updatedAt || null
});

const toBlacklistEntry = (entry) => ({
  _id: entry._id,
  phoneNormalized: entry.phoneNormalized || '',
  phoneVariants: Array.isArray(entry.phoneVariants) ? entry.phoneVariants : [],
  reason: entry.reason || '',
  source: entry.source || '',
  blockedEntityType: entry.blockedEntityType || 'user',
  blockedEntitySnapshot: entry.blockedEntitySnapshot || {},
  isActive: Boolean(entry.isActive),
  blockedAt: entry.blockedAt || entry.createdAt || null,
  blockedBy: entry.blockedBy
    ? {
        _id: entry.blockedBy._id || entry.blockedBy,
        name: entry.blockedBy.name || '',
        email: entry.blockedBy.email || ''
      }
    : null,
  unblockedAt: entry.unblockedAt || null,
  unblockedBy: entry.unblockedBy
    ? {
        _id: entry.unblockedBy._id || entry.unblockedBy,
        name: entry.unblockedBy.name || '',
        email: entry.unblockedBy.email || ''
      }
    : null,
  unblockedReason: entry.unblockedReason || '',
  createdAt: entry.createdAt || null,
  updatedAt: entry.updatedAt || null
});

const normalizeEntityType = (value = '') => {
  if (value === undefined || value === null || value === '') return '';
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'shop') return 'shop';
  if (normalized === 'user') return 'user';
  return '';
};

const registerCount = (target, key, result) => {
  const count = Number(result?.deletedCount || 0);
  target[key] = count;
  return count;
};

const createOrUpdatePhoneBlacklist = async ({
  actorId,
  reason,
  targetUser,
  entityType = 'user'
}) => {
  const normalizedPhone = normalizePhone(targetUser?.phone || '');
  const phoneVariants = Array.from(
    new Set([normalizedPhone, ...buildPhoneCandidates(targetUser?.phone || '')].filter(Boolean))
  );
  if (!normalizedPhone || !phoneVariants.length) {
    const error = new Error('Numéro de téléphone invalide, impossible de le blacklister.');
    error.status = 400;
    throw error;
  }
  const now = new Date();
  return PhoneBlacklist.findOneAndUpdate(
    { phoneNormalized: normalizedPhone },
    {
      $set: {
        phoneNormalized: normalizedPhone,
        phoneVariants,
        reason: String(reason || '').trim(),
        source: 'founder_hard_delete',
        blockedEntityType: entityType,
        blockedEntitySnapshot: {
          userId: targetUser?._id || null,
          name: targetUser?.name || '',
          email: targetUser?.email || '',
          phone: targetUser?.phone || '',
          role: targetUser?.role || 'user',
          accountType: targetUser?.accountType || 'person',
          shopName: targetUser?.shopName || ''
        },
        blockedBy: actorId,
        blockedAt: now,
        isActive: true,
        unblockedAt: null,
        unblockedBy: null,
        unblockedReason: ''
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const hardDeleteAccountAndReferences = async ({ targetUser }) => {
  const userId = targetUser._id;
  const targetEmail = String(targetUser?.email || '').toLowerCase().trim();
  const productIds = await Product.find({ user: userId }).distinct('_id');
  const deletedCounts = {
    products: 0,
    productPayments: 0,
    productComments: 0,
    productRatings: 0,
    payments: 0,
    comments: 0,
    ratings: 0,
    shopReviews: 0,
    carts: 0,
    orderMessages: 0,
    notifications: 0,
    deliveryGuys: 0,
    deliveryRequests: 0,
    pushTokens: 0,
    userSessions: 0,
    verificationCodes: 0,
    reports: 0,
    complaints: 0,
    disputes: 0,
    accountTypeChanges: 0,
    usersWithRelationsUpdated: 0,
    usersDeleted: 0
  };

  if (productIds.length) {
    const [productPayments, productComments, productRatings] = await Promise.all([
      Payment.deleteMany({ product: { $in: productIds } }),
      Comment.deleteMany({ product: { $in: productIds } }),
      Rating.deleteMany({ product: { $in: productIds } })
    ]);
    registerCount(deletedCounts, 'productPayments', productPayments);
    registerCount(deletedCounts, 'productComments', productComments);
    registerCount(deletedCounts, 'productRatings', productRatings);
  }

  const [
    productsResult,
    paymentsResult,
    commentsResult,
    ratingsResult,
    shopReviewsResult,
    cartsResult,
    orderMessagesResult,
    notificationsResult,
    deliveryGuysResult,
    deliveryRequestsResult,
    pushTokensResult,
    userSessionsResult,
    verificationCodesResult,
    reportsResult,
    complaintsResult,
    disputesResult,
    accountTypeChangesResult
  ] = await Promise.all([
    Product.deleteMany({ user: userId }),
    Payment.deleteMany({ user: userId }),
    Comment.deleteMany({ user: userId }),
    Rating.deleteMany({ user: userId }),
    ShopReview.deleteMany({ $or: [{ user: userId }, { shop: userId }] }),
    Cart.deleteMany({ user: userId }),
    OrderMessage.deleteMany({ $or: [{ sender: userId }, { recipient: userId }] }),
    Notification.deleteMany({ $or: [{ user: userId }, { actor: userId }, { shop: userId }] }),
    DeliveryGuy.deleteMany({ userId }),
    DeliveryRequest.deleteMany({
      $or: [
        { sellerId: userId },
        { buyerId: userId },
        { shopId: userId },
        { acceptedBy: userId },
        { rejectedBy: userId },
        { 'pickupProof.submittedBy': userId },
        { 'deliveryProof.submittedBy': userId }
      ]
    }),
    PushToken.deleteMany({ user: userId }),
    UserSession.deleteMany({ userId }),
    targetEmail ? VerificationCode.deleteMany({ email: targetEmail }) : Promise.resolve({ deletedCount: 0 }),
    Report.deleteMany({ $or: [{ reporter: userId }, { reportedUser: userId }] }),
    Complaint.deleteMany({ user: userId }),
    Dispute.deleteMany({ $or: [{ clientId: userId }, { sellerId: userId }] }),
    AccountTypeChange.deleteMany({ $or: [{ user: userId }, { changedBy: userId }] })
  ]);

  registerCount(deletedCounts, 'products', productsResult);
  registerCount(deletedCounts, 'payments', paymentsResult);
  registerCount(deletedCounts, 'comments', commentsResult);
  registerCount(deletedCounts, 'ratings', ratingsResult);
  registerCount(deletedCounts, 'shopReviews', shopReviewsResult);
  registerCount(deletedCounts, 'carts', cartsResult);
  registerCount(deletedCounts, 'orderMessages', orderMessagesResult);
  registerCount(deletedCounts, 'notifications', notificationsResult);
  registerCount(deletedCounts, 'deliveryGuys', deliveryGuysResult);
  registerCount(deletedCounts, 'deliveryRequests', deliveryRequestsResult);
  registerCount(deletedCounts, 'pushTokens', pushTokensResult);
  registerCount(deletedCounts, 'userSessions', userSessionsResult);
  registerCount(deletedCounts, 'verificationCodes', verificationCodesResult);
  registerCount(deletedCounts, 'reports', reportsResult);
  registerCount(deletedCounts, 'complaints', complaintsResult);
  registerCount(deletedCounts, 'disputes', disputesResult);
  registerCount(deletedCounts, 'accountTypeChanges', accountTypeChangesResult);

  const relationPull = {
    followingShops: userId
  };
  if (productIds.length) {
    relationPull.favorites = { $in: productIds };
  }
  const userRelationsResult = await User.updateMany(
    { _id: { $ne: userId } },
    { $pull: relationPull }
  );
  deletedCounts.usersWithRelationsUpdated = Number(userRelationsResult?.modifiedCount || 0);

  const userDeleteResult = await User.deleteOne({ _id: userId });
  deletedCounts.usersDeleted = Number(userDeleteResult?.deletedCount || 0);
  if (!deletedCounts.usersDeleted) {
    const error = new Error("Suppression impossible: le compte n'a pas été supprimé.");
    error.status = 500;
    throw error;
  }

  return { deletedCounts, productIdsCount: productIds.length };
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

export const listFounderDeletionCandidates = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query?.page || 1));
  const limit = Math.min(100, Math.max(10, Number(req.query?.limit || 30)));
  const skip = (page - 1) * limit;
  const accountTypeFilter = String(req.query?.accountType || 'all').trim().toLowerCase();
  const roleFilter = String(req.query?.role || '').trim().toLowerCase();
  const search = String(req.query?.search || '').trim();
  const query = {
    role: { $ne: 'founder' }
  };

  if (accountTypeFilter === 'person' || accountTypeFilter === 'shop') {
    query.accountType = accountTypeFilter;
  }
  if (roleFilter && roleFilter !== 'founder') {
    query.role = roleFilter;
  }
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    query.$or = [
      { name: regex },
      { email: regex },
      { phone: regex },
      { shopName: regex }
    ];
  }

  const [items, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('name email phone role accountType shopName profileImage shopLogo createdAt updatedAt')
      .lean(),
    User.countDocuments(query)
  ]);

  return res.json({
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    items: items.map(toDeletionCandidate)
  });
});

export const listFounderPhoneBlacklist = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query?.page || 1));
  const limit = Math.min(200, Math.max(10, Number(req.query?.limit || 40)));
  const skip = (page - 1) * limit;
  const activeFilter = String(req.query?.active || 'true').trim().toLowerCase();
  const search = String(req.query?.search || '').trim();
  const query = {};

  if (activeFilter === 'true' || activeFilter === 'false') {
    query.isActive = activeFilter === 'true';
  }
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    query.$or = [
      { phoneNormalized: regex },
      { phoneVariants: regex },
      { 'blockedEntitySnapshot.name': regex },
      { 'blockedEntitySnapshot.email': regex },
      { 'blockedEntitySnapshot.shopName': regex }
    ];
  }

  const [items, total] = await Promise.all([
    PhoneBlacklist.find(query)
      .sort({ isActive: -1, blockedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('blockedBy', 'name email')
      .populate('unblockedBy', 'name email')
      .lean(),
    PhoneBlacklist.countDocuments(query)
  ]);

  return res.json({
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    items: items.map(toBlacklistEntry)
  });
});

export const founderHardDeleteAccount = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(getTargetUserId(req))
    .select('name email phone role accountType shopName profileImage shopLogo createdAt updatedAt')
    .lean();
  if (!targetUser) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  const actorId = req.user?.id;
  if (String(targetUser._id) === String(actorId)) {
    return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte.' });
  }

  denyFounderTarget(targetUser);

  const requestedEntityType = normalizeEntityType(req.body?.entityType);
  const targetEntityType = String(targetUser.accountType || '').toLowerCase() === 'shop' ? 'shop' : 'user';
  if (requestedEntityType && requestedEntityType !== targetEntityType) {
    return res.status(400).json({
      message:
        requestedEntityType === 'shop'
          ? "Ce compte n'est pas une boutique."
          : 'Ce compte est une boutique. Utilisez le type shop.'
    });
  }

  const reason = String(req.body?.reason || '').trim();
  if (!reason) {
    return res
      .status(400)
      .json({ message: 'Le motif de suppression est requis pour cette action critique.' });
  }

  const blacklistEntry = await createOrUpdatePhoneBlacklist({
    actorId,
    reason,
    targetUser,
    entityType: targetEntityType
  });

  const { deletedCounts, productIdsCount } = await hardDeleteAccountAndReferences({ targetUser });
  const actionType =
    targetEntityType === 'shop'
      ? `${FOUNDER_HARD_DELETE_ACTION}_shop`
      : `${FOUNDER_HARD_DELETE_ACTION}_user`;

  await createAuditLogEntry({
    performedBy: actorId,
    targetUser: targetUser._id,
    actionType,
    previousValue: {
      account: targetUser
    },
    newValue: {
      deleted: true,
      entityType: targetEntityType,
      reason
    },
    meta: {
      blacklistId: blacklistEntry?._id || null,
      blacklistedPhone: blacklistEntry?.phoneNormalized || '',
      deletedCounts,
      productIdsCount
    },
    req
  });

  await createAuditLogEntry({
    performedBy: actorId,
    targetUser: targetUser._id,
    actionType: FOUNDER_PHONE_BLACKLIST_ADDED_ACTION,
    previousValue: null,
    newValue: {
      phoneNormalized: blacklistEntry?.phoneNormalized || '',
      reason,
      entityType: targetEntityType
    },
    meta: {
      blacklistId: blacklistEntry?._id || null
    },
    req
  });

  return res.json({
    success: true,
    message:
      targetEntityType === 'shop'
        ? 'Boutique supprimée définitivement et numéro blacklisté.'
        : 'Utilisateur supprimé définitivement et numéro blacklisté.',
    account: {
      _id: targetUser._id,
      name: targetUser.name || '',
      email: targetUser.email || '',
      phone: targetUser.phone || '',
      role: targetUser.role || 'user',
      accountType: targetUser.accountType || 'person'
    },
    blacklist: toBlacklistEntry(blacklistEntry),
    deletedCounts
  });
});

export const reverseFounderPhoneBlacklist = asyncHandler(async (req, res) => {
  const reason = String(req.body?.reason || '').trim();
  const entry = await PhoneBlacklist.findById(req.params.id);
  if (!entry) {
    return res.status(404).json({ message: 'Entrée blacklist introuvable.' });
  }
  if (!entry.isActive) {
    return res.status(400).json({ message: 'Ce numéro est déjà retiré de la blacklist.' });
  }

  const previousValue = {
    isActive: Boolean(entry.isActive),
    unblockedAt: entry.unblockedAt || null,
    unblockedBy: entry.unblockedBy || null
  };

  entry.isActive = false;
  entry.unblockedAt = new Date();
  entry.unblockedBy = req.user.id;
  entry.unblockedReason = reason;
  await entry.save();

  await createAuditLogEntry({
    performedBy: req.user.id,
    targetUser: null,
    actionType: FOUNDER_PHONE_BLACKLIST_REVERSED_ACTION,
    previousValue,
    newValue: {
      isActive: false,
      phoneNormalized: entry.phoneNormalized || '',
      reason
    },
    meta: {
      blacklistId: entry._id
    },
    req
  });

  const populated = await PhoneBlacklist.findById(entry._id)
    .populate('blockedBy', 'name email')
    .populate('unblockedBy', 'name email')
    .lean();

  return res.json({
    success: true,
    message: 'Numéro retiré de la blacklist.',
    blacklist: toBlacklistEntry(populated || entry.toObject())
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
