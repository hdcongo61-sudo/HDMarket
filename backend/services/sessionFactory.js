/**
 * sessionFactory.js
 * 
 * Single source of truth for building the connected-user session object.
 * Used by:
 *   - authMiddleware (req.user / req.session)
 *   - authController (buildAuthResponse for login/register)
 * 
 * Principles:
 *   1. Always include BOTH `id` (string) AND `_id` (string) for backward compat.
 *   2. Include all commonly-needed fields so controllers don't re-query User.
 *   3. Normalize arrays, booleans, and nested objects defensively.
 */

import { sanitizeShopHours } from '../utils/shopHours.js';
import { resolvePermissionsForUser } from './rbacService.js';

// ─── Helpers ────────────────────────────────────────────────

const toBool = (v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const n = v.trim().toLowerCase();
    return n === 'true' || n === '1' || n === 'yes' || n === 'oui' || n === 'on';
  }
  return false;
};

const safeNumber = (v, fallback = null) =>
  (v === null || v === undefined) ? fallback : Number.isFinite(Number(v)) ? Number(v) : fallback;

const safeArray = (v) => (Array.isArray(v) ? v : []);

const safeString = (v, fallback = '') => (typeof v === 'string' ? v : fallback);

// ─── Core factory ────────────────────────────────────────────

/**
 * Build a session object from a Mongoose user document (lean) + JWT payload + token.
 *
 * @param {Object}  user          - Mongoose lean user document
 * @param {Object}  [decoded={}]  - Decoded JWT payload (id, role, iat, exp)
 * @param {String}  [token='']    - Raw JWT token string
 * @returns {Object}              - Standardized session object
 */
export function buildSession(user, decoded = {}, token = '') {
  const userId = String(user._id || decoded.id || '');
  const role = String(user.role || decoded.role || 'user').toLowerCase();
  const permissions = resolvePermissionsForUser(user);

  // ── geo helpers ──
  const normalizeGeoJSON = (loc) => {
    if (!loc) return null;
    const coords = loc.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) return null;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return { type: 'Point', coordinates: [lng, lat], longitude: lng, latitude: lat };
  };

  const session = {
    // ── Identity (always strings) ──
    id: userId,
    _id: userId,                         // backward compat
    role,
    phone: safeString(user.phone),
    phoneVerified: toBool(user.phoneVerified),
    email: safeString(user.email),
    name: safeString(user.name),

    // ── Permissions ──
    permissions,
    // Convenience flags (pre-resolved for middleware-less checks)
    canReadFeedback:      toBool(user.canReadFeedback)      || permissions.includes('read_feedback'),
    canVerifyPayments:    toBool(user.canVerifyPayments)    || permissions.includes('verify_payments'),
    canManageBoosts:      toBool(user.canManageBoosts)      || permissions.includes('manage_boosts'),
    canManageComplaints:  toBool(user.canManageComplaints)  || permissions.includes('manage_complaints'),
    canManageProducts:    toBool(user.canManageProducts)    || permissions.includes('manage_products'),
    canManageDelivery:    toBool(user.canManageDelivery)    || permissions.includes('manage_delivery'),
    canManageChatTemplates: toBool(user.canManageChatTemplates) || permissions.includes('manage_chat_templates'),
    canManageHelpCenter:  toBool(user.canManageHelpCenter)  || permissions.includes('manage_help_center'),

    // ── Account status ──
    isActive: user.isActive !== false,
    isBlocked: toBool(user.isBlocked),
    blockedReason: safeString(user.blockedReason),
    isLocked: toBool(user.isLocked),
    lockReason: safeString(user.lockReason),
    sessionsInvalidatedAt: user.sessionsInvalidatedAt || null,

    // ── Account type & profile ──
    accountType: user.accountType || 'person',
    profileImage: safeString(user.profileImage),
    gender: user.gender || 'homme',

    // ── Shop fields ──
    shopName: safeString(user.shopName),
    shopAddress: safeString(user.shopAddress),
    shopLogo: safeString(user.shopLogo),
    shopBanner: safeString(user.shopBanner),
    shopDescription: safeString(user.shopDescription),
    shopVerified: toBool(user.shopVerified),
    followersCount: Math.max(0, Number(user.followersCount) || 0),
    followingShops: safeArray(user.followingShops).map(String),
    freeDeliveryEnabled: toBool(user.freeDeliveryEnabled),
    freeDeliveryNote: safeString(user.freeDeliveryNote),
    shopBoosted: toBool(user.shopBoosted),
    shopBoostScore: Math.max(0, Number(user.shopBoostScore) || 0),
    shopBoostedBy: user.shopBoostedBy ? String(user.shopBoostedBy) : null,
    shopBoostedAt: user.shopBoostedAt || null,
    shopBoostStartDate: user.shopBoostStartDate || null,
    shopBoostEndDate: user.shopBoostEndDate || null,

    // ── Shop location (normalized GeoJSON) ──
    shopLocation: normalizeGeoJSON(user.shopLocation),
    shopLocationVerified: toBool(user.shopLocationVerified),
    shopLocationAccuracy: safeNumber(user.shopLocationAccuracy),
    shopLocationUpdatedAt: user.shopLocationUpdatedAt || null,
    shopLocationTrustScore: Math.min(100, Math.max(0, safeNumber(user.shopLocationTrustScore, 0))),
    shopLocationNeedsReview: toBool(user.shopLocationNeedsReview),
    shopLocationReviewStatus: user.shopLocationReviewStatus || 'approved',
    shopLocationReviewFlags: safeArray(user.shopLocationReviewFlags),

    // ── Shop hours (sanitized) ──
    shopHours: sanitizeShopHours(user.shopHours || []),

    // ── Seller reputation ──
    sellerLevel: user.sellerLevel || 'debutant',
    sellerLevelUpdatedAt: user.sellerLevelUpdatedAt || null,
    totalCompletedOrders: Math.max(0, Number(user.totalCompletedOrders) || 0),
    avgRating: Math.min(5, Math.max(0, safeNumber(user.avgRating, 0))),
    totalReviews: Math.max(0, Number(user.totalReviews) || 0),
    disputeRate: Math.min(100, Math.max(0, safeNumber(user.disputeRate, 0))),

    // ── Geo / location preferences ──
    country: safeString(user.country, 'République du Congo'),
    city: safeString(user.city, 'Brazzaville'),
    commune: safeString(user.commune),
    address: safeString(user.address),
    preferredLanguage: safeString(user.preferredLanguage, 'fr'),
    preferredCurrency: safeString(user.preferredCurrency, 'XAF').toUpperCase(),
    preferredCity: safeString(user.preferredCity) || safeString(user.city, ''),
    theme: ['light', 'dark', 'system'].includes(user.theme) ? user.theme : 'system',

    // ── Session metadata ──
    token: token || '',
    sessionIssuedAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : null,
    sessionExpiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null,
  };

  return session;
}

/**
 * Lightweight variant for req.user (no session metadata, no large arrays).
 * Keeps the object small since it's stored on every request.
 */
export function buildReqUser(user, decoded = {}) {
  const session = buildSession(user, decoded);
  // Remove bulky fields not needed on every request
  delete session.token;
  delete session.sessionIssuedAt;
  delete session.sessionExpiresAt;
  return session;
}

export default { buildSession, buildReqUser };
