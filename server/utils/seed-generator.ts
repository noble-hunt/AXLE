import { randomUUID } from "crypto";
import type { GeneratorSeed, GeneratorInputs, GeneratorContext, GeneratorChoices } from "../../shared/generator-types";

/**
 * Generate a deterministic seed for workout generation
 */
export function generateWorkoutSeed(
  inputs: GeneratorInputs,
  userId: string,
  templateId?: string,
  movementPoolIds?: string[],
  schemeId?: string
): GeneratorSeed {
  const rngSeed = randomUUID();
  const dateISO = new Date().toISOString();
  
  const context: GeneratorContext = {
    dateISO,
    userId,
    // TODO: Add health modifiers from user's health data
    healthModifiers: {
      axleScore: undefined,
      vitality: undefined,
      performancePotential: undefined,
      circadian: undefined,
    }
  };

  const choices: GeneratorChoices | undefined = templateId && movementPoolIds && schemeId ? {
    templateId,
    movementPoolIds,
    schemeId,
  } : undefined;

  const seed: GeneratorSeed = {
    rngSeed,
    generatorVersion: 'v0.3.0',
    inputs,
    context,
    choices,
  };

  return seed;
}

/**
 * Convert legacy workout request to new GeneratorInputs format
 */
export function convertLegacyRequestToInputs(request: any): GeneratorInputs {
  // Map legacy category to archetype
  const categoryToArchetype = (category: string): GeneratorInputs['archetype'] => {
    switch (category?.toLowerCase()) {
      case 'strength':
      case 'powerlifting':
        return 'strength';
      case 'crossfit/hiit':
      case 'hiit':
      case 'cardio':
        return 'conditioning';
      case 'endurance':
        return 'endurance';
      default:
        return 'mixed';
    }
  };

  return {
    archetype: categoryToArchetype(request.category || request.goals?.[0]),
    minutes: request.duration || request.durationMinutes || 30,
    targetIntensity: (request.intensity || 6) as GeneratorInputs['targetIntensity'],
    equipment: request.equipment || ['barbell', 'dumbbells', 'kettlebell'],
    constraints: request.constraints || [],
    location: request.location || 'gym',
  };
}

/**
 * Create a seeded random number generator using a simple LCG
 */
export function createSeededRandom(seed: string) {
  // Convert string seed to number using simple hash
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Use Linear Congruential Generator for deterministic randomness
  let current = Math.abs(hash);
  
  return {
    random: () => {
      current = (current * 1664525 + 1013904223) % Math.pow(2, 32);
      return current / Math.pow(2, 32);
    },
    randomInt: (min: number, max: number) => {
      const rand = current = (current * 1664525 + 1013904223) % Math.pow(2, 32);
      return min + Math.floor((rand / Math.pow(2, 32)) * (max - min + 1));
    },
    choice: <T>(array: T[]): T => {
      const rand = current = (current * 1664525 + 1013904223) % Math.pow(2, 32);
      const index = Math.floor((rand / Math.pow(2, 32)) * array.length);
      return array[index];
    }
  };
}