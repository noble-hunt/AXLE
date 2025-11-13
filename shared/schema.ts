import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, integer, timestamp, jsonb, boolean, numeric, smallint, date, uniqueIndex, pgEnum, real, time, check, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// AXLE REPORTS ENUMS
export const reportFrequencyEnum = pgEnum("report_frequency", ["none", "weekly", "monthly", "both"]);
export const reportCadenceEnum = pgEnum("report_cadence", ["weekly", "monthly"]); // For actual report generation
export const reportStatusEnum = pgEnum("report_status", ["generating", "ready", "delivered", "failed"]);

// PROFILES - User profile data (references Supabase auth.users)
export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(), // References auth.users(id) in Supabase
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  avatarUrl: text("avatar_url"),
  dateOfBirth: date("date_of_birth"),
  preferredUnit: text("preferred_unit").notNull().default("lbs"), // User's preferred weight unit (lbs or kg)
  favoriteMovements: text("favorite_movements").array().notNull().default(sql`'{}'`), // Array of favorite movement names
  providers: text("providers").array().notNull().default(sql`'{}'`), // Array of linked identity providers
  // Location data for environment service integration
  latitude: real("latitude"),
  longitude: real("longitude"),
  timezone: text("timezone"),
  // AXLE Reports preferences
  reportFrequency: reportFrequencyEnum("report_frequency").notNull().default("weekly"), // Report delivery frequency
  reportWeeklyDay: integer("report_weekly_day"), // Day of week (0-6) for weekly reports (0=Sunday, 1=Monday, etc.)
  reportMonthlyDay: integer("report_monthly_day"), // Day of month (1-31) for monthly reports
  reportDeliveryTime: time("report_delivery_time").default("09:00:00"), // Time of day for report delivery (HH:MM:SS)
  createdAt: timestamp("created_at").defaultNow(),
});

// WORKOUTS
export const workouts = pgTable("workouts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(), // References auth.users(id) in Supabase
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"), // When the workout was started (for active workout tracking)
  request: jsonb("request").notNull(),
  title: text("title").notNull(),
  notes: text("notes"),
  sets: jsonb("sets").notNull(),
  completed: boolean("completed").default(false),
  feedback: jsonb("feedback"),
  seed: text("seed"), // Legacy seed for deterministic workout generation
  // Deterministic generation fields
  genSeed: jsonb("gen_seed").notNull().default(sql`'{}'`), // Comprehensive seed object
  generatorVersion: text("generator_version").notNull().default('v0.3.0'), // Generator version
  generationId: text("generation_id"), // For telemetry tracking
  // AI-generated workout fields
  rationale: text("rationale"), // AI rationale for the workout design
  criticScore: integer("critic_score"), // 0-100 critic score
  criticIssues: text("critic_issues").array(), // Array of identified issues
  rawWorkoutJson: jsonb("raw_workout_json"), // Full AI-generated workout JSON for debugging
  // User score tracking
  userScore: jsonb("user_score"), // { value: string, type: 'time'|'weight'|'rounds'|'reps', blockKey: string }
});

// WORKOUT FEEDBACK - RPE and satisfaction feedback from users
export const workoutFeedback = pgTable("workout_feedback", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  workoutId: uuid("workout_id").notNull(), // FK to workouts(id)
  userId: uuid("user_id").notNull(), // FK to auth.users(id) in Supabase
  perceivedIntensity: smallint("perceived_intensity").notNull(), // 1-10 RPE scale
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Unique constraint - one feedback per user per workout
  uniqueUserWorkout: uniqueIndex("workout_feedback_user_workout_unique").on(table.userId, table.workoutId),
}));

