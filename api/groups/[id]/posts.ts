// api/groups/[id]/posts.ts
import { supabaseFromReq } from '../../_supabase';
export const config = { runtime: 'nodejs18.x' };
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export default async function handler(req: Request, ctx: { params: { id: string } }) {
  const groupId = ctx.params.id;
  if (!isUuid(groupId)) return new Response(JSON.stringify({ error: 'Invalid group id' }), { status: 400, headers:{'content-type':'application/json'} });
  const supabase = supabaseFromReq(req);

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const since = url.searchParams.get('since');
    let q = supabase
      .from('group_posts')
      .select('id, group_id, author_id, body, meta, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (since) q = q.gte('created_at', since);
    const { data, error } = await q;
    if (error) return jsonErr(error.message, 400);
    return json({ posts: data ?? [] });
  }

  if (req.method === 'POST') {
    const { body, meta } = await req.json().catch(() => ({}));
    if (!body || typeof body !== 'string' || !body.trim()) return jsonErr('Body required', 400);
    const { data, error } = await supabase
      .from('group_posts')
      .insert({ group_id: groupId, body: body.trim(), meta: meta ?? null })
      .select('*').single();
    if (error) return jsonErr(error.message, 400);
    return json(data, 201);
  }

  return new Response('Method Not Allowed', { status: 405 });

  function json(x: any, status = 200) {
    return new Response(JSON.stringify(x), { status, headers: { 'content-type':'application/json', 'cache-control':'no-store' }});
  }
  function jsonErr(msg: string, status = 400) {
    return json({ error: msg }, status);
  }
}