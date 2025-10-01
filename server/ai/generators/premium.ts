import OpenAI from 'openai';
import { z } from 'zod';
import type { WorkoutGenerationRequest } from '../workoutGenerator';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define schema for premium workout structure
const WorkoutItemSchema = z.object({
  exercise: z.string(),
  target: z.string(),
  notes: z.string().optional()
});

const WorkoutBlockSchema = z.object({
  kind: z.enum(['warmup', 'strength', 'conditioning', 'skill', 'core', 'cooldown']),
  title: z.string(),
  time_min: z.number(),
  items: z.array(WorkoutItemSchema),
  notes: z.string().optional()
});

const AcceptanceFlagsSchema = z.object({
  time_fit: z.boolean(),
  has_warmup: z.boolean(),
  has_cooldown: z.boolean(),
  mixed_rule_ok: z.boolean(),
  equipment_ok: z.boolean(),
  injury_safe: z.boolean(),
  readiness_mod_applied: z.boolean(),
  hardness_ok: z.boolean(),
  patterns_locked: z.boolean()
});

const PremiumWorkoutSchema = z.object({
  title: z.string(),
  duration_min: z.number(),
  blocks: z.array(WorkoutBlockSchema),
  substitutions: z.array(z.string()).optional(),
  acceptance_flags: AcceptanceFlagsSchema,
  variety_score: z.number().optional()
});

type PremiumWorkout = z.infer<typeof PremiumWorkoutSchema>;

// Banned easy bodyweight movements (wall sit, mountain climber, star jump, high knees)
// Stored in lowercase for case-insensitive matching
const BANNED_EASY = new Set([
  "wall sit",
  "wall sits",
  "mountain climber",
  "mountain climbers",
  "star jump",
  "star jumps",
  "high knee",
  "high knees"
]);

// Allowed patterns for main blocks
const ALLOWED_PATTERNS = [
  /E[34]:00 x \d+/i,        // E3:00 x 5, E4:00 x 4
  /Every [34]:00 x \d+/i,   // Every 3:00 x 5
  /EMOM \d+(-\d+)?/i,       // EMOM 12, EMOM 10-16
  /AMRAP \d+/i,             // AMRAP 12
  /For Time 21-15-9/i,      // For Time 21-15-9
  /Chipper 40-30-20-10/i    // Chipper 40-30-20-10
];

// Movement pools with expanded options
const MOVEMENT_POOLS = {
  conditioning: [
    "Echo Bike Calories",
    "Row for Calories",
    "Ski Erg",
    "KB Swings",
    "DB Box Step-Overs",
    "Burpees",
    "Wall Balls",
    "DB/KB Farmer Carry",
    "Shuttle Runs",
    "DB Snatches"
  ],
  strength: [
    "BB Back Squat",
    "BB Front Squat",
    "BB Deadlift",
    "BB RDL",
    "BB Thruster",
    "BB Clean & Jerk",
    "DB Bench Press",
    "DB Floor Press",
    "Weighted Pull-Ups (fallback: Strict Pull-Ups → Ring Rows)",
    "DB/KB Goblet Squat",
    "DB/KB Overhead Press"
  ],
  skill: [
    "Toes-to-Bar",
    "Double-Unders",
    "Handstand Hold/Walk",
    "Muscle-Ups (progression)"
  ],
  core: [
    "Hollow Rocks",
    "Plank Variations",
    "Sit-Ups"
  ]
};

// Fallback ladder: BB → DB → KB → BW
const FALLBACK_LADDER = {
  "BB Clean & Jerk": ["DB Snatches", "KB Swings"],
  "BB Thruster": ["DB Thrusters", "KB Goblet Squat"],
  "Weighted Pull-Ups": ["Strict Pull-Ups", "Ring Rows"],
  "DB Bench Press": ["Push-Ups"],
  "BB Front Squat": ["DB Goblet Squat", "Air Squat"],
  "BB Deadlift": ["DB RDL", "KB Deadlift", "Good Mornings"],
  "Wall Balls": ["KB Swings", "Burpees"]
};

