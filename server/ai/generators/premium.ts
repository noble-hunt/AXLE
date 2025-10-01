/**
 * Premium CrossFit/HIIT-style workout generator for ALL categories
 * 
 * Delivers structured sessions with:
 * - Warm-up (≥6 min) → Main Block(s) → Cool-down (≥4 min)
 * - Equipment-aware with auto-substitutions
 * - Readiness gates based on biometrics
 * - Time-boxed patterns (E3:00, EMOM, AMRAP, For Time)
 * - For "mixed" focus: one main block per selected category
 */

import OpenAI from 'openai';
import { z } from 'zod';
import type { WorkoutGenerationRequest } from '../generateWorkout';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.MODEL_API_KEY,
  dangerouslyAllowBrowser: process.env.NODE_ENV === 'test'
});

// Schema for the premium workout format
const PremiumBlockSchema = z.object({
  title: z.string(),
  kind: z.enum(['warmup', 'strength', 'conditioning', 'skill', 'core', 'cooldown']),
  time_min: z.number(),
  items: z.array(z.object({
    exercise: z.string(),
    scheme: z.object({
      sets: z.union([z.number(), z.null()]).optional(),
      reps: z.union([z.string(), z.number(), z.null()]).optional(),
      rpe: z.union([z.string(), z.number(), z.null()]).optional(),
      rest_s: z.union([z.number(), z.null()]).optional(),
      tempo: z.union([z.string(), z.null()]).optional()
    }),
    notes: z.string()
  })),
  coach_notes: z.array(z.string())
});

const PremiumWorkoutSchema = z.object({
  title: z.string(),
  focus: z.string(),
  duration_min: z.number(),
  blocks: z.array(PremiumBlockSchema),
  substitutions: z.array(z.object({
    from: z.string(),
    to: z.string(),
    reason: z.string()
  })),
  variety_score: z.number(),
  acceptance_flags: z.object({
    time_fit: z.boolean(),
    has_warmup: z.boolean(),
    has_cooldown: z.boolean(),
    mixed_rule_ok: z.boolean(),
    equipment_ok: z.boolean(),
    injury_safe: z.boolean(),
    readiness_mod_applied: z.boolean(),
    hardness_ok: z.boolean(),
    patterns_locked: z.boolean().optional()
  })
});

type PremiumWorkout = z.infer<typeof PremiumWorkoutSchema>;

// Banned easy bodyweight exercises for main blocks (strength/conditioning)
const BANNED_EASY = new Set([
  "Wall Sit", "Mountain Climber", "Star Jump", "High Knees", "Jumping Jacks", "Side Plank Reach",
  "Sit-Up", "Sit-Ups", "V-Up", "V-Ups", "Tuck-Up", "Tuck-Ups"
]);

// Allowed main block pattern regexes
const ALLOWED_PATTERNS = [
  /Every\s+3:00\s*x/i,      // E3:00 x N
  /Every\s+4:00\s*x/i,      // E4:00 x N
  /E3:00\s*x/i,             // E3:00 x N (short form)
  /E4:00\s*x/i,             // E4:00 x N (short form)
  /EMOM/i,                  // EMOM 10-16
  /AMRAP/i,                 // AMRAP 8-15
  /For\s*Time.*21-15-9/i,   // For Time 21-15-9
  /21-15-9/i                // 21-15-9 (short form)
];

