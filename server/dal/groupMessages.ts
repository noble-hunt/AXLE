import { supabaseAdmin } from "../lib/supabaseAdmin";

export interface SendGroupMessageParams {
  userId: string;
  groupId: string;
  body: string;
  meta?: Record<string, any>;
}

export interface GetGroupMessagesOptions {
  before?: string; // For keyset pagination (created_at timestamp)
  limit?: number;
}

export async function sendGroupMessage(
  userId: string, 
  groupId: string, 
  body: string, 
  meta?: Record<string, any>
) {
  // First verify the user is a member of the group
  const { data: membership } = await supabaseAdmin
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (!membership) {
    throw new Error('User is not a member of this group');
  }

  // Insert the message
  const { data, error } = await supabaseAdmin
    .from('group_messages')
    .insert({
      group_id: groupId,
      author_id: userId,
      body: body.trim(),
      meta: meta || null
    })
    .select(`
      id,
      group_id,
      author_id,
      body,
      meta,
      created_at
    `)
    .single();

  if (error) {
    throw new Error(`Failed to send message: ${error.message}`);
  }

  return data;
}

export async function getGroupMessages(
  userId: string,
  groupId: string,
  options: GetGroupMessagesOptions = {}
) {
  // First verify the user is a member of the group
  const { data: membership } = await supabaseAdmin
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (!membership) {
    throw new Error('User is not a member of this group');
  }

  // Build query for messages with pagination
  let query = supabaseAdmin
    .from('group_messages')
    .select(`
      id,
      group_id,
      author_id,
      body,
      meta,
      created_at
    `)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  // Apply keyset pagination if 'before' cursor is provided
  if (options.before) {
    query = query.lt('created_at', options.before);
  }

  // Apply limit (default to 50)
  const limit = Math.min(options.limit || 50, 100); // Cap at 100 messages
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  // Return in ascending order (oldest first) for chat display
  return (data || []).reverse();
}

export async function deleteGroupMessage(
  userId: string,
  groupId: string,
  messageId: string
) {
  // Verify the user can delete this message (author or group admin/owner)
  const { data: message } = await supabaseAdmin
    .from('group_messages')
    .select('author_id')
    .eq('id', messageId)
    .eq('group_id', groupId)
    .single();

  if (!message) {
    throw new Error('Message not found');
  }

  // Check if user is the author
  if (message.author_id === userId) {
    // User can delete their own message
  } else {
    // Check if user is admin/owner of the group
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new Error('Only message author or group admins can delete messages');
    }
  }

  // Delete the message
  const { error } = await supabaseAdmin
    .from('group_messages')
    .delete()
    .eq('id', messageId)
    .eq('group_id', groupId);

  if (error) {
    throw new Error(`Failed to delete message: ${error.message}`);
  }

  return { success: true };
}