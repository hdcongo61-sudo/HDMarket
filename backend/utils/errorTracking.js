import * as Sentry from '@sentry/node';

// Opt-in: does nothing unless SENTRY_DSN is set (no account/DSN required to
// deploy this). Complements, not replaces, the existing ErrorLog DB persistence
// in middlewares/globalErrorHandler.js — that stays the durable, queryable
// record; this adds real-time alerting on top for 500-level errors so they're
// known about before a user reports them, instead of only discoverable by
// querying the ErrorLog collection after the fact.
const dsn = process.env.SENTRY_DSN || '';
export const errorTrackingEnabled = Boolean(dsn);

export const initErrorTracking = () => {
  if (!errorTrackingEnabled) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0)
  });
};

export const captureServerError = (err, context = {}) => {
  if (!errorTrackingEnabled) return;
  Sentry.captureException(err, { extra: context });
};
