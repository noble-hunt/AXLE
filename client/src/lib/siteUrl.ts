// client/src/lib/siteUrl.ts
export function getSiteUrl() {
  // Vercel prod/staging can supply this; else fall back to browser origin
  const env = import.meta.env.VITE_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return window.location.origin;
}