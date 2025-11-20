/**
 * Workout Templates System
 *
 * Defines structured workout templates for different archetypes and durations.
 * Each template specifies blocks, timing, and movement requirements.
 */
/**
 * Strength Training Templates
 */
const STRENGTH_TEMPLATES = [
    {
        id: 'strength-fullbody-3x3',
        name: 'Full Body Strength 3x3',
        archetype: 'strength',
        minMinutes: 45,
        maxMinutes: 75,
        targetIntensityRange: [7, 9],
        blocks: [
            {
                id: 'warmup',
                type: 'warmup',
                structure: 'straight',
                time: 10,
                movements: [
                    { role: 'mobility', patterns: ['hinge', 'squat'], count: 2 }
                ]
            },
            {
                id: 'main-compound',
                type: 'main',
                structure: 'straight',
                sets: 3,
                reps: '3-5',
                rest: 180,
                load: '80-90%',
                movements: [
                    { role: 'primary', patterns: ['squat', 'hinge'], count: 1, compound: true },
                    { role: 'primary', patterns: ['push', 'pull'], count: 1, compound: true }
                ]
            },
            {
                id: 'accessory',
                type: 'accessory',
                structure: 'superset',
                sets: 3,
                reps: '8-12',
                rest: 90,
                load: '65-75%',
                movements: [
                    { role: 'accessory', patterns: ['push', 'pull'], count: 1 },
                    { role: 'accessory', patterns: ['core'], count: 1 }
                ]
            }
        ]
    },
    {
        id: 'strength-upper-lower-4x5',
        name: 'Upper/Lower Strength 4x5',
        archetype: 'strength',
        minMinutes: 50,
        maxMinutes: 80,
        targetIntensityRange: [6, 8],
        blocks: [
            {
                id: 'warmup',
                type: 'warmup',
                structure: 'straight',
                time: 8,
                movements: [
                    { role: 'mobility', patterns: ['push', 'pull'], count: 2 }
                ]
            },
            {
                id: 'main-upper',
                type: 'main',
                structure: 'straight',
                sets: 4,
                reps: '5-6',
                rest: 150,
                load: '75-85%',
                movements: [
                    { role: 'primary', patterns: ['push'], count: 1, compound: true },
                    { role: 'primary', patterns: ['pull'], count: 1, compound: true }
                ]
            },
            {
                id: 'accessory-upper',
                type: 'accessory',
                structure: 'circuit',
                sets: 3,
                reps: '10-15',
                rest: 60,
                movements: [
                    { role: 'accessory', patterns: ['push'], count: 1 },
                    { role: 'accessory', patterns: ['pull'], count: 1 },
                    { role: 'accessory', patterns: ['core'], count: 1 }
                ]
            }
        ]
    }
];
/**
 * Quick Strength Templates
 */
const QUICK_STRENGTH_TEMPLATES = [
    {
        id: 'strength-quick-20min',
        name: 'Quick Strength 20min',
        archetype: 'strength',
        minMinutes: 15,
        maxMinutes: 25,
        targetIntensityRange: [5, 8],
        blocks: [
            {
                id: 'warmup',
                type: 'warmup',
                structure: 'straight',
                time: 5,
                movements: [
                    { role: 'mobility', patterns: ['squat', 'hinge'], count: 2 }
                ]
            },
            {
                id: 'main-quick',
                type: 'main',
                structure: 'superset',
                sets: 3,
                reps: '6-8',
                rest: 90,
                load: '70-80%',
                movements: [
                    { role: 'primary', patterns: ['squat', 'hinge'], count: 1, compound: true },
                    { role: 'primary', patterns: ['push', 'pull'], count: 1, compound: true }
                ]
            }
        ]
    }
];
/**
 * Mixed/CrossFit Templates
 */
