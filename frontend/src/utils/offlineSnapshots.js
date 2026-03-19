import storage from './storage';

const SNAPSHOT_PREFIX = 'hdmarket:offline-snapshot:v1:';
const DEFAULT_MAX_AGE_MS = 1000 * 60 * 60 * 24;

const buildStorageKey = (key) => `${SNAPSHOT_PREFIX}${String(key || '').trim()}`;

export const saveOfflineSnapshot = async (key, data) => {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey || data == null) return false;
  try {
    return await storage.set(buildStorageKey(normalizedKey), {
      timestamp: Date.now(),
      data
    });
  } catch {
    return false;
  }
};

export const loadOfflineSnapshot = async (key, options = {}) => {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) return null;
  const maxAgeMs = Number(options.maxAgeMs || DEFAULT_MAX_AGE_MS);

  try {
    const entry = await storage.get(buildStorageKey(normalizedKey));
    if (!entry || typeof entry !== 'object') return null;
    const timestamp = Number(entry.timestamp || 0);
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > maxAgeMs) return null;
    return entry.data ?? null;
  } catch {
    return null;
  }
};

export const clearOfflineSnapshot = async (key) => {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) return false;
  try {
    return await storage.remove(buildStorageKey(normalizedKey));
  } catch {
    return false;
  }
};