// PRS (Personal Records) - Historical tracking for all PR types
export const prs = pgTable("prs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(), // References auth.users(id) in Supabase
  category: text("category").notNull(),
  movement: text("movement").notNull(),
  // Flexible PR value system
  value: numeric("value").notNull(), // The PR value (weight, time, distance, reps, etc.)
  unit: text("unit").notNull(), // Unit: lbs, kg, seconds, meters, reps, calories, etc.
  // Legacy fields (optional for backward compatibility)
  repMax: smallint("rep_max"), // Optional: 1,3,5,10 for strength PRs
  weightKg: numeric("weight_kg"), // Optional: weight in kg for backward compatibility
  // Metadata
  notes: text("notes"),
  workoutId: uuid("workout_id"), // Optional: link to workout where PR was achieved
  date: date("date").notNull().default(sql`current_date`),
  createdAt: timestamp("created_at").defaultNow().notNull(), // For historical tracking
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

// AXLE REPORTS - Weekly/Monthly fitness reports with insights and analytics
export const axleReports = pgTable("axle_reports", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(), // References auth.users(id) in Supabase
  frequency: reportCadenceEnum("frequency").notNull(), // 'weekly' | 'monthly'
  timeframeStart: timestamp("timeframe_start", { withTimezone: true }).notNull(), // UTC timestamp
  timeframeEnd: timestamp("timeframe_end", { withTimezone: true }).notNull(), // UTC timestamp
  status: reportStatusEnum("status").notNull().default("generating"),
  generatorVersion: text("generator_version").notNull().default("v1.0.0"),
  // Report data stored as JSONB for flexibility
  metrics: jsonb("metrics").notNull(), // Workout stats, PR stats, health stats, trends
  insights: jsonb("insights").notNull(), // Headlines, highlights, recommendations, fun facts
  viewedAt: timestamp("viewed_at"), // When user first opened the report
  deliveredAt: timestamp("delivered_at"), // When report was delivered (email/push)
  deliveryChannel: text("delivery_channel").array().default(sql`'{}'`), // ['email', 'push', 'in-app']
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Prevent duplicate reports for same period
  uniqueUserPeriod: uniqueIndex("axle_reports_user_period_unique").on(table.userId, table.frequency, table.timeframeStart),
  // Index for efficient queries
  userTimeframeIdx: index("axle_reports_user_timeframe_idx").on(table.userId, table.timeframeStart),
  // Ensure valid timeframes
  timeframeOrderCheck: check("timeframe_order_check", sql`${table.timeframeEnd} > ${table.timeframeStart}`),
}));

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

// GROUP MESSAGES (direct messaging for fast realtime chat)
export const groupMessages = pgTable("group_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: uuid("group_id").notNull(),
  authorId: uuid("author_id").notNull(),
  body: text("body").notNull(),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow(),
});

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

// DEVICE TOKENS - Push notification device tokens
export const deviceTokens = pgTable("device_tokens", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(), // References auth.users(id) in Supabase
  platform: text("platform").notNull().default('ios'), // 'ios' | 'web'
  token: text("token").notNull(), // APNs device token or web push subscription
  createdAt: timestamp("created_at").defaultNow(),
  lastSeen: timestamp("last_seen").defaultNow(),
}, (table) => ({
  uniqueUserToken: uniqueIndex("unique_user_token").on(table.userId, table.token),
}));

// NOTIFICATION PREFERENCES - User notification settings
export const notificationPrefs = pgTable("notification_prefs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().unique(), // References auth.users(id) in Supabase
  enabled: boolean("enabled").notNull().default(false),
  dailyReminders: boolean("daily_reminders").notNull().default(false),
  reminderTime: text("reminder_time").default('09:00'), // HH:mm format
  platform: text("platform").notNull().default('auto'), // 'auto' | 'native' | 'web'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// NOTIFICATION TOPICS - Per-user topic preferences
export const notificationTopics = pgTable("notification_topics", {
  userId: uuid("user_id").notNull(), // References auth.users(id) in Supabase
  topic: text("topic").notNull(), // e.g., 'weekly-report', 'workout-reminder'
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  pk: { primaryKey: [table.userId, table.topic] }
}));

// WEB PUSH SUBSCRIPTIONS - Web Push subscription storage
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(), // References auth.users(id) in Supabase
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsed: timestamp("last_used").defaultNow(),
}, (table) => ({
  uniqueUserEndpoint: uniqueIndex("unique_user_endpoint").on(table.userId, table.endpoint),
}));

// NOTIFICATIONS QUEUE - Push notification queue with channel support
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(), // References auth.users(id) in Supabase
  title: text("title").notNull(),
  body: text("body").notNull(),
  data: jsonb("data"), // Additional payload data
  channel: text("channel").notNull().default('auto'), // 'auto' | 'apns' | 'webpush'
  scheduled_for: timestamp("scheduled_for").notNull(),
  status: text("status").notNull().default('pending'), // 'pending' | 'sent' | 'failed'
  sent_at: timestamp("sent_at"),
  error: text("error"), // Error message if failed
  createdAt: timestamp("created_at").defaultNow(),
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

// WORKOUT EVENTS - Telemetry for workout generation and feedback for RL training
export const workoutEvents = pgTable("workout_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(), // References auth.users(id) in Supabase
  event: text("event").notNull(), // 'generate' | 'feedback'
  workoutId: uuid("workout_id"), // References workouts.id if applicable
  generationId: uuid("generation_id"), // Links feedback to specific generation
  requestHash: text("request_hash"), // Hash of generation request for deduplication
  payload: jsonb("payload").notNull(), // Event-specific data (generation details or feedback)
  responseTimeMs: integer("response_time_ms"), // Generation response time in milliseconds
  createdAt: timestamp("created_at").defaultNow(),
});

