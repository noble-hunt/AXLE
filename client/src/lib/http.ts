export async function httpJSON(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    const body = ct.includes('application/json') ? await res.json().catch(() => ({})) : await res.text();
    throw Object.assign(new Error(`HTTP ${res.status} on ${input}`), { status: res.status, body });
  }
  return ct.includes('application/json') ? res.json() : res.text();
}