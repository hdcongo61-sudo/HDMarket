// Pure filter-building for NotificationCampaign.audience -> a Mongo filter on
// the User collection. Kept side-effect free (no DB calls) so it's unit
// testable without mocking Mongoose, matching this repo's pure-logic test
// convention (see CLAUDE.md).
//
// Data model note: HDMarket doesn't have a distinct "individual seller" role
// — role is one of user/admin/manager/founder/delivery_agent, and selling is
// determined by accountType ('person' | 'shop'), not role. So 'sellers' and
// 'shops' both resolve to accountType:'shop' here; there's no reliable,
// DB-free way to say "a person account that has listed at least one product"
// without a Product lookup, which would break purity — callers that need
// that distinction should intersect the result with a Product-owner id list
// themselves.
export const USER_TYPE_KEYS = Object.freeze(['all', 'new_users', 'buyers', 'sellers', 'shops', 'delivery_agents']);

const NEW_USER_WINDOW_DAYS = 30;

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

// Defense in depth: callers (notificationCampaignController.js) already
// validate ObjectIds before persisting, but this function shouldn't have to
// trust that — an invalid id silently passed to User.find() would otherwise
// throw a CastError deep inside the audience resolution.
const toObjectIdStrings = (list) =>
  (Array.isArray(list) ? list : [])
    .map((item) => String(item?._id || item || '').trim())
    .filter((id) => OBJECT_ID_RE.test(id));

/**
 * @param {object} audience - NotificationCampaign.audience / OnboardingSequence targeting shape
 * @param {object} [options]
 * @param {Date} [options.now]
 * @returns {object} Mongo filter to pass to User.find()
 */
export const buildAudienceFilter = (audience = {}, { now = new Date() } = {}) => {
  const base = { isBlocked: { $ne: true }, isActive: { $ne: false } };

  const specificUserIds = toObjectIdStrings(audience?.specificUserIds);
  if (specificUserIds.length) {
    // Explicit user list is an override — it means exactly these people, not
    // "these people AND whoever else matches the other filters".
    return { ...base, _id: { $in: specificUserIds } };
  }

  const clauses = [];

  const userTypes = (Array.isArray(audience?.userTypes) ? audience.userTypes : []).filter(Boolean);
  if (userTypes.length && !userTypes.includes('all')) {
    const orClauses = [];
    if (userTypes.includes('new_users')) {
      const since = new Date(now.getTime() - NEW_USER_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      orClauses.push({ createdAt: { $gte: since } });
    }
    if (userTypes.includes('buyers')) orClauses.push({ accountType: 'person' });
    if (userTypes.includes('sellers') || userTypes.includes('shops')) {
      orClauses.push({ accountType: 'shop' });
    }
    if (userTypes.includes('delivery_agents')) orClauses.push({ role: 'delivery_agent' });
    if (orClauses.length) clauses.push({ $or: orClauses });
  }

  const roles = (Array.isArray(audience?.roles) ? audience.roles : []).filter(Boolean);
  if (roles.length) clauses.push({ role: { $in: roles } });

  const countryIds = toObjectIdStrings(audience?.countryIds);
  if (countryIds.length) clauses.push({ countryId: { $in: countryIds } });

  const cityIds = toObjectIdStrings(audience?.cityIds);
  if (cityIds.length) clauses.push({ cityId: { $in: cityIds } });

  const communeIds = toObjectIdStrings(audience?.communeIds);
  if (communeIds.length) clauses.push({ communeId: { $in: communeIds } });

  if (audience?.testerGroup === true) {
    clauses.push({ betaTester: true });
  }

  if (!clauses.length) return base;
  return { ...base, $and: clauses };
};

export default { buildAudienceFilter, USER_TYPE_KEYS };
