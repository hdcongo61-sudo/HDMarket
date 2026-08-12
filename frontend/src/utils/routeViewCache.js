const MAX_ENTRIES = 48;
const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000;
const OFFLINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_PREFIX = 'hdmarket:route-view:v2:';

const routeViewCache = new Map();

const normalizeKey = (key) => String(key || '').trim();
const buildStorageKey = (key) => `${STORAGE_PREFIX}${key}`;
const hasPersistentStorage = () => {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage);
  } catch {
    return false;
  }
};

const readPersistentEntry = (key) => {
  if (!hasPersistentStorage()) return null;
  try {
    const raw = window.localStorage.getItem(buildStorageKey(key));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry !== 'object' || !Number(entry.savedAt)) return null;
    return entry;
  } catch {
    return null;
  }
};

const removePersistentEntry = (key) => {
  if (!hasPersistentStorage()) return;
  try {
    window.localStorage.removeItem(buildStorageKey(key));
  } catch {
    // Storage is best-effort and must never prevent the page from rendering.
  }
};

const listPersistentEntries = () => {
  if (!hasPersistentStorage()) return [];
  const entries = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const storageKey = window.localStorage.key(index);
      if (!storageKey?.startsWith(STORAGE_PREFIX)) continue;
      const key = storageKey.slice(STORAGE_PREFIX.length);
      const entry = readPersistentEntry(key);
      if (entry) entries.push([key, entry]);
    }
  } catch {
    return [];
  }
  return entries;
};

const prunePersistentCache = () => {
  const entries = listPersistentEntries().sort(
    (left, right) => Number(left[1]?.savedAt || 0) - Number(right[1]?.savedAt || 0)
  );
  entries.slice(0, Math.max(0, entries.length - MAX_ENTRIES)).forEach(([key]) => {
    removePersistentEntry(key);
  });
};

const persistEntry = (key, entry) => {
  if (!hasPersistentStorage()) return;
  try {
    window.localStorage.setItem(buildStorageKey(key), JSON.stringify(entry));
    prunePersistentCache();
  } catch {
    // Free only the oldest view snapshots, then make one final best-effort write.
    const oldestEntries = listPersistentEntries().sort(
      (left, right) => Number(left[1]?.savedAt || 0) - Number(right[1]?.savedAt || 0)
    );
    oldestEntries.slice(0, Math.max(1, Math.ceil(oldestEntries.length / 3))).forEach(([oldKey]) => {
      removePersistentEntry(oldKey);
    });
    try {
      window.localStorage.setItem(buildStorageKey(key), JSON.stringify(entry));
    } catch {
      // The in-memory cache still remains available for the current session.
    }
  }
};

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
  const cached = routeViewCache.get(normalizedKey) || readPersistentEntry(normalizedKey);
  if (!cached) return null;
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const effectiveMaxAgeMs = offline
    ? Math.max(Number(maxAgeMs || 0), OFFLINE_MAX_AGE_MS)
    : Number(maxAgeMs || DEFAULT_MAX_AGE_MS);
  const ageMs = Date.now() - Number(cached.savedAt || 0);
  if (ageMs > Math.max(OFFLINE_MAX_AGE_MS, effectiveMaxAgeMs)) {
    routeViewCache.delete(normalizedKey);
    removePersistentEntry(normalizedKey);
    return null;
  }
  // Keep a normally-expired view on disk as an offline-only safety net.
  if (ageMs > effectiveMaxAgeMs) return null;
  routeViewCache.set(normalizedKey, cached);
  pruneCache();
  return cached.value || null;
};

export const writeRouteViewCache = (key, value) => {
  const normalizedKey = normalizeKey(key);
  if (!normalizedKey || !value) return;
  routeViewCache.delete(normalizedKey);
  const entry = { savedAt: Date.now(), value };
  routeViewCache.set(normalizedKey, entry);
  persistEntry(normalizedKey, entry);
  pruneCache();
};

export const clearRouteViewCache = (prefix = '') => {
  const normalizedPrefix = normalizeKey(prefix);
  if (!normalizedPrefix) {
    routeViewCache.clear();
    listPersistentEntries().forEach(([key]) => removePersistentEntry(key));
    return;
  }
  Array.from(routeViewCache.keys()).forEach((key) => {
    if (key.startsWith(normalizedPrefix)) routeViewCache.delete(key);
  });
  listPersistentEntries().forEach(([key]) => {
    if (key.startsWith(normalizedPrefix)) removePersistentEntry(key);
  });
};
