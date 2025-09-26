import { WorkoutPlanZ } from "../../shared/workoutSchema";

export function adaptToPlanV1(raw: any): any {
  // try to coerce older shapes; ensure blocks[].items present
  // add conservative defaults if missing
  
  try {
    // If raw data is missing required fields, add defaults
    const adapted = {
      ...raw,
      version: 1,
      
      // Ensure blocks exist and have items
      blocks: (raw.blocks || []).map((block: any) => ({
        ...block,
        key: block.key || block.type || "main",
        title: block.title || block.notes || `${block.type || "main"} block`,
        targetSeconds: block.targetSeconds || (block.minutes ? block.minutes * 60 : 300),
        items: block.items && block.items.length > 0 ? block.items : [
          {
            movementId: "default",
            name: block.notes || "Default exercise",
            prescription: {
              type: "time" as const,
              sets: 1,
              seconds: block.targetSeconds || (block.minutes ? block.minutes * 60 : 300),
              restSec: 0,
            }
          }
        ]
      })),
      
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
  } catch (error) {
    // If adaptation fails, throw with helpful context
    throw new Error(`Failed to adapt workout data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}