function getSystemPrompt(): string {
  return `You are HOBH CF/HIIT Premium Generator v2.

OUTPUT FORMAT:
{
  "title": "string",
  "duration_min": number,
  "blocks": [
    {
      "kind": "warmup" | "strength" | "conditioning" | "skill" | "core" | "cooldown",
      "title": "string",
      "time_min": number,
      "items": [
        {
          "exercise": "string",
          "target": "reps | time | cal | tempo",
          "notes": "optional guidance"
        }
      ],
      "notes": "optional block intent"
    }
  ],
  "substitutions": ["Array of equipment swaps if needed"],
  "acceptance_flags": {
    "time_fit": true,
    "has_warmup": true,
    "has_cooldown": true,
    "mixed_rule_ok": true,
    "equipment_ok": true,
    "injury_safe": true,
    "readiness_mod_applied": true,
    "hardness_ok": true,
    "patterns_locked": true
  }
}

MOVEMENT POOLS:
Conditioning: ${MOVEMENT_POOLS.conditioning.join(', ')}
Strength: ${MOVEMENT_POOLS.strength.join(', ')}
Skill: ${MOVEMENT_POOLS.skill.join(', ')}
Core: ${MOVEMENT_POOLS.core.join(', ')}

FALLBACK LADDER (BB → DB → KB → BW):
${Object.entries(FALLBACK_LADDER).map(([key, vals]) => `${key} → ${vals.join(' → ')}`).join('\n')}

STRUCTURE REQUIREMENTS:
1. Warm-up: ≥6 min (foam roll, mobility, ramp-up drills)
2. Main block(s): Choose ONLY from:
   - E3:00 x 5 / E4:00 x 4 (strength density; E4:00 x 4 for strength into skill/row pairing)
   - EMOM 10-16 (conditioning or mixed)
   - AMRAP 8-15 (conditioning)
   - For Time 21-15-9 (finisher, ≤10 min)
   - Chipper 40-30-20-10 (≤12 min cap; 3 movements max; loaded+cyclical mix)
3. Cool-down: ≥4 min (stretching, breathing)

MAIN BLOCK RULES:
- NO bodyweight filler (wall sit, mountain climber, star jump, high knees) in main blocks
- Prioritize loaded movements (BB/DB/KB) over bodyweight when equipment available
- Use expanded pools for variety: BB Clean & Jerk, Thrusters, Wall Balls, Farmer Carry, DB Snatches, Shuttle Runs
- Apply fallback ladder when equipment is missing

MIXED FOCUS RULES:
- For "mixed" focus with categories_for_mixed, generate exactly N main blocks where N = len(categories_for_mixed)
- Each block's kind must map to its category (Strength → "strength", Conditioning → "conditioning")
- If total time < duration_min × 0.9, append +1 finisher block (For Time 21-15-9, ≤10 min)

EXAMPLE OUTPUT:
{
  "title": "Advanced Mixed Focus Workout",
  "duration_min": 45,
  "blocks": [
    {
      "kind": "warmup",
      "title": "Warm-Up",
      "time_min": 8,
      "items": [
        { "exercise": "Foam Roll", "target": "2 min", "notes": "Upper back, lats, quads" },
        { "exercise": "Dynamic Stretching", "target": "3 min", "notes": "Leg swings, arm circles" },
        { "exercise": "Barbell Warm-Up", "target": "3 min", "notes": "5 reps: deadlift, hang clean, press" }
      ]
    },
    {
      "kind": "strength",
      "title": "E3:00 x 5",
      "time_min": 15,
      "items": [
        { "exercise": "BB Clean & Jerk", "target": "3 reps @ 75%", "notes": "Focus on explosive hip drive" }
      ],
      "notes": "Build to working weight across 5 sets"
    },
    {
      "kind": "conditioning",
      "title": "EMOM 12",
      "time_min": 12,
      "items": [
        { "exercise": "Echo Bike Calories", "target": "12/10 cal", "notes": "Odd minutes" },
        { "exercise": "DB Snatches", "target": "10 reps (5/arm)", "notes": "Even minutes, moderate load" }
      ],
      "notes": "Alternate odd/even minutes"
    },
    {
      "kind": "cooldown",
      "title": "Cool-Down",
      "time_min": 10,
      "items": [
        { "exercise": "Walk/Light Bike", "target": "3 min", "notes": "Lower heart rate" },
        { "exercise": "Static Stretching", "target": "7 min", "notes": "Hamstrings, shoulders, hip flexors" }
      ]
    }
  ],
  "substitutions": [],
  "acceptance_flags": {
    "time_fit": true,
    "has_warmup": true,
    "has_cooldown": true,
    "mixed_rule_ok": true,
    "equipment_ok": true,
    "injury_safe": true,
    "readiness_mod_applied": true,
    "hardness_ok": true,
    "patterns_locked": true
  }
}

ACCEPTANCE CRITERIA (self-check before output):
HARD REQUIREMENTS:
1. Warm-up present (≥6 min) and Cool-down present (≥4 min)
2. Time budget: Σ time_min within ±10% of duration_min
3. Mixed semantics: If focus="mixed", number of main blocks = len(categories_for_mixed); each block's kind maps to category. If time < duration_min × 0.9, append +1 finisher (For Time 21-15-9, ≤10 min).
4. Equipment-safe: No exercise requires missing equipment. If swapped, log in substitutions[]. When gear (BB/DB/KB) is present, at least 2/3 of main movements must be loaded.
5. Injury-safe: No contraindicated patterns; provide safer alternates
6. Readiness: If low readiness (Sleep < 60 or HRV flagged), cap strength at RPE ≤ 7, remove sprints/plyos
7. Hardness score: Must be ≥ 0.75 when equipment present and readiness good (or ≥ 0.55 if readiness is low). Use BB/DB/KB movements, not bodyweight filler. Pair cyclical with loaded movements in EMOMs.
8. Clarity: Every items[] entry has explicit reps/cal/time, any rest, and intent via notes
9. Structure: Order is Warm-up → main block(s) → Cool-down

SOFT REQUIREMENTS:
9. Unilateral work balanced per side
10. No back-to-back high-skill lifts for beginners
11. Variety score ≥ 0.4
12. If history shows recent pattern, bias alternative

If any hard check fails, silently repair and re-validate before returning JSON.`;
}

