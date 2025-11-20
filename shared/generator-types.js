import { z } from "zod";
// Zod schemas for validation
export const generatorInputsSchema = z.object({
    archetype: z.enum(['strength', 'conditioning', 'mixed', 'endurance']),
    minutes: z.number().min(5).max(120),
    targetIntensity: z.union([
        z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
        z.literal(6), z.literal(7), z.literal(8), z.literal(9), z.literal(10)
    ]),
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
