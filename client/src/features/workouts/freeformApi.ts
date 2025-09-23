export async function parseFreeform(text: string) {
  const res = await fetch('/api/workouts/parse-freeform', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const raw = await res.text();
  let data:any = {}; try { data = JSON.parse(raw); } catch {}
  if (!res.ok) throw new Error(data?.error || `Server error: ${res.status}`);
  return data.parsed as any;
}

export async function logFreeform(parsed: any, title?: string) {
  const res = await fetch('/api/workouts/log-freeform', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ parsed, title }),
  });
  const raw = await res.text();
  let data:any = {}; try { data = JSON.parse(raw); } catch {}
  if (!res.ok) throw new Error(data?.error || `Server error: ${res.status}`);
  return data.id as string;
}