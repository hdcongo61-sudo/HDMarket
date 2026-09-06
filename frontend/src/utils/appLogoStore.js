import api from '../services/api';

// Shared app-logo store.
//
// Several places need the app branding (Navbar, brand-logo hook, favicon/head
// icon effects in App). Each of them used to fetch /settings/app-logo on every
// mount — with `x-skip-cache: 1` — producing up to 4 identical network calls
// per page load. This module deduplicates in-flight requests, caches the
// payload for 10 minutes (memory + localStorage), and stays in sync with
// `hdmarket:app-logo-updated` (emitted by Admin App Settings after a save).

const APP_LOGO_STORE_KEY = 'hdmarket:app-logo-store';
const APP_LOGO_TTL_MS = 10 * 60 * 1000; // refetch only after 10 minutes
const APP_LOGO_FAILURE_GRACE_MS = 2 * 60 * 1000; // after a failed attempt, keep serving the last known logo for 2 min

let cachedPayload = null;
let cachedAt = 0; // last successful persist
let lastAttemptAt = 0; // last network attempt (success or failure)
let inFlight = null;

const canUseWindow = () => typeof window !== 'undefined';

const readStored = () => {
  if (!canUseWindow()) return { payload: null, ts: 0 };
  try {
    const raw = window.localStorage.getItem(APP_LOGO_STORE_KEY);
    if (!raw) return { payload: null, ts: 0 };
    const parsed = JSON.parse(raw);
    return {
      payload: parsed?.payload && typeof parsed.payload === 'object' ? parsed.payload : null,
      ts: typeof parsed?.ts === 'number' ? parsed.ts : 0
    };
  } catch {
    return { payload: null, ts: 0 };
  }
};

// Hydrate at module load so a repeat visit paints the persisted logo before
// the first network response arrives.
if (canUseWindow()) {
  const stored = readStored();
  if (stored.payload) {
    cachedPayload = stored.payload;
    cachedAt = stored.ts || Date.now();
  }
}

const persist = (payload) => {
  cachedPayload = payload;
  cachedAt = Date.now();
  if (!canUseWindow()) return;
  try {
    window.localStorage.setItem(APP_LOGO_STORE_KEY, JSON.stringify({ ts: cachedAt, payload }));
  } catch {
    // Storage is an optimization; the API remains the source of truth.
  }
};

const isFresh = () => Boolean(cachedPayload) && Date.now() - cachedAt < APP_LOGO_TTL_MS;

// Keep the shared cache in sync when the admin saves new logos.
if (canUseWindow()) {
  window.addEventListener('hdmarket:app-logo-updated', (event) => {
    const detail = event?.detail;
    if (!detail || typeof detail !== 'object') return;
    persist({ ...(cachedPayload || {}), ...detail });
  });
}

/** Synchronous read of the fresh cached payload (or null). */
export const getCachedAppLogo = () => (isFresh() ? { ...cachedPayload } : null);

/**
 * Resolves with the latest app-logo payload (or the last known one on network
 * failure, or null when nothing is known). Concurrent callers share a single
 * network request; `force` bypasses the TTL (used on settings refresh).
 */
export const fetchAppLogo = ({ force = false } = {}) => {
  if (!force && isFresh()) return Promise.resolve({ ...cachedPayload });
  if (!force && cachedPayload && Date.now() - lastAttemptAt < APP_LOGO_FAILURE_GRACE_MS) {
    return Promise.resolve({ ...cachedPayload });
  }
  if (inFlight) return inFlight;

  lastAttemptAt = Date.now();
  inFlight = api
    .get('/settings/app-logo', { silentGlobalError: true })
    .then((res) => {
      const payload = res?.data && typeof res.data === 'object' ? res.data : {};
      if (Object.keys(payload).length) persist(payload);
      return cachedPayload ? { ...cachedPayload } : null;
    })
    .catch(() => (cachedPayload ? { ...cachedPayload } : null))
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
};
