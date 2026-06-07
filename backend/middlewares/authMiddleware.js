import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { buildReqUser } from '../services/sessionFactory.js';
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
  if (!token) {
    return res.status(401).json({
      message: 'Veuillez vous connecter pour continuer.',
      code: 'AUTH_TOKEN_MISSING'
    });
  }

  try {
    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({ message: 'Session expired. Please login again.', code: 'TOKEN_BLACKLISTED' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select(
      'name email phone phoneVerified role permissions accountType profileImage gender ' +
      'isActive isBlocked blockedReason isLocked lockReason sessionsInvalidatedAt ' +
      'canReadFeedback canVerifyPayments canManageBoosts canManageComplaints ' +
      'canManageProducts canManageDelivery canManageChatTemplates canManageHelpCenter ' +
      'shopName shopAddress shopLogo shopBanner shopDescription shopVerified ' +
      'followersCount followingShops freeDeliveryEnabled freeDeliveryNote ' +
      'shopBoosted shopBoostScore shopBoostedBy shopBoostedAt shopBoostStartDate shopBoostEndDate ' +
      'shopLocation shopLocationVerified shopLocationAccuracy shopLocationUpdatedAt ' +
      'shopLocationTrustScore shopLocationNeedsReview shopLocationReviewStatus shopLocationReviewFlags ' +
      'shopHours ' +
      'sellerLevel sellerLevelUpdatedAt totalCompletedOrders avgRating totalReviews disputeRate ' +
      'country city commune address preferredLanguage preferredCurrency preferredCity theme ' +
      'restrictions'
    ).lean();
    if (!user) {
      return res.status(401).json({
        message: 'Session expirée. Veuillez vous reconnecter.',
        code: 'AUTH_USER_NOT_FOUND'
      });
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

    // Build canonical session shape (includes id, _id, and all needed fields)
    req.user = buildReqUser(user, decoded);
    // Preserve raw token & decoded JWT on request for edge cases
    req.authToken = token;
    req.authDecoded = decoded;
    if (req.query?.token) {
      delete req.query.token;
    }
    next();
  } catch (e) {
    return res.status(401).json({
      message: 'Session expirée. Veuillez vous reconnecter.',
      code: 'AUTH_TOKEN_INVALID'
    });
  }
};

export const admin = (req, res, next) => {
  if (req.user?.role === 'admin' || req.user?.role === 'founder') return next();
  return res.status(403).json({ message: 'Seuls les administrateurs peuvent accéder à cette ressource.' });
};
