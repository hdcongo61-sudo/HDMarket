export const PRIVACY_STORAGE_KEY = 'hdmarket:privacy-preference:v2';
export const PRIVACY_VERSION = '2026-09-20';
// Product policy, not a statutory Congolese cookie deadline.
export const PRIVACY_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
export const PRIVACY_EVENT = 'hdmarket:privacy-preference-changed';
let sessionChoice = null;
let storageUnavailable = false;

export const getPrivacyChoices = () => {
  if (typeof window === 'undefined') return null;
  let value;
  try { value = storageUnavailable ? sessionChoice : JSON.parse(window.localStorage.getItem(PRIVACY_STORAGE_KEY)); }
  catch { value = sessionChoice; }
  const now = Date.now();
  if (!value || value.version !== PRIVACY_VERSION || typeof value.analytics !== 'boolean' ||
      typeof value.diagnostics !== 'boolean' || !Number.isFinite(value.savedAt) ||
      value.savedAt > now || now - value.savedAt >= PRIVACY_MAX_AGE_MS) return null;
  return value;
};

export const getPrivacyPreference = () => {
  const choice = getPrivacyChoices();
  return !choice ? '' : choice.analytics ? 'analytics' : choice.diagnostics ? 'custom' : 'essential';
};

export const setPrivacyPreference = (value) => {
  if (typeof window === 'undefined') return;
  const choice = {
    version: PRIVACY_VERSION, savedAt: Date.now(),
    analytics: value === 'analytics' || value?.analytics === true,
    diagnostics: value?.diagnostics === true
  };
  sessionChoice = choice;
  try {
    window.localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(choice));
    storageUnavailable = false;
    window.localStorage.removeItem('hdmarket:privacy-preference:v1');
  } catch { storageUnavailable = true; /* Retain the choice for this page. */ }
  window.dispatchEvent(new CustomEvent(PRIVACY_EVENT));
};

export const hasAnalyticsConsent = () => getPrivacyChoices()?.analytics === true;
export const hasDiagnosticsConsent = () => getPrivacyChoices()?.diagnostics === true;

// Update mounted consumers on withdrawal in another tab, expiry, and resuming a suspended tab.
export const subscribePrivacyPreference = (listener) => {
  if (typeof window === 'undefined') return () => {};
  let timer;
  const update = () => {
    window.clearTimeout(timer);
    listener();
    const choice = getPrivacyChoices();
    if (choice) timer = window.setTimeout(update, Math.min(2147483647, Math.max(1, choice.savedAt + PRIVACY_MAX_AGE_MS - Date.now())));
  };
  const storage = (event) => {
    if (event.key === PRIVACY_STORAGE_KEY || event.key === null) { sessionChoice = null; storageUnavailable = false; update(); }
  };
  window.addEventListener(PRIVACY_EVENT, update);
  window.addEventListener('storage', storage);
  window.addEventListener('focus', update);
  update();
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener(PRIVACY_EVENT, update);
    window.removeEventListener('storage', storage);
    window.removeEventListener('focus', update);
  };
};
