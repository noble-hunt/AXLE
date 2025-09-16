import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workouts = pgTable("workouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  date: timestamp("date").notNull(),
  duration: integer("duration").notNull(), // in minutes
  exercises: jsonb("exercises").notNull(), // array of exercise objects
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const personalRecords = pgTable("personal_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  exercise: text("exercise").notNull(),
  weight: integer("weight").notNull(), // in pounds
  reps: integer("reps"),
  date: timestamp("date").notNull(),
  workoutId: varchar("workout_id").references(() => workouts.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const achievements = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'streak', 'workout_count', 'pr_count', etc.
  title: text("title").notNull(),
  description: text("description").notNull(),
  unlockedAt: timestamp("unlocked_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertWorkoutSchema = createInsertSchema(workouts).omit({
  id: true,
  createdAt: true,
});

export const insertPersonalRecordSchema = createInsertSchema(personalRecords).omit({
  id: true,
  createdAt: true,
});

export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertWorkout = z.infer<typeof insertWorkoutSchema>;
export type Workout = typeof workouts.$inferSelect;

export type InsertPersonalRecord = z.infer<typeof insertPersonalRecordSchema>;
export type PersonalRecord = typeof personalRecords.$inferSelect;

export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Achievement = typeof achievements.$inferSelect;

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