// Validate main block patterns
function validatePatterns(workout: PremiumWorkout): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  
  for (const block of workout.blocks) {
    // Only validate main blocks (strength, conditioning, skill, core)
    if (!['strength', 'conditioning', 'skill', 'core'].includes(block.kind)) {
      continue;
    }
    
    // Check if title matches any allowed pattern
    const matchesPattern = ALLOWED_PATTERNS.some(pattern => pattern.test(block.title));
    
    if (!matchesPattern) {
      violations.push(`Main block "${block.title}" (${block.kind}) doesn't match allowed patterns`);
    }
  }
  
  return {
    valid: violations.length === 0,
    violations
  };
}

// Hardness calculation function
function computeHardness(workout: PremiumWorkout): number {
  let h = 0;
  
  for (const b of workout.blocks) {
    // Pattern-based scoring (case-insensitive, match both long and short forms)
    if (b.kind === "strength" && /(Every\s+[34]:00|E[34]:00)/i.test(b.title)) h += 0.28;
    if (b.kind === "conditioning" && /EMOM/i.test(b.title)) h += 0.22;
    if (b.kind === "conditioning" && /AMRAP/i.test(b.title)) h += 0.22;
    if (b.kind === "conditioning" && /21-15-9/.test(b.title)) h += 0.20;
    if (b.kind === "conditioning" && /Chipper 40-30-20-10/i.test(b.title)) h += 0.24;

    // Equipment bonuses
    const text = JSON.stringify(b.items).toLowerCase();
    const hasBarbell = /(barbell|bb[\s,])/.test(text);
    const hasDbKb = /(dumbbell|db[\s,]|kettlebell|kb[\s,])/.test(text);
    const hasCyclical = /(echo bike|row|ski|cal)/.test(text);
    
    if (hasBarbell) h += 0.05;
    if (hasDbKb) h += 0.03;
    if (hasCyclical) h += 0.02;
    
    // Heavy-movement bonuses (+0.05 each for advanced loaded movements)
    if (text.includes("clean & jerk") || text.includes("clean and jerk") || text.includes("clean&jerk")) h += 0.05;
    if (text.includes("thruster")) h += 0.05;
    if (text.includes("deadlift") || text.includes("rdl")) h += 0.05;
    if (text.includes("front squat")) h += 0.05;
    if (text.includes("weighted pull-up") || text.includes("weighted pullup")) h += 0.05;
    if (text.includes("wall ball")) h += 0.05;
    if (text.includes("farmer carry")) h += 0.05;

    // Penalty for bodyweight-only in multiple main items
    let bwOnly = 0;
    for (const it of b.items || []) {
      const name = (it.exercise || "").trim().toLowerCase();
      if (BANNED_EASY.has(name)) bwOnly++;
    }
    if (bwOnly >= 2) h -= 0.07;
    
    // NEW: Penalty for strength blocks with only bodyweight or only push-ups/pull-ups
    if (b.kind === "strength") {
      const hasLoaded = hasBarbell || hasDbKb;
      const onlyBodyweight = !hasLoaded && /(push-up|pull-up|air squat|lunge)/i.test(text);
      if (onlyBodyweight) h -= 0.05;
    }
    
    // NEW: Bonus for pairing cyclical cals with loaded movement (EMOM odd/even pattern)
    if (/EMOM/i.test(b.title)) {
      const hasLoaded = hasBarbell || hasDbKb;
      if (hasCyclical && hasLoaded) h += 0.03;
    }
  }
  
  return Math.min(1, Math.max(0, h));
}

