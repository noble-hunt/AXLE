import type { GenerationSeed } from "@shared/types/workouts";
import { createUserHash } from "@shared/types/workouts";

/**
 * Client-side utilities for workout generation seeding
 */

export function createDailySuggestionSeed(userId: string): GenerationSeed {
  const today = new Date().toISOString().split('T')[0];
  const userHash = createUserHash(userId);
  
  return {
    algo: 'v1',
    userHash,
    day: today,
  };
}

export function createTryDifferentFocusSeed(userId: string, focus: string, nonce = 1): GenerationSeed {
  const today = new Date().toISOString().split('T')[0];
  const userHash = createUserHash(userId);
  
  return {
    algo: 'v1',
    userHash,
    day: today,
    focus,
    nonce,
  };
}

export function serializeSeed(seed: GenerationSeed): string {
  const parts = [seed.userHash, seed.day];
  if (seed.focus) parts.push(seed.focus);
  if (seed.nonce !== undefined) parts.push(seed.nonce.toString());
  return parts.join('-');
}