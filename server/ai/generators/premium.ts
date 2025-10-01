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
      sets: z.number().optional(),
      reps: z.union([z.string(), z.number()]).optional(),
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
    hardness_ok: z.boolean()
  })
});

type PremiumWorkout = z.infer<typeof PremiumWorkoutSchema>;

// Banned easy bodyweight exercises for main blocks
const BANNED_EASY = new Set([
  "Wall Sit", "Mountain Climber", "Star Jump", "High Knees", "Jumping Jacks", "Side Plank Reach"
]);

function createPremiumSystemPrompt(): string {
  return `You are HOBH's CF/HIIT generator. Produce Warm-up → Main blocks → Cool-down in strict CrossFit style.
When focus = "mixed" you MUST output exactly one main block per requested category in order.
Allowed main-block patterns only: E3:00 x 5 sets (strength density), EMOM 10–16, AMRAP 8–15, For-Time 21-15-9.
Never use bodyweight filler (wall sit, mountain climber, star jump, high knees) in main blocks unless no equipment is available or readiness is low—then tag reason:"readiness" in substitutions.
Require a hardness score ≥ 0.65 (see rule below). If score < 0.65, regenerate by upgrading pattern (heavier loading, shorter rests, bigger sets) or swapping movements (BB/DB/KB > BW).
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

Add +.05 if barbell used; +.03 if DB/KB used; +.02 if cyclical cals present; −.07 if any bodyweight-only movement appears in two main items.

Cap 1.0. If < .65, regenerate and upgrade.

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
7. Hardness score: Must be ≥ 0.65 (or ≥ 0.55 if readiness is low). Use BB/DB/KB movements, not bodyweight filler
8. Clarity: Every items[] entry has explicit reps/cal/time, any rest, and intent via notes
9. Structure: Order is Warm-up → main block(s) → Cool-down

SOFT REQUIREMENTS:
9. Unilateral work balanced per side
10. No back-to-back high-skill lifts for beginners
11. Variety score ≥ 0.4
12. If history shows recent pattern, bias alternative

If any hard check fails, silently repair and re-validate before returning JSON.`;
}

// Hardness calculation function
function computeHardness(workout: PremiumWorkout): number {
  let h = 0;
  
  for (const b of workout.blocks) {
    // Pattern-based scoring
    if (b.kind === "strength" && /Every 3:00/.test(b.title)) h += 0.28;
    if (b.kind === "conditioning" && /EMOM/.test(b.title)) h += 0.22;
    if (b.kind === "conditioning" && /AMRAP/.test(b.title)) h += 0.22;
    if (b.kind === "conditioning" && /21-15-9/.test(b.title)) h += 0.20;

    // Equipment bonuses
    const text = JSON.stringify(b.items).toLowerCase();
    if (/(barbell|bb )/.test(text)) h += 0.05;
    if (/(dumbbell|db |kettlebell|kb )/.test(text)) h += 0.03;
    if (/(echo bike|row|ski)/.test(text)) h += 0.02;

    // Penalty for bodyweight-only in multiple main items
    let bwOnly = 0;
    for (const it of b.items || []) {
      const name = (it.exercise || "").trim();
      if (BANNED_EASY.has(name)) bwOnly++;
    }
    if (bwOnly >= 2) h -= 0.07;
  }
  
  return Math.min(1, Math.max(0, h));
}

// Sanitizer function to enforce rules post-generation
function sanitizeWorkout(
  workout: PremiumWorkout, 
  opts: { equipment?: string[]; wearable_snapshot?: any }
): PremiumWorkout {
  // 1) Remove banned BW items in main blocks if equipment exists
  const hasLoad = (opts.equipment || []).some(e => 
    /(barbell|dumbbell|kettlebell)/i.test(e)
  );
  
  for (const b of workout.blocks) {
    if (["strength", "conditioning", "skill", "core"].includes(b.kind) && hasLoad) {
      b.items = b.items.map(it => {
        if (BANNED_EASY.has((it.exercise || "").trim())) {
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
  const ws = opts.wearable_snapshot || {};
  if (ws.sleep_score && ws.sleep_score < 60) floor = 0.55;

  workout.variety_score = computeHardness(workout);
  workout.acceptance_flags = workout.acceptance_flags || {
    time_fit: true,
    has_warmup: true,
    has_cooldown: true,
    mixed_rule_ok: true,
    equipment_ok: true,
    injury_safe: true,
    readiness_mod_applied: true,
    hardness_ok: true
  };
  workout.acceptance_flags.hardness_ok = workout.variety_score >= floor;

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

export async function generatePremiumWorkout(request: WorkoutGenerationRequest): Promise<any> {
  try {
    const systemPrompt = createPremiumSystemPrompt();
    const userPrompt = createUserPrompt(request);

    console.log(`Generating premium workout for ${request.category}, ${request.duration}min, intensity ${request.intensity}/10`);

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

    // Sanitize and enforce hardness requirements
    validated = sanitizeWorkout(validated, {
      equipment: request.context?.equipment || [],
      wearable_snapshot: {
        sleep_score: request.context?.health_snapshot?.sleep_score
      }
    });

    // Check if hardness meets requirements
    if (!validated.acceptance_flags.hardness_ok) {
      console.warn(`⚠️ Hardness score ${validated.variety_score.toFixed(2)} below threshold, workout may be too easy`);
    }

    console.log(`✅ Premium workout generated: "${validated.title}" with ${validated.blocks.length} blocks, hardness: ${validated.variety_score.toFixed(2)}`);
    
    return validated;

  } catch (error) {
    console.error('Premium generation failed:', error);
    throw error;
  }
}