function createPremiumSystemPrompt(): string {
  return `You are HOBH's CF/HIIT generator. Produce Warm-up → Main blocks → Cool-down in strict CrossFit style.

PATTERN LOCK REQUIREMENT (CRITICAL):
Every main block (strength/conditioning/skill/core) title MUST match one of these patterns:
- "Every 3:00 x N" or "E3:00 x N" (strength density)
- "Every 4:00 x N" or "E4:00 x N" (strength density)
- "EMOM 10-16" (every minute on the minute)
- "AMRAP 8-15" (as many rounds as possible)
- "For Time 21-15-9" or "21-15-9" (decreasing reps)

BODYWEIGHT FILLER BANNED in strength/conditioning main blocks:
Never use Wall Sit, Mountain Climber, Star Jump, High Knees, Jumping Jacks, Sit-Ups in strength/conditioning blocks.
Keep bodyweight movements ONLY in warmup, skill, core, and cooldown sections.
Exception: If no equipment available AND low readiness, tag reason:"readiness" in substitutions.

When focus = "mixed" you MUST output exactly one main block per requested category in order.
Require a hardness score ≥ 0.75 when equipment includes DB/KB/BB and readiness is good (≥ 0.55 if low readiness).
If score is too low, regenerate by:
- Upgrading pattern (heavier loading, shorter rests, bigger sets)
- Swapping movements (BB/DB/KB > BW)
- Pairing cyclical cals with loaded movements in EMOMs
- Avoiding strength blocks with only bodyweight movements
Warm-ups/cool-downs must come from the templates below (adapt to available equipment).
Enforce time budget ±10%.
Return only JSON matching the schema. Self-validate and set acceptance_flags before returning.

WARM-UP TEMPLATES (choose 1 and adapt):

WU1 (~8 min):
1-2 sets: 1:30 Bike (:45 easy/:30 moderate/:15 hard) · 8/8 Runner's Lunge + T-rotation · 10 Barbell Stiff-Leg Deadlifts · 10 Barbell Bent-Over Rows (1-2s pause at chest) · 10 Alt Scorpions · 8 Cat/Cows · 10 V-Ups/Sit-ups. Rest :60.

WU2 (~8 min):
1-2 sets: 2:00 Cardio (choice) · 12 Alt Box Step-Ups · 12 Deep Lunge Mountain Climbers · 10 Down-Dog Toe Touches → :30 Child's Pose · 10 Air Squats · 10 Alt Reverse Lunges. Rest :60.

WU3 (~8 min):
1-2 sets for quality: 2:00 Cardio (:30 easy/:30 medium/:30 hard) · 8 Barbell Strict Press · 6 Inchworm Push-Ups · 4 No-Jump Burpees · 4 Box Jumps (step-down) · 12 Jumping Squats · 16 "90/90s". Rest :60.

COOL-DOWN TEMPLATE (~6 min):
2-3 sets for quality: :90 Legs-Up-the-Wall · :45 Child's Pose · :30 Cat/Cows · :30 Seated Toe-Touch Hold · :30 Deep Squat Hold (hands overhead) · :60 Pigeon (R) · :60 Pigeon (L).

MOVEMENT POOLS (main blocks):

Conditioning: Echo Bike ▸ Row ▸ Ski ▸ KB Swings ▸ DB Box Step-Overs ▸ Burpees.

Strength: BB Front Squat ▸ BB Push Press ▸ BB Deadlift ▸ DB Floor/Bench Press ▸ DB Goblet Squat ▸ DB RDL ▸ KB Front Rack Squat ▸ KB Push Press ▸ Strict Pull-Ups/Ring Rows.

Skill/Gym: Toes-to-Bar ▸ Hanging Knee Raises ▸ Double-Unders ▸ Single-Unders ▸ Handstand Hold ▸ Wall-Facing Hold.

Core: Hollow Rocks ▸ Plank Variations ▸ Sit-Ups.

HARDNESS SCORE (0–1) — compute and enforce:

Base per pattern: Strength E3:00x5 = .28; EMOM 12 = .22; AMRAP 12 = .22; 21-15-9 = .20.

Equipment bonuses:
+.05 if barbell used
+.03 if DB/KB used
+.02 if cyclical cals present
+.03 if EMOM pairs cyclical cals with loaded movement (odd/even pattern)

Penalties:
−.07 if 2+ bodyweight-only movements in main items
−.05 if strength block contains only bodyweight or only push-ups/pull-ups

Cap 1.0. Required floor: ≥ 0.75 when equipment present and readiness good; ≥ 0.55 if low readiness. Regenerate and upgrade if below.

READINESS GATES:

Sleep < 60 or HRV flagged → cap strength at RPE 7, exclude sprints/plyos; hardness floor becomes .55.

MIXED SEMANTICS:

The number of main blocks must equal len(categories_for_mixed) and each block's kind must map to that category (strength/conditioning/skill/core). If time remains > 10% short, add one For-Time 21-15-9 finisher ≤10 min.

OUTPUT SCHEMA:
{
  "title": "string",
  "focus": "strength | conditioning | endurance | mixed",
  "duration_min": 0,
  "blocks": [
    {
      "title": "string",
      "kind": "warmup | strength | conditioning | skill | core | cooldown",
      "time_min": 0,
      "items": [
        {
          "exercise": "string",
          "scheme": {
            "sets": 0,
            "reps": "string|number",
            "rpe": "string|number|null",
            "rest_s": 0|null,
            "tempo": "string|null"
          },
          "notes": "string"
        }
      ],
      "coach_notes": ["string"]
    }
  ],
  "substitutions": [{"from": "string", "to": "string", "reason": "string"}],
  "variety_score": 0.0,
  "acceptance_flags": {
    "time_fit": true,
    "has_warmup": true,
    "has_cooldown": true,
    "mixed_rule_ok": true,
    "equipment_ok": true,
    "injury_safe": true,
    "readiness_mod_applied": true,
    "hardness_ok": true
  }
}

ACCEPTANCE CRITERIA (self-check before output):
HARD REQUIREMENTS:
1. Warm-up present (≥6 min) and Cool-down present (≥4 min)
2. Time budget: Σ time_min within ±10% of duration_min
3. Mixed semantics: If focus="mixed", number of main blocks = len(categories); each block's kind maps to category
4. Equipment-safe: No exercise requires missing equipment. If swapped, log in substitutions[]
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
    // Pattern-based scoring
    if (b.kind === "strength" && /Every 3:00/.test(b.title)) h += 0.28;
    if (b.kind === "strength" && /Every 4:00/.test(b.title)) h += 0.28;
    if (b.kind === "conditioning" && /EMOM/.test(b.title)) h += 0.22;
    if (b.kind === "conditioning" && /AMRAP/.test(b.title)) h += 0.22;
    if (b.kind === "conditioning" && /21-15-9/.test(b.title)) h += 0.20;

    // Equipment bonuses
    const text = JSON.stringify(b.items).toLowerCase();
    const hasBarbell = /(barbell|bb )/.test(text);
    const hasDbKb = /(dumbbell|db |kettlebell|kb )/.test(text);
    const hasCyclical = /(echo bike|row|ski|cal)/.test(text);
    
    if (hasBarbell) h += 0.05;
    if (hasDbKb) h += 0.03;
    if (hasCyclical) h += 0.02;

    // Penalty for bodyweight-only in multiple main items
    let bwOnly = 0;
    for (const it of b.items || []) {
      const name = (it.exercise || "").trim();
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
  opts: { equipment?: string[]; wearable_snapshot?: any }
): PremiumWorkout {
  const hasLoad = (opts.equipment || []).some(e => 
    /(barbell|dumbbell|kettlebell)/i.test(e)
  );
  
  const ws = opts.wearable_snapshot || {};
  const lowReadiness = ws.sleep_score && ws.sleep_score < 60;
  
  // 1) Remove banned BW items in STRENGTH/CONDITIONING main blocks
  for (const b of workout.blocks) {
    // Only sanitize strength and conditioning blocks
    if (["strength", "conditioning"].includes(b.kind)) {
      b.items = b.items.map(it => {
        const exerciseName = (it.exercise || "").trim();
        
        // If banned exercise found and we have equipment (or not low readiness)
        if (BANNED_EASY.has(exerciseName) && (hasLoad || !lowReadiness)) {
          return { 
            ...it, 
            exercise: "DB Box Step-Overs", 
            notes: (it.notes || "") + " (auto-sub for intensity)" 
          };
        }
        return it;
      });
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
  
  // 3) Validate patterns
  const patternValidation = validatePatterns(workout);
  
  // 4) Set acceptance flags
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

  return workout;
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
  
  // Map category to focus
  let focus = 'strength';
  let categoriesForMixed: string[] = [];
  
  const categoryStr = String(category);
  if (categoryStr.includes('CrossFit') || categoryStr.includes('HIIT')) {
    focus = 'mixed';
    categoriesForMixed = ['Conditioning', 'Skill'];
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
- No markdown, no explanations
- Ensure all acceptance criteria are met`;
}

export async function generatePremiumWorkout(request: WorkoutGenerationRequest, retryCount = 0): Promise<any> {
  try {
    const systemPrompt = createPremiumSystemPrompt();
    const userPrompt = createUserPrompt(request);

    console.log(`Generating premium workout for ${request.category}, ${request.duration}min, intensity ${request.intensity}/10 (attempt ${retryCount + 1})`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.75,
      max_tokens: 2500
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
      }
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
      
      return generatePremiumWorkout(retryRequest, retryCount + 1);
    }

    // Check if hardness meets requirements
    if (!validated.acceptance_flags.hardness_ok) {
      console.warn(`⚠️ Hardness score ${validated.variety_score.toFixed(2)} below threshold, workout may be too easy`);
    }

    console.log(`✅ Premium workout generated: "${validated.title}" with ${validated.blocks.length} blocks, hardness: ${validated.variety_score.toFixed(2)}, patterns_locked: ${validated.acceptance_flags.patterns_locked}`);
    
    return validated;

  } catch (error) {
    console.error('Premium generation failed:', error);
    throw error;
  }
}
