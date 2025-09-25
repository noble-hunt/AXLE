// client/src/features/groups/api.ts
import { supabase } from '@/lib/supabase';
import { httpJSON } from '@/lib/http';
import { toast } from '@/hooks/use-toast';

export type GroupPost = {
  id: number;
  group_id: string;
  author_id: string;
  body: string;
  meta: any | null;
  created_at: string;
};

export async function fetchGroupPosts(groupId: string, since?: string): Promise<GroupPost[]> {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    const data = await httpJSON(`/api/groups/${groupId}/posts${qs}`, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    });
    return data.posts as GroupPost[];
  } catch (error: any) {
    toast({
      title: "Group Feed Load Failed",
      description: error.message || "Unable to load group posts. Please try again.",
      variant: "destructive"
    });
    throw error;
  }
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