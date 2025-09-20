import { supabaseAdmin } from "../lib/supabaseAdmin";
import { db } from "../db";
import { 
  groups, 
  groupMembers, 
  posts, 
  groupPosts, 
  groupReactions, 
  groupInvites, 
  referrals,
  profiles 
} from "@shared/schema";
import { eq, and, desc, asc, gte, sql } from "drizzle-orm";

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

// Set user context for RLS
async function setUserContext(userId: string) {
  await db.execute(sql`SET LOCAL app.user_id = ${userId}`);
}

// CREATE GROUP + ADD CREATOR AS OWNER
export async function createGroup(userId: string, params: CreateGroupParams) {
  // Use Drizzle with RLS for group creation
  await setUserContext(userId);
  
  const groupResult = await db
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
  await db
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
  await setUserContext(userId);

  const userGroups = await db
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
}

// GET GROUP PROFILE + MEMBERSHIP ROLE + BASIC COUNTS
export async function getGroupProfile(userId: string, groupId: string) {
  await setUserContext(userId);

  // Get group info and user's membership
  const groupInfo = await db
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
  const memberCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));

  // Get post count
  const postCount = await db
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
  await setUserContext(userId);

  // Check if group exists and get its info
  const group = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group[0]) {
    throw new Error("Group not found");
  }

  // Check if already a member
  const existingMember = await db
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
    const invite = await db
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
  const newMember = await db
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
  await setUserContext(userId);

  // Check current membership
  const membership = await db
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
    const ownerCount = await db
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
  await db
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
  // Check if user is admin/owner (admin operation - no RLS needed)
  const membership = await db
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

  const invite = await db
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
  // Find and validate invite (admin operation)
  const invite = await db
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
  const existingMember = await db
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
  const membership = await db
    .insert(groupMembers)
    .values({
      groupId: invite[0].groupId,
      userId,
      role: "member",
    })
    .returning();

  // Create referral record
  await db
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
  await setUserContext(userId);

  // Create canonical post
  const post = await db
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
    db
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
  const { after, limit = 30 } = options;

  await setUserContext(userId);

  // Build where conditions
  const whereConditions = after 
    ? and(
        eq(groupPosts.groupId, groupId),
        gte(groupPosts.createdAt, new Date(after))
      )
    : eq(groupPosts.groupId, groupId);

  const query = db
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
  await setUserContext(userId);

  // Check if reaction already exists
  const existing = await db
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
    await db
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
    const reaction = await db
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
  await setUserContext(userId);

  const reactions = await db
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