// Sanitizer function to enforce rules post-generation
function sanitizeWorkout(
  workout: PremiumWorkout, 
  opts: { 
    equipment?: string[]; 
    wearable_snapshot?: any;
    focus?: string;
    categories_for_mixed?: string[];
  }
): PremiumWorkout {
  // Normalize equipment for consistent access throughout function
  const equipment = (opts.equipment || []).map(e => e.toLowerCase());
  const hasLoad = equipment.some(e => 
    /(barbell|dumbbell|kettlebell)/i.test(e)
  );
  
  const ws = opts.wearable_snapshot || {};
  const lowReadiness = ws.sleep_score && ws.sleep_score < 60;
  
  // 1) Remove banned BW items in STRENGTH/CONDITIONING main blocks with rotation
  for (const b of workout.blocks) {
    // Only sanitize strength and conditioning blocks
    if (["strength", "conditioning"].includes(b.kind)) {
      const equipment = opts.equipment || [];
      const usedSubs = new Set<string>();
      let bannedCount = 0;
      
      // First pass: count banned movements (case-insensitive)
      for (const it of b.items) {
        const exerciseName = (it.exercise || "").trim().toLowerCase();
        if (BANNED_EASY.has(exerciseName)) bannedCount++;
      }
      
      // Second pass: replace with rotation (always replace banned, regardless of equipment/readiness)
      b.items = b.items.map(it => {
        const exerciseName = (it.exercise || "").trim().toLowerCase();
        
        // If banned exercise found, always replace to meet "no >1 banned per block" rule
        if (BANNED_EASY.has(exerciseName)) {
          // Rotation: DB Box Step-Overs → KB Swings → Wall Balls → Burpees
          let replacement = "Burpees"; // Default fallback
          
          if (equipment.includes('dumbbell') && !usedSubs.has("DB Box Step-Overs")) {
            replacement = "DB Box Step-Overs";
          } else if (equipment.includes('kettlebell') && !usedSubs.has("KB Swings")) {
            replacement = "KB Swings";
          } else if ((equipment.includes('medicine ball') || equipment.includes('med ball')) && !usedSubs.has("Wall Balls")) {
            replacement = "Wall Balls";
          } else if (!usedSubs.has("Burpees")) {
            replacement = "Burpees";
          } else {
            // If all used, cycle back through available
            if (equipment.includes('dumbbell')) replacement = "DB Box Step-Overs";
            else if (equipment.includes('kettlebell')) replacement = "KB Swings";
          }
          
          usedSubs.add(replacement);
          return { 
            ...it, 
            exercise: replacement, 
            notes: (it.notes || "") + " (upgraded for intensity)" 
          };
        }
        return it;
      });
      
      // Enforce: no block has >1 banned BW movement (case-insensitive)
      let remainingBanned = b.items.filter(it => BANNED_EASY.has((it.exercise || "").trim().toLowerCase())).length;
      
      // If >1 banned still exists, force replace remaining until ≤1
      while (remainingBanned > 1) {
        console.warn(`⚠️ Block "${b.title}" still has ${remainingBanned} banned movements, enforcing replacement`);
        
        for (let i = 0; i < b.items.length; i++) {
          const exerciseName = (b.items[i].exercise || "").trim().toLowerCase();
          if (BANNED_EASY.has(exerciseName)) {
            // Force replace with Burpees (always available)
            b.items[i] = {
              ...b.items[i],
              exercise: "Burpees",
              notes: (b.items[i].notes || "") + " (enforced replacement)"
            };
            console.log(`✅ Enforced replacement: ${exerciseName} → Burpees`);
            break; // Only replace one per iteration
          }
        }
        
        // Recount
        remainingBanned = b.items.filter(it => BANNED_EASY.has((it.exercise || "").trim().toLowerCase())).length;
      }
      
      if (remainingBanned === 1) {
        console.log(`✅ Block "${b.title}" has exactly 1 banned movement (acceptable)`);
      } else if (remainingBanned === 0) {
        console.log(`✅ Block "${b.title}" has no banned movements`);
      }
      
      // 1b) Upgrade intensity if block still appears too easy after substitutions
      // Check if block has any loaded movements
      const text = JSON.stringify(b.items).toLowerCase();
      const hasLoadedMovements = /(barbell|bb[\s,]|dumbbell|db[\s,]|kettlebell|kb[\s,]|weighted|wall ball)/i.test(text);
      
      // If we have equipment but block is still mostly bodyweight, upgrade
      if (hasLoad && !hasLoadedMovements && bannedCount > 0) {
        let upgraded = false;
        
        // Option 1: Tighten rest intervals in title (only to valid patterns)
        if (/E4:00/i.test(b.title)) {
          b.title = b.title.replace(/E4:00/gi, "E3:00");
          b.notes = (b.notes || "") + " Rest tightened to increase density";
          console.log(`✅ Tightened rest: E4:00 → E3:00 in "${b.title}"`);
          upgraded = true;
        } else if (/Every 4:00/i.test(b.title)) {
          b.title = b.title.replace(/Every 4:00/gi, "Every 3:00");
          b.notes = (b.notes || "") + " Rest tightened to increase density";
          console.log(`✅ Tightened rest: Every 4:00 → Every 3:00 in "${b.title}"`);
          upgraded = true;
        }
        
        // Option 2: Increase reps by 10-15% (only for pure rep targets)
        if (!upgraded) {
          for (const it of b.items) {
            const target = it.target || "";
            // Only increase if target is pure reps (not cal, time, or complex schemes)
            if (/^\d+\s*reps?$/i.test(target) || /^\d+$/.test(target)) {
              const repsMatch = target.match(/(\d+)/);
              if (repsMatch) {
                const currentReps = parseInt(repsMatch[1]);
                const newReps = Math.ceil(currentReps * 1.15); // 15% increase
                it.target = `${newReps} reps`;
                it.notes = (it.notes || "") + ` Upgraded from ${currentReps} reps`;
                console.log(`✅ Increased reps: ${currentReps} → ${newReps} for ${it.exercise}`);
              }
            }
          }
        }
      }
    }
  }
  
  // 2) Calculate hardness and check floor
  let floor = 0.65;
  
  // Raise floor to 0.75 when equipment includes DB/KB/BB and sleep >= 60
  if (hasLoad && !lowReadiness) {
    floor = 0.75;
  } else if (lowReadiness) {
    floor = 0.55;
  }

  workout.variety_score = computeHardness(workout);
  
  // 2b) Enforce hardness floor: append finisher if hardness < floor
  let hardnessFinisherAdded = false;
  if (workout.variety_score < floor) {
    console.warn(`⚠️ Hardness ${workout.variety_score.toFixed(2)} < floor ${floor.toFixed(2)}, appending intensity finisher`);
    
    // Find cooldown index
    const cooldownIdx = workout.blocks.findIndex(b => b.kind === 'cooldown');
    
    // Select a loaded movement based on available equipment
    let finisherMovement = "DB Snatches";
    let finisherSecondMovement = "Burpees";
    if (hasLoad) {
      if (equipment.includes('barbell')) {
        finisherMovement = "BB Thrusters";
        finisherSecondMovement = "BB Clean & Jerk";
      } else if (equipment.includes('dumbbell')) {
        finisherMovement = "DB Snatches";
        finisherSecondMovement = "DB Box Step-Overs";
      } else if (equipment.includes('kettlebell')) {
        finisherMovement = "KB Swings";
        finisherSecondMovement = "KB Goblet Squat";
      }
    }
    
    // Create finisher block (For Time 21-15-9, ≤10 min)
    // Use TWO loaded movements to maintain equipment ratio
    const finisher = {
      kind: "conditioning" as const,
      title: "For Time 21-15-9",
      time_min: 8,
      items: [
        { 
          exercise: finisherMovement, 
          target: "21-15-9", 
          notes: "Quick pace, prioritize movement quality" 
        },
        { 
          exercise: finisherSecondMovement, 
          target: "21-15-9", 
          notes: "Full range, explosive" 
        }
      ],
      notes: "Fast finisher to elevate heart rate and add intensity"
    };
    
    // Insert before cooldown
    if (cooldownIdx !== -1) {
      workout.blocks.splice(cooldownIdx, 0, finisher);
    } else {
      workout.blocks.push(finisher);
    }
    
    hardnessFinisherAdded = true;
    
    // Recalculate hardness after adding finisher
    workout.variety_score = computeHardness(workout);
    console.log(`✅ Finisher added, new hardness: ${workout.variety_score.toFixed(2)}`);
  }
  
  // 3) Validate patterns
  const patternValidation = validatePatterns(workout);
  
  // 4) Validate equipment usage (at least 2/3 main movements are loaded when gear present)
  // Only check strength + conditioning blocks (skill/core typically use bodyweight)
  let equipmentOk = true;
  if (hasLoad) {
    const mainBlocks = workout.blocks.filter(b => 
      ['strength', 'conditioning'].includes(b.kind)
    );
    
    let totalMovements = 0;
    let loadedMovements = 0;
    
    for (const block of mainBlocks) {
      for (const item of block.items || []) {
        const exercise = (item.exercise || "").toLowerCase();
        totalMovements++;
        
        // Check if movement is loaded (BB/DB/KB) - improved regex to avoid false positives
        if (/(barbell|bb[\s,]|dumbbell|db[\s,]|kettlebell|kb[\s,]|weighted|wall ball|farmer)/i.test(exercise)) {
          loadedMovements++;
        }
      }
    }
    
    const loadedRatio = totalMovements > 0 ? loadedMovements / totalMovements : 0;
    equipmentOk = loadedRatio >= (2/3) || totalMovements === 0;
    
    if (!equipmentOk) {
      console.warn(`⚠️ Equipment usage violation: ${loadedMovements}/${totalMovements} movements are loaded (${(loadedRatio * 100).toFixed(0)}%), need ≥67%`);
    }
  }
  
  // 5) Validate mixed semantics
  let mixedRuleOk = true;
  if (opts.focus === 'mixed' && opts.categories_for_mixed && opts.categories_for_mixed.length > 0) {
    const mainBlocks = workout.blocks.filter(b => 
      ['strength', 'conditioning', 'skill', 'core'].includes(b.kind)
    );
    
    const expectedCount = opts.categories_for_mixed.length;
    const actualCount = mainBlocks.length;
    
    // Check: should be exactly N blocks OR N+1 if finisher added
    const totalTime = workout.blocks.reduce((sum, b) => sum + b.time_min, 0);
    const hasTimeShortfallFinisher = actualCount === expectedCount + 1 && totalTime < workout.duration_min * 0.9;
    const hasHardnessFinisher = actualCount === expectedCount + 1 && hardnessFinisherAdded;
    
    mixedRuleOk = actualCount === expectedCount || hasTimeShortfallFinisher || hasHardnessFinisher;
    
    if (!mixedRuleOk) {
      console.warn(`⚠️ Mixed rule violation: expected ${expectedCount} main blocks (or ${expectedCount + 1} with finisher), got ${actualCount}`);
    }
  }
  
  // 6) Set acceptance flags
  workout.acceptance_flags = workout.acceptance_flags || {
    time_fit: true,
    has_warmup: true,
    has_cooldown: true,
    mixed_rule_ok: true,
    equipment_ok: true,
    injury_safe: true,
    readiness_mod_applied: true,
    hardness_ok: true,
    patterns_locked: true
  };
  
  workout.acceptance_flags.hardness_ok = workout.variety_score >= floor;
  workout.acceptance_flags.patterns_locked = patternValidation.valid;
  workout.acceptance_flags.mixed_rule_ok = mixedRuleOk;
  workout.acceptance_flags.equipment_ok = equipmentOk;

  return workout;
}