const MIXED_TEMPLATES = [
    {
        id: 'mixed-emom-18',
        name: 'Mixed EMOM 18',
        archetype: 'mixed',
        minMinutes: 25,
        maxMinutes: 35,
        targetIntensityRange: [6, 8],
        blocks: [
            {
                id: 'warmup',
                type: 'warmup',
                structure: 'straight',
                time: 8,
                movements: [
                    { role: 'mobility', patterns: ['squat', 'hinge', 'push'], count: 3 }
                ]
            },
            {
                id: 'emom-main',
                type: 'main',
                structure: 'emom',
                time: 18,
                movements: [
                    { role: 'strength', patterns: ['squat', 'hinge'], count: 1, compound: true },
                    { role: 'conditioning', patterns: ['push', 'pull'], count: 1, energySystem: 'glycolytic' },
                    { role: 'metabolic', patterns: ['squat'], count: 1, energySystem: 'glycolytic' }
                ],
                notes: 'Minute 1: Strength, Minute 2: Upper conditioning, Minute 3: Metabolic, repeat'
            }
        ]
    },
    {
        id: 'mixed-amrap-15',
        name: 'Mixed AMRAP 15',
        archetype: 'mixed',
        minMinutes: 25,
        maxMinutes: 35,
        targetIntensityRange: [7, 9],
        blocks: [
            {
                id: 'warmup',
                type: 'warmup',
                structure: 'straight',
                time: 8,
                movements: [
                    { role: 'mobility', patterns: ['squat', 'push', 'pull'], count: 3 }
                ]
            },
            {
                id: 'amrap-main',
                type: 'main',
                structure: 'amrap',
                time: 15,
                movements: [
                    { role: 'strength', patterns: ['hinge'], count: 1 },
                    { role: 'gymnastics', patterns: ['push', 'pull'], count: 1 },
                    { role: 'metabolic', patterns: ['squat'], count: 1, energySystem: 'glycolytic' }
                ]
            },
            {
                id: 'cooldown',
                type: 'cooldown',
                structure: 'straight',
                time: 5,
                movements: [
                    { role: 'recovery', patterns: ['core'], count: 1 }
                ]
            }
        ]
    },
    {
        id: 'mixed-complex-45min',
        name: 'Mixed Complex 45min',
        archetype: 'mixed',
        minMinutes: 40,
        maxMinutes: 50,
        targetIntensityRange: [6, 8],
        blocks: [
            {
                id: 'warmup',
                type: 'warmup',
                structure: 'straight',
                time: 10,
                movements: [
                    { role: 'mobility', patterns: ['squat', 'hinge', 'push'], count: 3 }
                ]
            },
            {
                id: 'strength-block',
                type: 'main',
                structure: 'straight',
                sets: 4,
                reps: '5-8',
                rest: 120,
                load: '75-85%',
                movements: [
                    { role: 'primary', patterns: ['squat', 'hinge'], count: 1, compound: true }
                ]
            },
            {
                id: 'conditioning-block',
                type: 'conditioning',
                structure: 'circuit',
                sets: 3,
                time: 8,
                rest: 90,
                movements: [
                    { role: 'power', patterns: ['squat'], count: 1, energySystem: 'glycolytic' },
                    { role: 'gymnastics', patterns: ['push', 'pull'], count: 1 },
                    { role: 'metabolic', patterns: ['carry'], count: 1 }
                ]
            }
        ]
    }
];
/**
 * Endurance/Conditioning Templates
 */
