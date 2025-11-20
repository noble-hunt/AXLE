import { WorkoutPlanZ } from "../../shared/workoutSchema";
// Helper to coerce numeric values for schema validation
function coerceNumber(value, options = {}) {
    if (value === null || value === undefined)
        return null;
    let num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num))
        return null;
    // Round to integer if required
    if (options.requireInt) {
        num = Math.round(num);
    }
    // Return null if below minimum (for optional fields)
    if (options.min !== undefined && num < options.min) {
        return null;
    }
    return num;
}
export function adaptToPlanV1(raw) {
    // try to coerce older shapes; ensure blocks[].items present
    // add conservative defaults if missing
    try {
        const rawBlocks = raw.blocks || [];
        // Handle missing/empty blocks by creating minimal valid structure
        let adaptedBlocks;
        if (rawBlocks.length === 0) {
            // Create conservative minimal 2-block plan (warmup + main)
            const durationMin = raw.durationMin || 30;
            const focus = raw.focus || "mixed";
            adaptedBlocks = [
                {
                    key: "warmup",
                    title: `${focus} warmup`,
                    targetSeconds: 300, // 5 minutes
                    items: [{
                            movementId: "warmup_default",
                            name: "Dynamic warmup",
                            prescription: {
                                type: "time",
                                sets: 1,
                                seconds: 300,
                                restSec: 0,
                            }
                        }]
                },
                {
                    key: "main",
                    title: "Main workout",
                    targetSeconds: (durationMin - 5) * 60,
                    items: [{
                            movementId: "main_default",
                            name: `${focus} training`,
                            prescription: {
                                type: "time",
                                sets: 1,
                                seconds: (durationMin - 5) * 60,
                                restSec: 0,
                            }
                        }]
                }
            ];
        }
        else {
            // Adapt existing blocks, ensure each has items
            console.log('[ADAPTER] Input blocks:', rawBlocks.map((b) => ({
                key: b.key,
                title: b.title,
                workoutTitle: b.workoutTitle,
                scoreType: b.scoreType,
                coachingCues: b.coachingCues
            })));
            adaptedBlocks = rawBlocks.map((block) => ({
                ...block,
                key: block.key || block.type || "main",
                title: block.title || block.notes || `${block.type || "main"} block`,
                targetSeconds: coerceNumber(block.targetSeconds || (block.minutes ? block.minutes * 60 : 300), { requireInt: true, min: 60 }) || 300,
                items: block.items && block.items.length > 0 ? block.items.map((item) => {
                    // Build prescription object, only including non-null values
                    const prescription = {
                        type: item.prescription?.type || 'reps',
                        sets: coerceNumber(item.prescription?.sets, { requireInt: true, min: 1 }) || 1,
                        restSec: coerceNumber(item.prescription?.restSec, { requireInt: true, min: 0 }) || 0,
                    };
                    // Only add optional fields if they have valid values
                    const reps = coerceNumber(item.prescription?.reps, { requireInt: true, min: 1 });
                    if (reps !== null)
                        prescription.reps = reps;
                    const seconds = coerceNumber(item.prescription?.seconds, { requireInt: true, min: 5 });
                    if (seconds !== null)
                        prescription.seconds = seconds;
                    const meters = coerceNumber(item.prescription?.meters, { requireInt: true, min: 10 });
                    if (meters !== null)
                        prescription.meters = meters;
                    // Handle calories field for cardio (e.g., "15 Cal Bike")
                    const calories = coerceNumber(item.prescription?.calories, { requireInt: true, min: 1 });
                    if (calories !== null)
                        prescription.calories = calories;
                    if (item.prescription?.load)
                        prescription.load = item.prescription.load;
                    if (item.prescription?.tempo)
                        prescription.tempo = item.prescription.tempo;
                    if (item.prescription?.notes)
                        prescription.notes = item.prescription.notes;
                    return {
                        ...item,
                        prescription
                    };
                }) : [
                    {
                        movementId: "default",
                        name: block.notes || "Default exercise",
                        prescription: {
                            type: "time",
                            sets: 1,
                            seconds: coerceNumber(block.targetSeconds || (block.minutes ? block.minutes * 60 : 300), { requireInt: true, min: 5 }) || 300,
                            restSec: 0,
                        }
                    }
                ]
            }));
            console.log('[ADAPTER] Output blocks:', adaptedBlocks.map((b) => ({
                key: b.key,
                title: b.title,
                workoutTitle: b.workoutTitle,
                scoreType: b.scoreType,
                coachingCues: b.coachingCues
            })));
        }
        // If we still don't have at least 2 blocks, add a minimal second block
        if (adaptedBlocks.length < 2) {
            adaptedBlocks.push({
                key: "cooldown",
                title: "Cool down",
                targetSeconds: 180, // 3 minutes
                items: [{
                        movementId: "cooldown_default",
                        name: "Recovery",
                        prescription: {
                            type: "time",
                            sets: 1,
                            seconds: 180,
                            restSec: 0,
                        }
                    }]
            });
        }
        // If raw data is missing required fields, add defaults
        const adapted = {
            ...raw,
            version: 1,
            blocks: adaptedBlocks,
            // Ensure required top-level fields
            seed: raw.seed || crypto.randomUUID(),
            focus: raw.focus || "mixed",
            durationMin: raw.durationMin || 30,
            intensity: raw.intensity || 5,
            equipment: raw.equipment || [],
            totalSeconds: raw.totalSeconds || (raw.durationMin ? raw.durationMin * 60 : 1800),
            summary: raw.summary || `${raw.focus || "Mixed"} workout`,
        };
        // Validate and return
        const plan = WorkoutPlanZ.parse(adapted);
        return plan;
    }
    catch (error) {
        // If adaptation fails, throw with helpful context
        throw new Error(`Failed to adapt workout data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