// WORKOUTS HISTORY - Workout progression tracking and analysis
export const workoutsHistory = pgTable("workouts_history", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(), // References auth.users(id) in Supabase
  workoutId: uuid("workout_id").notNull(), // References workouts.id
  progressionState: jsonb("progression_state"), // JSONB nullable - tracks progression metrics
  performanceMetrics: jsonb("performance_metrics"), // RPE, completion %, etc.
  adaptations: jsonb("adaptations"), // Block modifications, intensity adjustments
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertProfileSchema = createInsertSchema(profiles).omit({
  createdAt: true,
});

export const insertWorkoutSchema = createInsertSchema(workouts).omit({
  id: true,
  createdAt: true,
  startedAt: true, // Set via API route when workout is started
});

export const insertPRSchema = createInsertSchema(prs).omit({
  id: true,
  createdAt: true,
}).extend({
  // Make optional fields truly optional
  repMax: z.number().int().min(1).max(10).optional().nullable(),
  weightKg: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  workoutId: z.string().uuid().optional().nullable(),
  date: z.string().optional(), // Optional, defaults to current date
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

export const insertWorkoutEventSchema = createInsertSchema(workoutEvents).omit({
  id: true,
  createdAt: true,
});

export const insertWorkoutFeedbackSchema = createInsertSchema(workoutFeedback).omit({
  id: true,
  createdAt: true,
});

export const insertWorkoutsHistorySchema = createInsertSchema(workoutsHistory).omit({
  id: true,
  createdAt: true,
});

export const insertDeviceTokenSchema = createInsertSchema(deviceTokens).omit({
  id: true,
  createdAt: true,
  lastSeen: true,
});

export const insertNotificationPrefsSchema = createInsertSchema(notificationPrefs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationTopicSchema = createInsertSchema(notificationTopics).omit({
  updatedAt: true,
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
  lastUsed: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  sent_at: true,
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

export type InsertWorkoutEvent = z.infer<typeof insertWorkoutEventSchema>;
export type WorkoutEvent = typeof workoutEvents.$inferSelect;

export type InsertWorkoutFeedback = z.infer<typeof insertWorkoutFeedbackSchema>;
export type WorkoutFeedback = typeof workoutFeedback.$inferSelect;

export type InsertWorkoutsHistory = z.infer<typeof insertWorkoutsHistorySchema>;
export type WorkoutsHistory = typeof workoutsHistory.$inferSelect;

export type InsertNotificationPrefs = z.infer<typeof insertNotificationPrefsSchema>;
export type NotificationPrefs = typeof notificationPrefs.$inferSelect;

export type InsertNotificationTopic = z.infer<typeof insertNotificationTopicSchema>;
export type NotificationTopic = typeof notificationTopics.$inferSelect;

export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;


// Workout generation schemas
export enum Category {
  CROSSFIT = "CrossFit",
  STRENGTH = "Strength", 
  HIIT = "HIIT",
  CARDIO = "Cardio",
  POWERLIFTING = "Powerlifting",
  OLYMPIC_LIFTING = "Olympic Lifting"
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
  calories: z.number().optional(), // For cardio exercises (alternative to distance)
  restTime: z.number().optional(),
  notes: z.string().optional(),
  is_header: z.boolean().optional(),
  // Wodify-style fields for header sets
  workoutTitle: z.string().optional(),
  scoreType: z.string().optional(),
  coachingCues: z.string().optional(),
});

export const generatedWorkoutSchema = z.object({
  name: z.string(),
  category: z.nativeEnum(Category),
  description: z.string(),
  duration: z.number(),
  intensity: z.number(),
  sets: z.array(workoutSetSchema),
  seed: z.string().optional()
});

// Legacy workout completion feedback schema (for existing completion flow)
export const legacyWorkoutFeedbackSchema = z.object({
  difficulty: z.number().min(1).max(10),
  satisfaction: z.number().min(1).max(10),
  completedAt: z.date()
});

export type WorkoutRequest = z.infer<typeof workoutRequestSchema>;
export type WorkoutSet = z.infer<typeof workoutSetSchema>;
export type GeneratedWorkout = z.infer<typeof generatedWorkoutSchema>;
export type LegacyWorkoutFeedback = z.infer<typeof legacyWorkoutFeedbackSchema>;

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
    health?: { 
      hrv?: number|null; 
      sleepScore?: number|null; 
      restingHR?: number|null; 
      stress?: number|null;
      performancePotential?: number|null;
      vitality?: number|null;
      energyBalance?: number|null;
      circadian?: number|null;
      uvMax?: number|null;
    };
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

// TYPES FOR DEVICE TOKENS & NOTIFICATIONS
export type DeviceToken = typeof deviceTokens.$inferSelect;
export type InsertDeviceToken = z.infer<typeof insertDeviceTokenSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// AXLE REPORTS - Types and Schemas

// Report Metrics structure (JSONB)
export const reportMetricsSchema = z.object({
  workoutStats: z.object({
    totalWorkouts: z.number(),
    totalMinutes: z.number(),
    avgIntensity: z.number().nullable(),
    completionRate: z.number(),
    consistencyScore: z.number(),
    categoriesBreakdown: z.record(z.string(), z.number()).optional(), // Category -> count
  }),
  prStats: z.object({
    totalPRs: z.number(),
    topPRs: z.array(z.object({
      movement: z.string(),
      improvement: z.string(),
      value: z.string(),
    })),
    categoriesImproved: z.array(z.string()),
  }),
  healthStats: z.object({
    avgHeartRate: z.number().nullable(),
    recoveryScore: z.number().nullable(),
    sleepHours: z.number().nullable(),
    readiness: z.number().nullable(),
  }).optional(),
  trends: z.object({
    workoutTrend: z.enum(['up', 'down', 'stable']),
    volumeTrend: z.enum(['up', 'down', 'stable']),
    intensityTrend: z.enum(['up', 'down', 'stable']),
  }),
}).passthrough(); // Allow future fields

// Report Insights structure (JSONB)
export const reportInsightsSchema = z.object({
  headline: z.string(),
  highlights: z.array(z.string()),
  recommendations: z.array(z.string()),
  funFacts: z.array(z.string()),
  badges: z.array(z.string()),
  mostProductiveDay: z.string().optional(),
  favoriteMovement: z.string().optional(),
}).passthrough(); // Allow future fields

// Report preferences schema for validation
export const reportPreferencesSchema = z.object({
  reportFrequency: z.enum(['none', 'weekly', 'monthly', 'both']),
  reportWeeklyDay: z.number().int().min(0).max(6).nullable().optional(), // 0=Sunday, 1=Monday, ..., 6=Saturday
  reportMonthlyDay: z.number().int().min(1).max(31).nullable().optional(), // 1-31 day of month
  reportDeliveryTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(), // HH:MM or HH:MM:SS
}).refine(data => {
  // Validate that appropriate days are set based on frequency
  if (data.reportFrequency === 'weekly' || data.reportFrequency === 'both') {
    // Weekly or both requires weekly day to be set
    if (data.reportWeeklyDay === null || data.reportWeeklyDay === undefined) {
      return false;
    }
  }
  if (data.reportFrequency === 'monthly' || data.reportFrequency === 'both') {
    // Monthly or both requires monthly day to be set
    if (data.reportMonthlyDay === null || data.reportMonthlyDay === undefined) {
      return false;
    }
  }
  return true;
}, {
  message: "Weekly reports require reportWeeklyDay (0-6), monthly reports require reportMonthlyDay (1-31), both require both fields"
});

// Insert schema for creating new reports
export const insertAxleReportSchema = createInsertSchema(axleReports).omit({
  id: true,
  createdAt: true,
  viewedAt: true,
  deliveredAt: true,
}).extend({
  metrics: reportMetricsSchema,
  insights: reportInsightsSchema,
});

// Types
export type ReportMetrics = z.infer<typeof reportMetricsSchema>;
export type ReportInsights = z.infer<typeof reportInsightsSchema>;
export type ReportPreferences = z.infer<typeof reportPreferencesSchema>;
export type AxleReport = typeof axleReports.$inferSelect;
export type InsertAxleReport = z.infer<typeof insertAxleReportSchema>;
export type ReportFrequency = 'none' | 'weekly' | 'monthly' | 'both';
export type ReportCadence = 'weekly' | 'monthly';
export type ReportStatus = 'generating' | 'ready' | 'delivered' | 'failed';

// Legacy aliases for backward compatibility
export const users = profiles; // Alias for compatibility
export const personalRecords = prs; // Alias for compatibility
export type User = Profile;
export type InsertUser = InsertProfile;
export type PersonalRecord = PR;
export type InsertPersonalRecord = InsertPR;