// server/services/suggestions.ts
import { computeSuggestion } from '../logic/suggestions.js';
import { createWorkoutFromSeed } from './workouts/createFromSeed.js';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import { suggestedWorkouts } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';

/**
 * Service functions for suggestion-related operations as specified in the backend requirements.
 * These functions wrap existing functionality to provide the API surface required.
 */

/**
 * Compute today's suggestion for a user
 * Wraps the existing computeSuggestion function with the expected return format
 */
export async function computeTodaySuggestion(userId: string) {
  try {
    // Use existing suggestion computation logic
    const suggestionResult = await computeSuggestion(userId, new Date());
    
    const config = {
      focus: suggestionResult.request.category,
      duration: suggestionResult.request.duration, 
      intensity: suggestionResult.request.intensity,
      equipment: [], // Default to bodyweight - can be enhanced later with user preferences
      constraints: [] // Default to no constraints - can be enhanced later with user preferences
    };
    
    const rationale = suggestionResult.rationale;
    
    return { 
      config, 
      rationale,
      seed: {
        rngSeed: nanoid(10),
        generatorVersion: 'v0.3.0'
      }
    };
  } catch (error) {
    console.error('Failed to compute today suggestion:', error);
    throw error;
  }
}

/**
 * Start (generate and persist) a suggestion as an actual workout
 * First checks for pre-generated workouts, falls back to on-demand generation
 */
export async function startSuggestion(userId: string) {
  try {
    // Check for pre-generated workout first
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const suggestions = await db
      .select()
      .from(suggestedWorkouts)
      .where(and(
        eq(suggestedWorkouts.userId, userId),
        eq(suggestedWorkouts.date, today)
      ))
      .limit(1);
    
    // If pre-generated workout exists, return it instantly
    if (suggestions.length > 0 && suggestions[0].workoutId) {
      console.log(`[startSuggestion] Serving pre-generated workout for user ${userId}: ${suggestions[0].workoutId}`);
      return { workoutId: suggestions[0].workoutId };
    }
    
    // Fallback to on-demand generation
    console.log(`[startSuggestion] No pre-generated workout found for user ${userId}, generating on-demand`);
    
    // First get today's suggestion to determine the parameters
    const { config, seed } = await computeTodaySuggestion(userId);
    
    // Map config to the format expected by createWorkoutFromSeed
    const focus = mapCategoryToFocus(config.focus);
    
    // Create the workout using existing service
    const result = await createWorkoutFromSeed({
      userId,
      focus,
      minutes: config.duration,
      intensity: config.intensity,
      seed: seed || { rngSeed: nanoid(10) },
      generatorVersion: 'v0.3.0',
      source: 'daily-suggestion-start'
    });
    
    console.log(`[startSuggestion] On-demand workout generated for user ${userId}: ${result.id}`);
    return { workoutId: result.id };
  } catch (error) {
    console.error('Failed to start suggestion:', error);
    throw error;
  }
}

/**
 * Helper function to map suggestion categories to focus strings
 */
function mapCategoryToFocus(category: string): string {
  const categoryLower = category.toLowerCase();
  
  if (categoryLower.includes('strength') || categoryLower.includes('power')) {
    return 'Strength';
  }
  if (categoryLower.includes('cardio') || categoryLower.includes('endurance')) {
    return 'Cardio';
  }
  if (categoryLower.includes('conditioning') || categoryLower.includes('hiit') || categoryLower.includes('metcon')) {
    return 'Conditioning';
  }
  if (categoryLower.includes('skill') || categoryLower.includes('gymnastics')) {
    return 'Skill';
  }
  if (categoryLower.includes('recovery') || categoryLower.includes('mobility')) {
    return 'Recovery';
  }
  
  // Default to general fitness for mixed/unknown categories
  return 'Mixed';
}