import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAnalytics,
  isSupported,
  logEvent,
  setUserId,
  setUserProperties,
  setAnalyticsCollectionEnabled,
  setConsent
} from 'firebase/analytics';
import api from './api';
import { hasAnalyticsConsent } from './privacyPreferences';
import { monitoringPage } from './productMonitoring';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ''
};

let analyticsInstance = null;
let initPromise = null;
const recentRealtimeEvents = new Map();
const REALTIME_EVENT_DEDUP_MS = 2500;

const canUseAnalytics = async () => {
  if (typeof window === 'undefined') return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
};

export const initAnalytics = async () => {
  if (!hasAnalyticsConsent()) return null;
  if (typeof window !== 'undefined' && firebaseConfig.measurementId) window[`ga-disable-${firebaseConfig.measurementId}`] = false;
  if (analyticsInstance) {
    setAnalyticsCollectionEnabled(analyticsInstance, true);
    setConsent({ analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    return analyticsInstance;
  }
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!firebaseConfig.apiKey) return null;
    const supported = await canUseAnalytics();
    if (!supported || !hasAnalyticsConsent()) return null;
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    setConsent({ analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    analyticsInstance = initializeAnalytics(app, { config: {
      send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
      page_location: `${window.location.origin}${monitoringPage(window.location.pathname)}`,
      page_referrer: '', page_title: 'HDMarket', cookie_expires: 180 * 24 * 60 * 60, cookie_update: false
    } });
    return analyticsInstance;
  })().catch(() => null).finally(() => { initPromise = null; });
  return initPromise;
};

export const disableAnalytics = () => {
  recentRealtimeEvents.clear();
  if (typeof window !== 'undefined' && firebaseConfig.measurementId) window[`ga-disable-${firebaseConfig.measurementId}`] = true;
  if (!analyticsInstance) return;
  setAnalyticsCollectionEnabled(analyticsInstance, false);
  setUserId(analyticsInstance, null);
  setConsent({ analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
};

export const trackPageView = async ({ path }) => {
  const analytics = await initAnalytics();
  if (!analytics || !hasAnalyticsConsent()) return;
  const pagePath = monitoringPage(path || window.location.pathname);
  logEvent(analytics, 'page_view', {
    page_path: pagePath,
    page_location: `${window.location.origin}${pagePath}`,
    page_referrer: '',
    page_title: 'HDMarket'
  });
};

export const trackEvent = async (name, params = {}) => {
  if (!/^(product_card_interaction|product_gallery_[a-z_]+|image_preview_[a-z_]+)$/.test(name || '')) return;
  const analytics = await initAnalytics();
  if (!analytics || !hasAnalyticsConsent()) return;
  const allowed = new Set(['action', 'card_view_mode', 'boosted', 'has_discount', 'gallery_enabled', 'gallery_variant', 'gallery_mode', 'gallery_image_count', 'event_name', 'variant', 'display_mode', 'image_index', 'unique_images_viewed', 'duration_ms', 'entity_type', 'context_type']);
  const safe = Object.fromEntries(Object.entries(params).filter(([key, value]) => allowed.has(key) && ['number', 'boolean', 'string'].includes(typeof value)).map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 40) : value]));
  logEvent(analytics, name, { ...safe, page_location: `${window.location.origin}${monitoringPage(window.location.pathname)}`, page_referrer: '', page_title: 'HDMarket' });
};

export const setAnalyticsUser = async (user) => {
  const analytics = await initAnalytics();
  if (!analytics || !hasAnalyticsConsent()) return;
  if (!user) {
    setUserId(analytics, null);
    setUserProperties(analytics, {});
    return;
  }
  const userId = user._id || user.id || null;
  if (userId) {
    setUserId(analytics, String(userId));
  }
  setUserProperties(analytics, {
    account_type: user.accountType || 'person',
    role: user.role || 'user'
  });
};

export const trackRealtimeMonitoringEvent = async (payload = {}) => {
  if (typeof window === 'undefined' || !hasAnalyticsConsent()) return;

  const eventType = String(payload?.eventType || '').trim().toLowerCase();
  if (!eventType) return;

  const rawPath = monitoringPage(payload?.path || window.location.pathname);
  const dedupKey = `${eventType}:${rawPath}`;
  const now = Date.now();
  const previousAt = Number(recentRealtimeEvents.get(dedupKey) || 0);
  if (previousAt && now - previousAt < REALTIME_EVENT_DEDUP_MS) return;
  recentRealtimeEvents.set(dedupKey, now);

  // Keep map compact to avoid unbounded growth in long sessions.
  if (recentRealtimeEvents.size > 100) {
    for (const [key, value] of recentRealtimeEvents.entries()) {
      if (now - Number(value || 0) > 60_000) {
        recentRealtimeEvents.delete(key);
      }
    }
  }

  try {
    await api.post(
      '/analytics/realtime/events',
      {
        eventType,
        path: rawPath,
        entityType: payload?.entityType || '',
        entityId: '',
        role: payload?.role || '',
        accountType: payload?.accountType || ''
      },
      {
        silentGlobalError: true,
        timeout: 4000,
        headers: {
          'x-skip-cache': '1'
        }
      }
    );
  } catch {
    // Ignore client-side analytics transport errors.
  }
};
