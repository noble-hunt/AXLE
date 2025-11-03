// client/src/features/groups/api.ts
import { supabase } from '@/lib/supabase';
import { httpJSON } from '@/lib/http';
import { toast } from '@/hooks/use-toast';

export type GroupPost = {
  id: string;
  userId: string;
  kind: string;
  content: any;
  createdAt: string;
  groupCreatedAt: string;
  authorUsername: string;
  authorFirstName: string;
  authorLastName: string;
  authorAvatarUrl: string | null;
};

export async function fetchGroupPosts(groupId: string, since?: string): Promise<GroupPost[]> {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const qs = since ? `?after=${encodeURIComponent(since)}&limit=50` : '?limit=50';
    const data = await httpJSON(`/api/groups/${groupId}/feed${qs}`, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    });
    return data as GroupPost[];
  } catch (error: any) {
    toast({
      title: "Group Feed Load Failed",
      description: error.message || "Unable to load group posts. Please try again.",
      variant: "destructive"
    });
    throw error;
  }
}

export async function sendPost(groupId: string, text: string): Promise<GroupPost | null> {
  const body = text.trim();
  if (!body) return null;
  
  // Insert the post and get back the created_at timestamp from the database
  const { data: insertedPost, error: insertError } = await supabase
    .from('posts')
    .insert({ 
      kind: 'text',
      content: { message: body }
    })
    .select('id, created_at')
    .single();
  
  if (insertError) throw insertError;
  
  // Link to group and get the group_posts created_at
  const { data: groupPost, error: linkError } = await supabase
    .from('group_posts')
    .insert({ 
      group_id: groupId,
      post_id: insertedPost.id
    })
    .select('created_at')
    .single();
  
  if (linkError) throw linkError;
  
  // Use the database's timestamp (subtract 1 second to be safe)
  const afterTimestamp = new Date(new Date(groupPost.created_at).getTime() - 1000).toISOString();
  
  // Fetch posts created after the timestamp to get the new post with full author info
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const feedData = await httpJSON(`/api/groups/${groupId}/feed?after=${encodeURIComponent(afterTimestamp)}&limit=10`, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  });
  
  // Find the newly created post in the feed
  const newPost = feedData.find((p: any) => p.id === insertedPost.id);
  if (!newPost) {
    console.warn('Newly created post not found in feed after insert, this should not happen');
    // This should rarely happen now that we use the database timestamp
    throw new Error('Failed to fetch newly created post with author info');
  }
  return newPost;
}