// Helper function to extract focus and categories from request
function extractFocusAndCategories(request: WorkoutGenerationRequest): { focus: string; categoriesForMixed: string[] } {
  const categoryStr = String(request.category);
  let focus = 'strength';
  let categoriesForMixed: string[] = [];
  
  if (categoryStr.includes('CrossFit') || categoryStr.includes('HIIT')) {
    focus = 'mixed';
    // For CrossFit/HIIT, default to Strength + Conditioning (can be extended based on equipment/duration)
    categoriesForMixed = ['Strength', 'Conditioning'];
  } else if (categoryStr.includes('Olympic')) {
    focus = 'strength';
  } else if (categoryStr.includes('Powerlifting')) {
    focus = 'strength';
  } else if (categoryStr.includes('Gymnastics')) {
    focus = 'skill';
  } else if (categoryStr.includes('Cardio')) {
    focus = 'conditioning';
  } else if (categoryStr.includes('Bodybuilding')) {
    focus = 'strength';
  }
  
  return { focus, categoriesForMixed };
}

function createUserPrompt(request: WorkoutGenerationRequest): string {
  const {
    category,
    duration,
    intensity,
    context
  } = request;

  // Extract equipment and constraints
  const equipment = context?.equipment || ['dumbbell', 'kettlebell', 'barbell'];
  const constraints = context?.constraints || [];
  const injuries = constraints.filter(c => c.includes('injury') || c.includes('shoulder') || c.includes('knee') || c.includes('back'));
  
  // Determine experience level from intensity
  const experience = intensity <= 4 ? 'beginner' : intensity <= 7 ? 'intermediate' : 'advanced';
  
  // Extract focus and categories
  const { focus, categoriesForMixed } = extractFocusAndCategories(request);
  
  // Extract biometric snapshot
  const healthSnapshot = context?.health_snapshot;
  const wearableSnapshot = {
    hrv_score: healthSnapshot?.hrv || 70,
    sleep_score: healthSnapshot?.sleep_score || 75,
    rhr: healthSnapshot?.resting_hr || 60,
    load_72h: 2.5
  };
  
  // Extract history
  const yesterday = context?.yesterday;
  const historySummary = {
    last_patterns: yesterday?.category ? [String(yesterday.category).toLowerCase()] : [],
    last_date: new Date().toISOString().split('T')[0]
  };
  
  return `GENERATE PREMIUM WORKOUT:

USER INPUT:
{
  "focus": "${focus}",
  "duration_min": ${duration},
  "categories_for_mixed": ${JSON.stringify(categoriesForMixed)},
  "equipment": ${JSON.stringify(equipment)},
  "experience": "${experience}",
  "injuries": ${JSON.stringify(injuries)},
  "wearable_snapshot": ${JSON.stringify(wearableSnapshot)},
  "history_summary": ${JSON.stringify(historySummary)},
  "banned": ${constraints.length > 0 ? JSON.stringify(constraints) : '[]'}
}

REQUIREMENTS:
- Category: ${category}
- Target Intensity: ${intensity}/10
- Return ONLY valid JSON matching the schema
- No markdown, no explanations`;
}

