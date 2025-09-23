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
  
  const rawPosts = (await res.json()).posts;
  
  // Transform server data to match UI expectations
  return rawPosts.map((post: any) => ({
    id: post.id,
    kind: post.meta?.kind || 'text', // Default to 'text' if no kind specified
    content: post.meta?.content || { body: post.body }, // Use meta content or fallback to body
    createdAt: post.created_at, // Convert snake_case to camelCase
    authorId: post.author_id, // Convert snake_case to camelCase
    authorName: post.meta?.authorName || 'Unknown', // Use meta author name or fallback
    authorAvatar: post.meta?.authorAvatar || null // Use meta author avatar or null
  }));
}