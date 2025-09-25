const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export async function httpJSON(input: RequestInfo, init?: RequestInit) {
  // If input is a relative path starting with /api, prefix with base URL
  let url = input;
  if (typeof input === 'string' && input.startsWith('/api') && API_BASE) {
    url = API_BASE + input;
  }
  
  const res = await fetch(url, init);
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    const body = ct.includes('application/json') ? await res.json().catch(() => ({})) : await res.text();
    throw Object.assign(new Error(`HTTP ${res.status} on ${url}`), { status: res.status, body });
  }
  return ct.includes('application/json') ? res.json() : res.text();
}