import { z } from "zod";

/**
 * Seeding types for deterministic workout generation
 * 
 * Seeding allows us to reproduce workout generation for debugging, A/B testing,
 * RL data collection, and "try different focus" without randomness creeping in.
 * 
 * Two runs with same seed → identical workout payloads (same movements/order).
 * Changing nonce or focus changes the result in a predictable way.
 */

// Local copy of supported styles to avoid server import cycles
const SUPPORTED_STYLES = [
  'crossfit', 'olympic_weightlifting', 'powerlifting', 'bb_full_body', 'bb_upper',
  'bb_lower', 'aerobic', 'conditioning', 'strength', 'endurance', 'gymnastics', 'mobility', 'mixed'
] as const;

export type GenerationSeed = {
  algo: 'v1';
  userHash: string;   // stable per user
  day: string;        // YYYY-MM-DD format
  focus?: string;     // optional override for focus/archetype
  nonce?: number;     // bump to iterate through variations
};

export const generationSeedSchema = z.object({
  algo: z.literal('v1'),
  userHash: z.string().min(1),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
  focus: z.string().optional(),
  nonce: z.number().int().min(0).optional(),
});

export type GeneratePayload = {
  archetype: 'strength' | 'conditioning' | 'mixed' | 'endurance';
  minutes: number;
  intensity: number;
  equipment: string[];
  constraints?: string[];
  goals?: string[];
  seed?: GenerationSeed;  // opt-in seed for deterministic generation
};

export const generatePayloadSchema = z.object({
  archetype: z.string().optional(),
  style: z.string().optional(),
  goal: z.string().optional(),
  focus: z.string().optional(),
  minutes: z.number().min(5).max(120),
  intensity: z.number().min(1).max(10),
  equipment: z.array(z.string()),
  constraints: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
  seed: generationSeedSchema.optional(),
}).transform((d) => {
  // Normalize style from any field (archetype, style, goal, focus)
  const raw = (d.style ?? d.goal ?? d.focus ?? d.archetype ?? '').toString().toLowerCase();

  // Inline normalize (duplicates server/lib/style.ts logic to avoid import cycles)
  const map: Record<string, typeof SUPPORTED_STYLES[number]> = {
    crossfit: 'crossfit', cf: 'crossfit',
    oly: 'olympic_weightlifting', olympic: 'olympic_weightlifting', olympic_weightlifting: 'olympic_weightlifting',
    powerlifting: 'powerlifting', pl: 'powerlifting',
    bbfull: 'bb_full_body', 'bb full body': 'bb_full_body', bb_full_body: 'bb_full_body',
    bb_upper: 'bb_upper', bb_lower: 'bb_lower',
    aerobic: 'aerobic', conditioning: 'conditioning', strength: 'strength', endurance: 'endurance',
    gymnastics: 'gymnastics', mobility: 'mobility', mixed: 'mixed',
  };
  
  let style = map[raw];
  if (!style) {
    if (raw.includes('olympic')) style = 'olympic_weightlifting';
    else if (raw === 'bb' || raw.includes('bodybuilding')) style = 'bb_full_body';
    else style = 'mixed';
  }

  return { 
    ...d, 
    archetype: style,
    style, 
    goal: style, 
    focus: style 
  };
}).refine(d => (SUPPORTED_STYLES as readonly string[]).includes(d.archetype), {
  message: 'style_invalid',
  path: ['archetype'],
});

export type SimulatePayload = {
  archetype: 'strength' | 'conditioning' | 'mixed' | 'endurance';
  minutes: number;
  intensity: number;
  equipment: string[];
  constraints?: string[];
  goals?: string[];
  seed?: GenerationSeed;  // opt-in seed for deterministic generation
};

export const simulatePayloadSchema = z.object({
  archetype: z.string().optional(),
  style: z.string().optional(),
  goal: z.string().optional(),
  focus: z.string().optional(),
  minutes: z.number().min(5).max(120),
  intensity: z.number().min(1).max(10),
  equipment: z.array(z.string()),
  constraints: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
  seed: generationSeedSchema.optional(),
}).transform((d) => {
  // Normalize style from any field (archetype, style, goal, focus)
  const raw = (d.style ?? d.goal ?? d.focus ?? d.archetype ?? '').toString().toLowerCase();

  // Inline normalize (duplicates server/lib/style.ts logic to avoid import cycles)
  const map: Record<string, typeof SUPPORTED_STYLES[number]> = {
    crossfit: 'crossfit', cf: 'crossfit',
    oly: 'olympic_weightlifting', olympic: 'olympic_weightlifting', olympic_weightlifting: 'olympic_weightlifting',
    powerlifting: 'powerlifting', pl: 'powerlifting',
    bbfull: 'bb_full_body', 'bb full body': 'bb_full_body', bb_full_body: 'bb_full_body',
    bb_upper: 'bb_upper', bb_lower: 'bb_lower',
    aerobic: 'aerobic', conditioning: 'conditioning', strength: 'strength', endurance: 'endurance',
    gymnastics: 'gymnastics', mobility: 'mobility', mixed: 'mixed',
  };
  
  let style = map[raw];
  if (!style) {
    if (raw.includes('olympic')) style = 'olympic_weightlifting';
    else if (raw === 'bb' || raw.includes('bodybuilding')) style = 'bb_full_body';
    else style = 'mixed';
  }

  return { 
    ...d, 
    archetype: style,
    style, 
    goal: style, 
    focus: style 
  };
}).refine(d => (SUPPORTED_STYLES as readonly string[]).includes(d.archetype), {
  message: 'style_invalid',
  path: ['archetype'],
});

// Utility functions for creating seeds
export function createUserHash(userId: string): string {
  // Simple hash function for user ID - can be improved with crypto
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

export function createGenerationSeed(userId: string, focus?: string, nonce?: number): GenerationSeed {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const userHash = createUserHash(userId);
  
  return {
    algo: 'v1',
    userHash,
    day: today,
    focus,
    nonce,
  };
}