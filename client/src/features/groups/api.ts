// client/src/features/groups/api.ts
import { supabase } from '@/lib/supabase';
export async function fetchGroupPosts(groupId: string) {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const res = await fetch(`/api/groups/${groupId}/posts`, {
    headers: { Authorization: `Bearer ${token ?? ''}` }
  });
  if (!res.ok) {
    console.error('[groups/posts] load failed', res.status, await res.text());
    throw new Error('Unable to fetch group feed');
  }
  return (await res.json()).posts as any[];
}