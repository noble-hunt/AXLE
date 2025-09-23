// api/storage/group-photos/signed-upload.ts
import { supabaseAdmin } from '../../_supabaseAdmin';
export const config = { runtime: 'nodejs18.x' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  
  const { groupId, filename } = await req.json().catch(() => ({}));
  if (!groupId) return json({ error: 'groupId required' }, 400);
  
  const ext = (String(filename || 'jpg').split('.').pop() || 'jpg').toLowerCase();
  const path = `${groupId}/${crypto.randomUUID()}.${ext}`;
  
  const { data, error } = await supabaseAdmin.storage.from('group-photos').createSignedUploadUrl(path);
  if (error) return json({ error: error.message }, 400);
  
  // Include signedUrl for SDK fallback
  return json({ path, token: data.token, signedUrl: (data as any).signedUrl });
  
  function json(x: any, status = 200) {
    return new Response(JSON.stringify(x), {
      status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    });
  }
}