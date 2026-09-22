/* global __HDMARKET_BUILD_ID__ */
import * as Sentry from '@sentry/react';
import { hasDiagnosticsConsent, subscribePrivacyPreference } from '../services/privacyPreferences';
import { monitoringPage } from '../services/productMonitoring';

// Opt-in: requires a configured DSN and the user's separate diagnostic consent.
// Sentry's default browser integrations
// already cover window 'error'/'unhandledrejection'; what's added manually here
// is the 'hdmarket:ui-error' event GlobalErrorBoundary dispatches on every
// caught render error, plus the 'hdmarket:api-error'
// events, which Sentry has no way to know about on its own.
const dsn = import.meta.env.VITE_SENTRY_DSN || '';
export const errorTrackingEnabled = Boolean(dsn);
let initialized = false;
let subscribed = false;

// Must match the release name vite.config.js passes to @sentry/vite-plugin, or
// uploaded sourcemaps won't be applied and stack traces stay minified.
const release =
  import.meta.env.VITE_SENTRY_RELEASE ||
  (typeof __HDMARKET_BUILD_ID__ === 'string' ? __HDMARKET_BUILD_ID__ : '');

// Group application routes to avoid transmitting private IDs and query strings.
const scrubUrl = (value) => {
  try {
    const url = new URL(String(value || ''), window.location.origin);
    return `${url.origin}${monitoringPage(url.pathname)}`;
  } catch { return ''; }
};

export const sanitizeDiagnosticEvent = (event) => {
  if (!hasDiagnosticsConsent()) return null;
  // Breadcrumbs can contain DOM text, console arguments and full API URLs.
  const safe = { ...event, user: undefined, breadcrumbs: undefined, extra: undefined,
    message: event.message ? 'Application diagnostic' : undefined,
    transaction: event.transaction ? monitoringPage(event.transaction) : undefined
  };
  safe.request = event.request?.url ? { url: scrubUrl(event.request.url) } : undefined;
  safe.contexts = Object.fromEntries(Object.entries(event.contexts || {}).filter(([key]) => ['browser', 'os', 'device', 'react'].includes(key)));
  if (safe.exception?.values) safe.exception = { ...safe.exception, values: safe.exception.values.map(value => ({
    ...value, value: 'Application error',
    stacktrace: value.stacktrace ? { ...value.stacktrace, frames: value.stacktrace.frames?.map(frame => ({
      ...frame, vars: undefined, filename: frame.filename?.split(/[?#]/)[0], abs_path: frame.abs_path?.split(/[?#]/)[0]
    })) } : undefined
  })) };
  return safe;
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
  if (!subscribed) {
    subscribed = true;
    subscribePrivacyPreference(() => {
      if (hasDiagnosticsConsent()) initErrorTracking();
      else if (initialized) {
        Sentry.getClient().getOptions().enabled = false;
        Sentry.setUser(null);
      }
    });
  }
  if (!hasDiagnosticsConsent()) return;
  if (initialized) { Sentry.getClient().getOptions().enabled = true; return; }
  initialized = true;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'development',
    release: release || undefined,
    // No APM/tracing and no session replay: neither was requested, both add
    // bundle weight and (for replay) capture user screens.
    tracesSampleRate: 0,
    // Never attach IP addresses or cookies to an event.
    sendDefaultPii: false,
    autoSessionTracking: false,
    integrations: defaults => defaults.filter(integration => !['Breadcrumbs', 'BrowserSession', 'SessionTiming'].includes(integration.name)),
    // Check at transport time too, so a queued envelope cannot leave after withdrawal.
    transport: options => {
      const transport = Sentry.makeFetchTransport(options);
      return { ...transport, send: envelope => hasDiagnosticsConsent() ? transport.send(envelope) : Promise.resolve({}) };
    },
    ignoreErrors: IGNORED_ERRORS,
    beforeSend: sanitizeDiagnosticEvent
  });

  // Render errors caught by GlobalErrorBoundary. The boundary passes the
  // original stack, which is reattached to a real Error so Sentry groups by the
  // failing component instead of by this file.
  window.addEventListener('hdmarket:ui-error', (event) => {
    if (!hasDiagnosticsConsent()) return;
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
    if (!hasDiagnosticsConsent()) return;
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

// Retain the AuthContext hook without attaching account identity to diagnostics.
export const setErrorTrackingUser = () => {
  if (initialized) Sentry.setUser(null);
};
