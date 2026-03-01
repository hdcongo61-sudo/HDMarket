import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { resolvePermissionsForUser } from '../services/rbacService.js';
import {
  extractBearerToken,
  isTokenBlacklisted,
  wasSessionInvalidated
} from '../services/sessionSecurityService.js';

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  let token = extractBearerToken(authHeader) || null;
  if (!token && req.query?.token) {
    token = req.query.token;
  }
  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

  try {
    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({ message: 'Session expired. Please login again.', code: 'TOKEN_BLACKLISTED' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select(
      'role permissions phone isBlocked blockedReason isActive isLocked lockReason sessionsInvalidatedAt canReadFeedback canVerifyPayments canManageBoosts canManageComplaints canManageProducts canManageDelivery canManageChatTemplates canManageHelpCenter'
    );
    if (!user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    if (!user.isActive) {
      return res.status(403).json({
        message: 'Votre compte est désactivé. Contactez le support.',
        code: 'ACCOUNT_INACTIVE'
      });
    }
    if (user.isBlocked) {
      const reason = user.blockedReason ? ` Motif : ${user.blockedReason}` : '';
      return res.status(403).json({
        message: `Votre compte est suspendu. Contactez l'administrateur pour plus d'informations.${reason}`,
        reason: user.blockedReason || '',
        code: 'ACCOUNT_BLOCKED'
      });
    }
    if (user.isLocked) {
      const reason = user.lockReason ? ` Motif : ${user.lockReason}` : '';
      return res.status(403).json({
        message: `Votre compte est verrouillé.${reason}`,
        reason: user.lockReason || '',
        code: 'ACCOUNT_LOCKED'
      });
    }
    if (wasSessionInvalidated(user, decoded)) {
      return res.status(401).json({
        message: 'Session invalidée. Veuillez vous reconnecter.',
        code: 'SESSION_INVALIDATED'
      });
    }

    const resolvedPermissions = resolvePermissionsForUser(user);

    req.user = {
      id: user._id.toString(),
      role: user.role,
      permissions: resolvedPermissions,
      phone: user.phone || '',
      canReadFeedback: user.canReadFeedback,
      canVerifyPayments: user.canVerifyPayments,
      canManageBoosts: user.canManageBoosts,
      canManageComplaints: user.canManageComplaints,
      canManageProducts: user.canManageProducts,
      canManageDelivery: user.canManageDelivery,
      canManageChatTemplates: user.canManageChatTemplates,
      canManageHelpCenter: user.canManageHelpCenter
    };
    req.authToken = token;
    req.authDecoded = decoded;
    if (req.query?.token) {
      delete req.query.token;
    }
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Token invalid' });
  }
};

export const admin = (req, res, next) => {
  if (req.user?.role === 'admin' || req.user?.role === 'founder') return next();
  return res.status(403).json({ message: 'Seuls les administrateurs peuvent accéder à cette ressource.' });
};
