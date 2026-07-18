const STORAGE_KEY = 'hdmarket:privacy-preference:v1';
export const PRIVACY_EVENT = 'hdmarket:privacy-preference-changed';

export const getPrivacyPreference = () => {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(STORAGE_KEY) || '';
};

export const setPrivacyPreference = (value) => {
  if (typeof window === 'undefined') return;
  const normalized = value === 'analytics' ? 'analytics' : 'essential';
  window.localStorage.setItem(STORAGE_KEY, normalized);
  window.dispatchEvent(new CustomEvent(PRIVACY_EVENT, { detail: normalized }));
};

export const hasAnalyticsConsent = () => getPrivacyPreference() === 'analytics';