export async function generatePremiumWorkout(
  request: WorkoutGenerationRequest,
  seed?: string,
  retryCount: number = 0
): Promise<PremiumWorkout> {
  try {
    const systemPrompt = getSystemPrompt();
    const userPrompt = createUserPrompt(request);
    const { focus, categoriesForMixed } = extractFocusAndCategories(request);

    console.log(`Generating premium workout for ${request.category}, ${request.duration}min, intensity ${request.intensity}/10, seed: ${seed || 'none'} (attempt ${retryCount + 1})`);

    // Convert seed to integer for OpenAI (they accept integer seeds)
    const seedInt = seed ? parseInt(seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0).toString().slice(0, 8)) : undefined;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.75,
      max_tokens: 2500,
      ...(seedInt !== undefined && { seed: seedInt })
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content generated');
    }

    // Parse and validate
    const workout = JSON.parse(content);
    let validated = PremiumWorkoutSchema.parse(workout);

    // Sanitize and enforce requirements
    validated = sanitizeWorkout(validated, {
      equipment: request.context?.equipment || [],
      wearable_snapshot: {
        sleep_score: request.context?.health_snapshot?.sleep_score
      },
      focus,
      categories_for_mixed: categoriesForMixed
    });

    // Check pattern lock violations and regenerate once if needed
    if (!validated.acceptance_flags.patterns_locked && retryCount === 0) {
      const patternCheck = validatePatterns(validated);
      console.warn(`⚠️ Pattern lock violation: ${patternCheck.violations.join('; ')}. Regenerating...`);
      
      // Add pattern violation reason to context for next attempt
      const retryRequest = {
        ...request,
        context: {
          ...request.context,
          pattern_violation_reason: patternCheck.violations.join('; ')
        }
      };
      
      return generatePremiumWorkout(retryRequest, seed, retryCount + 1);
    }

    // Check if hardness meets requirements
    if (!validated.acceptance_flags.hardness_ok) {
      console.warn(`⚠️ Hardness score ${validated.variety_score.toFixed(2)} below threshold, workout may be too easy`);
    }
    
    // Check if mixed rule is satisfied
    if (focus === 'mixed' && !validated.acceptance_flags.mixed_rule_ok) {
      console.warn(`⚠️ Mixed rule violation: blocks don't match expected categories`);
    }
    
    // Check if equipment usage is satisfied
    if (!validated.acceptance_flags.equipment_ok) {
      console.warn(`⚠️ Equipment usage violation: insufficient loaded movements when gear is present`);
    }

    console.log(`✅ Premium workout generated: "${validated.title}" with ${validated.blocks.length} blocks, hardness: ${validated.variety_score.toFixed(2)}, patterns_locked: ${validated.acceptance_flags.patterns_locked}, mixed_rule_ok: ${validated.acceptance_flags.mixed_rule_ok}, equipment_ok: ${validated.acceptance_flags.equipment_ok}`);
    
    return validated;

  } catch (error) {
    console.error('Premium generation failed:', error);
    throw error;
  }
}
