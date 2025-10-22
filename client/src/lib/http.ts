import { API_ORIGIN, API_PREFIX, isDev } from "@/lib/env";

export class HttpError extends Error {
  status: number;
  body?: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/**
 * Build an API URL from a relative path.
 * Uses VITE_API_ORIGIN env var if set, otherwise uses relative /api paths.
 * 
 * @example
 * api('/workouts/preview') // => '/api/workouts/preview' (or https://api.example.com/api/workouts/preview)
 * api('workouts/preview')  // => '/api/workouts/preview'
 */
export function api(path: string): string {
  return buildApiUrl(path);
}

function buildApiUrl(resourcePath: string) {
  if (!resourcePath || typeof resourcePath !== "string") {
    throw new HttpError("Invalid API path (empty)", 0);
  }
  let p = resourcePath.startsWith("/") ? resourcePath : `/${resourcePath}`;

  // Disallow callers smuggling /api in; we add it centrally
  if (p.startsWith(`${API_PREFIX}/`)) {
    p = p.slice(API_PREFIX.length); // now p begins with "/" for the resource
  }

  const base = API_ORIGIN; // "" for same-origin
  const url = `${base}${API_PREFIX}${p}`;

  if (isDev) {
    // one-line dev trace to catch regressions fast
    // eslint-disable-next-line no-console
    console.debug("[http] →", url);
  }
  return url;
}

export async function httpJSON(resourcePath: string, init?: RequestInit) {
  const url = buildApiUrl(resourcePath);
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  const ctype = res.headers.get("content-type") || "";
  const isJson = ctype.includes("application/json");
  const payload = isJson ? await res.json().catch(() => undefined) : await res.text();

  if (!res.ok) {
    // Try common shapes: {error: "..."} | {message: "..."} | nested object
    let message =
      (isJson && (payload?.error || payload?.message)) ||
      (typeof payload === "string" ? payload : "");
    if (!message || typeof message !== "string") {
      try { message = JSON.stringify(payload).slice(0, 300); } catch {}
    }
    if (!message) message = `HTTP ${res.status}`;
    throw new HttpError(message, res.status, payload);
  }
  return payload;
}