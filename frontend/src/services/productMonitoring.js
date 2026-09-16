import { hasAnalyticsConsent } from './privacyPreferences';

let client;
let initializing;
let identity = '';
export const isPublicPostHogKey = value => typeof value === 'string' && /^phc_[A-Za-z0-9_-]+$/.test(value);
const key = import.meta.env.VITE_POSTHOG_KEY;
const host = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';
const allowedEvents = new Set(['$pageview', '$pageleave', '$identify', '$set', 'page_engagement', 'product_viewed', 'cart_viewed', 'checkout_viewed', 'cart_item_added', 'payment_return_viewed', 'payment_confirmed_in_browser', 'search_viewed', 'signed_in']);
const allowedProperties = new Set(['distinct_id', '$anon_distinct_id', '$session_id', '$window_id', '$device_id', '$lib', '$lib_version', '$browser', '$browser_version', '$os', '$os_version', '$device_type', '$screen_height', '$screen_width', '$viewport_height', '$viewport_width', '$current_url', '$pathname', 'page', 'auth_state', 'account_type', 'role', 'active_seconds', 'scroll_percent', 'quantity', '$process_person_profile', '$is_identified', '$set', '$set_once']);

// Route groups deliberately omit product slugs, order IDs, search terms, tokens and hashes.
export const monitoringPage = (pathname) => {
  const path = String(pathname || '/').split(/[?#]/)[0];
  if (path === '/') return '/';
  const parts = path.split('/').filter(Boolean);
  if (['admin', 'founder', 'delivery'].includes(parts[0])) return `/${parts[0]}`;
  if (['product', 'shop'].includes(parts[0])) return `/${parts[0]}/:item`;
  if (parts[0] === 'orders') {
    if (['checkout', 'messages', 'all', 'pending', 'confirmed', 'delivered', 'cancelled'].includes(parts[1])) return `/orders/${parts[1]}`;
    return parts.length > 1 ? '/orders/:detail' : '/orders';
  }
  if (parts[0] === 'payment') return '/payment';
  if (parts[0] === 'quotations') return '/quotations/:detail';
  if (parts[0] === 'seller') return `/seller/${['products', 'orders', 'videos', 'analytics'].includes(parts[1]) ? parts[1] : ':page'}`;
  const publicPages = ['search', 'products', 'shops', 'cart', 'profile', 'videos', 'suggestions', 'login', 'register', 'favorites', 'notifications'];
  return publicPages.includes(parts[0]) ? `/${parts[0]}` : '/other';
};
export const sanitizeMonitoringEvent = event => {
  if (!event || !allowedEvents.has(event.event)) return null;
  const properties = Object.fromEntries(Object.entries(event.properties || {}).filter(([name]) => allowedProperties.has(name)));
  for (const key of ['$set', '$set_once']) {
    if (properties[key]) properties[key] = Object.fromEntries(Object.entries(properties[key]).filter(([name]) => ['account_type', 'role'].includes(name)));
  }
  if (properties.$current_url) {
    try { properties.$current_url = `${window.location.origin}${monitoringPage(new URL(properties.$current_url, window.location.origin).pathname)}`; }
    catch { delete properties.$current_url; }
  }
  if (properties.$pathname) properties.$pathname = monitoringPage(properties.$pathname);
  return { ...event, properties };
};
const permitted = () => {
  try { return isPublicPostHogKey(key) && hasAnalyticsConsent() && (import.meta.env.PROD || import.meta.env.VITE_POSTHOG_DEBUG === 'true'); } catch { return false; }
};
export const initProductMonitoring = async () => {
  if (!permitted()) return null;
  if (client) return client;
  if (!initializing) initializing = import('posthog-js').then(({ default: posthog }) => {
    if (!permitted()) return null;
    posthog.init(key, {
      api_host: host, autocapture: false, capture_pageview: false, capture_pageleave: false,
      capture_exceptions: false, capture_performance: false, capture_heatmaps: false,
      disable_session_recording: true, disable_surveys: true, advanced_disable_feature_flags: true,
      person_profiles: 'identified_only', ip: false, save_referrer: false, save_campaign_params: false,
      before_send: sanitizeMonitoringEvent
    });
    client = posthog;
    return client;
  }).catch(() => null).finally(() => { initializing = null; });
  return initializing;
};
export const disableProductMonitoring = () => {
  if (client) { client.reset(); client.opt_out_capturing(); }
  identity = '';
};
export const setMonitoringUser = (user) => {
  if (!client || !permitted()) return;
  const id = String(user?._id || user?.id || '');
  const previousId = identity || (client.get_property('auth_state') === 'signed_in' ? client.get_distinct_id() : '');
  if (previousId && previousId !== id) client.reset();
  if (client.has_opted_out_capturing()) client.opt_in_capturing({ captureEventName: false });
  if (id && identity !== id) client.identify(id, { account_type: user.accountType || 'person', role: user.role || 'user' });
  const newlySignedIn = id && identity !== id;
  identity = id;
  client.register({ auth_state: id ? 'signed_in' : 'guest', account_type: user?.accountType || 'guest', role: user?.role || 'guest' });
  if (newlySignedIn) client.capture('signed_in');
};
export const captureMonitoring = (name, properties = {}) => {
  if (!client || !permitted()) return;
  try { client.capture(name, properties); } catch { /* Analytics must not interrupt shopping. */ }
};
