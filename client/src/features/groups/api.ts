import { supabase } from "@/lib/supabase";

export type Group = {
  id: string;
  name: string;
  description?: string;
  photo_url: string | null;
  is_public: boolean;
  owner_id: string;
  created_at: string;
  memberCount?: number;
  userRole?: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
};

export type GroupPost = {
  id: string;
  group_id: string;
  user_id: string;
  kind: string;
  content: any;
  created_at: string;
};

// Return groups the current user belongs to
export async function getMyGroups() {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return { data: [] as Group[], error: null };

  const { data, error } = await supabase
    .from("group_members")
    .select(`
      role,
      group:groups (
        id,
        name,
        description,
        photo_url,
        is_public,
        owner_id,
        created_at
      )
    `)
    .eq("user_id", user.id);

  if (error) return { data: [] as Group[], error };
  
  // Transform the data to include role information
  const groups = (data ?? []).map((item: any) => ({
    ...item.group,
    userRole: item.role,
  })) as Group[];

  return { data: groups, error: null };
}

export async function createGroup(input: {
  name: string;
  description?: string;
  is_public?: boolean;
  photo_url?: string | null;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user!;
  
  const { data: inserted, error } = await supabase
    .from("groups")
    .insert({ 
      name: input.name, 
      description: input.description,
      is_public: !!input.is_public, 
      photo_url: input.photo_url ?? null, 
      owner_id: user.id 
    })
    .select()
    .single();

  if (error) throw error;

  // Add creator as owner member
  const { error: mErr } = await supabase
    .from("group_members")
    .insert({ 
      group_id: inserted.id, 
      user_id: user.id, 
      role: "owner" 
    });
    
  if (mErr) throw mErr;

  return inserted as Group;
}

export async function getGroupProfile(groupId: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;

  // Get group details
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .single();

  if (groupError) return { data: null, error: groupError };

  // Get user's role in this group (if member)
  let userRole = null;
  if (user) {
    const { data: membership } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .single();
    
    userRole = membership?.role;
  }

  // Get member count
  const { count: memberCount } = await supabase
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", groupId);

  return {
    data: {
      ...group,
      userRole,
      memberCount: memberCount || 0,
    } as Group,
    error: null,
  };
}

export async function joinGroup(groupId: string, inviteCode?: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user!;

  // Check if already a member
  const { data: existing } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    throw new Error("Already a member of this group");
  }

  // For now, just allow joining if it's a public group or user provided valid invite
  // In a full implementation, you'd validate invite codes here
  const { error } = await supabase
    .from("group_members")
    .insert({
      group_id: groupId,
      user_id: user.id,
      role: "member",
    });

  if (error) throw error;
  return { success: true };
}

export async function leaveGroup(groupId: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user!;

  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id);

  if (error) throw error;
  return { success: true };
}

export async function getGroupMembers(groupId: string) {
  const { data, error } = await supabase
    .from("group_members")
    .select(`
      *,
      profile:profiles!inner (
        user_id,
        username,
        first_name,
        last_name,
        avatar_url
      )
    `)
    .eq("group_id", groupId)
    .order("joined_at", { ascending: true });

  if (error) return { data: [], error };

  return { data: data || [], error: null };
}

export async function updateGroup(groupId: string, updates: Partial<Group>) {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user!;

  // Only allow owner to update
  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .single();

  if (!group || group.owner_id !== user.id) {
    throw new Error("Only group owner can update group");
  }

  const { data, error } = await supabase
    .from("groups")
    .update(updates)
    .eq("id", groupId)
    .select()
    .single();

  if (error) throw error;
  return data as Group;
}

export async function deleteGroup(groupId: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user!;

  // Only allow owner to delete
  const { data: group } = await supabase
    .from("groups")
    .select("owner_id")
    .eq("id", groupId)
    .single();

  if (!group || group.owner_id !== user.id) {
    throw new Error("Only group owner can delete group");
  }

  const { error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId);

  if (error) throw error;
  return { success: true };
}