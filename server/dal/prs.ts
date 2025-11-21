import { db } from "../db.js";
import { prs } from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";

export interface InsertPRParams {
  userId: string;
  category: string;
  movement: string;
  value: number;
  unit: string;
  repMax?: number | null;
  weightKg?: number | null;
  notes?: string | null;
  workoutId?: string | null;
  date?: string;
}

export interface ListPRsOptions {
  category?: string;
  movement?: string;
}

export async function insertPR(params: InsertPRParams) {
  const result = await db
    .insert(prs)
    .values({
      userId: params.userId,
      category: params.category,
      movement: params.movement,
      value: String(params.value),
      unit: params.unit,
      repMax: params.repMax || null,
      weightKg: params.weightKg ? String(params.weightKg) : null,
      notes: params.notes || null,
      workoutId: params.workoutId || null,
      date: params.date || new Date().toISOString().split('T')[0]
    } as any)
    .returning();

  if (!result || result.length === 0) {
    throw new Error(`Failed to insert PR`);
  }

  return result[0];
}

export async function listPRs(userId: string, options: ListPRsOptions = {}) {
  const conditions = [eq(prs.userId, userId)];

  if (options.category) {
    conditions.push(eq(prs.category, options.category));
  }

  if (options.movement) {
    conditions.push(eq(prs.movement, options.movement));
  }

  const result = await db
    .select()
    .from(prs)
    .where(and(...conditions))
    .orderBy(desc(prs.date));

  return result;
}

export async function deletePR(userId: string, id: string) {
  await db
    .delete(prs)
    .where(and(eq(prs.userId, userId), eq(prs.id, id)));

  return true;
}

// Get PR history for a specific movement (for graphing progress over time)
export async function getPRHistory(userId: string, movement: string, category?: string) {
  const conditions = [
    eq(prs.userId, userId),
    eq(prs.movement, movement)
  ];

  if (category) {
    conditions.push(eq(prs.category, category));
  }

  const result = await db
    .select()
    .from(prs)
    .where(and(...conditions))
    .orderBy(asc(prs.date), asc(prs.createdAt));

  return result;
}