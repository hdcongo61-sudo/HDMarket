import { hasAnyPermission, hasPermission } from '../services/rbacService.js';

export const requireRole = (roles = []) => (req, res, next) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!req.user) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (req.user.role === 'founder') {
    return next();
  }
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

export const requireFounder = (req, res, next) => {
  if (!req.user || req.user.role !== 'founder') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  return next();
};

export const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (hasPermission(req.user, permission)) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden' });
};

export const requireAnyPermission = (permissions = []) => (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (hasAnyPermission(req.user, permissions)) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden' });
};

export const requireFeedbackAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  // Backward compatible: supports both legacy booleans and permission array.
  if (hasAnyPermission(req.user, ['read_feedback']) || req.user.canReadFeedback === true) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden' });
};

export const requirePaymentVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (hasAnyPermission(req.user, ['verify_payments']) || req.user.canVerifyPayments === true) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden' });
};

export const requireBoostManagement = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (hasAnyPermission(req.user, ['manage_boosts']) || req.user.canManageBoosts === true) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden' });
};

export const requireComplaintAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (
    req.user.role === 'manager' ||
    hasAnyPermission(req.user, ['manage_complaints']) ||
    req.user.canManageComplaints === true
  ) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden' });
};

export const requireHelpCenterAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (hasAnyPermission(req.user, ['manage_help_center']) || req.user.canManageHelpCenter === true) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden' });
};

export const requireChatTemplateAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (
    req.user.role === 'manager' ||
    hasAnyPermission(req.user, ['manage_chat_templates']) ||
    req.user.canManageChatTemplates === true
  ) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden' });
};

export const requireProductAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (
    req.user.role === 'manager' ||
    hasAnyPermission(req.user, ['manage_products']) ||
    req.user.canManageProducts === true
  ) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden' });
};

export const requireDeliveryAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (
    req.user.role === 'admin' ||
    req.user.role === 'founder' ||
    req.user.role === 'manager' ||
    hasAnyPermission(req.user, ['manage_delivery']) ||
    req.user.canManageDelivery === true
  ) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden' });
};
