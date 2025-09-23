// client/src/features/groups/api.ts
import { supabase } from '@/lib/supabase';

export type GroupPost = {
  id: number;
  group_id: string;
  author_id: string;
  body: string;
  meta: any | null;
  created_at: string;
};

export async function fetchGroupPosts(groupId: string, since?: string): Promise<GroupPost[]> {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const qs = since ? `?since=${encodeURIComponent(since)}` : '';
  const res = await fetch(`/api/groups/${groupId}/posts${qs}`, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  });
  if (!res.ok) {
    console.error('[groups/posts] load failed', res.status, await res.text());
    throw new Error('Unable to fetch group feed');
  }
  const { posts } = await res.json();
  return posts as GroupPost[];
}

export async function sendPost(groupId: string, text: string) {
  const body = text.trim();
  if (!body) return null;
  const { data, error } = await supabase
    .from('group_posts')
    .insert({ group_id: groupId, body, meta: null })
    .select('*').single();
  if (error) throw error;
  return data as GroupPost;
}