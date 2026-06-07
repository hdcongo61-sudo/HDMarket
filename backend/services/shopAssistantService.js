/**
 * Shop Assistant Service — Staff Delegation System
 * Inspired by Taobao/Alibaba shop management.
 */

import mongoose from 'mongoose';
import ShopAssistant, { ALLOWED_PERMISSIONS } from '../models/shopAssistantModel.js';
import AssistantAuditLog from '../models/assistantAuditLogModel.js';
import User from '../models/userModel.js';
import { createNotification } from '../utils/notificationService.js';

const VALID_STATUSES = ['pending', 'active', 'removed', 'left'];
const VALID_ROLES = ['admin', 'founder'];

// ─── Helpers ────────────────────────────────────────────

const logAudit = async ({ shop, actor, actorRole, action, targetType = '', targetId = '', metadata = {} }) => {
  try {
    await AssistantAuditLog.create({ shop, actor, actorRole, action, targetType, targetId, metadata });
  } catch { /* non-blocking */ }
};

const findUserByLookup = async (email, phone, userId) => {
  const query = {};
  if (userId && mongoose.Types.ObjectId.isValid(userId)) query._id = userId;
  else if (email) query.email = email.toLowerCase().trim();
  else if (phone) query.phone = phone.trim();
  else return null;
  return User.findOne(query).select('_id name email phone role accountType').lean();
};

const notify = async (userId, actorId, shopId, type, metadata = {}) => {
  try {
    await createNotification({
      userId,
      actorId,
      shopId,
      type,
      allowSelf: false,
      priority: 'HIGH',
      pushEnabled: true,
      entityType: 'shop',
      entityId: String(shopId),
      metadata,
      deepLink: '/seller/assistant'
    });
  } catch { /* non-blocking */ }
};

const normalizePermissions = (permissions = []) => [
  ...new Set((permissions || []).filter((permission) => ALLOWED_PERMISSIONS.includes(permission)))
];

// ─── Invite ─────────────────────────────────────────────

export const inviteAssistant = async ({ shopId, ownerId, email, phone, userId, permissions = [] }) => {
  // Validate shop ownership
  const shop = await User.findById(shopId).select('accountType shopName name').lean();
  if (!shop || shop.accountType !== 'shop') throw { status: 404, message: 'Boutique introuvable.' };
  if (String(shop._id) !== String(ownerId)) throw { status: 403, message: 'Seul le propriétaire peut inviter un assistant.' };

  // Find target user
  const target = await findUserByLookup(email, phone, userId);
  if (!target) throw { status: 404, message: 'Utilisateur introuvable. Vérifiez l\'email, le téléphone ou l\'ID.' };

  // Prevent self-invite
  if (String(target._id) === String(ownerId)) throw { status: 400, message: 'Vous ne pouvez pas vous inviter vous-même.' };

  // Prevent inviting admin/founder
  if (VALID_ROLES.includes(target.role)) throw { status: 400, message: 'Les administrateurs ne peuvent pas être assistants.' };

  // Check target not already an assistant
  const existingAssignment = await ShopAssistant.findOne({
    assistant: target._id,
    status: { $in: ['pending', 'active'] }
  }).lean();
  if (existingAssignment) throw { status: 409, message: 'Cet utilisateur est déjà assistant dans une autre boutique.' };

  // Check shop doesn't already have an active/pending assistant
  const existingShopAssignment = await ShopAssistant.findOne({
    shop: shopId,
    status: { $in: ['pending', 'active'] }
  }).lean();
  if (existingShopAssignment) throw { status: 409, message: 'Cette boutique a déjà un assistant actif ou en attente.' };

  const validPerms = normalizePermissions(permissions);

  const assignment = await ShopAssistant.create({
    shop: shopId,
    owner: ownerId,
    assistant: target._id,
    permissions: validPerms,
    status: 'pending',
    invitedAt: new Date()
  });

  await logAudit({ shop: shopId, actor: ownerId, actorRole: 'owner', action: 'assistant_invited', targetType: 'user', targetId: String(target._id), metadata: { permissions: validPerms, email, phone } });
  await notify(target._id, ownerId, shopId, 'shop_follow', { shopName: shop.shopName || shop.name, message: `${shop.shopName || shop.name} vous a invité comme assistant.` });

  return ShopAssistant.findById(assignment._id).populate('assistant', 'name email phone').populate('shop', 'shopName name').lean();
};

// ─── Accept ─────────────────────────────────────────────

export const acceptInvitation = async ({ shopId, userId }) => {
  const assignment = await ShopAssistant.findOne({ shop: shopId, assistant: userId, status: 'pending' });
  if (!assignment) throw { status: 404, message: 'Invitation introuvable ou déjà traitée.' };

  assignment.status = 'active';
  assignment.acceptedAt = new Date();
  await assignment.save();

  await logAudit({ shop: shopId, actor: userId, actorRole: 'assistant', action: 'assistant_accepted' });
  const shop = await User.findById(shopId).select('shopName name').lean();
  await notify(assignment.owner, userId, shopId, 'shop_follow', { shopName: shop?.shopName || shop?.name, message: 'Votre invitation a été acceptée.' });

  return ShopAssistant.findById(assignment._id).populate('assistant', 'name email phone').populate('shop', 'shopName name').lean();
};

// ─── Reject ─────────────────────────────────────────────

