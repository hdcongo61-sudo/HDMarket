// Stores the most recent valid social attribution (a /s/:socialCode visit)
// in localStorage so checkout can attach it later — matches the spec's
// "at minimum preserve the most recent valid social attribution before
// order creation" bar. Never sent as a bare channel string: the backend
// re-validates socialClickId against the real SocialClick record.
const STORAGE_KEY = 'hdmarket:social_attribution';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — a reasonable "did this click lead to a purchase" window

export const setSocialAttribution = ({ socialClickId, source, campaign, socialCode }) => {
  if (!socialClickId) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ socialClickId, source: source || '', campaign: campaign || '', socialCode: socialCode || '', savedAt: Date.now() })
    );
  } catch {
    // Storage unavailable (private mode, quota) — attribution just won't persist.
  }
};

export const getSocialAttribution = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.socialClickId || !parsed?.savedAt || Date.now() - parsed.savedAt > TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearSocialAttribution = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
};

// Shape the checkout controller expects — undefined (not an empty object)
// when there's nothing to attach, so it doesn't show up in the request body
// at all for a normal, non-social order.
export const getCheckoutAcquisitionPayload = () => {
  const attribution = getSocialAttribution();
  return attribution?.socialClickId ? { socialClickId: attribution.socialClickId } : undefined;
};
