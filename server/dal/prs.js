import { db } from "../db";
import { prs } from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";
export async function insertPR(params) {
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
    })
        .returning();
    if (!result || result.length === 0) {
        throw new Error(`Failed to insert PR`);
    }
    return result[0];
}
export async function listPRs(userId, options = {}) {
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
export async function deletePR(userId, id) {
    await db
        .delete(prs)
        .where(and(eq(prs.userId, userId), eq(prs.id, id)));
    return true;
}
// Get PR history for a specific movement (for graphing progress over time)
export async function getPRHistory(userId, movement, category) {
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
