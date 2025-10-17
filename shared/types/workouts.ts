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

/**
 * Style Normalization (Shared Schema Copy)
 * 
 * CANONICAL SOURCE: server/lib/style.ts
 * 
 * This is a necessary duplicate to avoid circular imports:
 * - Shared code runs in both client and server contexts
 * - Cannot import from server/ without breaking client builds
 * - Schema transforms need normalization at validation time
 * 
 * Keep this in sync with server/lib/style.ts
 */
const SUPPORTED_STYLES = [
  'crossfit', 'olympic_weightlifting', 'powerlifting', 'bb_full_body', 'bb_upper',
  'bb_lower', 'aerobic', 'conditioning', 'strength', 'endurance', 'gymnastics', 'mobility', 'mixed'
] as const;

const StyleEnum = z.enum(SUPPORTED_STYLES);

// Normalize helper - mirrors server/lib/style.ts normalizeStyle()
// STRICT: throws error for truly unsupported styles instead of silent fallback
function normalizeToStyle(raw: string): typeof SUPPORTED_STYLES[number] {
  if (!raw || raw.trim() === '') {
    // Empty input defaults to mixed (valid use case for wizard)
    return 'mixed';
  }
  
  const lower = raw.toLowerCase().trim();
  
  // Direct match
  if (SUPPORTED_STYLES.includes(lower as any)) return lower as any;
  
  // Common aliases
  const aliases: Record<string, typeof SUPPORTED_STYLES[number]> = {
    'cf': 'crossfit',
    'oly': 'olympic_weightlifting',
    'olympic': 'olympic_weightlifting',
    'pl': 'powerlifting',
    'bbfull': 'bb_full_body',
    'bb full body': 'bb_full_body',
  };
  
  if (aliases[lower]) return aliases[lower];
  
  // Fuzzy matches
  if (lower.includes('olympic')) return 'olympic_weightlifting';
  if (lower.includes('bodybuilding')) return 'bb_full_body';
  
  // STRICT: throw error instead of silent fallback
  throw new Error(`Unsupported workout style: "${raw}". Supported: ${SUPPORTED_STYLES.join(', ')}`);
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
  
  // STRICT: Validate normalized result is in supported styles
  if (!SUPPORTED_STYLES.includes(style)) {
    throw new Error(`Invalid normalized style: "${style}" from input "${raw}"`);
  }
  
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
  
  // STRICT: Validate normalized result is in supported styles
  if (!SUPPORTED_STYLES.includes(style)) {
    throw new Error(`Invalid normalized style: "${style}" from input "${raw}"`);
  }
  
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