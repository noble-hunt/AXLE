import { db } from "../db";
import { 
  groups, 
  groupMembers, 
  posts, 
  groupPosts, 
  groupReactions, 
  groupEventRsvps,
  groupInvites, 
  referrals,
  profiles 
} from "@shared/schema";
import { eq, and, desc, asc, gte, sql } from "drizzle-orm";

// Helper to ensure database is available
function ensureDb() {
  if (!db) {
    throw new Error('Groups feature unavailable - DATABASE_URL not configured. This feature requires direct database access.');
  }
  return db;
}

export interface CreateGroupParams {
  name: string;
  description?: string;
  isPublic: boolean;
  photoUrl?: string;
}

export interface CreatePostParams {
  kind: "text" | "workout" | "pr" | "event";
  content: Record<string, any>;
  groupIds: string[];
}

export interface ReactionParams {
  groupId: string;
  postId: string;
  emoji: string;
}

export interface RsvpParams {
  groupId: string;
  postId: string;
  status: "going" | "maybe" | "no";
}

// Set user context for RLS
async function setUserContext(userId: string) {
  const database = ensureDb();
  try {
    // Use string interpolation for session variables as they don't support parameterization
    await database.execute(sql.raw(`SET LOCAL app.user_id = '${userId}'`));
  } catch (error) {
    console.error('[DAL:groups] Failed to set user context for RLS:', {
      userId,
      error: error instanceof Error ? error.message : String(error),
      hint: 'This may indicate a database connection issue or missing DATABASE_URL environment variable'
    });
    throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// CREATE GROUP + ADD CREATOR AS OWNER
export async function createGroup(userId: string, params: CreateGroupParams) {
  const database = ensureDb();
  // Use Drizzle with RLS for group creation
  await setUserContext(userId);
  
  const groupResult = await database
    .insert(groups)
    .values({
      name: params.name,
      description: params.description,
      isPublic: params.isPublic,
      photoUrl: params.photoUrl,
      ownerId: userId,
    })
    .returning();

  if (!groupResult[0]) {
    throw new Error("Failed to create group");
  }

  // Add creator as owner member
  await database
    .insert(groupMembers)
    .values({
      groupId: groupResult[0].id,
      userId: userId,
      role: "owner",
    });

  return groupResult[0];
}

// GET GROUPS I BELONG TO (with role)
export async function getUserGroups(userId: string) {
  const database = ensureDb();
  try {
    await setUserContext(userId);

    const userGroups = await database
      .select({
        id: groups.id,
        name: groups.name,
        description: groups.description,
        photoUrl: groups.photoUrl,
        isPublic: groups.isPublic,
        ownerId: groups.ownerId,
        createdAt: groups.createdAt,
        role: groupMembers.role,
        joinedAt: groupMembers.joinedAt,
      })
      .from(groups)
      .innerJoin(groupMembers, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.userId, userId))
      .orderBy(desc(groupMembers.joinedAt));

    return userGroups;
  } catch (error) {
    console.error('[DAL:groups:getUserGroups] Failed to fetch user groups:', {
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      hint: 'Check DATABASE_URL, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY environment variables'
    });
    throw error;
  }
}

// MODERATION: Delete post from group (owners/admins only)
export async function deleteGroupPost(userId: string, groupId: string, postId: string) {
  const database = ensureDb();
  await setUserContext(userId);
  
  // Check if user is owner or admin
  const membership = await database
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      )
    );
    
  if (!membership[0] || !['owner', 'admin'].includes(membership[0].role)) {
    throw new Error('Only owners and admins can delete posts');
  }
  
  // Delete group_posts mapping (keep canonical post if cross-posted elsewhere)
  const deleted = await database
    .delete(groupPosts)
    .where(
      and(
        eq(groupPosts.groupId, groupId),
        eq(groupPosts.postId, postId)
      )
    )
    .returning();
    
  if (deleted.length === 0) {
    throw new Error('Post not found in this group');
  }
  
  // Also delete reactions for this post in this group
  await database
    .delete(groupReactions)
    .where(
      and(
        eq(groupReactions.groupId, groupId),
        eq(groupReactions.postId, postId)
      )
    );
    
  return { success: true };
}

