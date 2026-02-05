import { initializeApp, getApps } from 'firebase/app';
import {
  getAnalytics,
  isSupported,
  logEvent,
  setUserId,
  setUserProperties
} from 'firebase/analytics';

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

const canUseAnalytics = async () => {
  if (typeof window === 'undefined') return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
};

export const initAnalytics = async () => {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!firebaseConfig.apiKey) return null;
    const supported = await canUseAnalytics();
    if (!supported) return null;
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    analyticsInstance = getAnalytics(app);
    return analyticsInstance;
  })();
  return initPromise;
};

export const trackPageView = async ({ path, title }) => {
  const analytics = await initAnalytics();
  if (!analytics) return;
  const pagePath = path || window.location.pathname;
  logEvent(analytics, 'page_view', {
    page_path: pagePath,
    page_location: window.location.href,
    page_title: title || document.title || 'HDMarket'
  });
};

export const trackEvent = async (name, params = {}) => {
  if (!name) return;
  const analytics = await initAnalytics();
  if (!analytics) return;
  logEvent(analytics, name, params);
};

export const setAnalyticsUser = async (user) => {
  const analytics = await initAnalytics();
  if (!analytics) return;
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
