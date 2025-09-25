const isBrowser = typeof window !== "undefined";

// Prefer relative /api in the browser so Vite (dev) and Vercel (prod) proxies can work.
// Fall back to localhost only for non-browser contexts.
const FALLBACK_BASE = isBrowser ? "/api" : "http://localhost:5000";

const BASE =
  (import.meta.env.VITE_API_BASE_URL?.trim() || FALLBACK_BASE).replace(/\/$/, "");

export async function httpJSON(path: string, init?: RequestInit) {
  const url =
    /^https?:\/\//i.test(path)
      ? path
      : `${BASE}/${path.replace(/^\//, "")}`;

  const res = await fetch(url, {
    // keep existing options you used (headers, credentials, etc.)
    ...init,
  });

  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    const body = ct.includes("application/json") ? await res.json().catch(() => ({})) : await res.text().catch(() => "");
    const err: any = new Error((body && (body.message || body.error)) || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return ct.includes("application/json") ? res.json() : res.text();
}