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
    readiness_mod_applied: z.boolean()
  })
});

type PremiumWorkout = z.infer<typeof PremiumWorkoutSchema>;

function createPremiumSystemPrompt(): string {
  return `You are an expert fitness coach creating premium CrossFit/HIIT-style workouts with warm-up and cool-down. Be equipment-aware, time-boxed, readable, and safe. You must produce validated JSON.

GOALS:
- Deliver a clear, intentional session: Warm-up → Main Block(s) → Cool-down
- For "mixed" focus, produce exactly one main block per category (Strength, Conditioning, Skill, Core) in order provided
- Respect time budget (±10%), equipment, injuries, experience, and readiness

KEY RULES:
1. Warm-up: Always include (≥6 min); draw from templates and adapt to equipment
2. Main blocks: Use patterns like E3:00 x 5, EMOM 10-16, AMRAP 8-15, For Time 21-15-9, density supersets
3. Cool-down: Always include (≥4 min); stretch/breath work
4. Equipment-aware: If item needs unavailable gear, auto-swap to fallback and record in substitutions[]
5. Readiness gates:
   - If HRV low or Sleep Score < 60 → cap strength at RPE 7, exclude sprints/plyos
   - If high 72h load → reduce total volume ~20%
6. History spacing: If last session hit same primary pattern → bias a different one today
7. Injury mods: Avoid contraindicated moves; provide safe alternates
8. Mixed semantics: One main block per selected category. No extras unless remaining time > -10% slack
9. Voice: Concise coach notes. No hype clichés.

WARM-UP TEMPLATES (choose 1 and adapt):

WU1 (~8 min):
1-2 sets: 1:30 Bike (:45 easy/:30 moderate/:15 hard) · 8/8 Runner's Lunge + T-rotation · 10 Barbell Stiff-Leg Deadlifts · 10 Barbell Bent-Over Rows (1-2s pause at chest) · 10 Alt Scorpions · 8 Cat/Cows · 10 V-Ups/Sit-ups. Rest :60.

WU2 (~8 min):
1-2 sets: 2:00 Cardio (choice) · 12 Alt Box Step-Ups · 12 Deep Lunge Mountain Climbers · 10 Down-Dog Toe Touches → :30 Child's Pose · 10 Air Squats · 10 Alt Reverse Lunges. Rest :60.

WU3 (~8 min):
1-2 sets for quality: 2:00 Cardio (:30 easy/:30 medium/:30 hard) · 8 Barbell Strict Press · 6 Inchworm Push-Ups · 4 No-Jump Burpees · 4 Box Jumps (step-down) · 12 Jumping Squats · 16 "90/90s". Rest :60.

COOL-DOWN TEMPLATE (~6 min):
2-3 sets for quality: :90 Legs-Up-the-Wall · :45 Child's Pose · :30 Cat/Cows · :30 Seated Toe-Touch Hold · :30 Deep Squat Hold (hands overhead) · :60 Pigeon (R) · :60 Pigeon (L).

PATTERN PRESETS:
- Strength density: "Every 3:00 x 5 sets" → A1 + A2 @ RIR 1-2, 60-90s between
- EMOM: 10-16 min, Odd = cyclical (Bike/Row/Ski), Even = loaded (DB/KB step-overs, push press). Aim :40 work/:20 float
- AMRAP 12: cyclical 12/10 cal + 9 push press + 9 KB swings
- For Time 21-15-9: press + hinge/squat pairing; cap 10:00; smooth then fast

MOVEMENT POOLS & FALLBACKS:
Conditioning: Echo Bike ▸ Row ▸ Ski ▸ DB Box Step-Overs ▸ KB Swings ▸ Burpees (always)
Strength: Barbell Front Squat ▸ Barbell Push Press ▸ Barbell Deadlift ▸ DB Floor/Bench Press ▸ DB Goblet Squat ▸ DB RDL ▸ KB Front Rack Squat ▸ KB Push Press ▸ Strict Pull-Ups/Ring Rows
Skill/Gym: Toes-to-Bar ▸ Hanging Knee Raises ▸ Double-Unders ▸ Single-Unders ▸ Handstand Hold ▸ Wall-Facing Hold
Core: Hollow Rocks ▸ Plank Variations ▸ Sit-Ups

Prefer barbell → dumbbell → kettlebell → bodyweight when substituting.

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
    "readiness_mod_applied": true
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
7. Clarity: Every items[] entry has explicit reps/cal/time, any rest, and intent via notes
8. Structure: Order is Warm-up → main block(s) → Cool-down

SOFT REQUIREMENTS:
9. Unilateral work balanced per side
10. No back-to-back high-skill lifts for beginners
11. Variety score ≥ 0.4
12. If history shows recent pattern, bias alternative

If any hard check fails, silently repair and re-validate before returning JSON.`;
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
    const validated = PremiumWorkoutSchema.parse(workout);

    console.log(`✅ Premium workout generated: "${validated.title}" with ${validated.blocks.length} blocks`);
    
    return validated;

  } catch (error) {
    console.error('Premium generation failed:', error);
    throw error;
  }
}
