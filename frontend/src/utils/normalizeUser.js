/**
 * normalizeUser.js
 *
 * Single source of truth for normalizing user data on the frontend.
 * Mirrors backend sessionFactory.js to keep both sides in sync.
 *
 * Used by: AuthContext (login, readPersistedUser, updateUser)
 */

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

const normalizeGeoJSON = (loc) => {
  if (!loc) return null;
  const coords = loc.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { type: 'Point', coordinates: [lng, lat], longitude: lng, latitude: lat };
};

/**
 * @param {Object} raw - Raw user data from API or localStorage
 * @returns {Object}   - Canonical normalized user shape
 */
export function normalizeUser(raw = {}) {
  const role = safeString(raw.role, 'user').toLowerCase();

  return {
    // Identity
    id: safeString(raw.id || raw._id),
    _id: safeString(raw._id || raw.id),
    role,
    phone: safeString(raw.phone),
    phoneVerified: toBool(raw.phoneVerified),
    email: safeString(raw.email),
    name: safeString(raw.name),

    // Permissions
    permissions: safeArray(raw.permissions),
    canReadFeedback: toBool(raw.canReadFeedback),
    canVerifyPayments: toBool(raw.canVerifyPayments),
    canManageBoosts: toBool(raw.canManageBoosts),
    canManageComplaints: toBool(raw.canManageComplaints),
    canManageProducts: toBool(raw.canManageProducts),
    canManageDelivery: toBool(raw.canManageDelivery),
    canManageChatTemplates: toBool(raw.canManageChatTemplates),
    canManageHelpCenter: toBool(raw.canManageHelpCenter),

    // Account status
    isActive: raw.isActive !== false,
    isBlocked: toBool(raw.isBlocked),
    blockedReason: safeString(raw.blockedReason),
    isLocked: toBool(raw.isLocked),
    lockReason: safeString(raw.lockReason),

    // Account type & profile
    accountType: raw.accountType || 'person',
    profileImage: safeString(raw.profileImage),
    gender: raw.gender || 'homme',

    // Shop
    shopName: safeString(raw.shopName),
    shopAddress: safeString(raw.shopAddress),
    shopLogo: safeString(raw.shopLogo),
    shopBanner: safeString(raw.shopBanner),
    shopBannerMobile: safeString(raw.shopBannerMobile),
    shopColor: safeString(raw.shopColor, '#e85d00'),
    shopDescription: safeString(raw.shopDescription),
    shopVerified: toBool(raw.shopVerified),
    followersCount: Math.max(0, Number(raw.followersCount) || 0),
    followingShops: safeArray(raw.followingShops),
    freeDeliveryEnabled: toBool(raw.freeDeliveryEnabled),
    freeDeliveryNote: safeString(raw.freeDeliveryNote),
    shopBoosted: toBool(raw.shopBoosted),
    shopBoostScore: Math.max(0, Number(raw.shopBoostScore) || 0),
    shopBoostedBy: raw.shopBoostedBy ? String(raw.shopBoostedBy) : null,
    shopBoostedAt: raw.shopBoostedAt || null,
    shopBoostStartDate: raw.shopBoostStartDate || null,
    shopBoostEndDate: raw.shopBoostEndDate || null,

    // Shop location
    shopLocation: normalizeGeoJSON(raw.shopLocation),
    shopLocationVerified: toBool(raw.shopLocationVerified),
    shopLocationAccuracy: safeNumber(raw.shopLocationAccuracy),
    shopLocationUpdatedAt: raw.shopLocationUpdatedAt || null,
    shopLocationTrustScore: Math.min(100, Math.max(0, safeNumber(raw.shopLocationTrustScore, 0))),
    shopLocationNeedsReview: toBool(raw.shopLocationNeedsReview),
    shopLocationReviewStatus: raw.shopLocationReviewStatus || 'approved',
    shopLocationReviewFlags: safeArray(raw.shopLocationReviewFlags),

    // Shop hours
    shopHours: safeArray(raw.shopHours),

    // Seller reputation
    sellerLevel: raw.sellerLevel || 'debutant',
    sellerLevelUpdatedAt: raw.sellerLevelUpdatedAt || null,
    totalCompletedOrders: Math.max(0, Number(raw.totalCompletedOrders) || 0),
    avgRating: Math.min(5, Math.max(0, safeNumber(raw.avgRating, 0))),
    totalReviews: Math.max(0, Number(raw.totalReviews) || 0),
    disputeRate: Math.min(100, Math.max(0, safeNumber(raw.disputeRate, 0))),

    // Geo / prefs
    country: safeString(raw.country, 'République du Congo'),
    city: safeString(raw.city, 'Brazzaville'),
    commune: safeString(raw.commune),
    address: safeString(raw.address),
    preferredLanguage: safeString(raw.preferredLanguage, 'fr'),
    preferredCurrency: safeString(raw.preferredCurrency, 'XAF').toUpperCase(),
    preferredCity: safeString(raw.preferredCity) || safeString(raw.city, ''),
    theme: ['light', 'dark', 'system'].includes(raw.theme) ? raw.theme : 'system',

    // Token (only from API responses, stripped before persist)
    token: safeString(raw.token),
  };
}

export default normalizeUser;
