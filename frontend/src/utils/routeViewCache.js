const MAX_ENTRIES = 48;
const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000;

const routeViewCache = new Map();

const normalizeKey = (key) => String(key || '').trim();

const pruneCache = () => {
  if (routeViewCache.size <= MAX_ENTRIES) return;
  const entries = Array.from(routeViewCache.entries()).sort(
    (left, right) => Number(left[1]?.savedAt || 0) - Number(right[1]?.savedAt || 0)
  );
  entries.slice(0, routeViewCache.size - MAX_ENTRIES).forEach(([key]) => {
    routeViewCache.delete(key);
  });
};

export const readRouteViewCache = (key, maxAgeMs = DEFAULT_MAX_AGE_MS) => {
  const normalizedKey = normalizeKey(key);
  if (!normalizedKey) return null;
  const cached = routeViewCache.get(normalizedKey);
  if (!cached) return null;
  if (Date.now() - Number(cached.savedAt || 0) > maxAgeMs) {
    routeViewCache.delete(normalizedKey);
    return null;
  }
  return cached.value || null;
};

export const writeRouteViewCache = (key, value) => {
  const normalizedKey = normalizeKey(key);
  if (!normalizedKey || !value) return;
  routeViewCache.delete(normalizedKey);
  routeViewCache.set(normalizedKey, { savedAt: Date.now(), value });
  pruneCache();
};

export const clearRouteViewCache = (prefix = '') => {
  const normalizedPrefix = normalizeKey(prefix);
  if (!normalizedPrefix) {
    routeViewCache.clear();
    return;
  }
  Array.from(routeViewCache.keys()).forEach((key) => {
    if (key.startsWith(normalizedPrefix)) routeViewCache.delete(key);
  });
};
