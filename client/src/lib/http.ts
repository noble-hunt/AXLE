import { toast } from '@/hooks/use-toast';

export async function httpJSON<T>(path: string, init?: RequestInit): Promise<{ ok: true; } & T> {
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
    
    // Extract error message properly
    let errorMessage: string;
    if (detail?.error?.message) {
      errorMessage = detail.error.message;
    } else if (detail?.message) {
      errorMessage = detail.message;
    } else if (detail?.error && typeof detail.error === 'string') {
      errorMessage = detail.error;
    } else if (detail && typeof detail === 'string') {
      errorMessage = detail;
    } else {
      errorMessage = `${res.status} ${res.statusText}`;
    }
    
    // helpful toast for common cases
    if (res.status === 404) {
      toast({ title: 'Not found', description: 'That endpoint was not found (404). We\'ll open the generator instead.', variant: 'destructive' });
    }
    
    // Return a structured error object instead of throwing
    return {
      ok: false,
      error: {
        message: errorMessage,
        statusCode: res.status,
        detail
      }
    } as any;
  }
  
  const responseData = isJson ? await res.json() : await res.text();
  return { ok: true, ...responseData };
}