// MODERATION: Remove member from group (owners/admins only)
export async function removeMemberFromGroup(userId: string, groupId: string, targetUserId: string) {
  const database = ensureDb();
  await setUserContext(userId);
  
  // Check if user is owner or admin
  const membership = await database
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      )
    );
    
  if (!membership[0] || !['owner', 'admin'].includes(membership[0].role)) {
    throw new Error('Only owners and admins can remove members');
  }
  
  // Can't remove the owner
  const targetMembership = await database
    .select({ role: groupMembers.role })
    .from(groupMembers) 
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, targetUserId)
      )
    );
    
  if (targetMembership[0]?.role === 'owner') {
    throw new Error('Cannot remove the group owner');
  }
  
  // Remove member
  const removed = await database
    .delete(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, targetUserId)
      )
    )
    .returning();
    
  if (removed.length === 0) {
    throw new Error('Member not found in this group');
  }
  
  return { success: true };
}

// GET GROUP PROFILE + MEMBERSHIP ROLE + BASIC COUNTS
export async function getGroupProfile(userId: string, groupId: string) {
  const database = ensureDb();
  await setUserContext(userId);

  // Get group info and user's membership
  const groupInfo = await database
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      photoUrl: groups.photoUrl,
      isPublic: groups.isPublic,
      ownerId: groups.ownerId,
      createdAt: groups.createdAt,
      userRole: groupMembers.role,
    })
    .from(groups)
    .leftJoin(
      groupMembers,
      and(
        eq(groups.id, groupMembers.groupId),
        eq(groupMembers.userId, userId)
      )
    )
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!groupInfo[0]) {
    return null;
  }

  // Get member count
  const memberCount = await database
    .select({ count: sql<number>`count(*)` })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));

  // Get post count
  const postCount = await database
    .select({ count: sql<number>`count(*)` })
    .from(groupPosts)
    .where(eq(groupPosts.groupId, groupId));

  return {
    ...groupInfo[0],
    memberCount: memberCount[0]?.count || 0,
    postCount: postCount[0]?.count || 0,
  };
}

// JOIN GROUP (requires valid invite for private groups)
export async function joinGroup(userId: string, groupId: string, inviteCode?: string) {
  const database = ensureDb();
  await setUserContext(userId);

  // Check if group exists and get its info
  const group = await database
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group[0]) {
    throw new Error("Group not found");
  }

  // Check if already a member
  const existingMember = await database
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      )
    )
    .limit(1);

  if (existingMember[0]) {
    throw new Error("Already a member of this group");
  }

  // For private groups, validate invite code
  if (!group[0].isPublic) {
    if (!inviteCode) {
      throw new Error("Invite code required for private group");
    }

    // Validate invite code (admin operation)
    const invite = await database
      .select()
      .from(groupInvites)
      .where(
        and(
          eq(groupInvites.code, inviteCode),
          eq(groupInvites.groupId, groupId),
          gte(groupInvites.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!invite[0]) {
      throw new Error("Invalid or expired invite code");
    }
  }

  // Add user as member
  const newMember = await database
    .insert(groupMembers)
    .values({
      groupId,
      userId,
      role: "member",
    })
    .returning();

  return newMember[0];
}

// LEAVE GROUP (owner transfer required if last owner)
export async function leaveGroup(userId: string, groupId: string) {
  const database = ensureDb();
  await setUserContext(userId);

  // Check current membership
  const membership = await database
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      )
    )
    .limit(1);

  if (!membership[0]) {
    throw new Error("Not a member of this group");
  }

  // If user is owner, check if they're the last owner
  if (membership[0].role === "owner") {
    const ownerCount = await database
      .select({ count: sql<number>`count(*)` })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.role, "owner")
        )
      );

    if (ownerCount[0]?.count === 1) {
      throw new Error("Cannot leave group as last owner. Transfer ownership first.");
    }
  }

  // Remove membership
  await database
    .delete(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      )
    );

  return { success: true };
}