export const rejectInvitation = async ({ shopId, userId }) => {
  const assignment = await ShopAssistant.findOne({ shop: shopId, assistant: userId, status: 'pending' });
  if (!assignment) throw { status: 404, message: 'Invitation introuvable ou déjà traitée.' };

  assignment.status = 'removed';
  assignment.removedAt = new Date();
  assignment.removedBy = userId;
  await assignment.save();

  await logAudit({ shop: shopId, actor: userId, actorRole: 'assistant', action: 'assistant_rejected' });
  const shop = await User.findById(shopId).select('shopName name').lean();
  await notify(assignment.owner, userId, shopId, 'shop_follow', { shopName: shop?.shopName || shop?.name, message: 'L\'invitation a été refusée.' });

  return { message: 'Invitation refusée.' };
};

// ─── Remove (owner) ─────────────────────────────────────

export const removeAssistant = async ({ shopId, ownerId }) => {
  const assignment = await ShopAssistant.findOne({ shop: shopId, status: { $in: ['pending', 'active'] } });
  if (!assignment) throw { status: 404, message: 'Aucun assistant actif trouvé.' };
  if (String(assignment.owner) !== String(ownerId)) throw { status: 403, message: 'Seul le propriétaire peut retirer l\'assistant.' };

  assignment.status = 'removed';
  assignment.removedAt = new Date();
  assignment.removedBy = ownerId;
  await assignment.save();

  await logAudit({ shop: shopId, actor: ownerId, actorRole: 'owner', action: 'assistant_removed' });
  await notify(assignment.assistant, ownerId, shopId, 'shop_follow', { message: 'Vous avez été retiré du rôle d\'assistant.' });

  return { message: 'Assistant retiré.' };
};

// ─── Leave (assistant) ──────────────────────────────────

export const leaveShop = async ({ shopId, userId }) => {
  const assignment = await ShopAssistant.findOne({ shop: shopId, assistant: userId, status: 'active' });
  if (!assignment) throw { status: 404, message: 'Vous n\'êtes pas assistant actif de cette boutique.' };

  assignment.status = 'left';
  assignment.removedAt = new Date();
  assignment.removedBy = userId;
  await assignment.save();

  await logAudit({ shop: shopId, actor: userId, actorRole: 'assistant', action: 'assistant_left' });
  await notify(assignment.owner, userId, shopId, 'shop_follow', { message: 'L\'assistant a quitté la boutique.' });

  return { message: 'Vous avez quitté la boutique.' };
};

// ─── Update Permissions ─────────────────────────────────

export const updatePermissions = async ({ shopId, ownerId, permissions }) => {
  const assignment = await ShopAssistant.findOne({ shop: shopId, status: { $in: ['pending', 'active'] } });
  if (!assignment) throw { status: 404, message: 'Aucun assistant trouvé.' };
  if (String(assignment.owner) !== String(ownerId)) throw { status: 403, message: 'Seul le propriétaire peut modifier les permissions.' };

  const validPerms = normalizePermissions(permissions);

  assignment.permissions = validPerms;
  await assignment.save();

  await logAudit({ shop: shopId, actor: ownerId, actorRole: 'owner', action: 'assistant_permissions_updated', metadata: { permissions: validPerms } });
  await notify(assignment.assistant, ownerId, shopId, 'shop_follow', { message: 'Vos permissions d\'assistant ont été mises à jour.' });

  return ShopAssistant.findById(assignment._id).populate('assistant', 'name email phone').populate('shop', 'shopName name').lean();
};

// ─── Queries ────────────────────────────────────────────

export const getShopAssistant = async (shopId) => {
  return ShopAssistant.findOne({ shop: shopId, status: { $in: ['pending', 'active'] } })
    .populate('assistant', 'name email phone profileImage')
    .populate('owner', 'name shopName')
    .lean();
};

export const getMyAssistantShop = async (userId) => {
  const assignment = await ShopAssistant.findOne({ assistant: userId, status: 'active' })
    .populate('shop', 'shopName name slug shopLogo')
    .populate('owner', 'name shopName email phone')
    .lean();
  if (!assignment) return null;

  const { shop, owner, permissions, acceptedAt, invitedAt } = assignment;
  return { shop, owner, permissions, acceptedAt, invitedAt, status: assignment.status };
};

export const getMyPendingInvitations = async (userId) => {
  return ShopAssistant.find({ assistant: userId, status: 'pending' })
    .sort({ invitedAt: -1, createdAt: -1 })
    .populate('shop', 'shopName name slug shopLogo city')
    .populate('owner', 'name shopName email phone')
    .lean();
};

export const getAssistantAuditLogs = async ({ shopId, userId, limit = 20 }) => {
  const userObjectId = String(userId);
  const isOwner = userObjectId === String(shopId);
  if (!isOwner) {
    const assignment = await ShopAssistant.findOne({
      shop: shopId,
      assistant: userId,
      status: 'active'
    }).select('_id').lean();
    if (!assignment) throw { status: 403, message: 'Accès refusé au journal assistant.' };
  }

  const safeLimit = Math.min(50, Math.max(5, Number(limit) || 20));
  return AssistantAuditLog.find({ shop: shopId })
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .populate('actor', 'name email phone shopName')
    .lean();
};

export const hasPermission = async (userId, shopId, permission) => {
  const assignment = await ShopAssistant.findOne({
    assistant: userId,
    shop: shopId,
    status: 'active',
    permissions: permission
  }).lean();
  return !!assignment;
};
