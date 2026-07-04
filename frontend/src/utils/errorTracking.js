import * as Sentry from '@sentry/react';

// Opt-in: does nothing unless VITE_SENTRY_DSN is set at build time (no
// account/DSN required to ship this). Sentry's default browser integrations
// already cover window 'error'/'unhandledrejection'; the only thing added
// manually here is the 'hdmarket:ui-error' event GlobalErrorBoundary
// dispatches on every caught render error, which Sentry has no way to know
// about on its own.
const dsn = import.meta.env.VITE_SENTRY_DSN || '';
export const errorTrackingEnabled = Boolean(dsn);

export const initErrorTracking = () => {
  if (!errorTrackingEnabled || typeof window === 'undefined') return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'development',
    tracesSampleRate: 0
  });

  window.addEventListener('hdmarket:ui-error', (event) => {
    const detail = event?.detail || {};
    Sentry.captureException(new Error(detail.message || 'UI_ERROR'), {
      extra: { componentStack: detail.componentStack }
    });
  });
};
