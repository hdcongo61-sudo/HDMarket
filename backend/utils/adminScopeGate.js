/**
 * Pure allowlist for the admin country-scope gate.
 *
 * Country-scoped admins (role 'admin' with assigned adminCountryIds) may only
 * reach country-owned resources. The controllers of those resources enforce
 * the actual country filtering and record ownership.
 *
 * Kept as a pure function so the gate logic is unit-testable and shared with
 * the frontend's mental model (single source of truth on the backend).
 */

const CITY_COMMUNE_METHODS = new Set(['GET', 'POST']);

// Country-owned admin resources whose controllers scope every query/write by
// the requesting admin's countries.
const COUNTRY_OWNED_PREFIXES = ['/promo-codes', '/notification-campaigns'];

export const isScopedCountryAdminPathAllowed = (method, path) => {
  const normalizedPath = String(path || '');
  const normalizedMethod = String(method || 'GET').toUpperCase();

  // Country management (served by adminCountryRoutes + the country pages).
  if (normalizedPath === '/countries' || normalizedPath.startsWith('/countries/')) return true;

  // City/commune endpoints are needed by the country detail page and enforce
  // their own country checks inside the controllers.
  if (
    (normalizedPath === '/cities' || normalizedPath === '/communes') &&
    CITY_COMMUNE_METHODS.has(normalizedMethod)
  ) {
    return true;
  }

  // Country-scoped runtime settings: each market has its own system settings.
  // The controllers enforce that the admin only touches their assigned country.
  if (normalizedPath === '/config/runtime' || normalizedPath.startsWith('/config/runtime/')) return true;

  // Read-only access to the remaining global sections so pages still render.
  if (normalizedPath === '/config/feature-flags' && normalizedMethod === 'GET') return true;
  if (normalizedPath === '/settings' && normalizedMethod === 'GET') return true;

  // Country-owned commerce/marketing resources.
  for (const prefix of COUNTRY_OWNED_PREFIXES) {
    if (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)) return true;
  }

  // Read-only user listing: country admins see their country's users only
  // (listUsers applies the country filter).
  if (normalizedPath === '/users' && normalizedMethod === 'GET') return true;

  return false;
};

export default { isScopedCountryAdminPathAllowed };
