/* global __HDMARKET_BUILD_ID__ */
import * as Sentry from '@sentry/react';

// Opt-in: does nothing unless VITE_SENTRY_DSN is set at build time (no
// account/DSN required to ship this). Sentry's default browser integrations
// already cover window 'error'/'unhandledrejection'; what's added manually here
// is the 'hdmarket:ui-error' event GlobalErrorBoundary dispatches on every
// caught render error, plus the 'hdmarket:api-error'/'hdmarket:query-error'
// events, which Sentry has no way to know about on its own.
const dsn = import.meta.env.VITE_SENTRY_DSN || '';
export const errorTrackingEnabled = Boolean(dsn);

// Must match the release name vite.config.js passes to @sentry/vite-plugin, or
// uploaded sourcemaps won't be applied and stack traces stay minified.
const release =
  import.meta.env.VITE_SENTRY_RELEASE ||
  (typeof __HDMARKET_BUILD_ID__ === 'string' ? __HDMARKET_BUILD_ID__ : '');

// Query/body keys whose values must never reach a third party. Mirrors
// SENSITIVE_FIELDS in backend/middlewares/globalErrorHandler.js.
const SENSITIVE_KEYS = [
  'password',
  'token',
  'authorization',
  'cookie',
  'refreshtoken',
  'accesstoken',
  'jwt',
  'secret',
  'apikey',
  'otp',
  'verificationcode',
  'transactioncode'
];

const isSensitiveKey = (key = '') => {
  const lower = String(key).toLowerCase();
  return SENSITIVE_KEYS.some((field) => lower.includes(field));
};

// Strips secrets out of query strings before a URL is sent to Sentry. Password
// reset and payment-verification links carry tokens as query params.
const scrubUrl = (value) => {
  const raw = String(value || '');
  if (!raw.includes('?')) return raw;
  const [base, query] = raw.split('?');
  try {
    const params = new URLSearchParams(query);
    let touched = false;
    for (const key of [...params.keys()]) {
      if (isSensitiveKey(key)) {
        params.set(key, '[REDACTED]');
        touched = true;
      }
    }
    return touched ? `${base}?${params.toString()}` : raw;
  } catch {
    return base;
  }
};

// Noise that is not actionable: user connectivity, browser extensions, and
// aborted requests the app cancels on purpose (see abortPendingRequests).
const IGNORED_ERRORS = [
  'Network Error',
  'NetworkError',
  'Failed to fetch',
  'Load failed',
  'AbortError',
  'canceled',
  'CanceledError',
  'ResizeObserver loop',
  'Non-Error promise rejection captured'
];

export const initErrorTracking = () => {
  if (!errorTrackingEnabled || typeof window === 'undefined') return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'development',
    release: release || undefined,
    // No APM/tracing and no session replay: neither was requested, both add
    // bundle weight and (for replay) capture user screens.
    tracesSampleRate: 0,
    // Never attach IP addresses or cookies to an event.
    sendDefaultPii: false,
    ignoreErrors: IGNORED_ERRORS,
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = scrubUrl(event.request.url);
      }
      // Sentry does not send cookies with sendDefaultPii off, but headers can
      // still arrive via manually attached context.
      if (event.request?.headers) {
        for (const key of Object.keys(event.request.headers)) {
          if (isSensitiveKey(key)) event.request.headers[key] = '[REDACTED]';
        }
      }
      if (Array.isArray(event.breadcrumbs)) {
        event.breadcrumbs = event.breadcrumbs.map((crumb) =>
          crumb?.data?.url ? { ...crumb, data: { ...crumb.data, url: scrubUrl(crumb.data.url) } } : crumb
        );
      }
      return event;
    }
  });

  // Render errors caught by GlobalErrorBoundary. The boundary passes the
  // original stack, which is reattached to a real Error so Sentry groups by the
  // failing component instead of by this file.
  window.addEventListener('hdmarket:ui-error', (event) => {
    const detail = event?.detail || {};
    const error = new Error(String(detail.message || 'UI_ERROR'));
    error.name = 'UiRenderError';
    if (detail.stack) error.stack = String(detail.stack);
    Sentry.captureException(error, {
      tags: { source: 'error-boundary' },
      contexts: { react: { componentStack: String(detail.componentStack || '') } }
    });
  });

  // Failed API calls. Reported at a lower level than a crash: these are
  // expected to happen occasionally and are useful as trend data, so they go in
  // as messages rather than exceptions to avoid drowning out real bugs.
  window.addEventListener('hdmarket:api-error', (event) => {
    const detail = event?.detail || {};
    const status = Number(detail.status || 0);
    // Client-side validation failures and auth expiry are normal operation.
    if (status > 0 && status < 500) return;
    Sentry.captureMessage(`API ${status || 'network'}: ${detail.code || 'API_ERROR'}`, {
      level: 'warning',
      tags: { source: 'api', status: String(status || 0), code: String(detail.code || '') },
      extra: { requestId: String(detail.requestId || '') }
    });
  });
};

// Attaches the signed-in user so an error report shows how many distinct people
// hit it. Deliberately id-only: name, email, and phone are PII and are not sent.
export const setErrorTrackingUser = (user) => {
  if (!errorTrackingEnabled) return;
  if (!user?.id) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: String(user.id) });
  Sentry.setTag('user.role', String(user.role || 'user'));
};