// CREATE INVITE (admin/owner only)
export async function createGroupInvite(userId: string, groupId: string, invitedEmail?: string) {
  const database = ensureDb();
  // Check if user is admin/owner (admin operation - no RLS needed)
  const membership = await database
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      )
    )
    .limit(1);

  if (!membership[0] || !["owner", "admin"].includes(membership[0].role)) {
    throw new Error("Only group owners and admins can create invites");
  }

  // Generate unique invite code
  const code = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  const invite = await database
    .insert(groupInvites)
    .values({
      groupId,
      code,
      invitedEmail,
      createdBy: userId,
    })
    .returning();

  return invite[0];
}

// ACCEPT INVITE (creates membership + referral)
export async function acceptInvite(userId: string, inviteCode: string) {
  const database = ensureDb();
  // Find and validate invite (admin operation)
  const invite = await database
    .select()
    .from(groupInvites)
    .where(
      and(
        eq(groupInvites.code, inviteCode),
        gte(groupInvites.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!invite[0]) {
    throw new Error("Invalid or expired invite code");
  }

  await setUserContext(userId);

  // Check if already a member
  const existingMember = await database
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, invite[0].groupId),
        eq(groupMembers.userId, userId)
      )
    )
    .limit(1);

  if (existingMember[0]) {
    throw new Error("Already a member of this group");
  }

  // Add membership
  const membership = await database
    .insert(groupMembers)
    .values({
      groupId: invite[0].groupId,
      userId,
      role: "member",
    })
    .returning();

  // Create referral record
  await database
    .insert(referrals)
    .values({
      referrerUserId: invite[0].createdBy,
      referredUserId: userId,
      groupId: invite[0].groupId,
    });

  return {
    membership: membership[0],
    groupId: invite[0].groupId,
  };
}

// CREATE POST (cross-post to multiple groups)
export async function createPost(userId: string, params: CreatePostParams) {
  const database = ensureDb();
  await setUserContext(userId);

  // Create canonical post
  const post = await database
    .insert(posts)
    .values({
      userId,
      kind: params.kind,
      content: params.content,
    })
    .returning();

  if (!post[0]) {
    throw new Error("Failed to create post");
  }

  // Cross-post to each group
  const groupPostPromises = params.groupIds.map(groupId =>
    database
      .insert(groupPosts)
      .values({
        groupId,
        postId: post[0].id,
      })
      .returning()
  );

  await Promise.all(groupPostPromises);

  return post[0];
}

// GET GROUP FEED (ascending, keyset pagination)
export async function getGroupFeed(
  userId: string,
  groupId: string,
  options: { after?: string; limit?: number } = {}
) {
  const database = ensureDb();
  const { after, limit = 30 } = options;

  await setUserContext(userId);

  // Build where conditions
  const whereConditions = after 
    ? and(
        eq(groupPosts.groupId, groupId),
        gte(groupPosts.createdAt, new Date(after))
      )
    : eq(groupPosts.groupId, groupId);

  const query = database
    .select({
      id: posts.id,
      userId: posts.userId,
      kind: posts.kind,
      content: posts.content,
      createdAt: posts.createdAt,
      groupCreatedAt: groupPosts.createdAt,
      authorUsername: profiles.username,
      authorFirstName: profiles.firstName,
      authorLastName: profiles.lastName,
      authorAvatarUrl: profiles.avatarUrl,
    })
    .from(groupPosts)
    .innerJoin(posts, eq(groupPosts.postId, posts.id))
    .innerJoin(profiles, eq(posts.userId, profiles.userId))
    .where(whereConditions);

  const feed = await query
    .orderBy(asc(groupPosts.createdAt))
    .limit(limit);

  return feed;
}

// ADD/REMOVE REACTION (toggle)
export async function toggleReaction(userId: string, params: ReactionParams) {
  const database = ensureDb();
  await setUserContext(userId);

  // Check if reaction already exists
  const existing = await database
    .select()
    .from(groupReactions)
    .where(
      and(
        eq(groupReactions.groupId, params.groupId),
        eq(groupReactions.postId, params.postId),
        eq(groupReactions.userId, userId),
        eq(groupReactions.emoji, params.emoji)
      )
    )
    .limit(1);

  if (existing[0]) {
    // Remove reaction
    await database
      .delete(groupReactions)
      .where(
        and(
          eq(groupReactions.groupId, params.groupId),
          eq(groupReactions.postId, params.postId),
          eq(groupReactions.userId, userId),
          eq(groupReactions.emoji, params.emoji)
        )
      );
    return { action: "removed" };
  } else {
    // Add reaction
    const reaction = await database
      .insert(groupReactions)
      .values({
        groupId: params.groupId,
        postId: params.postId,
        userId,
        emoji: params.emoji,
      })
      .returning();
    return { action: "added", reaction: reaction[0] };
  }
}

