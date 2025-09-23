// api/groups/[id]/posts.ts
import { supabaseFromReq } from '../../_supabase';
export const config = { runtime: 'nodejs18.x' };
export default async function handler(req: Request, ctx: { params: { id: string } }) {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  const supabase = supabaseFromReq(req);
  const { id: gid } = ctx.params;

  const url = new URL(req.url);
  const since = url.searchParams.get('since');

  let q = supabase
    .from('group_posts')
    .select('id, group_id, author_id, body, meta, created_at')
    .eq('group_id', gid)
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (since) {
    q = q.gt('created_at', since);
  }

  const { data, error } = await q;

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type':'application/json' }});
  return new Response(JSON.stringify({ posts: data ?? [] }), { status: 200, headers: { 'content-type':'application/json', 'cache-control':'no-store' }});
}