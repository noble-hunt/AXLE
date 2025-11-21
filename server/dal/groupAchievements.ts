import { db } from "../db";
import { 
  groupAchievements, 
  groups, 
  groupMembers,
  groupPosts,
  groupReactions,
  posts
} from "@shared/schema";
import { eq, and, desc, asc, gte, sql, count } from "drizzle-orm";

export interface GroupAchievementItem {
  name: string;
  description: string;
  progress: number;
  unlocked: boolean;
}

// Define the three group achievements
export const GROUP_ACHIEVEMENT_DEFINITIONS = {
  SQUAD_GOALS: {
    name: "Squad Goals",
    description: "25 posts in a week",
    target: 25,
    timeWindow: "7 days"
  },
  HYPE_TRAIN: {
    name: "Hype Train", 
    description: "50 reactions in a week",
    target: 50,
    timeWindow: "7 days"
  },
  PR_PARTY: {
    name: "PR Party",
    description: "5 PR shares in a month", 
    target: 5,
    timeWindow: "30 days"
  }
} as const;

// Set user context for RLS
async function setUserContext(userId: string) {
  await db.execute(sql`SET LOCAL app.user_id = ${userId}`);
}

// Compute Squad Goals progress (25 posts in a week)
export async function computeSquadGoalsProgress(groupId: string): Promise<number> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const result = await db
    .select({ count: count() })
    .from(groupPosts)
    .innerJoin(posts, eq(groupPosts.postId, posts.id))
    .where(
      and(
        eq(groupPosts.groupId, groupId),
        gte(posts.createdAt, oneWeekAgo)
      )
    );

  const postCount = result[0]?.count || 0;
  return Math.min(postCount / GROUP_ACHIEVEMENT_DEFINITIONS.SQUAD_GOALS.target, 1);
}

// Compute Hype Train progress (50 reactions in a week)  
export async function computeHypeTrainProgress(groupId: string): Promise<number> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const result = await db
    .select({ count: count() })
    .from(groupReactions)
    .where(
      and(
        eq(groupReactions.groupId, groupId),
        gte(groupReactions.createdAt, oneWeekAgo)
      )
    );

  const reactionCount = result[0]?.count || 0;
  return Math.min(reactionCount / GROUP_ACHIEVEMENT_DEFINITIONS.HYPE_TRAIN.target, 1);
}

// Compute PR Party progress (5 PR shares in a month)
export async function computePrPartyProgress(groupId: string): Promise<number> {
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  const result = await db
    .select({ count: count() })
    .from(groupPosts)
    .innerJoin(posts, eq(groupPosts.postId, posts.id))
    .where(
      and(
        eq(groupPosts.groupId, groupId),
        eq(posts.kind, "pr"),
        gte(posts.createdAt, oneMonthAgo)
      )
    );

  const prCount = result[0]?.count || 0;
  return Math.min(prCount / GROUP_ACHIEVEMENT_DEFINITIONS.PR_PARTY.target, 1);
}

// Compute all achievements for a group
export async function computeGroupAchievements(groupId: string): Promise<GroupAchievementItem[]> {
  const [squadGoalsProgress, hypeTrainProgress, prPartyProgress] = await Promise.all([
    computeSquadGoalsProgress(groupId),
    computeHypeTrainProgress(groupId), 
    computePrPartyProgress(groupId)
  ]);

  return [
    {
      name: GROUP_ACHIEVEMENT_DEFINITIONS.SQUAD_GOALS.name,
      description: GROUP_ACHIEVEMENT_DEFINITIONS.SQUAD_GOALS.description,
      progress: squadGoalsProgress,
      unlocked: squadGoalsProgress >= 1
    },
    {
      name: GROUP_ACHIEVEMENT_DEFINITIONS.HYPE_TRAIN.name,
      description: GROUP_ACHIEVEMENT_DEFINITIONS.HYPE_TRAIN.description,
      progress: hypeTrainProgress,
      unlocked: hypeTrainProgress >= 1
    },
    {
      name: GROUP_ACHIEVEMENT_DEFINITIONS.PR_PARTY.name,
      description: GROUP_ACHIEVEMENT_DEFINITIONS.PR_PARTY.description,
      progress: prPartyProgress,
      unlocked: prPartyProgress >= 1
    }
  ];
}

// Upsert group achievements
export async function upsertGroupAchievements(groupId: string, achievements: GroupAchievementItem[]): Promise<void> {
  const insertData = achievements.map(achievement => ({
    groupId: groupId,
    name: achievement.name,
    description: achievement.description,
    progress: achievement.progress.toString(), // Convert to string for numeric field
    unlocked: achievement.unlocked,
    updatedAt: new Date()
  }));

  await db
    .insert(groupAchievements)
    .values(insertData)
    .onConflictDoUpdate({
      target: [groupAchievements.groupId, groupAchievements.name],
      set: {
        description: sql`excluded.description`,
        progress: sql`excluded.progress`,
        unlocked: sql`excluded.unlocked`, 
        updatedAt: sql`excluded.updated_at`
      }
    });
}

// Get group achievements
export async function getGroupAchievements(groupId: string) {
  return await db
    .select()
    .from(groupAchievements)
    .where(eq(groupAchievements.groupId, groupId))
    .orderBy(desc(groupAchievements.updatedAt));
}

// Recompute and update all achievements for a group
export async function recomputeAndUpdateGroupAchievements(groupId: string): Promise<{ newlyUnlocked: GroupAchievementItem[] }> {
  // Get current achievements
  const currentAchievements = await getGroupAchievements(groupId);
  const currentUnlocked = new Set(
    currentAchievements.filter(a => a.unlocked).map(a => a.name)
  );

  // Compute new achievements
  const newAchievements = await computeGroupAchievements(groupId);
  
  // Find newly unlocked achievements
  const newlyUnlocked = newAchievements.filter(
    achievement => achievement.unlocked && !currentUnlocked.has(achievement.name)
  );

  // Update achievements in database
  await upsertGroupAchievements(groupId, newAchievements);

  return { newlyUnlocked };
}