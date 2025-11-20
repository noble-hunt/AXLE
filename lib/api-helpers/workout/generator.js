// lib/api-helpers/workout/generator.ts
// Lightweight wrapper for Vercel serverless functions to access workout generation
/**
 * This module provides a bridge between Vercel serverless functions and the workout generator.
 * It dynamically imports the full generator to keep the serverless bundle size small.
 */
export async function generateWorkoutForAPI(request) {
    // Dynamic import to reduce initial bundle size
    const { generateWorkout } = await import('../../../server/workoutGenerator');
    return generateWorkout(request);
}
export async function generateSeedForAPI() {
    const { generateSeed } = await import('../../../server/lib/seededRandom');
    return generateSeed();
}
