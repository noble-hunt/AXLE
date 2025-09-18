import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, integer, timestamp, jsonb, boolean, numeric, smallint, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// PROFILES - User profile data (references Supabase auth.users)
export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(), // References auth.users(id) in Supabase
  username: text("username"),
  avatarUrl: text("avatar_url"),
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

// WEARABLE CONNECTIONS
export const wearableConnections = pgTable("wearable_connections", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(), // References auth.users(id) in Supabase
  provider: text("provider").notNull(),
  connected: boolean("connected").notNull().default(false),
  lastSync: timestamp("last_sync"),
});

// HEALTH REPORTS
export const healthReports = pgTable("health_reports", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(), // References auth.users(id) in Supabase
  date: date("date").notNull(),
  summary: text("summary"),
  metrics: jsonb("metrics").notNull().default(sql`'{}'`),
  suggestions: text("suggestions").array().notNull().default(sql`'{}'`),
});

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

export const insertHealthReportSchema = createInsertSchema(healthReports).omit({
  id: true,
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

export type InsertHealthReport = z.infer<typeof insertHealthReportSchema>;
export type HealthReport = typeof healthReports.$inferSelect;

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

// Legacy aliases for backward compatibility
export const users = profiles; // Alias for compatibility
export const personalRecords = prs; // Alias for compatibility
export type User = Profile;
export type InsertUser = InsertProfile;
export type PersonalRecord = PR;
export type InsertPersonalRecord = InsertPR;