import { 
  type User, 
  type InsertUser,
  type Workout,
  type InsertWorkout,
  type PersonalRecord,
  type InsertPersonalRecord,
  type Achievement,
  type InsertAchievement,
  type WorkoutEvent,
  type InsertWorkoutEvent
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Workout methods
  getWorkouts(userId: string): Promise<Workout[]>;
  getWorkout(id: string): Promise<Workout | undefined>;
  createWorkout(workout: InsertWorkout): Promise<Workout>;
  updateWorkout(id: string, workout: Partial<InsertWorkout>): Promise<Workout | undefined>;
  deleteWorkout(id: string): Promise<boolean>;

  // Personal Record methods
  getPersonalRecords(userId: string): Promise<PersonalRecord[]>;
  getPersonalRecord(id: string): Promise<PersonalRecord | undefined>;
  createPersonalRecord(pr: InsertPersonalRecord): Promise<PersonalRecord>;
  updatePersonalRecord(id: string, pr: Partial<InsertPersonalRecord>): Promise<PersonalRecord | undefined>;
  deletePersonalRecord(id: string): Promise<boolean>;

  // Achievement methods
  getAchievements(userId: string): Promise<Achievement[]>;
  createAchievement(achievement: InsertAchievement): Promise<Achievement>;

  // Workout Event methods (for telemetry)
  getWorkoutEvents(userId?: string): Promise<WorkoutEvent[]>;
  createWorkoutEvent(event: InsertWorkoutEvent): Promise<WorkoutEvent>;
  getWorkoutEventStats(userId?: string): Promise<{
    totalGenerationEvents: number;
    totalFeedbackEvents: number;
    recentGenerations: number;
    recentFeedback: number;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private workouts: Map<string, Workout>;
  private personalRecords: Map<string, PersonalRecord>;
  private achievements: Map<string, Achievement>;
  private workoutEvents: Map<string, WorkoutEvent>;

  constructor() {
    this.users = new Map();
    this.workouts = new Map();
    this.personalRecords = new Map();
    this.achievements = new Map();
    this.workoutEvents = new Map();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const userId = randomUUID();
    const user: User = { 
      userId,
      username: insertUser.username ?? null,
      firstName: insertUser.firstName ?? null,
      lastName: insertUser.lastName ?? null,
      avatarUrl: insertUser.avatarUrl ?? null,
      dateOfBirth: insertUser.dateOfBirth ?? null,
      preferredUnit: insertUser.preferredUnit ?? 'lbs',
      favoriteMovements: Array.isArray(insertUser.favoriteMovements) ? insertUser.favoriteMovements : [],
      providers: Array.isArray(insertUser.providers) ? insertUser.providers : [],
      latitude: insertUser.latitude ?? null,
      longitude: insertUser.longitude ?? null,
      timezone: insertUser.timezone ?? null,
      reportFrequency: insertUser.reportFrequency ?? 'weekly',
      reportWeeklyDay: insertUser.reportWeeklyDay ?? null,
      reportMonthlyDay: insertUser.reportMonthlyDay ?? null,
      reportDeliveryTime: insertUser.reportDeliveryTime ?? '09:00:00',
      enableNotifications: insertUser.enableNotifications ?? true,
      enableEmail: insertUser.enableEmail ?? false,
      createdAt: new Date()
    };
    this.users.set(userId, user);
    return user;
  }

  // Workout methods
  async getWorkouts(userId: string): Promise<Workout[]> {
    return Array.from(this.workouts.values())
      .filter(workout => workout.userId === userId)
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
  }

  async getWorkout(id: string): Promise<Workout | undefined> {
    return this.workouts.get(id);
  }

  async createWorkout(insertWorkout: InsertWorkout): Promise<Workout> {
    const id = randomUUID();
    const workout: Workout = {
      ...insertWorkout,
      id,
      notes: insertWorkout.notes ?? null,
      completed: insertWorkout.completed ?? null,
      feedback: insertWorkout.feedback ?? null,
      seed: insertWorkout.seed ?? null,
      genSeed: insertWorkout.genSeed ?? {},
      generatorVersion: insertWorkout.generatorVersion ?? 'v0.3.0',
      generationId: insertWorkout.generationId ?? null,
      rationale: insertWorkout.rationale ?? null,
      criticScore: insertWorkout.criticScore ?? null,
      criticIssues: insertWorkout.criticIssues 
        ? (Array.isArray(insertWorkout.criticIssues) ? insertWorkout.criticIssues : [insertWorkout.criticIssues])
        : null,
      rawWorkoutJson: insertWorkout.rawWorkoutJson ?? null,
      userScore: insertWorkout.userScore ?? null,
      startedAt: null,
      createdAt: new Date()
    };
    this.workouts.set(id, workout);
    return workout;
  }

  async updateWorkout(id: string, updateData: Partial<InsertWorkout>): Promise<Workout | undefined> {
    const existing = this.workouts.get(id);
    if (!existing) return undefined;

    const updated: Workout = { 
      ...existing, 
      ...updateData,
      criticIssues: updateData.criticIssues 
        ? (Array.isArray(updateData.criticIssues) ? updateData.criticIssues : [updateData.criticIssues])
        : existing.criticIssues
    };
    this.workouts.set(id, updated);
    return updated;
  }

  async deleteWorkout(id: string): Promise<boolean> {
    return this.workouts.delete(id);
  }

  // Personal Record methods
  async getPersonalRecords(userId: string): Promise<PersonalRecord[]> {
    return Array.from(this.personalRecords.values())
      .filter(pr => pr.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getPersonalRecord(id: string): Promise<PersonalRecord | undefined> {
    return this.personalRecords.get(id);
  }

  async createPersonalRecord(insertPR: InsertPersonalRecord): Promise<PersonalRecord> {
    const id = randomUUID();
    const pr: PersonalRecord = {
      id,
      userId: insertPR.userId,
      category: insertPR.category,
      movement: insertPR.movement,
      value: String(insertPR.value),
      unit: insertPR.unit,
      repMax: insertPR.repMax ?? null,
      weightKg: insertPR.weightKg ? String(insertPR.weightKg) : null,
      notes: insertPR.notes ?? null,
      workoutId: insertPR.workoutId ?? null,
      date: insertPR.date ?? new Date().toISOString().split('T')[0],
      createdAt: new Date()
    };
    this.personalRecords.set(id, pr);
    return pr;
  }

  async updatePersonalRecord(id: string, updateData: Partial<InsertPersonalRecord>): Promise<PersonalRecord | undefined> {
    const existing = this.personalRecords.get(id);
    if (!existing) return undefined;

    const updated: PersonalRecord = { 
      ...existing, 
      ...updateData,
      value: updateData.value ? String(updateData.value) : existing.value,
      weightKg: updateData.weightKg ? String(updateData.weightKg) : existing.weightKg
    };
    this.personalRecords.set(id, updated);
    return updated;
  }

  async deletePersonalRecord(id: string): Promise<boolean> {
    return this.personalRecords.delete(id);
  }

  // Achievement methods
  async getAchievements(userId: string): Promise<Achievement[]> {
    return Array.from(this.achievements.values())
      .filter(achievement => achievement.userId === userId)
      .sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });
  }

  async createAchievement(insertAchievement: InsertAchievement): Promise<Achievement> {
    const id = randomUUID();
    const achievement: Achievement = {
      id,
      userId: insertAchievement.userId,
      name: insertAchievement.name,
      description: insertAchievement.description,
      progress: insertAchievement.progress ? String(insertAchievement.progress) : '0',
      unlocked: insertAchievement.unlocked ?? false,
      updatedAt: new Date()
    };
    this.achievements.set(id, achievement);
    return achievement;
  }

  // Workout Event methods (for telemetry)
  async getWorkoutEvents(userId?: string): Promise<WorkoutEvent[]> {
    const events = Array.from(this.workoutEvents.values());
    if (userId) {
      return events.filter(event => event.userId === userId);
    }
    return events;
  }

  async createWorkoutEvent(insertEvent: InsertWorkoutEvent): Promise<WorkoutEvent> {
    const id = randomUUID();
    const event: WorkoutEvent = {
      id,
      userId: insertEvent.userId,
      event: insertEvent.event,
      workoutId: insertEvent.workoutId ?? null,
      generationId: insertEvent.generationId ?? null,
      requestHash: insertEvent.requestHash ?? null,
      payload: insertEvent.payload,
      responseTimeMs: insertEvent.responseTimeMs ?? null,
      createdAt: new Date()
    };
    this.workoutEvents.set(id, event);
    return event;
  }

  async getWorkoutEventStats(userId?: string): Promise<{
    totalGenerationEvents: number;
    totalFeedbackEvents: number;
    recentGenerations: number;
    recentFeedback: number;
  }> {
    const events = await this.getWorkoutEvents(userId);
    const generationEvents = events.filter(e => e.event === 'generate');
    const feedbackEvents = events.filter(e => e.event === 'feedback');
    
    // Recent events from last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentGenerations = generationEvents.filter(e => e.createdAt && e.createdAt > yesterday).length;
    const recentFeedback = feedbackEvents.filter(e => e.createdAt && e.createdAt > yesterday).length;

    return {
      totalGenerationEvents: generationEvents.length,
      totalFeedbackEvents: feedbackEvents.length,
      recentGenerations,
      recentFeedback
    };
  }
}

export const storage = new MemStorage();