// GET REACTION SUMMARY FOR POST
export async function getReactionSummary(userId: string, groupId: string, postId: string) {
  const database = ensureDb();
  await setUserContext(userId);

  const reactions = await database
    .select({
      emoji: groupReactions.emoji,
      count: sql<number>`count(*)`,
      userReacted: sql<boolean>`bool_or(${groupReactions.userId} = ${userId})`,
    })
    .from(groupReactions)
    .where(
      and(
        eq(groupReactions.groupId, groupId),
        eq(groupReactions.postId, postId)
      )
    )
    .groupBy(groupReactions.emoji);

  return reactions;
}

// RSVP TO EVENT POST
export async function upsertRsvp(userId: string, params: RsvpParams) {
  const database = ensureDb();
  await setUserContext(userId);

  // Check if RSVP already exists
  const existing = await database
    .select()
    .from(groupEventRsvps)
    .where(
      and(
        eq(groupEventRsvps.groupId, params.groupId),
        eq(groupEventRsvps.postId, params.postId),
        eq(groupEventRsvps.userId, userId)
      )
    )
    .limit(1);

  if (existing[0]) {
    // Update existing RSVP
    const updated = await database
      .update(groupEventRsvps)
      .set({ status: params.status })
      .where(
        and(
          eq(groupEventRsvps.groupId, params.groupId),
          eq(groupEventRsvps.postId, params.postId),
          eq(groupEventRsvps.userId, userId)
        )
      )
      .returning();
    return { action: "updated", rsvp: updated[0] };
  } else {
    // Create new RSVP
    const rsvp = await database
      .insert(groupEventRsvps)
      .values({
        groupId: params.groupId,
        postId: params.postId,
        userId,
        status: params.status,
      })
      .returning();
    return { action: "created", rsvp: rsvp[0] };
  }
}

// REMOVE RSVP
export async function removeRsvp(userId: string, groupId: string, postId: string) {
  const database = ensureDb();
  await setUserContext(userId);

  await database
    .delete(groupEventRsvps)
    .where(
      and(
        eq(groupEventRsvps.groupId, groupId),
        eq(groupEventRsvps.postId, postId),
        eq(groupEventRsvps.userId, userId)
      )
    );
  
  return { action: "removed" };
}

// GET RSVPS FOR POST
export async function getPostRsvps(userId: string, groupId: string, postId: string) {
  const database = ensureDb();
  await setUserContext(userId);

  const rsvps = await database
    .select({
      userId: groupEventRsvps.userId,
      status: groupEventRsvps.status,
      createdAt: groupEventRsvps.createdAt,
      userUsername: profiles.username,
      userFirstName: profiles.firstName,
      userLastName: profiles.lastName,
      userAvatarUrl: profiles.avatarUrl,
    })
    .from(groupEventRsvps)
    .innerJoin(profiles, eq(groupEventRsvps.userId, profiles.userId))
    .where(
      and(
        eq(groupEventRsvps.groupId, groupId),
        eq(groupEventRsvps.postId, postId)
      )
    )
    .orderBy(groupEventRsvps.createdAt);

  // Group by status
  const grouped = {
    going: rsvps.filter(r => r.status === "going"),
    maybe: rsvps.filter(r => r.status === "maybe"),
    no: rsvps.filter(r => r.status === "no"),
  };

  return grouped;
}

