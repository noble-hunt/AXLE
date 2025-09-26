import { toast } from '@/hooks/use-toast';

export async function httpJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const base = import.meta.env.VITE_API_BASE_URL || '';
  const url = `${base}${path.startsWith('/') ? path : '/' + path}`;
  const res = await fetch(url, {
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    credentials: 'include',
    ...init,
  });

  const ct = res.headers.get('content-type') || '';
  const isJson = ct.includes('application/json');
  if (!res.ok) {
    let detail: any = undefined;
    if (isJson) {
      try { detail = await res.json(); } catch {}
    }
    // helpful toast for common cases
    const msg = detail?.error || `${res.status} ${res.statusText}`;
    if (res.status === 404) {
      toast({ title: 'Not found', description: 'That endpoint was not found (404). We\'ll open the generator instead.', variant: 'destructive' });
    }
    throw Object.assign(new Error(msg), { statusCode: res.status, detail });
  }
  return (isJson ? res.json() : (await res.text())) as T;
}