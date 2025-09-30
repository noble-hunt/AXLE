// api/storage/group-photos/signed-upload.ts
import { supabaseFromReq } from '../../_supabase';
import { supabaseAdmin } from '../../_supabaseAdmin';
export const config = { runtime: 'nodejs' };

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  
  try {
    const { groupId, filename } = await req.json().catch(() => ({}));
    if (!groupId) return json({ error: 'groupId required' }, 400);
    if (!isUuid(groupId)) return json({ error: 'Invalid group id' }, 400);
    
    // Verify user is authenticated and is a member of the group
    const supabase = supabaseFromReq(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return json({ error: 'Authentication required' }, 401);
    }
    
    const { data: membership, error: memberError } = await supabase
      .from('group_memberships')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .single();
    
    if (memberError || !membership) {
      return json({ error: 'Access denied: not a group member' }, 403);
    }
    
    const ext = (String(filename || 'jpg').split('.').pop() || 'jpg').toLowerCase();
    const path = `${groupId}/${crypto.randomUUID()}.${ext}`;
    
    const { data, error } = await supabaseAdmin.storage.from('group-photos').createSignedUploadUrl(path);
    if (error) return json({ error: error.message }, 400);
    
    // Include signedUrl for SDK fallback
    return json({ path, token: data.token, signedUrl: (data as any).signedUrl });
  } catch (error) {
    console.error('Storage signed upload error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
  
  function json(x: any, status = 200) {
    return new Response(JSON.stringify(x), {
      status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    });
  }
}