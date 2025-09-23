// client/src/features/groups/api.ts
import { supabase } from '@/lib/supabase';

export type GroupPost = {
  id: number;
  group_id: string;       // uuid
  author_id: string;      // uuid
  body: string;
  meta: any | null;
  created_at: string;     // ISO
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