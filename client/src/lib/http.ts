import { API_BASE } from './env';

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
  if (!path || path === "/" || typeof path !== "string") {
    throw new HttpError("Invalid API path (empty)", 0);
  }
  if (!path.startsWith("/")) path = `/${path}`;
  return `${API_BASE}${path}`;
}

export async function httpJSON(path: string, init?: RequestInit) {
  const url = joinApi(path);
  const res = await fetch(url, { headers: { "Content-Type": "application/json", ...init?.headers }, ...init });
  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const data = isJson ? await res.json().catch(() => undefined) : await res.text();

  if (!res.ok) {
    const msg = isJson && data?.error
      ? data.error
      : typeof data === "string" && data ? data.slice(0, 200) : `HTTP ${res.status}`;
    throw new HttpError(msg, res.status, data);
  }
  return data;
}