// DELETE GROUP (owners only)
export async function deleteGroup(userId: string, groupId: string) {
  const database = ensureDb();
  await setUserContext(userId);

  // Check if user is owner
  const membership = await database
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      )
    )
    .limit(1);

  if (!membership[0]) {
    throw new Error('Group not found or access denied');
  }
  
  if (membership[0].role !== 'owner') {
    throw new Error('Only group owners can delete groups');
  }

  // Perform all deletions in a transaction for data integrity
  const result = await database.transaction(async (tx) => {
    // Delete all related data (cascade deletion)
    // Order matters: delete child records first, then parent records
    
    // Delete all RSVPs for posts in this group
    await tx
      .delete(groupEventRsvps)
      .where(eq(groupEventRsvps.groupId, groupId));

    // Delete all reactions for posts in this group
    await tx
      .delete(groupReactions)
      .where(eq(groupReactions.groupId, groupId));

    // Delete all group posts
    await tx
      .delete(groupPosts)
      .where(eq(groupPosts.groupId, groupId));

    // Delete all group invites
    await tx
      .delete(groupInvites)
      .where(eq(groupInvites.groupId, groupId));

    // Delete all referrals related to this group
    await tx
      .delete(referrals)
      .where(eq(referrals.groupId, groupId));

    // Delete all group memberships
    await tx
      .delete(groupMembers)
      .where(eq(groupMembers.groupId, groupId));

    // Finally, delete the group itself
    const deletedGroup = await tx
      .delete(groups)
      .where(eq(groups.id, groupId))
      .returning();

    if (deletedGroup.length === 0) {
      throw new Error('Group not found');
    }

    return deletedGroup[0];
  });

  return { success: true, deletedGroup: result };
}

// UPDATE GROUP - owners only
export async function updateGroup(userId: string, groupId: string, updates: {
  name?: string;
  description?: string;
  photoUrl?: string;
}) {
  const database = ensureDb();
  await setUserContext(userId);
  
  // Verify user is owner
  const membership = await database
    .select()
    .from(groupMembers)
    .where(and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, userId),
      eq(groupMembers.role, "owner")
    ));
  
  if (membership.length === 0) {
    throw new Error('Only group owners can update group details');
  }

  const updateData: Record<string, any> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.photoUrl !== undefined) updateData.photoUrl = updates.photoUrl;

  if (Object.keys(updateData).length === 0) {
    throw new Error('No fields to update');
  }

  const updatedGroup = await database
    .update(groups)
    .set(updateData)
    .where(eq(groups.id, groupId))
    .returning();

  if (updatedGroup.length === 0) {
    throw new Error('Group not found');
  }

  return updatedGroup[0];
}

// GET GROUP MEMBERS - all members can see this
export async function getGroupMembers(userId: string, groupId: string) {
  const database = ensureDb();
  await setUserContext(userId);
  
  // Verify user is a member
  const membership = await database
    .select()
    .from(groupMembers)
    .where(and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, userId)
    ));
  
  if (membership.length === 0) {
    throw new Error('Only group members can view member list');
  }

  const members = await database
    .select({
      userId: groupMembers.userId,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
    })
    .from(groupMembers)
    .leftJoin(profiles, eq(groupMembers.userId, profiles.userId))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(asc(groupMembers.role), asc(groupMembers.joinedAt));

  return members;
}

// ADD MEMBER TO GROUP - owners/admins only
export async function addMemberToGroup(userId: string, groupId: string, memberUserId: string, role: string = "member") {
  const database = ensureDb();
  await setUserContext(userId);
  
  // Verify user is owner or admin
  const membership = await database
    .select()
    .from(groupMembers)
    .where(and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, userId),
      sql`${groupMembers.role} IN ('owner', 'admin')`
    ));
  
  if (membership.length === 0) {
    throw new Error('Only group owners and admins can add members');
  }

  // Check if member already exists
  const existingMember = await database
    .select()
    .from(groupMembers)
    .where(and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, memberUserId)
    ));

  if (existingMember.length > 0) {
    throw new Error('User is already a member of this group');
  }

  // Add the member
  const newMember = await database
    .insert(groupMembers)
    .values({
      groupId: groupId,
      userId: memberUserId,
      role: role === "admin" && membership[0].role === "owner" ? "admin" : "member",
    })
    .returning();

  if (newMember.length === 0) {
    throw new Error('Failed to add member');
  }

  return newMember[0];
}