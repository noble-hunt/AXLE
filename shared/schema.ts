import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, integer, timestamp, jsonb, boolean, numeric, smallint, date, uniqueIndex, pgEnum, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// PROFILES - User profile data (references Supabase auth.users)
export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(), // References auth.users(id) in Supabase
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  avatarUrl: text("avatar_url"),
  dateOfBirth: date("date_of_birth"),
  providers: text("providers").array().notNull().default(sql`'{}'`), // Array of linked identity providers
  createdAt: timestamp("created_at").defaultNow(),
});

// WORKOUTS
export const workouts = pgTable("workouts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(), // References auth.users(id) in Supabase
  createdAt: timestamp("created_at").defaultNow(),
  request: jsonb("request").notNull(),
  title: text("title").notNull(),
  notes: text("notes"),
  sets: jsonb("sets").notNull(),
  completed: boolean("completed").default(false),
  feedback: jsonb("feedback"),
});

// PRS (Personal Records)
export const prs = pgTable("prs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(), // References auth.users(id) in Supabase
  category: text("category").notNull(),
  movement: text("movement").notNull(),
  repMax: smallint("rep_max").notNull(), // Check constraint: in (1,3,5,10)
  weightKg: numeric("weight_kg").notNull(),
  date: date("date").notNull().default(sql`current_date`),
});

// ACHIEVEMENTS
export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(), // References auth.users(id) in Supabase
  name: text("name").notNull(),
  description: text("description").notNull(),
  progress: numeric("progress").notNull().default(sql`0`),
  unlocked: boolean("unlocked").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// GROUPS & SOCIAL FEATURES

// Post kinds enum
export const postKindEnum = pgEnum("post_kind", ["text", "workout", "pr", "event"]);

// GROUPS
export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  photoUrl: text("photo_url"),
  isPublic: boolean("is_public").notNull().default(false),
  ownerId: uuid("owner_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// GROUP MEMBERS
export const groupMembers = pgTable("group_members", {
  groupId: uuid("group_id").notNull(),
  userId: uuid("user_id").notNull(),
  role: text("role").notNull().default("member"), // owner|admin|member
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => ({
  pk: { primaryKey: [table.groupId, table.userId] }
}));

// POSTS
export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(),
  kind: postKindEnum("kind").notNull(),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// GROUP POSTS (cross-posting map)
export const groupPosts = pgTable("group_posts", {
  groupId: uuid("group_id").notNull(),
  postId: uuid("post_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  pk: { primaryKey: [table.groupId, table.postId] }
}));

// GROUP REACTIONS
export const groupReactions = pgTable("group_reactions", {
  groupId: uuid("group_id").notNull(),
  postId: uuid("post_id").notNull(),
  userId: uuid("user_id").notNull(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  pk: { primaryKey: [table.groupId, table.postId, table.userId, table.emoji] }
}));

// GROUP EVENT RSVPS
export const groupEventRsvps = pgTable("group_event_rsvps", {
  groupId: uuid("group_id").notNull(),
  postId: uuid("post_id").notNull(),
  userId: uuid("user_id").notNull(),
  status: text("status").notNull(), // going|maybe|no
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  pk: { primaryKey: [table.groupId, table.postId, table.userId] }
}));

// GROUP INVITES
export const groupInvites = pgTable("group_invites", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: uuid("group_id").notNull(),
  code: text("code").notNull().unique(),
  invitedEmail: text("invited_email"),
  createdBy: uuid("created_by").notNull(),
  expiresAt: timestamp("expires_at").notNull().default(sql`(now() + interval '14 days')`),
  createdAt: timestamp("created_at").defaultNow(),
});

