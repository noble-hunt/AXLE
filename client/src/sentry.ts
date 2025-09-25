import * as Sentry from '@sentry/browser';

export function initSentry() {
  try {
    const dsn = import.meta.env.VITE_SENTRY_DSN_CLIENT;
    const env = import.meta.env.VITE_SENTRY_ENV || 'dev';
    if (!dsn) return; // no-op in local/dev without DSN
    Sentry.init({
      dsn,
      environment: env,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  } catch (err) {
    // Never block app start on Sentry
    console.warn('Sentry init skipped:', err);
  }
}