const ENDURANCE_TEMPLATES = [
    {
        id: 'endurance-intervals-8x1min',
        name: 'Endurance Intervals 8x1min',
        archetype: 'endurance',
        minMinutes: 30,
        maxMinutes: 45,
        targetIntensityRange: [5, 7],
        blocks: [
            {
                id: 'warmup',
                type: 'warmup',
                structure: 'straight',
                time: 10,
                movements: [
                    { role: 'mobility', patterns: ['squat', 'hinge'], count: 2 }
                ]
            },
            {
                id: 'intervals',
                type: 'conditioning',
                structure: 'intervals',
                sets: 8,
                time: 1,
                rest: 90,
                movements: [
                    { role: 'cardio', patterns: ['squat', 'pull'], count: 1, energySystem: 'aerobic' }
                ]
            },
            {
                id: 'cooldown',
                type: 'cooldown',
                structure: 'straight',
                time: 8,
                movements: [
                    { role: 'recovery', patterns: ['core'], count: 1 }
                ]
            }
        ]
    },
    {
        id: 'endurance-steady-30min',
        name: 'Steady State Endurance 30min',
        archetype: 'endurance',
        minMinutes: 35,
        maxMinutes: 50,
        targetIntensityRange: [4, 6],
        blocks: [
            {
                id: 'warmup',
                type: 'warmup',
                structure: 'straight',
                time: 5,
                movements: [
                    { role: 'mobility', patterns: ['squat'], count: 1 }
                ]
            },
            {
                id: 'steady-state',
                type: 'conditioning',
                structure: 'straight',
                time: 30,
                movements: [
                    { role: 'cardio', patterns: ['squat', 'pull'], count: 1, energySystem: 'aerobic' }
                ],
                notes: 'Maintain steady conversational pace'
            },
            {
                id: 'cooldown',
                type: 'cooldown',
                structure: 'straight',
                time: 10,
                movements: [
                    { role: 'recovery', patterns: ['core'], count: 1 }
                ]
            }
        ]
    }
];
/**
 * All available templates
 */
export const WORKOUT_TEMPLATES = [
    ...STRENGTH_TEMPLATES,
    ...QUICK_STRENGTH_TEMPLATES,
    ...MIXED_TEMPLATES,
    ...ENDURANCE_TEMPLATES
];
/**
 * Find template by ID
 */
export function getTemplateById(id) {
    return WORKOUT_TEMPLATES.find(t => t.id === id);
}
/**
 * Find templates by archetype
 */
export function getTemplatesByArchetype(archetype) {
    return WORKOUT_TEMPLATES.filter(t => t.archetype === archetype);
}
/**
 * Find templates by duration range
 */
export function getTemplatesByDuration(minutes) {
    return WORKOUT_TEMPLATES.filter(t => minutes >= t.minMinutes && minutes <= t.maxMinutes);
}
/**
 * Find best template for given parameters
 */
export function selectTemplate(archetype, minutes, targetIntensity, rng) {
    // Filter by archetype and duration
    let candidates = WORKOUT_TEMPLATES.filter(t => t.archetype === archetype &&
        minutes >= t.minMinutes &&
        minutes <= t.maxMinutes);
    // If no exact matches, try broader archetype matching
    if (candidates.length === 0) {
        if (archetype === 'conditioning') {
            candidates = WORKOUT_TEMPLATES.filter(t => (t.archetype === 'mixed' || t.archetype === 'endurance') &&
                minutes >= t.minMinutes && minutes <= t.maxMinutes);
        }
    }
    // Filter by intensity preference
    const intensityMatches = candidates.filter(t => targetIntensity >= t.targetIntensityRange[0] &&
        targetIntensity <= t.targetIntensityRange[1]);
    const finalCandidates = intensityMatches.length > 0 ? intensityMatches : candidates;
    if (finalCandidates.length === 0) {
        // Fallback: Find closest match by duration
        const allTemplates = WORKOUT_TEMPLATES.filter(t => t.archetype === archetype);
        if (allTemplates.length > 0) {
            // Find template with closest duration
            const closest = allTemplates.reduce((prev, curr) => {
                const prevDiff = Math.abs((prev.minMinutes + prev.maxMinutes) / 2 - minutes);
                const currDiff = Math.abs((curr.minMinutes + curr.maxMinutes) / 2 - minutes);
                return currDiff < prevDiff ? curr : prev;
            });
            return closest;
        }
        return undefined;
    }
    // Select randomly using seeded RNG
    const index = Math.floor(rng() * finalCandidates.length);
    return finalCandidates[index];
}
/**
 * Estimate total workout time for template
 */
export function estimateWorkoutTime(template) {
    return template.blocks.reduce((total, block) => {
        if (block.time) {
            return total + block.time;
        }
        // Estimate based on sets and rest
        if (block.sets && block.rest) {
            const workTime = block.sets * 45; // 45 seconds average per set
            const restTime = (block.sets - 1) * (block.rest / 60); // rest in minutes
            return total + (workTime + restTime) / 60;
        }
        return total + 10; // default fallback
    }, 0);
}
