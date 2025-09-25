import { z } from "zod";

// Generator input types as specified in requirements
export interface GeneratorInputs {
  archetype: 'strength' | 'conditioning' | 'mixed' | 'endurance';
  minutes: number;
  targetIntensity: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  equipment: string[];          // e.g., ['dumbbells','kettlebell','rower']
  constraints?: string[];       // movement or injury constraints by tag
  location?: 'home' | 'gym' | 'outside';
}

export interface GeneratorContext {
  dateISO: string;
  userId: string;
  healthModifiers?: {
    axleScore?: number;         // 0..100
    vitality?: number;          // 0..100
    performancePotential?: number; // 0..100
    circadian?: number;         // 0..100
  };
}

export interface GeneratorChoices {
  templateId: string;           // picked structure template
  movementPoolIds: string[];    // IDs of moves considered
  schemeId: string;             // rep/time scheme chosen
}

export interface GeneratorSeed {
  rngSeed: string;              // e.g., uuid or numeric string
  generatorVersion: string;     // e.g., 'v0.3.0'
  inputs: GeneratorInputs;
  context: GeneratorContext;
  choices?: GeneratorChoices;   // optional until post-pick
}

// Zod schemas for validation
export const generatorInputsSchema = z.object({
  archetype: z.enum(['strength', 'conditioning', 'mixed', 'endurance']),
  minutes: z.number().min(5).max(120),
  targetIntensity: z.number().min(1).max(10),
  equipment: z.array(z.string()),
  constraints: z.array(z.string()).optional(),
  location: z.enum(['home', 'gym', 'outside']).optional(),
});

export const generatorContextSchema = z.object({
  dateISO: z.string(),
  userId: z.string(),
  healthModifiers: z.object({
    axleScore: z.number().min(0).max(100).optional(),
    vitality: z.number().min(0).max(100).optional(),
    performancePotential: z.number().min(0).max(100).optional(),
    circadian: z.number().min(0).max(100).optional(),
  }).optional(),
});

export const generatorChoicesSchema = z.object({
  templateId: z.string(),
  movementPoolIds: z.array(z.string()),
  schemeId: z.string(),
});

export const generatorSeedSchema = z.object({
  rngSeed: z.string(),
  generatorVersion: z.string(),
  inputs: generatorInputsSchema,
  context: generatorContextSchema,
  choices: generatorChoicesSchema.optional(),
});

// Type exports
export type GeneratorInputsType = z.infer<typeof generatorInputsSchema>;
export type GeneratorContextType = z.infer<typeof generatorContextSchema>;
export type GeneratorChoicesType = z.infer<typeof generatorChoicesSchema>;
export type GeneratorSeedType = z.infer<typeof generatorSeedSchema>;