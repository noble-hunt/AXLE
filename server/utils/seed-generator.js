import { randomUUID } from "crypto";
/**
 * Generate a deterministic seed for workout generation
 */
export function generateWorkoutSeed(inputs, userId, templateId, movementPoolIds, schemeId) {
    const rngSeed = randomUUID();
    const dateISO = new Date().toISOString();
    const context = {
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
    const choices = templateId && movementPoolIds && schemeId ? {
        templateId,
        movementPoolIds,
        schemeId,
    } : undefined;
    const seed = {
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
export function convertLegacyRequestToInputs(request) {
    // Map legacy category to archetype
    const categoryToArchetype = (category) => {
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
        targetIntensity: (request.intensity || 6),
        equipment: request.equipment || ['barbell', 'dumbbells', 'kettlebell'],
        constraints: request.constraints || [],
        location: request.location || 'gym',
    };
}
/**
 * Create a seeded random number generator using a simple LCG
 */
export function createSeededRandom(seed) {
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
        randomInt: (min, max) => {
            const rand = current = (current * 1664525 + 1013904223) % Math.pow(2, 32);
            return min + Math.floor((rand / Math.pow(2, 32)) * (max - min + 1));
        },
        choice: (array) => {
            const rand = current = (current * 1664525 + 1013904223) % Math.pow(2, 32);
            const index = Math.floor((rand / Math.pow(2, 32)) * array.length);
            return array[index];
        }
    };
}
