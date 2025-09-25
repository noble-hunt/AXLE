import * as Sentry from "@sentry/node";

export function initSentry() {
  if (!process.env.SENTRY_DSN_SERVER) return;
  
  Sentry.init({
    dsn: process.env.SENTRY_DSN_SERVER,
    environment: process.env.SENTRY_ENV || "dev",
    tracesSampleRate: 0.2,
  });
}

export { Sentry };