// REFERRALS
export const referrals = pgTable("referrals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerUserId: uuid("referrer_user_id").notNull(),
  referredUserId: uuid("referred_user_id"),
  groupId: uuid("group_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// GROUP ACHIEVEMENTS
export const groupAchievements = pgTable("group_achievements", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: uuid("group_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  progress: numeric("progress").notNull().default(sql`0`),
  unlocked: boolean("unlocked").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// WEARABLE CONNECTIONS
export const wearableConnections = pgTable("wearable_connections", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(), // References auth.users(id) in Supabase
  provider: text("provider").notNull(),
  connected: boolean("connected").notNull().default(false),
  lastSync: timestamp("last_sync"),
  providerUserId: text("provider_user_id"),
  status: text("status").notNull().default("disconnected"), // disconnected|connected|error
  error: text("error"),
});

// WEARABLE TOKENS - Secure storage for provider tokens
export const wearableTokens = pgTable("wearable_tokens", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(), // References auth.users(id) in Supabase
  provider: text("provider").notNull(),
  accessToken: text("access_token").notNull(), // encrypted
  refreshToken: text("refresh_token"), // encrypted
  expiresAt: timestamp("expires_at"),
  scope: text("scope"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// HEALTH REPORTS
export const healthReports = pgTable("health_reports", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(), // References auth.users(id) in Supabase
  date: date("date").notNull(),
  summary: text("summary"),
  metrics: jsonb("metrics").notNull().default(sql`'{}'`),
  suggestions: text("suggestions").array().notNull().default(sql`'{}'`),
  fatigueScore: real("fatigue_score"), // 0.0-1.0 fatigue score based on health metrics
});

// SUGGESTED WORKOUTS - Daily workout suggestions per user
export const suggestedWorkouts = pgTable("suggested_workouts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(), // References auth.users(id) in Supabase
  date: date("date").notNull(), // suggestion day (UTC)
  request: jsonb("request").notNull(), // WorkoutRequest { category, duration, intensity }
  rationale: jsonb("rationale").notNull(), // SuggestionRationale with rulesApplied, scores, sources
  workoutId: uuid("workout_id"), // the generated workouts.id if we also generated one
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userDateIdx: uniqueIndex('suggested_workouts_user_date_idx').on(table.userId, table.date),
}));

// Insert schemas
export const insertProfileSchema = createInsertSchema(profiles).omit({
  createdAt: true,
});

export const insertWorkoutSchema = createInsertSchema(workouts).omit({
  id: true,
  createdAt: true,
});

export const insertPRSchema = createInsertSchema(prs).omit({
  id: true,
});

export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  updatedAt: true,
});

export const insertWearableConnectionSchema = createInsertSchema(wearableConnections).omit({
  id: true,
});

