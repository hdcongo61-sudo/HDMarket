import asyncHandler from 'express-async-handler';
import { hasPermission } from '../services/shopAssistantService.js';
import ShopAssistant from '../models/shopAssistantModel.js';

/**
 * Middleware: require the user to be the shop owner OR an active assistant.
 */
export const requireShopOwnerOrAssistant = asyncHandler(async (req, res, next) => {
  const shopId = req.params.shopId || req.body.shopId;
  if (!shopId) return res.status(400).json({ message: 'shopId requis.' });
  if (String(req.user.id || req.user._id) === String(shopId)) return next(); // Owner

  const assignment = await ShopAssistant.findOne({ shop: shopId, assistant: req.user.id || req.user._id, status: 'active' }).lean();
  if (!assignment) return res.status(403).json({ message: 'Accès refusé. Vous n\'êtes pas autorisé pour cette boutique.' });
  req.shopAssistantAssignment = assignment;
  next();
});

/**
 * Middleware: require a specific assistant permission.
 */
export const requireAssistantPermission = (permission) =>
  asyncHandler(async (req, res, next) => {
    const shopId = req.params.shopId || req.body.shopId;
    if (!shopId) return res.status(400).json({ message: 'shopId requis.' });

    // Owner always passes
    if (String(req.user.id || req.user._id) === String(shopId)) return next();

    const has = await hasPermission(req.user.id || req.user._id, shopId, permission);
    if (!has) return res.status(403).json({ message: `Permission manquante: ${permission}.` });
    next();
  });

export const canManageShopOrder = requireAssistantPermission('update_order_status');
export const canRespondToShopComment = requireAssistantPermission('respond_to_comments');
export const canViewShopDashboard = requireAssistantPermission('view_shop_dashboard');
