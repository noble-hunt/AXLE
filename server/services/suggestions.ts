// server/services/suggestions.ts
import { computeSuggestion } from '../logic/suggestions.js';
import { createWorkoutFromSeed } from './workouts/createFromSeed.js';
import { nanoid } from 'nanoid';

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
 * Uses the existing createWorkoutFromSeed service
 */
export async function startSuggestion(userId: string) {
  try {
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