import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import * as Sentry from "@sentry/browser";

// Initialize Sentry for error tracking
if (import.meta.env.VITE_SENTRY_DSN_CLIENT) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN_CLIENT,
    environment: import.meta.env.VITE_SENTRY_ENV || 'dev',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration()
    ],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.1,
  });
}

// Client bootstrap guard - check for required environment variables
const ok = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
if (!ok) console.error("[env] Missing VITE_SUPABASE_* client envs.");

createRoot(document.getElementById("root")!).render(<App />);
