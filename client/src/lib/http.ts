import { API_ORIGIN, API_PREFIX, isDev } from './env';

export class HttpError extends Error {
  status: number;
  body?: any;
  constructor(message: string, status: number, body?: any) { 
    super(message); 
    this.status = status; 
    this.body = body; 
  }
}

function joinApi(path: string) {
  // Runtime validation to catch regressions
  if (!path || path === "/" || typeof path !== "string") {
    const error = new HttpError("Invalid API path: path cannot be empty or root '/'", 400);
    if (isDev) {
      console.error('[HTTP] joinApi failed:', { path, type: typeof path });
    }
    throw error;
  }
  
  // Ensure path starts with /
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  
  // Build final URL: origin + /api + path
  // Examples:
  // - Dev (same-origin): "" + "/api" + "/workouts/preview" = "/api/workouts/preview" 
  // - Prod with origin: "https://api.example.com" + "/api" + "/workouts/preview" = "https://api.example.com/api/workouts/preview"
  const fullUrl = `${API_ORIGIN}${API_PREFIX}${path}`;
  
  // Runtime check to catch double-prefix regressions
  if (isDev) {
    if (fullUrl.includes('/api/api/')) {
      console.error('[HTTP] REGRESSION DETECTED: Double /api prefix in URL:', fullUrl);
      throw new HttpError(`Double /api prefix detected in URL: ${fullUrl}`, 500);
    }
    if (path.startsWith('/api/')) {
      console.warn('[HTTP] WARNING: Path already contains /api prefix, this may cause issues:', { path, fullUrl });
    }
  }
  
  return fullUrl;
}

export async function httpJSON(path: string, init?: RequestInit) {
  const url = joinApi(path);
  const res = await fetch(url, { headers: { "Content-Type": "application/json", ...init?.headers }, ...init });
  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const data = isJson ? await res.json().catch(() => undefined) : await res.text();

  if (!res.ok) {
    // Improved error messages
    let msg = `HTTP ${res.status}`;
    
    if (isJson && data?.error) {
      msg = typeof data.error === 'string' ? data.error : data.error.message || msg;
    } else if (isJson && data?.message) {
      msg = data.message;
    } else if (typeof data === "string" && data) {
      msg = data.slice(0, 200);
    }
    
    // Add context for common errors
    if (res.status === 404) {
      msg += ` - Endpoint not found: ${url}`;
    } else if (res.status === 401) {
      msg += ` - Authentication required`;
    }
    
    if (isDev) {
      console.error('[HTTP] Request failed:', { url, status: res.status, msg, data });
    }
    
    throw new HttpError(msg, res.status, data);
  }
  return data;
}