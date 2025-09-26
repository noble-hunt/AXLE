import { WorkoutPlanZ } from "../../shared/workoutSchema";

export function adaptToPlanV1(raw: any): any {
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
              type: "time" as const,
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
              type: "time" as const,
              sets: 1,
              seconds: (durationMin - 5) * 60,
              restSec: 0,
            }
          }]
        }
      ];
    } else {
      // Adapt existing blocks, ensure each has items
      adaptedBlocks = rawBlocks.map((block: any) => ({
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
      }));
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
            type: "time" as const,
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
  } catch (error) {
    // If adaptation fails, throw with helpful context
    throw new Error(`Failed to adapt workout data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}