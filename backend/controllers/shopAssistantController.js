import asyncHandler from 'express-async-handler';
import * as sas from '../services/shopAssistantService.js';

// POST /api/shops/:shopId/assistant/invite
export const inviteAssistant = asyncHandler(async (req, res) => {
  const result = await sas.inviteAssistant({
    shopId: req.params.shopId,
    ownerId: req.user.id || req.user._id,
    email: req.body.email,
    phone: req.body.phone,
    userId: req.body.userId,
    permissions: req.body.permissions
  });
  res.status(201).json({ success: true, data: result });
});

// POST /api/shops/:shopId/assistant/accept
export const acceptInvitation = asyncHandler(async (req, res) => {
  const result = await sas.acceptInvitation({
    shopId: req.params.shopId,
    userId: req.user.id || req.user._id
  });
  res.json({ success: true, data: result });
});

// POST /api/shops/:shopId/assistant/reject
export const rejectInvitation = asyncHandler(async (req, res) => {
  const result = await sas.rejectInvitation({
    shopId: req.params.shopId,
    userId: req.user.id || req.user._id
  });
  res.json({ success: true, data: result });
});

// DELETE /api/shops/:shopId/assistant  (owner removes)
export const removeAssistant = asyncHandler(async (req, res) => {
  const result = await sas.removeAssistant({
    shopId: req.params.shopId,
    ownerId: req.user.id || req.user._id
  });
  res.json({ success: true, data: result });
});

// POST /api/shops/:shopId/assistant/leave  (assistant leaves)
export const leaveShop = asyncHandler(async (req, res) => {
  const result = await sas.leaveShop({
    shopId: req.params.shopId,
    userId: req.user.id || req.user._id
  });
  res.json({ success: true, data: result });
});

// PUT /api/shops/:shopId/assistant/permissions
export const updatePermissions = asyncHandler(async (req, res) => {
  const result = await sas.updatePermissions({
    shopId: req.params.shopId,
    ownerId: req.user.id || req.user._id,
    permissions: req.body.permissions
  });
  res.json({ success: true, data: result });
});

// GET /api/shops/:shopId/assistant
export const getShopAssistant = asyncHandler(async (req, res) => {
  const result = await sas.getShopAssistant(req.params.shopId);
  res.json({ success: true, data: result });
});

// GET /api/me/assistant-shop
export const getMyAssistantShop = asyncHandler(async (req, res) => {
  const result = await sas.getMyAssistantShop(req.user.id || req.user._id);
  res.json({ success: true, data: result });
});
