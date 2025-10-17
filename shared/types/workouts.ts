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

const StyleEnum = z.enum(SUPPORTED_STYLES);

// Normalize helper to ensure valid style
function normalizeToStyle(raw: string): typeof SUPPORTED_STYLES[number] {
  const lower = raw.toLowerCase();
  
  // Direct match
  if (SUPPORTED_STYLES.includes(lower as any)) return lower as any;
  
  // Common aliases
  if (lower === 'cf') return 'crossfit';
  if (lower === 'oly' || lower === 'olympic') return 'olympic_weightlifting';
  if (lower === 'pl') return 'powerlifting';
  if (lower === 'bbfull' || lower === 'bb full body') return 'bb_full_body';
  
  // Fuzzy matches
  if (lower.includes('olympic')) return 'olympic_weightlifting';
  if (lower.includes('bodybuilding')) return 'bb_full_body';
  
  // Safe default
  return 'mixed';
}

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
  const raw = (d.style ?? d.goal ?? d.focus ?? d.archetype ?? '').toString();
  const style = normalizeToStyle(raw);
  return { ...d, archetype: style, style, goal: style, focus: style };
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
  const raw = (d.style ?? d.goal ?? d.focus ?? d.archetype ?? '').toString();
  const style = normalizeToStyle(raw);
  return { ...d, archetype: style, style, goal: style, focus: style };
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