export const insertWearableTokenSchema = createInsertSchema(wearableTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHealthReportSchema = createInsertSchema(healthReports).omit({
  id: true,
});

export const insertSuggestedWorkoutSchema = createInsertSchema(suggestedWorkouts).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;

export type InsertWorkout = z.infer<typeof insertWorkoutSchema>;
export type Workout = typeof workouts.$inferSelect;

export type InsertPR = z.infer<typeof insertPRSchema>;
export type PR = typeof prs.$inferSelect;

export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Achievement = typeof achievements.$inferSelect;

export type InsertWearableConnection = z.infer<typeof insertWearableConnectionSchema>;
export type WearableConnection = typeof wearableConnections.$inferSelect;

export type InsertWearableToken = z.infer<typeof insertWearableTokenSchema>;
export type WearableToken = typeof wearableTokens.$inferSelect;

export type InsertHealthReport = z.infer<typeof insertHealthReportSchema>;
export type HealthReport = typeof healthReports.$inferSelect;

export type InsertSuggestedWorkout = z.infer<typeof insertSuggestedWorkoutSchema>;
export type SuggestedWorkout = typeof suggestedWorkouts.$inferSelect;

// Workout generation schemas
export enum Category {
  CROSSFIT = "CrossFit",
  STRENGTH = "Strength", 
  HIIT = "HIIT",
  CARDIO = "Cardio",
  POWERLIFTING = "Powerlifting"
}

export const workoutRequestSchema = z.object({
  category: z.nativeEnum(Category),
  duration: z.number().min(5).max(120),
  intensity: z.number().min(1).max(10)
});

export const workoutSetSchema = z.object({
  id: z.string(),
  exercise: z.string(),
  weight: z.number().optional(),
  reps: z.number().optional(),
  duration: z.number().optional(),
  distance: z.number().optional(),
  restTime: z.number().optional(),
  notes: z.string().optional()
});

export const generatedWorkoutSchema = z.object({
  name: z.string(),
  category: z.nativeEnum(Category),
  description: z.string(),
  duration: z.number(),
  intensity: z.number(),
  sets: z.array(workoutSetSchema)
});

// Workout feedback schema
export const workoutFeedbackSchema = z.object({
  difficulty: z.number().min(1).max(10),
  satisfaction: z.number().min(1).max(10),
  completedAt: z.date()
});

export type WorkoutRequest = z.infer<typeof workoutRequestSchema>;
export type WorkoutSet = z.infer<typeof workoutSetSchema>;
export type GeneratedWorkout = z.infer<typeof generatedWorkoutSchema>;
export type WorkoutFeedback = z.infer<typeof workoutFeedbackSchema>;

// Suggestion system types
export type SuggestionRationale = {
  rulesApplied: string[];
  scores: {
    recency: number;  // 0..1, weight from yesterday
    weeklyBalance: number; // 0..1
    monthlyBalance: number; // 0..1
    fatigue: number;  // 0..1   higher = more fatigued
    novelty: number;  // 0..1   reward doing something different
  };
  sources: {
    lastWorkout?: Workout | null;
    weeklyCounts?: Record<Category, number>;
    monthlyCounts?: Record<Category, number>;
    health?: { hrv?: number|null; sleepScore?: number|null; restingHR?: number|null; stress?: number|null };
  };
};

export type SuggestedWorkoutData = {
  id?: string;
  date: string; // YYYY-MM-DD
  request: WorkoutRequest; // {category, duration, intensity}
  rationale: SuggestionRationale;
  workoutId?: string | null;
};

// INSERT SCHEMAS & TYPES FOR GROUPS

export const insertGroupSchema = createInsertSchema(groups).omit({
  id: true,
  createdAt: true,
  ownerId: true, // Server sets this from authenticated user
});
export const insertGroupMemberSchema = createInsertSchema(groupMembers).omit({
  joinedAt: true,
});
export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  createdAt: true,
});
export const insertGroupPostSchema = createInsertSchema(groupPosts).omit({
  createdAt: true,
});
export const insertGroupReactionSchema = createInsertSchema(groupReactions).omit({
  createdAt: true,
});
export const insertGroupEventRsvpSchema = createInsertSchema(groupEventRsvps).omit({
  createdAt: true,
});
export const insertGroupInviteSchema = createInsertSchema(groupInvites).omit({
  id: true,
  createdAt: true,
});
export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
});
export const insertGroupAchievementSchema = createInsertSchema(groupAchievements).omit({
  id: true,
  updatedAt: true,
});

// TYPES FOR GROUPS
export type Group = typeof groups.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type GroupMember = typeof groupMembers.$inferSelect;
export type InsertGroupMember = z.infer<typeof insertGroupMemberSchema>;
export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type GroupPost = typeof groupPosts.$inferSelect;
export type InsertGroupPost = z.infer<typeof insertGroupPostSchema>;
export type GroupReaction = typeof groupReactions.$inferSelect;
export type InsertGroupReaction = z.infer<typeof insertGroupReactionSchema>;
export type GroupEventRsvp = typeof groupEventRsvps.$inferSelect;
export type InsertGroupEventRsvp = z.infer<typeof insertGroupEventRsvpSchema>;
export type GroupInvite = typeof groupInvites.$inferSelect;
export type InsertGroupInvite = z.infer<typeof insertGroupInviteSchema>;
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type GroupAchievement = typeof groupAchievements.$inferSelect;
export type InsertGroupAchievement = z.infer<typeof insertGroupAchievementSchema>;

// Legacy aliases for backward compatibility
export const users = profiles; // Alias for compatibility
export const personalRecords = prs; // Alias for compatibility
export type User = Profile;
export type InsertUser = InsertProfile;
export type PersonalRecord = PR;
export type InsertPersonalRecord = InsertPR;