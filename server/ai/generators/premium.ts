import OpenAI from 'openai';
import { z } from 'zod';
import type { WorkoutGenerationRequest } from '../generateWorkout';

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

const SubstitutionSchema = z.object({
  from: z.string(),
  to: z.string(),
  reason: z.string()
});

const PremiumWorkoutSchema = z.object({
  title: z.string(),
  duration_min: z.number(),
  blocks: z.array(WorkoutBlockSchema),
  substitutions: z.array(SubstitutionSchema).optional(),
  acceptance_flags: AcceptanceFlagsSchema,
  variety_score: z.number().optional()
});

type PremiumWorkout = z.infer<typeof PremiumWorkoutSchema>;

// Banned easy bodyweight movements (wall sit, mountain climber, star jump, high knees, jumping jacks, bicycle crunch)
// Stored in lowercase for case-insensitive matching
const BANNED_EASY = new Set([
  "wall sit",
  "wall sits",
  "mountain climber",
  "mountain climbers",
  "star jump",
  "star jumps",
  "high knee",
  "high knees",
  "jumping jack",
  "jumping jacks",
  "bicycle crunch",
  "bicycle crunches"
]);

// Banned bodyweight movements specifically for main blocks when equipment is available
const BANNED_BW_MAIN = /^(Wall Sit|Mountain Climber|Star Jump|High Knees|Jumping Jacks|Bicycle Crunch)$/i;

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
    "Echo Bike cals",
    "Row cals",
    "Ski Erg cals",
    "KB Swings",
    "DB Box Step-Overs",
    "Burpees",
    "Wall Balls",
    "Farmer Carry (DB/KB)",
    "DB Snatch (alt: KB Swings)",
    "Shuttle Runs (no machine)"
  ],
  strength: [
    "Barbell Front Squat",
    "Barbell Push Press",
    "Barbell Deadlift",
    "Barbell Thruster",
    "Barbell Clean & Jerk (moderate, touch-and-go)",
    "Dumbbell Floor Press",
    "Dumbbell Bench Press",
    "DB Goblet Squat",
    "DB Romanian Deadlift",
    "KB Front Rack Squat",
    "KB Push Press",
    "Weighted Pull-Ups",
    "Strict Pull-Ups",
    "Ring Rows"
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

// Equipment fallback ladder: Barbell → Dumbbell → Kettlebell → Bodyweight
const MOVEMENT_FALLBACKS: Record<string, string[]> = {
  "Barbell Front Squat": ["DB Goblet Squat", "KB Front Rack Squat", "Air Squat x 20 tempo"],
  "Barbell Push Press": ["DB Push Press", "KB Push Press", "Push-Ups x 15"],
  "Barbell Deadlift": ["DB Romanian Deadlift", "KB Deadlift", "Glute Bridge x 20"],
  "Barbell Thruster": ["DB Thruster", "KB Thruster", "Air Squat to Press x 15"],
  "Barbell Clean & Jerk (moderate, touch-and-go)": ["DB Clean & Jerk", "KB Clean & Press", "Burpees x 10"],
  "Dumbbell Bench Press": ["DB Floor Press", "Push-Ups", "Push-Ups x 15"],
  "Dumbbell Floor Press": ["Push-Ups", "Pike Push-Ups x 10"],
  "DB Goblet Squat": ["KB Goblet Squat", "Air Squat x 20"],
  "DB Romanian Deadlift": ["KB Romanian Deadlift", "Glute Bridge x 20"],
  "KB Front Rack Squat": ["Goblet Squat", "Air Squat x 20"],
  "KB Push Press": ["DB Push Press", "Push-Ups x 15"],
  "Weighted Pull-Ups": ["Strict Pull-Ups", "Ring Rows", "Inverted Rows x 12"],
  "Wall Balls": ["DB Thruster", "Air Squat to Press x 15"],
  "Farmer Carry (DB/KB)": ["Farmers Walk", "Plank Hold 60s"],
  "DB Snatch (alt: KB Swings)": ["KB Swings", "Burpees x 10"]
};

function applyEquipmentFallback(movement: string, equipment: string[]): { exercise: string; wasSubstituted: boolean } {
  const hasBarbell = equipment.some(e => /barbell/i.test(e));
  const hasDumbbell = equipment.some(e => /dumbbell/i.test(e));
  const hasKettlebell = equipment.some(e => /kettlebell/i.test(e));
  
  // If movement requires equipment not available, use fallback
  if (movement.toLowerCase().includes('barbell') && !hasBarbell) {
    const fallbacks = MOVEMENT_FALLBACKS[movement] || [];
    // Try DB first
    if (hasDumbbell && fallbacks[0]) {
      return { exercise: fallbacks[0], wasSubstituted: true };
    }
    // Try KB next
    if (hasKettlebell && fallbacks[1]) {
      return { exercise: fallbacks[1], wasSubstituted: true };
    }
    // Fall back to bodyweight
    if (fallbacks[2]) {
      return { exercise: fallbacks[2], wasSubstituted: true };
    }
  }
  
  if (movement.toLowerCase().includes('dumbbell') && !hasDumbbell) {
    const fallbacks = MOVEMENT_FALLBACKS[movement] || [];
    // Try KB first
    if (hasKettlebell && fallbacks[0]) {
      return { exercise: fallbacks[0], wasSubstituted: true };
    }
    // Fall back to bodyweight
    if (fallbacks[1]) {
      return { exercise: fallbacks[1], wasSubstituted: true };
    }
  }
  
  if (movement.toLowerCase().includes('kettlebell') || movement.toLowerCase().includes('kb ')) {
    if (!hasKettlebell) {
      const fallbacks = MOVEMENT_FALLBACKS[movement] || [];
      // Try DB first
      if (hasDumbbell && fallbacks[0]) {
        return { exercise: fallbacks[0], wasSubstituted: true };
      }
      // Fall back to bodyweight
      if (fallbacks[1]) {
        return { exercise: fallbacks[1], wasSubstituted: true };
      }
    }
  }
  
  return { exercise: movement, wasSubstituted: false };
}

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

// Validate patterns and ban BW filler in main blocks when equipment exists
function validatePatternsAndBW(workout: PremiumWorkout, equipment: string[]): void {
  const hasLoad = (equipment || []).some(e => /(barbell|dumbbell|kettlebell)/i.test(e));
  const mains = workout.blocks.filter((b: any) => !['warmup', 'cooldown'].includes(b.kind));
  
  if (!mains.length) {
    throw new Error('no_main_blocks');
  }

  for (const b of mains) {
    // Check pattern lock
    const ALLOWED_PATTERNS_REGEX = /(Every\s*[234]:?00\s*x\s*\d+|EMOM\s*(8|10|12|14|16)|AMRAP\s*(8|10|12|15)|For\s*Time\s*21-15-9|Chipper\s*40-30-20-10)/i;
    if (!ALLOWED_PATTERNS_REGEX.test(b.title || '')) {
      throw new Error('pattern_lock_violation');
    }
    
    // Check for banned BW movements in main blocks when equipment is available
    if (hasLoad) {
      const banned = (b.items || []).filter((it: any) => BANNED_BW_MAIN.test(it.exercise || ''));
      if (banned.length > 0) {
        throw new Error('banned_bw_in_main');
      }
      console.log(`✅ Block "${b.title}" has no banned movements`);
    }
  }
}

// Hardness calculation function
export function computeHardness(workout: PremiumWorkout): number {
  let h = 0;
  
  for (const b of workout.blocks) {
    // ===== HOBH: pattern bonuses (hard mode) =====
    if (/(Every\s+[234]:00|E[234]:00)/i.test(b.title)) h += 0.35;   // was 0.28
    if (/EMOM/i.test(b.title))       h += 0.30;  // was 0.22
    if (/AMRAP/i.test(b.title))      h += 0.30;  // was 0.22
    if (/21-15-9/i.test(b.title))    h += 0.28;  // was 0.20
    if (/Chipper/i.test(b.title))    h += 0.32;  // was 0.24

    // ===== HOBH: equipment & heavy movement bonuses =====
    const text = JSON.stringify(b.items).toLowerCase();
    const hasBarbell = /(barbell|bb[\s,])/.test(text);
    const hasDbKb = /(dumbbell|db[\s,]|kettlebell|kb[\s,])/.test(text);
    const hasCyclical = /(echo bike|row|ski|cal)/.test(text);
    
    if (hasBarbell)  h += 0.10; // was 0.05
    if (hasDbKb)     h += 0.07; // was 0.03
    if (hasCyclical) h += 0.05; // was 0.02
    
    // heavy lifts present?
    if (/clean\s*&\s*jerk/i.test(text)) h += 0.08; // was 0.05
    if (/thruster/i.test(text))         h += 0.08; // was 0.05
    if (/deadlift/i.test(text))         h += 0.08; // was 0.05
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
  
  // Initialize substitutions array if not exists
  if (!workout.substitutions) {
    workout.substitutions = [];
  }
  
  // Apply equipment fallbacks to all main blocks
  for (const b of workout.blocks) {
    if (['strength', 'conditioning'].includes(b.kind)) {
      for (let i = 0; i < b.items.length; i++) {
        const item = b.items[i];
        const result = applyEquipmentFallback(item.exercise, opts.equipment || []);
        if (result.wasSubstituted) {
          console.log(`🔄 Equipment fallback: ${item.exercise} → ${result.exercise}`);
          workout.substitutions.push({
            from: item.exercise,
            to: result.exercise,
            reason: 'equipment_unavailable'
          });
          b.items[i].exercise = result.exercise;
        }
      }
    }
  }
  
  // Verify loaded movement ratio (at least 2/3 main movements should be loaded)
  const mainBlocks = workout.blocks.filter(b => ['strength', 'conditioning'].includes(b.kind));
  let totalMainMovements = 0;
  let loadedMovements = 0;
  
  for (const b of mainBlocks) {
    for (const item of b.items) {
      totalMainMovements++;
      const exercise = item.exercise.toLowerCase();
      if (exercise.includes('barbell') || exercise.includes('dumbbell') || 
          exercise.includes('kettlebell') || exercise.includes('kb ') ||
          exercise.includes('weighted')) {
        loadedMovements++;
      }
    }
  }
  
  const loadedRatio = totalMainMovements > 0 ? loadedMovements / totalMainMovements : 0;
  console.log(`📊 Loaded movement ratio: ${loadedMovements}/${totalMainMovements} = ${loadedRatio.toFixed(2)}`);
  
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
  
  // ===== HOBH: hardness floor (hard mode) =====
  let floor = 0.75; // base floor (was 0.65)
  // lowReadiness and hasLoad already declared above
  
  if (hasLoad && !lowReadiness) {
    floor = 0.85;  // was 0.75 —> HARDER by default when gear present
  } else if (lowReadiness) {
    floor = 0.55;  // unchanged guardrail
  }
  // If score < floor, attempt repair path first; only then consider finisher.

  workout.variety_score = computeHardness(workout);
  
  // ===== HOBH: finisher only-on-deficit and harder defaults =====
  let hardnessFinisherAdded = false;
  if (workout.variety_score < floor) {
    console.warn(`⚠️ Hardness ${workout.variety_score.toFixed(2)} < floor ${floor.toFixed(2)}, appending intensity finisher`);
    
    // Find cooldown index
    const cooldownIdx = workout.blocks.findIndex(b => b.kind === 'cooldown');
    
    // Helper: Choose loaded hinge movement
    const chooseLoadedHinge = () => {
      if (equipment.includes('barbell')) return "BB Deadlift";
      if (equipment.includes('dumbbell')) return "DB Romanian Deadlift";
      if (equipment.includes('kettlebell')) return "KB Swings";
      return "Good Mornings"; // bodyweight fallback
    };
    
    // Helper: Choose press or wall ball
    const choosePressOrWallBall = () => {
      if (equipment.includes('barbell')) return "BB Thrusters";
      if (equipment.includes('dumbbell')) return "DB Push Press";
      if (equipment.includes('kettlebell')) return "KB Push Press";
      return "Wall Balls"; // or bodyweight: "Burpees"
    };
    
    // Helper: Choose cyclical movement
    const chooseCyclical = () => {
      if (equipment.includes('rower')) return "Row";
      if (equipment.includes('bike')) return "Bike";
      return "Run"; // universal fallback
    };
    
    // Create finisher block (For Time 30-20-10, ≤12 min)
    const finisher = {
      kind: "conditioning" as const,
      title: "For Time 30-20-10",
      time_min: 12,
      items: [
        { 
          exercise: chooseLoadedHinge(), 
          target: "30-20-10", 
          notes: "Maintain tension and form" 
        },
        { 
          exercise: choosePressOrWallBall(), 
          target: "30-20-10", 
          notes: "Explosive power" 
        },
        { 
          exercise: chooseCyclical(), 
          target: "30-20-10 cals", 
          notes: "Push the pace" 
        }
      ],
      notes: "Harder finisher to boost intensity"
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
  
  // Check if focus/categories are explicitly passed in context
  if (request.context?.focus) {
    focus = request.context.focus;
  } else if (categoryStr.includes('CrossFit') || categoryStr.includes('HIIT')) {
    focus = 'mixed';
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
  
  // Use passed categories if available, otherwise use defaults based on focus
  if (request.context?.categories_for_mixed && Array.isArray(request.context.categories_for_mixed)) {
    categoriesForMixed = request.context.categories_for_mixed;
  } else if (focus === 'mixed') {
    categoriesForMixed = ['Strength', 'Conditioning'];
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

// ===== HOBH: Strict Mixed Semantics Helper Functions =====

function makeStrengthE3x(req: WorkoutGenerationRequest): any {
  const equipment = req.context?.equipment || [];
  const hasBarbell = equipment.some(e => /barbell/i.test(e));
  const hasDumbbell = equipment.some(e => /dumbbell/i.test(e));
  
  const exercises = [];
  if (hasBarbell) {
    exercises.push(
      { exercise: 'Barbell Back Squat', target: '5 reps @ 75-80%', notes: 'Focus on depth and control' },
      { exercise: 'Barbell Deadlift', target: '3-5 reps @ 80%', notes: 'Maintain neutral spine' }
    );
  } else if (hasDumbbell) {
    exercises.push(
      { exercise: 'Dumbbell Front Squat', target: '8 reps', notes: 'Goblet or dual DB position' },
      { exercise: 'Dumbbell Romanian Deadlift', target: '8 reps', notes: 'Control the eccentric' }
    );
  } else {
    exercises.push(
      { exercise: 'Bodyweight Squat', target: '15 reps', notes: 'Full depth' },
      { exercise: 'Single Leg Deadlift', target: '10/side', notes: 'Balance and control' }
    );
  }
  
  return {
    kind: 'strength',
    title: 'E3:00 x 5',
    time_min: 15,
    items: exercises,
    notes: 'Complete all exercises every 3:00 for 5 rounds'
  };
}

function makeEmom(req: WorkoutGenerationRequest): any {
  const equipment = req.context?.equipment || [];
  const hasKettlebell = equipment.some(e => /kettlebell/i.test(e));
  const hasDumbbell = equipment.some(e => /dumbbell/i.test(e));
  
  const exercises = [];
  if (hasKettlebell) {
    exercises.push(
      { exercise: 'Kettlebell Swing', target: '15 reps', notes: 'Hip drive, chest up' },
      { exercise: 'Burpee', target: '10 reps', notes: 'Full push-up at bottom' }
    );
  } else if (hasDumbbell) {
    exercises.push(
      { exercise: 'Dumbbell Thruster', target: '12 reps', notes: 'Smooth transition from squat to press' },
      { exercise: 'Box Jump', target: '10 reps', notes: 'Step down safely' }
    );
  } else {
    exercises.push(
      { exercise: 'Burpee', target: '12 reps', notes: 'Full push-up' },
      { exercise: 'Air Squat', target: '20 reps', notes: 'Maintain tempo' }
    );
  }
  
  return {
    kind: 'conditioning',
    title: 'EMOM 12',
    time_min: 12,
    items: exercises,
    notes: 'Alternate exercises every minute for 12 minutes'
  };
}

function makeAmrapSkill(req: WorkoutGenerationRequest): any {
  const equipment = req.context?.equipment || [];
  const hasBarbell = equipment.some(e => /barbell/i.test(e));
  
  const exercises = [];
  if (hasBarbell) {
    exercises.push(
      { exercise: 'Barbell Clean', target: '5 reps @ 60%', notes: 'Focus on technique' },
      { exercise: 'Handstand Hold', target: '20-30 sec', notes: 'Against wall if needed' },
      { exercise: 'Double Under', target: '20 reps', notes: 'Or 40 singles' }
    );
  } else {
    exercises.push(
      { exercise: 'Pull-Up', target: '5-10 reps', notes: 'Strict or kipping' },
      { exercise: 'Handstand Hold', target: '20-30 sec', notes: 'Against wall' },
      { exercise: 'Double Under', target: '20 reps', notes: 'Or 40 singles' }
    );
  }
  
  return {
    kind: 'skill',
    title: 'AMRAP 10',
    time_min: 10,
    items: exercises,
    notes: 'As many rounds as possible in 10 minutes'
  };
}

function makeAmrapCore(req: WorkoutGenerationRequest): any {
  return {
    kind: 'core',
    title: 'AMRAP 8',
    time_min: 8,
    items: [
      { exercise: 'Hollow Hold', target: '30 sec', notes: 'Press lower back to floor' },
      { exercise: 'V-Up', target: '15 reps', notes: 'Touch toes at top' },
      { exercise: 'Russian Twist', target: '20 total', notes: 'Control rotation' }
    ],
    notes: 'As many rounds as possible in 8 minutes'
  };
}

function makeFinisher21_15_9(req: WorkoutGenerationRequest): any {
  const equipment = req.context?.equipment || [];
  const hasKettlebell = equipment.some(e => /kettlebell/i.test(e));
  
  const exercises = [];
  if (hasKettlebell) {
    exercises.push(
      { exercise: 'Kettlebell Swing', target: '21-15-9 reps', notes: 'American swing to overhead' },
      { exercise: 'Burpee', target: '21-15-9 reps', notes: 'Chest to deck' }
    );
  } else {
    exercises.push(
      { exercise: 'Burpee', target: '21-15-9 reps', notes: 'Full push-up' },
      { exercise: 'Air Squat', target: '21-15-9 reps', notes: 'Full depth' }
    );
  }
  
  return {
    kind: 'conditioning',
    title: 'For Time 21-15-9',
    time_min: 10,
    items: exercises,
    notes: '21 reps each, 15 reps each, 9 reps each - for time'
  };
}

function pickWarmup(req: WorkoutGenerationRequest): any {
  return {
    kind: 'warmup',
    title: 'Dynamic Warm-Up',
    time_min: 5,
    items: [
      { exercise: 'Jumping Jacks', target: '30 reps', notes: 'Get heart rate up' },
      { exercise: 'Arm Circles', target: '20 total', notes: 'Forward and backward' },
      { exercise: 'Leg Swings', target: '10/leg', notes: 'Front to back, side to side' },
      { exercise: 'Inchworm', target: '5 reps', notes: 'Walk hands out to plank' }
    ],
    notes: 'Prepare body for main work'
  };
}

function makeCooldown(): any {
  return {
    kind: 'cooldown',
    title: 'Cool Down & Stretch',
    time_min: 5,
    items: [
      { exercise: 'Walk or Light Jog', target: '2 min', notes: 'Bring heart rate down' },
      { exercise: 'Hamstring Stretch', target: '30 sec/side', notes: 'Seated or standing' },
      { exercise: 'Quad Stretch', target: '30 sec/side', notes: 'Standing, hold foot' },
      { exercise: 'Shoulder Stretch', target: '30 sec/side', notes: 'Cross-body arm pull' }
    ],
    notes: 'Active recovery and mobility'
  };
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

    // ===== HOBH: strict mixed semantics =====
    if (focus === 'mixed') {
      const cats = Array.isArray(categoriesForMixed) && categoriesForMixed.length
        ? categoriesForMixed
        : ['Strength', 'Conditioning', 'Core'];

      const byCat = (cat: string) => {
        if (/strength/i.test(cat)) return makeStrengthE3x(request);
        if (/condition/i.test(cat)) return makeEmom(request);
        if (/skill|gym/i.test(cat)) return makeAmrapSkill(request);
        if (/core/i.test(cat)) return makeAmrapCore(request);
        return makeEmom(request);
      };

      const mainBlocks = cats.map(byCat);

      validated.blocks = [pickWarmup(request), ...mainBlocks, makeCooldown()];

      // optional finisher if short
      const ttl = validated.blocks.reduce((t, b) => t + (b.time_min || 0), 0);
      if (ttl < request.duration * 0.90) {
        validated.blocks.splice(validated.blocks.length - 1, 0, makeFinisher21_15_9(request));
      }

      validated.acceptance_flags = {
        ...(validated.acceptance_flags || {}),
        mixed_rule_ok: true
      };

      console.log(`🎯 Strict mixed semantics applied: ${cats.length} main blocks (${cats.join(', ')}) + finisher check (total: ${ttl}min vs ${request.duration}min)`);
    }

    // Validate patterns and BW movements before sanitization
    try {
      validatePatternsAndBW(validated, request.context?.equipment || []);
    } catch (validationError: any) {
      if (retryCount === 0 && (validationError.message === 'pattern_lock_violation' || validationError.message === 'banned_bw_in_main')) {
        console.warn(`⚠️ Validation failed: ${validationError.message}. Regenerating with CF pattern lock and removing bodyweight filler from mains...`);
        
        // Regenerate with explicit instructions
        const retryRequest = {
          ...request,
          context: {
            ...request.context,
            regeneration_reason: 'Regenerate with CF pattern lock and remove bodyweight filler from mains (use DB/KB/BB)'
          }
        };
        
        return generatePremiumWorkout(retryRequest, seed, retryCount + 1);
      }
      // If second attempt still fails, continue with warning
      console.warn(`⚠️ Validation failed after retry: ${validationError.message}, continuing anyway`);
    }

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
      console.warn(`⚠️ Hardness score ${validated.variety_score?.toFixed(2) ?? 'N/A'} below threshold, workout may be too easy`);
    }
    
    // Check if mixed rule is satisfied
    if (focus === 'mixed' && !validated.acceptance_flags.mixed_rule_ok) {
      console.warn(`⚠️ Mixed rule violation: blocks don't match expected categories`);
    }
    
    // Check if equipment usage is satisfied
    if (!validated.acceptance_flags.equipment_ok) {
      console.warn(`⚠️ Equipment usage violation: insufficient loaded movements when gear is present`);
    }

    console.log(`✅ Premium workout generated: "${validated.title}" with ${validated.blocks.length} blocks, hardness: ${validated.variety_score?.toFixed(2) ?? 'N/A'}, patterns_locked: ${validated.acceptance_flags.patterns_locked}, mixed_rule_ok: ${validated.acceptance_flags.mixed_rule_ok}, equipment_ok: ${validated.acceptance_flags.equipment_ok}`);
    
    return validated;

  } catch (error) {
    console.error('Premium generation failed:', error);
    throw error;
  }
}
