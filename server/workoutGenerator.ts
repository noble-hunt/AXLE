import OpenAI from "openai";
import type { WorkoutRequest, GeneratedWorkout, WorkoutSet } from "../shared/schema";
import { Category } from "../shared/schema";
import { generatedWorkoutSchema } from "../shared/schema";
import { generatePremiumWorkout, computeHardness } from "./ai/generators/premium";
import type { WorkoutGenerationRequest } from "./ai/generateWorkout";
import { DISABLE_SIMPLE, DISABLE_MOCK, FORCE_PREMIUM } from './config/env';
import { normalizeStyle } from './lib/style';
import { MOVEMENTS } from './workouts/movements';

// Orchestrator version stamp for debugging
export const GENERATOR_STAMP = 'WG-ORCH@1.0.5';

// Canonical style resolver - normalizes goal/style/focus to pattern pack keys
function resolveStyle(input: any): string {
  const raw = String(input?.style || input?.goal || input?.focus || 'mixed').trim().toLowerCase();
  const map: Record<string,string> = {
    'crossfit': 'crossfit',
    'cf': 'crossfit',
    'olympic': 'olympic_weightlifting',
    'olympic_weightlifting': 'olympic_weightlifting',
    'oly': 'olympic_weightlifting',
    'powerlifting': 'powerlifting',
    'pl': 'powerlifting',
    'bb_full_body': 'bb_full_body',
    'bb_upper': 'bb_upper',
    'bb_lower': 'bb_lower',
    'aerobic': 'aerobic',
    'conditioning': 'conditioning',
    'strength': 'strength',
    'endurance': 'endurance',
    'gymnastics': 'gymnastics',
    'mobility': 'mobility',
    'mixed': 'mixed',
  };
  return map[raw] || raw;
}

// Using gpt-4o-mini for fast, cost-effective workout generation with excellent quality
const apiKey = process.env.OPENAI_API_KEY || process.env.MODEL_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

// ===== HOBH: upgradeIntensity (hard mode) =====
const ROTATION = ["DB Box Step-Overs","KB Swings","Wall Balls","Burpees"];
const BANNED = new Set(["Wall Sit","Mountain Climber","Star Jump","High Knees","Jumping Jacks","Bicycle Crunch"]);

export function upgradeIntensity(workout:any, equipment:string[], readiness?:{sleep_score?:number}) {
  const hasLoad = (equipment||[]).some(e=>/(barbell|dumbbell|kettlebell)/i.test(e));
  let rot = 0;

  for (const b of workout.blocks) {
    if (['warmup','cooldown'].includes(b.kind)) continue;

    // 1) Remove banned BW in mains when gear exists
    if (hasLoad) {
      b.items = (b.items||[]).map((it:any)=>{
        const n = (it.exercise||'').trim();
        if (BANNED.has(n)) {
          const sub = ROTATION[rot++ % ROTATION.length];
          workout.substitutions = (workout.substitutions||[]).concat([{from:n,to:sub,reason:"upgrade_intensity"}]);
          return { ...it, exercise: sub, notes: ((it.notes||'') + ' (auto-upgrade)').trim() };
        }
        return it;
      });
    }

    // 2) Tighten time domains
    if (/(Every\s*3:00|E3:00)/i.test(b.title)) b.title = b.title.replace(/(Every\s*3:00|E3:00)/i,'E2:00');
    if (/EMOM\s*10\b/i.test(b.title)) b.title = b.title.replace(/EMOM\s*10\b/i,'EMOM 14');

    // 3) Increase volume
    for (const it of (b.items||[])) {
      if (typeof it.scheme?.reps === 'number') it.scheme.reps = Math.round(it.scheme.reps * 1.25); // was 1.15
      if (/RIR\s*2-3/i.test(it.scheme?.rpe||'')) it.scheme.rpe = 'RIR 1–2';
    }
  }

  // recompute hardness & flag
  workout.variety_score = computeHardness(workout);
  const floor = (readiness?.sleep_score && readiness.sleep_score < 60) ? 0.55 : 0.85;
  workout.acceptance_flags = { ...(workout.acceptance_flags||{}), hardness_ok: workout.variety_score >= floor };
  return workout;
}

// Enhanced request type with context data
type EnhancedWorkoutRequest = WorkoutRequest & {
  recentPRs?: Array<{
    exercise: string;
    weight?: number;
    reps?: number;
    date: string;
    unit?: string;
  }>;
  lastWorkouts?: Array<{
    name: string;
    category: string;
    duration: number;
    intensity: number;
    date: string;
    exercises: string[];
  }>;
  todaysReport?: {
    energy: number;
    stress: number;
    sleep: number;
    soreness: number;
  };
};

// AXLE Fitness Expert Prompt Template
const createPromptTemplate = (request: EnhancedWorkoutRequest): string => {
  const { category, duration, intensity, recentPRs = [], lastWorkouts = [], todaysReport } = request;
  
  // Format recent PRs for context
  const prContext = recentPRs.length > 0 
    ? `Recent Personal Records (Top 3):
${recentPRs.slice(0, 3).map((pr: any) => 
  `- ${pr.exercise}: ${pr.weight ? `${pr.weight} ${pr.unit || 'lbs'}` : ''} ${pr.reps ? `x${pr.reps} reps` : ''} (${new Date(pr.date).toLocaleDateString()})`
).join('\n')}`
    : "No recent PRs available.";

  // Format last 3 workouts for variety context
  const workoutContext = lastWorkouts.length > 0
    ? `Last 3 Workouts:
${lastWorkouts.slice(0, 3).map((workout: any) => 
  `- ${workout.name} (${workout.category}): ${workout.duration}min, ${workout.intensity}/10 intensity, Exercises: ${workout.exercises.join(', ')} - ${new Date(workout.date).toLocaleDateString()}`
).join('\n')}`
    : "No recent workouts available.";

  // Format today's wellness report
  const reportContext = todaysReport
    ? `Today's Wellness Report:
- Energy Level: ${todaysReport.energy}/10
- Stress Level: ${todaysReport.stress}/10  
- Sleep Quality: ${todaysReport.sleep}/10
- Muscle Soreness: ${todaysReport.soreness}/10`
    : "No wellness data available for today.";

  // Removed legacy CrossFit-specific instructions - now handled by styleGuidelines

  return `You are AXLE, an expert fitness planner with 20+ years of multi-disciplinary experience in all fields of physical fitness and athletic performance.

WORKOUT REQUEST:
- Category: ${category}
- Duration: ${duration} minutes
- Target Intensity: ${intensity}/10

CONTEXT INFORMATION:
${prContext}

${workoutContext}

${reportContext}

INSTRUCTIONS:
Create a safe, balanced, and effective workout in strict JSON format matching this exact structure:

{
  "title": "Creative workout name that reflects the category and intensity",
  "notes": "Brief workout description and any important safety considerations",
  "sets": [
    {
      "description": "Clear exercise description with form cues",
      "target": {
        "reps": number (if applicable),
        "weightKg": number (if applicable),
        "distanceM": number (if applicable), 
        "timeSec": number (if applicable)
      }
    }
  ]
}

CRITICAL RULES:
- Respect category constraints and focus on movement patterns appropriate for each category
- Scale difficulty by intensity level 1-10 (1=very easy, 10=extremely challenging)
- Respect duration target within ±10% (${Math.round(duration * 0.9)}-${Math.round(duration * 1.1)} minutes)
- Prefer varied movement patterns compared to recent workouts to prevent overuse
- If risky combinations detected (e.g., heavy spinal loading after max deadlifts), adjust to safer alternatives
- Consider wellness metrics: low energy/sleep = easier workout, high soreness = avoid affected muscle groups
- Use metric units (kg for weight, meters for distance, seconds for time) for non-CrossFit categories
- Provide realistic weights and targets based on recent PR context

Return ONLY the JSON object. No markdown formatting, explanations, or additional text.`;
};
// ===== HOBH: Helper functions for premium conversion =====
function secondsFromPattern(title: string, fallbackMin?: number): number {
  const em = title.match(/^EMOM\s+(\d+)/i);
  if (em) return parseInt(em[1], 10) * 60;
  const ev = title.match(/^Every\s*(\d):([0-5]0)\s*x\s*(\d+)/i);
  if (ev) { 
    const m = +ev[1], s = +ev[2], n = +ev[3]; 
    return n * (m * 60 + s); 
  }
  return Math.round((fallbackMin ?? 12) * 60);
}

function addHeaderSet(sets: any[], title: string, mins: number) {
  sets.push({
    id: `hdr-${Math.random().toString(36).slice(2, 8)}`,
    exercise: title,
    duration: secondsFromPattern(title, mins),
    notes: title,
    is_header: true
  });
}

function addItemFromMovement(sets: any[], it: any, extraNote?: string) {
  sets.push({
    id: `itm-${Math.random().toString(36).slice(2, 8)}`,
    exercise: it.name || it.exercise,
    registry_id: it.registry_id || it.id || null,
    reps: it.scheme?.reps ?? undefined,
    duration: undefined,
    distance_m: it.scheme?.distance_m ?? undefined,
    num_sets: it.scheme?.sets ?? undefined,
    notes: [it.notes, extraNote].filter(Boolean).join(' ').trim() || undefined,
    rest_s: it.scheme?.rest_s ?? undefined,
    percent_1rm: it.scheme?.percent_1rm ?? undefined,
    rpe: it.scheme?.rpe ?? undefined
  });
}

// ===== HOBH: premium -> UI conversion (preserve patterns/items) =====
export function convertPremiumToGenerated(premium: any): any {
  const sets: any[] = [];

  // Warm-up
  const wu = premium.blocks.find((b: any) => b.kind === 'warmup');
  if (wu) {
    addHeaderSet(sets, 'Warm-up', wu.time_min || 6);
    (wu.items || []).forEach((it: any) => {
      addItemFromMovement(sets, it);
      // Add _source tag and rounded duration for warm-up items
      const lastItem = sets[sets.length - 1];
      lastItem._source = 'warmup';
      const rawDuration = (wu.time_min || 6) * 60 / Math.max(1, (wu.items || []).length);
      // Round to nearest 30s, minimum 30s
      lastItem.duration = Math.max(30, Math.round(rawDuration / 30) * 30);
      if (!lastItem.notes) lastItem.notes = 'For quality';
    });
  }

  // MAIN — preserve patterns
  for (const b of premium.blocks.filter((x: any) => !['warmup', 'cooldown'].includes(x.kind))) {
    const title = String(b.title || 'Main').trim();

    if (/^EMOM\s+(\d+)/i.test(title)) {
      const mins = Number(title.match(/^EMOM\s+(\d+)/i)?.[1] ?? b.time_min ?? 12);
      addHeaderSet(sets, `EMOM ${mins}`, mins);
      // Render items as odd/even notes, not 40/20
      (b.items || []).forEach((it: any, idx: number) => {
        const tag = idx === 0 ? '(odd min)' : idx === 1 ? '(even min)' : '';
        addItemFromMovement(sets, it, tag);
      });
      continue;
    }

    if (/^Every\s*2:00/i.test(title) || /^Every\s*2:30/i.test(title) || /^Every\s*3:00/i.test(title)) {
      addHeaderSet(sets, title, b.time_min || 12);
      (b.items || []).forEach((it: any) => addItemFromMovement(sets, it));
      continue;
    }

    if (/^AMRAP/i.test(title) || /^For\s*Time/i.test(title) || /^Chipper/i.test(title)) {
      addHeaderSet(sets, title, b.time_min || 12);
      (b.items || []).forEach((it: any) => addItemFromMovement(sets, it));
      continue;
    }

    // Fallback: still add a header so UI shows pattern name
    addHeaderSet(sets, title || 'Main', b.time_min || 12);
    (b.items || []).forEach((it: any) => addItemFromMovement(sets, it));
  }

  // Cool-down
  const cd = premium.blocks.find((b: any) => b.kind === 'cooldown');
  if (cd) {
    addHeaderSet(sets, 'Cool-down', cd.time_min || 4);
    (cd.items || []).forEach((it: any) => {
      addItemFromMovement(sets, it);
      // Add _source tag and default duration for cool-down items
      const lastItem = sets[sets.length - 1];
      lastItem._source = 'cooldown';
      lastItem.duration = Math.round((cd.time_min || 4) * 60 / Math.max(1, (cd.items || []).length));
      if (!lastItem.notes) lastItem.notes = 'Easy breathing';
    });
  }

  return {
    name: premium.title || premium.meta?.title || 'Session',
    category: premium.meta?.style || premium.category || 'Mixed',
    description: premium.description || '',
    duration: premium.total_min || premium.duration || 45,
    intensity: premium.intensity || 7,
    sets,
    meta: premium.meta || {}
  };
}

// Equipment normalization map - handles variations in equipment naming
const EQUIPMENT_SYNONYMS: Record<string, string[]> = {
  'pullup-bar': ['pull-up bar', 'pullup bar', 'pull up bar', 'pullupbar'],
  'dip-bar': ['dip bar', 'dipbar', 'dip bars'],
  'barbell': ['bar', 'barbell', 'bb'],
  'dumbbell': ['dumbbells', 'dumbbell', 'db', 'dbs'],
  'kettlebell': ['kettlebells', 'kettlebell', 'kb', 'kbs'],
  'resistance_band': ['resistance band', 'resistance bands', 'band', 'bands'],
  'medicine_ball': ['medicine ball', 'med ball', 'medball', 'wall ball', 'wallball'],
  'bodyweight': ['bodyweight', 'bw', 'body weight'],
  'bike': ['bike', 'assault bike', 'air bike', 'airbike', 'stationary bike'],
  'rower': ['rower', 'rowing machine', 'erg', 'c2', 'concept2'],
  'ski': ['ski', 'ski erg', 'skierg', 'skier'],
  'treadmill': ['treadmill', 'tread', 'running'],
};

function normalizeEquipment(userEquipment: string[]): string[] {
  const normalized = new Set<string>();
  
  for (const item of userEquipment) {
    const lower = item.toLowerCase().trim();
    let matched = false;
    
    // Check each canonical equipment type
    for (const [canonical, synonyms] of Object.entries(EQUIPMENT_SYNONYMS)) {
      if (synonyms.some(syn => lower.includes(syn))) {
        normalized.add(canonical);
        matched = true;
        break;
      }
    }
    
    // If no match, add the lowercase version
    if (!matched) {
      normalized.add(lower);
    }
  }
  
  return Array.from(normalized);
}

// Map lowercase categories to proper Category enum values
function normalizeCategoryToEnum(rawCategory: string): Category {
  const normalized = rawCategory.toLowerCase().trim();
  
  const categoryMap: Record<string, Category> = {
    'crossfit': Category.CROSSFIT,
    'strength': Category.STRENGTH,
    'hiit': Category.HIIT,
    'cardio': Category.CARDIO,
    'powerlifting': Category.POWERLIFTING,
    'olympic lifting': Category.OLYMPIC_LIFTING,
    'olympic': Category.OLYMPIC_LIFTING,
    'oly': Category.OLYMPIC_LIFTING,
    'mixed': Category.CROSSFIT,  // Default to CrossFit for mixed
  };
  
  return categoryMap[normalized] || Category.CROSSFIT;
}

// Simplified OpenAI generator with movement library
async function generateWithOpenAI(request: EnhancedWorkoutRequest): Promise<GeneratedWorkout> {
  // Normalize category to match Category enum
  const rawCategory = request.category || (request as any).style || 'mixed';
  const category = normalizeCategoryToEnum(rawCategory);
  
  // Normalize style using existing normalizeStyle function to handle aliases
  const rawStyle = (request as any).style || (request as any).goal || (request as any).focus || rawCategory;
  const style = normalizeStyle(rawStyle);
  const userEquipment = (request as any).equipment || [];
  
  // Normalize equipment names to handle variations
  const normalizedEquipment = normalizeEquipment(userEquipment);
  
  // Filter movements by available equipment (if specified)
  // Always include bodyweight movements as fallback
  let availableMovements = MOVEMENTS;
  if (normalizedEquipment.length > 0) {
    const filtered = MOVEMENTS.filter(m => 
      m.equipment.some(e => normalizedEquipment.includes(e)) || 
      m.equipment.includes('bodyweight')
    );
    
    // Only use filtered list if it has meaningful content (>10 movements)
    if (filtered.length > 10) {
      availableMovements = filtered;
    } else {
      console.warn('[WG] Equipment filter too restrictive, using full library', { 
        userEquipment, 
        normalizedEquipment, 
        filteredCount: filtered.length 
      });
    }
  }
  
  // Create movement library string for the prompt
  const movementLibrary = availableMovements
    .map(m => `- ${m.name} (${m.equipment.join(', ')}) [${m.tags.join(', ')}]`)
    .join('\n');
  
  // Style-specific programming guidelines
  const styleGuidelines: Record<string, string> = {
    'crossfit': `
CROSSFIT WODIFY-STYLE STRUCTURE:
You MUST create a workout with this EXACT 3-section structure:

SECTION 1 - WARM-UP (no creative title):
- Title: "Warm-Up Flow" or "General Prep"
- Duration: 5-8 min
- MUST include 5-7 exercises: Cardio ramp + dynamic stretching + movement-specific priming
- Format: Start with cardio (200-400m), then dynamic movements that prepare for main workout
- Example: 300m Row, 10 Arm Circle, 10 Leg Swing each, 5 Inchworm, 5 Cat-Cow, 10 Air Squat, 5 Push-Up
- Coaching cues: Movement-specific notes about preparing joints and priming patterns for main work (e.g., "Gradually elevate heart rate and mobilize shoulders/hips for overhead work. Focus on opening hip flexors and warming shoulder rotation for the main WOD. Scale: Reduce rounds or substitute easier variations.")

SECTION 2 - MAIN WOD (MUST have creative title):
- Creative Title: Generate a fun, memorable name in ALL CAPS with quotes (examples: "FRUIT LOOPS IN MY ORANGE JUICE", "THE THREE WISE WITCHES", "HOT DOG TREASURE CHEST")
- Score Type: MUST be one of these formats:
  * "For Time" (with time cap like "13:00 time cap!")
  * "AMRAP" (e.g., "15:00 AMRAP", "4:00 AMRAP")
  * "EMOM" (e.g., "28:00 EMOM", "Every 2:00 x 6 Sets")
  * "Intervals" (e.g., "Every 5:00 for 4 rounds", "2:00 on 1:00 off for 5 rounds")
- Duration: 10-20 min (majority of workout time)
- CRITICAL: Main WOD should include 3-5 exercises (varies by format):
  * For Time chipper: 3-5 movements
  * AMRAP: 3-4 movements per round
  * EMOM: 1-3 movements per minute
- **MANDATORY**: ALL cardio MUST include distance/calories (e.g., "500m Row", "15 Cal Bike"), ALL weighted movements MUST include M/F weight (e.g., "@ 95/65lb", "@ 24/16kg")
- Coaching cues: Movement-specific physiological targets and technique focus based on exercises selected (e.g., "Focus on explosive hip drive in thrusters while maintaining upright torso and full lockout overhead. Target 70-80% max heart rate with smooth transitions between movements. Prioritize unbroken sets of wall balls in early rounds. Scale: Reduce barbell to 65/45lb, substitute ring rows for pull-ups, or break movements into smaller sets.")
- **INTERVAL FORMAT RULE**: If using "Intervals" score type, MUST specify complete work/rest structure (e.g., "Work 5:00 / Rest 2:00 x 5 rounds" or "3:00 on / 1:00 off for 6 rounds")
- Format examples:
  * For Time: "21-15-9\\nThrusters @ 95/65lb\\nPull-ups"
  * AMRAP 15: "19 Cal Row\\n19 Wall Ball @ 20/14lb\\n15 Push-ups"
  * EMOM: "minute 1: 3 Wall Walks\\nminute 2: 200m Run\\nminute 3: 15/12 Cal Row"
  * Intervals: "Work 5:00 / Rest 2:00 x 5 rounds\\n500m Row\\n15 Cal Bike\\n400m Run\\n10 Burpee"

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Recovery"
- Duration: 3-5 min
- MUST include 3-5 exercises: Static stretches targeting worked muscles + breathing + light movement
- Example: Child's Pose 1 min, Pigeon Stretch 1 min each, Quad Stretch 1 min each, Cat-Cow 10 reps, Deep Breathing 1 min
- Coaching cues: Specific recovery targets based on workout (e.g., "Focus on hip flexor and shoulder mobility after overhead work. Hold static stretches for 60-90 seconds to improve flexibility. Use deep nasal breathing to activate parasympathetic recovery. Scale: Adjust stretch depth based on comfort, avoid pushing into pain.")

CRITICAL FORMATTING RULES:
- Main section MUST have creative title in quotes and capitals
- **MANDATORY**: ALL cardio MUST include distance in meters or calories (e.g., "500m Row", "15 Cal Bike", "800m Run")
- **MANDATORY**: ALL weighted movements MUST include M/F weight (e.g., "@ 95/65lb", "@ 24/16kg", "@ 20/14lb")
- Include time notation (12:35, 15:00, etc.) where relevant  
- Use @ symbol for weights (e.g., @ 95/65#, @ 50/35#)
- Specify "For Time", "AMRAP", "EMOM", or interval format clearly
- Keep coaching cues SHORT (1-2 sentences max)
- Embed scaling suggestions in coaching cues, not separate section`,
    
    'olympic_weightlifting': `
OLYMPIC LIFTING WODIFY-STYLE STRUCTURE:
You MUST create a workout with this EXACT 3-section structure:

SECTION 1 - WARM-UP (no creative title):
- Title: "Warm-Up" or "Movement Prep"
- Duration: 8-10 min
- MUST include 5-7 exercises: Joint mobility + light cardio + PVC work + empty bar technique
- Example: 500m Easy Row, PVC Pass Through 10 reps, Wrist Circles 20, Empty Bar Snatch Balance 8 reps, Overhead Squat 5 reps, Hang Muscle Snatch 5 reps, Front Squat 5 reps
- Coaching cues: Position-specific prep (e.g., "Mobilize wrists, shoulders, and ankles for deep receiving positions. Practice overhead stability with PVC pass-throughs and snatch balance. Rehearse pulling mechanics with empty bar to establish proper timing and positions. Scale: Use PVC pipe for all movements if shoulder mobility limited, add extra wrist prep if needed.")

SECTION 2 - MAIN LIFTS (MUST have creative title):
- Creative Title: Generate a fun, powerful name in ALL CAPS with quotes (examples: "IRON SUMMIT", "THE BARBELL SYMPHONY", "OLYMPIC DOMINATION")
- Score Type: "Score Weight" or "Heavy Single" or "Work Sets"
- Duration: 25-30 min (majority of workout time)
- CRITICAL: MUST include 5-7 exercises total with percentage-based programming:
  1. Primary Olympic lift (REQUIRED - e.g., "Power Snatch 4x1 @ 85% of 1RM" or "Snatch 5x1 @ 80%")
  2. Secondary Olympic lift or variation (REQUIRED - e.g., "Clean & Jerk 3x2 @ 80% of 3RM" or "Hang Clean 4x2 @ 75%")
  3. Squat variation (REQUIRED - e.g., "Back Squat 5RM @ RPE 8" or "Front Squat 4x3 @ 85%")
  4. Pulling movement (REQUIRED - e.g., "Clean Pull 3x3 @ 90%" or "Snatch Pull 4x2 @ 95%")
  5. Accessory movement 1 (REQUIRED - e.g., "BTN Jerk 3x2 @ 70% of 3RM" or "Overhead Squat 3x3")
  6. Accessory movement 2 (REQUIRED - e.g., "Rear Foot Elevated Split Squat 4x6 each" or "Bulgarian Split Squat 3x8 each")
  7. Optional core/stability work (e.g., "Hollow Hold 3x30 sec" or "Plank 3x45 sec")
- Format example with multiple exercises:
  * "Power Snatch 4x1 @ 85% of 1RM"
  * "Clean & Jerk 3x2 @ 80%"
  * "Back Squat 4x3 @ 85%"
  * "Snatch Pull 3x3 @ 95%"
  * "BTN Jerk 3x2 @ 70%"
  * "Walking Lunge 3x10 each"
  * "Hollow Hold 3x30 sec"
- Coaching cues: Technique-specific targets for Olympic lifts (e.g., "Focus on aggressive turnover in snatches with active pull under the bar. Maintain vertical torso in front squat receiving position. Emphasize speed through the power position on cleans with quick elbow rotation. Target bar speed over load on technique sets. Scale: Reduce percentages by 10-15% to prioritize positions and speed, use hang variations to practice timing, or substitute power variations for full lifts if mobility limited.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Recovery"
- Duration: 3-5 min
- MUST include 3-5 exercises: Hip/shoulder-focused stretching + mobility + breathing
- Example: Couch Stretch 2 min each, Thoracic Rotations 10 each, Lat Stretch 1 min each, Child's Pose 1 min, Deep Breathing 2 min
- Coaching cues: Recovery for Olympic lifting demands (e.g., "Prioritize hip flexor and ankle mobility after deep squat receiving positions. Open thoracic spine and lats after overhead work. Hold stretches 90+ seconds for tissue adaptation. Use box breathing (4-4-4-4) to downregulate nervous system after heavy lifting. Scale: Add foam rolling for tight areas, extend stretch duration if needed.")

CRITICAL FORMATTING RULES:
- Main section MUST have creative title in quotes and capitals
- Main section MUST have 5-7 exercises minimum (mirror screenshot example!)
- Use percentage-based programming (e.g., "@ 85% of 1RM", "@ RPE 8", "5RM")
- Include Olympic lifts (Snatch, Clean, Jerk variations) + Squats + Accessories
- Score type is typically "Score Weight" for maximal efforts
- Keep coaching cues SHORT (1-2 sentences max)
- Embed scaling suggestions in coaching cues`,
    
    'powerlifting': `
POWERLIFTING WODIFY-STYLE STRUCTURE:
You MUST create a workout with this EXACT 3-section structure:

SECTION 1 - WARM-UP (no creative title):
- Title: "Warm-Up" or "Movement Prep"
- Duration: 5-8 min
- MUST include 5-7 exercises: Dynamic stretching + activation + movement-specific prep
- Example: 400m Easy Row, 10 Hip Circle each, 10 Air Squat, 10 Leg Swing each, Band Pull-Apart 15, Glute Bridge 15, Light Deadlift 5 reps
- Coaching cues: Lift-specific activation (e.g., "Activate glutes and hamstrings for posterior chain loading. Mobilize hips and ankles for deep squat positions. Prime spinal erectors and lats with light pulls. Practice bracing mechanics before heavy loading. Scale: Add extra hip mobility if limited range, use resistance bands for activation if needed.")

SECTION 2 - MAIN LIFT (MUST have creative title):
- Creative Title: Generate a powerful, strength-focused name in ALL CAPS with quotes (examples: "IRON THRONE", "THE BIG THREE GAUNTLET", "THE STEEL BEHEMOTH")
- Score Type: "Score Weight" or "Heavy Set" or "Max Effort"
- Duration: 20-25 min (majority of workout time)
- CRITICAL: MUST include 4-6 exercises total:
  1. Primary lift from big three with sets/reps (REQUIRED - e.g., "Back Squat 5x5 @ 75%" or "Build to Heavy 3 Rep Back Squat")
  2. Secondary compound movement with sets/reps (REQUIRED - e.g., "Romanian Deadlift 3x8" or "Front Squat 4x6")
  3. Accessory movement 1 (REQUIRED - e.g., "Walking Lunge 3x10 each" or "Leg Press 3x12")
  4. Accessory movement 2 (REQUIRED - e.g., "GHD Back Extension 3x12" or "Plank Hold 3x45 sec")
  5-6. Optional additional accessories (e.g., "Hamstring Curl 3x10", "Core Work 3 sets")
- Format example with multiple exercises:
  * "Back Squat 5x3 @ 80%"
  * "Romanian Deadlift 3x8"
  * "Bulgarian Split Squat 3x10 each"
  * "GHD Back Extension 3x12"
  * "Plank 3x45 sec"
- Coaching cues: Powerlifting-specific technique and loading (e.g., "Maintain rigid torso bracing throughout all compound lifts. Focus on driving through full foot on squats with vertical bar path. Emphasize lats and leg drive on bench variations. Build to RPE 8-9 on primary lift while keeping 1-2 reps in reserve. Scale: Reduce percentages by 10% to prioritize bar speed, substitute box squats for full squats if depth limited, or reduce volume to 3x3 instead of 5x5.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Recovery"
- Duration: 3-5 min
- MUST include 3-5 exercises: Static stretching + foam rolling + breathing
- Example: Foam Roll Quads 2 min, Foam Roll IT Band 1 min each, Pigeon Stretch 1 min each, Hip Flexor Stretch 1 min each, Child's Pose 1 min
- Coaching cues: Powerlifting recovery focus (e.g., "Target hip flexors, quads, and IT band after heavy squatting and deadlifting. Use foam rolling to release fascial restrictions. Hold stretches 90-120 seconds for improved range of motion. Practice 4-7-8 breathing to reduce cortisol after maximal efforts. Scale: Extend foam rolling if tissue feels dense, add lacrosse ball for trigger points.")

CRITICAL FORMATTING RULES:
- Main section MUST have creative title in quotes and capitals
- Main section MUST have 4-6 exercises minimum (not just 1!)
- Score type is typically "Score Weight" for max efforts
- Each exercise needs sets x reps format (e.g., "5x3", "3x8", "4x10 each")
- Emphasize progressive overload and percentage-based programming
- Keep coaching cues SHORT (1-2 sentences max)`,
    
    'endurance': `
HYROX-STYLE ENDURANCE TRAINING WODIFY STRUCTURE:
**CRITICAL**: Generate this workout like a HYROX training session - combining running/cardio with functional fitness movements in a circuit format.

You MUST create a workout with this EXACT 3-section structure:

SECTION 1 - WARM-UP (no creative title):
- Title: "Warm-Up" or "Movement Prep"
- Duration: 5-8 min
- MUST include 5-7 exercises: Easy cardio + dynamic mobility + movement priming
- Example: 500m Easy Row, 10 Leg Swing each, 10 Arm Circle, 5 Inchworm, 10 Walking Lunge, 10 Jumping Jack, 5 Burpee
- Coaching cues: Endurance-specific prep (e.g., "Gradually elevate heart rate to Zone 2 (60-70% max HR) to prepare aerobic system. Open hip flexors and mobilize ankles for running mechanics. Practice breathing rhythm and pace control. Prime movement patterns that mirror main circuit. Scale: Reduce cardio distance to 300m or slow pace if breathing labored.")

SECTION 2 - MAIN CIRCUIT (MUST have creative title):
- Creative Title: Generate a HYROX/endurance-focused name in ALL CAPS with quotes (examples: "THE MARATHON GRIND", "HYROX SIMULATOR", "ENDURANCE ODYSSEY")
- Score Type: "For Time" or "Score Rounds" or "Total Distance"
- Duration: 20-30 min (majority of workout time)
- CRITICAL: MUST include 4-6 stations alternating cardio + functional movements in HYROX style:
  1. Station 1: Distance-based cardio (REQUIRED - MUST include meters OR calories: "1000m Row" or "15 Cal Bike" or "800m Run")
  2. Station 2: Functional movement with weight if applicable (REQUIRED - e.g., "20 Burpees" or "25 KB Swing @ 24/16kg")
  3. Station 3: Different cardio modality (REQUIRED - MUST include meters OR calories: "1000m Ski" or "15 Cal Row" or "1500m Bike" or "400m Run")
  4. Station 4: Different functional movement with weight (REQUIRED - e.g., "30 Wall Ball @ 20/14lb" or "20 Box Jump @ 24/20in")
  5-6. Optional additional cardio/functional pairs (ALWAYS include distance OR calories for cardio, weight for weighted movements)
- **CARDIO RULES**: ALL cardio (Row/Run/Bike/Ski) MUST include distance in meters OR calories (e.g., "1000m Row", "15 Cal Bike", "800m Run", "20 Cal Row")
- **WEIGHT RULES**: ALL weighted movements MUST include male/female weight specs (e.g., "KB Swing @ 24/16kg", "Wall Ball @ 20/14lb", "DB @ 50/35lb")
- Format: Alternating cardio + functional stations like HYROX competition
- Coaching cues: Endurance pacing and fueling strategy (e.g., "Target 75-80% max heart rate during cardio stations with quick transitions under 10 seconds. Maintain consistent stroke rate 24-28 spm on rowing. Focus on sustainable pace you can repeat across all rounds like HYROX race simulation. Control breathing through functional movements to avoid spiking heart rate. Scale: Reduce cardio distances by 30% or extend transition rest to 30 seconds between stations, substitute ski erg for running if impact sensitive.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Active Recovery"
- Duration: 3-5 min
- MUST include 3-5 exercises: Active recovery + static stretching + breathing
- Example: Easy Walk 2 min, Quad Stretch 1 min each, Hip Flexor Stretch 1 min each, Calf Stretch 1 min each, Deep Breathing 2 min
- Coaching cues: Endurance recovery protocol (e.g., "Walk or move easy for 2 min to clear lactate and bring heart rate below 100 bpm. Target hip flexors, quads, and calves after high-volume running. Use nasal breathing only to enhance parasympathetic recovery. Consider light nutrition within 30 min post-workout. Scale: Extend easy movement if heart rate elevated, add foam rolling for calves and IT band.")

CRITICAL FORMATTING RULES:
- Main section MUST have creative title in quotes and capitals
- Main section MUST have 4-6 stations minimum
- **MANDATORY**: ALL cardio exercises MUST include distance in meters OR calories (e.g., "1000m Row", "15 Cal Bike", "800m Run", "20 Cal Row")
- **MANDATORY**: ALL weighted movements MUST include weight in M/F format (e.g., "@ 24/16kg", "@ 50/35lb")
- Vary cardio modalities across stations (Row, Run, Bike, Ski)
- Program like HYROX: alternating cardio + functional fitness
- Keep coaching cues SHORT (1-2 sentences max)`,
    
    'strength': `
STRENGTH TRAINING WODIFY-STYLE STRUCTURE:
You MUST create a workout with this EXACT 3-section structure:

SECTION 1 - WARM-UP (no creative title):
- Title: "Warm-Up" or "Movement Prep"
- Duration: 5-8 min
- MUST include 5-7 exercises: Cardio + activation + dynamic prep + movement rehearsal
- Example: 400m Easy Row, 10 Hip Circle each, 10 Air Squat, 10 Arm Circle, Band Pull-Apart 15, Glute Bridge 15, Light KB Swing 10
- Coaching cues: Strength-specific activation (e.g., "Activate posterior chain with glute bridges and hip circles for compound lift readiness. Mobilize thoracic spine and shoulders for pressing movements. Rehearse movement patterns with light loads to establish motor patterns. Practice breathing and bracing mechanics. Scale: Add extra mobility work if range limited, use lighter activation loads if needed.")

SECTION 2 - MAIN LIFT (MUST have creative title):
- Creative Title: Generate a strength-focused name in ALL CAPS with quotes (examples: "THE IRON GAUNTLET", "STRENGTH FORTRESS", "POWER BUILDER")
- Score Type: "Score Weight" or "Heavy Sets" or "Total Volume"
- Duration: 20-25 min (majority of workout time)
- CRITICAL: MUST include 4-6 exercises total:
  1. Primary compound lift (REQUIRED - e.g., "Back Squat 5x5 @ 75%" or "Deadlift 4x6 @ 80%")
  2. Secondary compound (REQUIRED - e.g., "Front Squat 3x8" or "Romanian Deadlift 3x8")
  3. Accessory movement 1 (REQUIRED - e.g., "Walking Lunge 3x10 each" or "Leg Press 3x12")
  4. Accessory movement 2 (REQUIRED - e.g., "Core Work 3 sets" or "Plank 3x45 sec")
  5-6. Optional additional accessories
- Format example with multiple exercises:
  * "Back Squat 5x5 @ 75%"
  * "Romanian Deadlift 3x8"
  * "Walking Lunge 3x10 each"
  * "Leg Press 3x12"
  * "Plank 3x45 sec"
- Coaching cues: Strength-specific technique and loading targets (e.g., "Maintain 3-second eccentric tempo on all compound lifts for time under tension. Focus on full range of motion with controlled bar path. Build to RPE 7-8 on main lift, leaving 2-3 reps in reserve. Rest 2-3 min between heavy sets for neurological recovery. Target progressive overload by adding 2.5-5lb per session. Scale: Reduce load to prioritize tempo and form, substitute goblet squats for barbell if mobility limited, or reduce sets to 3 instead of 5.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Recovery"
- Duration: 3-5 min
- MUST include 3-5 exercises: Foam rolling + static stretching + breathing
- Example: Foam Roll Quads/IT Band 2 min, Hip Flexor Stretch 1 min each, Hip Stretch 1 min each, Lat Stretch 1 min, Deep Breathing 2 min
- Coaching cues: Strength recovery protocol (e.g., "Use foam rolling to release myofascial tension in primary movers. Hold static stretches 90+ seconds to improve flexibility and reduce soreness. Target hip flexors and thoracic spine after compound lifts. Practice box breathing (4-4-4-4) to enhance recovery. Scale: Extend foam rolling to 5 min if tissue feels dense, add lacrosse ball for trigger points.")

CRITICAL FORMATTING RULES:
- Main section MUST have creative title in quotes and capitals
- Main section MUST have 4-6 exercises minimum
- Focus on load progression and proper rest intervals (2-3 min for main lifts)
- Keep coaching cues SHORT (1-2 sentences max)`,
    
    'bb_upper': `
BODYBUILDING UPPER BODY WODIFY-STYLE STRUCTURE:
You MUST create a workout with this EXACT 3-section structure:

SECTION 1 - WARM-UP (no creative title):
- Title: "Warm-Up" or "Movement Prep"
- Duration: 5 min
- MUST include 5-7 exercises: Cardio + shoulder/scapular activation + dynamic stretching
- Example: 400m Easy Row, Arm Circles 20 reps, Band Pull-Aparts 15 reps, Push-Up 10 reps, Scap Pull-Ups 8 reps, Cat-Cow 10 reps, Light DB Press 10 reps
- Coaching cues: Upper body activation (e.g., "Activate rotator cuff and scapular stabilizers with band work and scap pull-ups. Increase blood flow to chest, back, and shoulders with light cardio and dynamic movements. Prime pressing and pulling patterns with bodyweight and light loads. Scale: Use lighter bands if shoulder mobility limited, substitute wall push-ups for floor push-ups.")

SECTION 2 - MAIN WORK (MUST have creative title):
- Creative Title: Generate a bodybuilding-focused name in ALL CAPS with quotes (examples: "THE UPPER BODY SCULPTOR", "CHEST & BACK BUILDER", "PUSH PULL PERFECTION")
- Score Type: "Total Volume" or "Score Reps" or "For Quality"
- Duration: 25-30 min (majority of workout time)
- CRITICAL: MUST include 4-6 exercises total with detailed set/rep schemes (MIRROR SCREENSHOT EXAMPLE):
  1. Primary compound push (REQUIRED - e.g., "DB Bench Press 4x8 Each Side - Heavy" or "DB Shoulder Press 3x10-12")
  2. Primary compound pull (REQUIRED - e.g., "Single Arm DB Row 4x8 Each Side - Heavy" or "Pull Ups 3x10-12")
  3. Secondary push or accessory (REQUIRED - e.g., "DB Fly 3x12" or "Cable Chest Fly 3x15")
  4. Secondary pull or accessory (REQUIRED - e.g., "Cable Row (Pronated Grip) 3x8" or "Lat Pull Down 3x10")
  5. Isolation work 1 (REQUIRED - e.g., "GHD Back Extension 3x Max Hold" or "Lateral Raise 3x15")
  6. Isolation work 2 (optional - e.g., "Bicep Curl 3x12" or "Tricep Extension 3x12")
- Format example with multiple exercises:
  * "DB Bench Press 4x8 Each Side - Heavy"
  * "Single Arm DB Row 4x8 Each Side - Heavy"
  * "GHD Back Extension 3x Max Hold"
  * "Pull Ups 3x10-12"
  * "Cable Row (Pronated Grip) 3x8"
  * "Lateral Raise 3x15"
- Coaching cues: Bodybuilding-specific hypertrophy targets (e.g., "Emphasize mind-muscle connection with 3-second eccentric and 1-second peak contraction on all movements. Target 8-12 rep range for hypertrophy with last 2 reps approaching failure. Rest 60-90 sec between accessory sets, 90-120 sec on compounds. Focus on muscle stretch and squeeze, not moving weight. Scale: Reduce load by 20% to maintain 3-sec eccentrics and full ROM, use resistance bands for peak contractions, or reduce volume to 3 sets if recovery limited.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Recovery"
- Duration: 3-5 min
- MUST include 3-5 exercises: Upper body stretching + foam rolling + breathing
- Example: Doorway Pec Stretch 1 min each, Lat Stretch 1 min each, Tricep Stretch 1 min each, Foam Roll Upper Back 2 min, Deep Breathing 1 min
- Coaching cues: Upper body recovery (e.g., "Target chest, lats, and triceps with static stretches held 90+ seconds to enhance flexibility. Use foam roller on upper back and lats to release fascial restrictions. Focus on deep breathing to enhance blood flow and nutrient delivery to worked muscles. Scale: Add lacrosse ball for pec and lat trigger points, extend stretches if tissue feels tight.")

CRITICAL FORMATTING RULES:
- Main section MUST have creative title in quotes and capitals
- Main section MUST have 4-6 exercises minimum (mirror screenshot example!)
- Each exercise needs detailed format: "4x8 Each Side - Heavy" or "3x10-12"
- Include both compound movements AND accessories
- Balance push/pull exercises
- Emphasize muscle-mind connection, time under tension
- Keep coaching cues SHORT (1-2 sentences max)`,
    
    'bb_lower': `
BODYBUILDING LOWER BODY WODIFY-STYLE STRUCTURE:
You MUST create a workout with this EXACT 3-section structure:

SECTION 1 - WARM-UP (no creative title):
- Title: "Warm-Up" or "Movement Prep"
- Duration: 5 min
- MUST include 5-7 exercises: Cardio + hip/ankle mobility + glute activation + movement prep
- Example: 400m Easy Row, Leg Swing 10 each, Hip Circle 10 each, Air Squat 15 reps, Glute Bridge 15 reps, Walking Lunge 10 each, Calf Raise 15 reps
- Coaching cues: Lower body activation (e.g., "Activate glutes with bridges and hip circles to prep for compound loading. Mobilize ankles and hips for deep squat positions. Increase blood flow with light cardio and bodyweight movements. Prime quad, hamstring, and glute patterns. Scale: Add extra ankle mobility if depth limited, use box squats if flexibility restricted.")

SECTION 2 - MAIN WORK (MUST have creative title):
- Creative Title: Generate a leg-focused name in ALL CAPS with quotes (examples: "THE LEG DAY DESTROYER", "GLUTE & QUAD FORGE", "LOWER BODY DOMINATION")
- Score Type: "Total Volume" or "Score Reps" or "For Quality"
- Duration: 25-30 min (majority of workout time)
- CRITICAL: MUST include 4-6 exercises total with detailed set/rep schemes:
  1. Primary compound (REQUIRED - e.g., "Goblet Squat 4x10 - Heavy" or "DB RDL 4x8-10")
  2. Secondary compound (REQUIRED - e.g., "DB Walking Lunge 3x10 each" or "Bulgarian Split Squat 3x8 each")
  3. Quad-focused movement (REQUIRED - e.g., "Leg Extension 3x12" or "Goblet Squat Pause 3x8")
  4. Hamstring-focused movement (REQUIRED - e.g., "DB RDL 3x10" or "Leg Curl 3x12")
  5. Glute/accessory work 1 (REQUIRED - e.g., "Hip Thrust 3x12" or "Glute Bridge 3x15")
  6. Calf/core work (optional - e.g., "Calf Raise 3x15" or "Plank 3x45 sec")
- Format example with multiple exercises:
  * "Goblet Squat 4x10 - Heavy"
  * "DB RDL 4x8-10"
  * "Walking Lunge 3x10 each"
  * "Leg Curl 3x12"
  * "Hip Thrust 3x12"
  * "Calf Raise 3x15"
- Coaching cues: Hypertrophy-specific lower body targets (e.g., "Emphasize deep stretch and peak contraction with 3-second eccentric tempo on all movements. Target 8-12 rep range with last 2 reps approaching failure for quad and hamstring hypertrophy. Focus on glute activation throughout full range. Rest 90-120 sec between compound sets. Pause at bottom of squats and top of hip thrusts for peak tension. Scale: Reduce load by 20% to maintain tempo and full ROM, use elevated surface for split squats if balance limited, reduce volume to 3 sets if recovery compromised.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Recovery"
- Duration: 3-5 min
- MUST include 3-5 exercises: Lower body stretching + foam rolling + breathing
- Example: Foam Roll Quads 2 min, Foam Roll IT Band 1 min each, Pigeon Stretch 1 min each, Hamstring Stretch 1 min each, Deep Breathing 1 min
- Coaching cues: Lower body recovery protocol (e.g., "Target quads, hip flexors, and IT band with foam rolling to reduce DOMS. Hold static stretches 90+ seconds to enhance flexibility after high-volume leg training. Focus on hip and ankle mobility. Use nasal breathing to enhance recovery and nutrient delivery. Scale: Extend foam rolling to 5 min if soreness high, add lacrosse ball for glute trigger points.")

CRITICAL FORMATTING RULES:
- Main section MUST have creative title in quotes and capitals
- Main section MUST have 4-6 exercises minimum
- Each exercise needs detailed format: "4x10 - Heavy" or "3x8-10"
- Focus on full ROM, controlled eccentrics, balanced quad/hamstring/glute work
- Keep coaching cues SHORT (1-2 sentences max)`,
    
    'bb_full_body': `
BODYBUILDING FULL BODY WODIFY-STYLE STRUCTURE:
You MUST create a workout with this EXACT 3-section structure:

SECTION 1 - WARM-UP (no creative title):
- Title: "Warm-Up" or "Movement Prep"
- Duration: 5 min
- MUST include 5-7 exercises: Cardio + dynamic mobility + full body activation
- Example: 400m Easy Row, Arm Circles 20 reps, Leg Swings 10 each, Air Squat 10 reps, Push-Up 8 reps, Jumping Jack 20 reps, Cat-Cow 10 reps
- Coaching cues: Full body activation (e.g., "Activate all major muscle groups with dynamic movements and light cardio. Mobilize shoulders, hips, and spine for compound lifts. Prime both upper and lower body movement patterns. Elevate core temperature and heart rate. Scale: Reduce cardio distance if conditioning limited, modify push-ups to wall variation if strength limited.")

SECTION 2 - MAIN WORK (MUST have creative title):
- Creative Title: Generate a full-body name in ALL CAPS with quotes (examples: "THE TOTAL BODY TRANSFORMATION", "HEAD TO TOE GAINS", "COMPLETE PHYSIQUE")
- Score Type: "Total Volume" or "Score Reps" or "For Quality"
- Duration: 25-30 min (majority of workout time)
- CRITICAL: MUST include 5-6 exercises total with balanced upper/lower and push/pull:
  1. Upper push compound (REQUIRED - e.g., "DB Bench Press 4x8" or "DB Shoulder Press 3x10")
  2. Lower compound (REQUIRED - e.g., "Goblet Squat 4x10" or "DB RDL 3x10")
  3. Upper pull compound (REQUIRED - e.g., "DB Row 4x8 each" or "Pull Ups 3x8-10")
  4. Lower accessory (REQUIRED - e.g., "Walking Lunge 3x10 each" or "Bulgarian Split Squat 3x8 each")
  5. Upper accessory (REQUIRED - e.g., "DB Curl 3x12" or "Tricep Extension 3x12")
  6. Core work (optional - e.g., "Plank 3x45 sec" or "Dead Bug 3x10 each")
- Format: Upper Push → Lower → Upper Pull → Lower Accessory → Upper Accessory → Core
- Coaching cues: Full body hypertrophy protocol (e.g., "Balance push/pull and upper/lower movements for complete development. Use 3-second eccentric tempo on compounds, 2-second on accessories. Target 8-12 reps approaching failure on all movements. Rest 90-120 sec between compound sets, 60-90 sec on accessories. Alternate upper and lower exercises to manage fatigue. Scale: Reduce load by 20% to maintain tempo and ROM, substitute machine variations for free weight if stability limited, reduce to 3 sets if recovery compromised.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down"
- Duration: 3-5 min
- MUST include 3-5 exercises: Full body stretching + foam rolling + breathing
- Example: Cat-Cow 10 reps, Child's Pose 1 min, Foam Roll Back 2 min, Hip Flexor Stretch 1 min each, Pec Stretch 1 min
- Coaching cues: Full body recovery (e.g., "Target all major muscle groups with combination of stretching and foam rolling. Hold stretches 90+ seconds for flexibility gains. Focus on hip flexors, chest, and lats after compound movements. Use diaphragmatic breathing for recovery. Scale: Prioritize most worked areas, extend duration if soreness high.")

CRITICAL FORMATTING RULES:
- Main section MUST have creative title in quotes and capitals
- Main section MUST have 5-6 exercises minimum
- Balance upper/lower and push/pull movements
- Each exercise needs format: "4x8" or "3x10-12"
- Keep coaching cues SHORT (1-2 sentences max)`,
    
    'mobility': `
MOBILITY & RECOVERY WODIFY-STYLE STRUCTURE:
You MUST create a workout with this EXACT 3-section structure:

SECTION 1 - WARM-UP (no creative title):
- Title: "Centering" or "Breathing Prep"
- Duration: 3-5 min
- MUST include 5-7 exercises: Breathing + body scan + gentle joint circles
- Example: Box Breathing 2 min, Body Scan 1 min, Gentle Neck Circles 10 each, Shoulder Rolls 10, Wrist Circles 20, Hip Circles 10 each, Ankle Circles 10 each
- Coaching cues: Mindful preparation (e.g., "Center nervous system with box breathing (4-4-4-4 pattern). Perform body scan to identify areas of tension. Gently mobilize all major joints without force. Set intention for quality movement and recovery. Scale: Extend breathing to 3 min if stress high, reduce range on circles if pain present.")

SECTION 2 - MAIN MOBILITY (MUST have creative title):
- Creative Title: Generate a mobility-focused name in ALL CAPS with quotes (examples: "THE FLEXIBILITY FLOW", "MOBILITY MASTERY", "MOVEMENT MEDICINE")
- Score Type: "For Quality" or "Time-Based Flow"
- Duration: 20-25 min (majority of workout time)
- CRITICAL: MUST include 5-8 movements with progression (dynamic → active → static):
  1-2. Dynamic mobility (REQUIRED - e.g., "Hip Circles 10 each direction", "Arm Circles 10 each")
  3-4. Active stretching (REQUIRED - e.g., "Cat-Cow 10 reps", "90/90 Hip Rotation 5 each")
  5-6. Static holds (REQUIRED - e.g., "Pigeon Pose 1 min each", "Child's Pose 2 min")
  7-8. Additional gentle stretches (optional - e.g., "Couch Stretch 1 min each", "Spinal Twist 1 min each")
- Format: Joint circles, full ROM movements, gentle holds (30-60s each)
- Coaching cues: Mobility-specific progression (e.g., "Progress from dynamic to active to static stretching. Never force range - work within 70-80% of max stretch. Hold static positions 60-90 seconds for tissue adaptation. Breathe deeply into stretches to enhance relaxation. Focus on areas of restriction identified in warm-up. Scale: Reduce hold times to 30-45 sec if new to stretching, use props (blocks, straps) for support, avoid painful end ranges.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Relaxation" or "Recovery"
- Duration: 3-5 min
- MUST include 3-5 exercises: Gentle breathing + relaxation + meditation
- Example: Savasana 3 min, Deep Breathing 2 min, Body Scan 1 min, Gentle Spinal Twist 1 min each
- Coaching cues: Deep recovery integration (e.g., "Allow body to fully relax in savasana to integrate mobility work. Use 4-7-8 breathing to activate parasympathetic response. Perform final body scan noting changes from session start. Practice gratitude for body's movement capacity. Scale: Extend savasana if stress high, use blanket for comfort.")

CRITICAL FORMATTING RULES:
- Main section MUST have creative title in quotes and capitals
- Main section MUST have 5-8 movements
- No forced or ballistic stretching
- Keep coaching cues SHORT (1-2 sentences max)`,
    
    'mixed': `
MIXED/GENERAL FITNESS WODIFY-STYLE STRUCTURE:
You MUST create a workout with this EXACT 3-section structure:

SECTION 1 - WARM-UP (no creative title):
- Title: "Warm-Up" or "Movement Prep"
- Duration: 5-8 min
- MUST include 5-7 exercises: Cardio + dynamic mobility + varied movement prep
- Example: 300m Easy Row, Inchworm 5, Leg Swing 10 each, Arm Circle 10, Air Squat 10, Push-Up 5, Jumping Jack 20
- Coaching cues: General fitness prep (e.g., "Prepare for varied modalities with full-body warm-up. Elevate heart rate with cardio, mobilize all major joints, prime both strength and conditioning patterns. Balance upper, lower, and core activation. Scale: Reduce cardio distance or modify movements based on fitness level.")

SECTION 2 - MAIN WORKOUT (MUST have creative title):
- Creative Title: Generate a fitness-focused name in ALL CAPS with quotes (examples: "THE FITNESS FUSION", "MIXED MODALITIES", "TOTAL FITNESS")
- Score Type: "For Time" or "AMRAP" or "Score Rounds" or "Total Volume"
- Duration: 20-25 min (majority of workout time)
- CRITICAL: MUST include 4-6 movements with variety:
  1-2. Strength block (REQUIRED - e.g., "Back Squat 3x8" or "DB Bench Press 3x10 @ 50/35lb")
  3-4. Conditioning circuit (REQUIRED - e.g., "500m Row" or "20 Burpees")
  5-6. Accessory/Skill work (optional - e.g., "Pull-Ups 3x8" or "Plank 3x30 sec")
- **MANDATORY**: ALL cardio MUST include distance/calories (e.g., "500m Row", "400m Run"), ALL weighted movements MUST include M/F weight where applicable (e.g., "@ 50/35lb", "@ 24/16kg")
- Format: Variety across strength, cardio, and functional movements
- Coaching cues: Mixed modality strategy (e.g., "Balance strength and conditioning throughout session. Maintain form quality on strength work while managing heart rate on cardio. Target RPE 7-8 on strength blocks, 75-85% max HR on conditioning. Transition efficiently between modalities. Scale: Reduce loads by 15-20% to prioritize movement quality, decrease cardio distances by 25%, or substitute lower-impact movements as needed.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down"
- Duration: 3-5 min
- MUST include 3-5 exercises: Active recovery + stretching + breathing
- Example: Easy Walk 2 min, Cat-Cow 10, Child's Pose 1 min, Hip Flexor Stretch 1 min each, Deep Breathing 1 min
- Coaching cues: General recovery protocol (e.g., "Bring heart rate below 100 bpm with easy movement. Target major muscle groups worked with static stretches held 60-90 seconds. Use deep nasal breathing to enhance parasympathetic recovery. Hydrate and consider light nutrition. Scale: Extend cool-down if heart rate elevated or extend stretches if areas feel tight.")

CRITICAL FORMATTING RULES:
- Main section MUST have creative title in quotes and capitals
- Main section MUST have 4-6 movements
- **MANDATORY**: ALL cardio MUST include distance/calories (e.g., "500m Row", "400m Run", "15 Cal Bike")
- **MANDATORY**: ALL weighted movements MUST include M/F weight where applicable (e.g., "@ 50/35lb", "@ 24/16kg")
- Provide variety across strength, cardio, and functional movements
- Keep coaching cues SHORT (1-2 sentences max)`,
    
    'aerobic': `
AEROBIC/CARDIO WODIFY-STYLE STRUCTURE:
You MUST create a workout with this EXACT 3-section structure:

SECTION 1 - WARM-UP (no creative title):
- Title: "Warm-Up" or "Easy Start"
- Duration: 5 min
- MUST include 5-7 exercises: Easy cardio + dynamic mobility + breathing prep
- Example: 400m Easy Row, Leg Swing 10 each, Arm Circle 10, Inchworm 5, Hip Circle 10, Jumping Jack 15, Deep Breathing 1 min
- Coaching cues: Aerobic preparation (e.g., "Gradually elevate heart rate to Zone 1-2 (50-70% max HR) with easy cardio. Mobilize hips and ankles for sustained movement. Practice nasal breathing rhythm for aerobic efficiency. Prime cardiovascular system without spiking heart rate. Scale: Reduce cardio distance to 200m if deconditioned, slow pace to conversational.")

SECTION 2 - MAIN CARDIO (MUST have creative title):
- Creative Title: Generate a cardio-focused name in ALL CAPS with quotes (examples: "THE AEROBIC ENGINE", "ZONE 2 JOURNEY", "CARDIO FOUNDATION")
- Score Type: "Total Distance" or "For Time" or "Sustained Effort"
- Duration: 25-30 min (majority of workout time)
- CRITICAL: MUST include 3-5 cardio blocks/intervals:
  1. Primary cardio block (REQUIRED - e.g., "2000m Row @ Zone 2" or "3000m Bike @ conversational pace")
  2. Secondary cardio or interval (REQUIRED - e.g., "1500m Ski @ Zone 2" or "1600m Run @ steady pace")
  3. Additional cardio variation (optional - e.g., "1000m Row" or "2000m Bike")
  4-5. Optional interval work or mixed cardio
- Focus: Zone 2 (60-70% max HR) steady-state or intervals
- Format: Sustained cardio (Row, Bike, Ski, Run) with distance in meters (2000-5000m)
- Coaching cues: Aerobic pacing and development (e.g., "Maintain Zone 2 (60-70% max HR) conversational pace for aerobic base building. Focus on nasal-only breathing if possible to enhance mitochondrial adaptation. Target steady, sustainable effort you can maintain for extended duration. Monitor stroke rate 20-24 spm on rowing, cadence 80-90 rpm on biking. Scale: Reduce total distance by 30%, slow pace to ensure nasal breathing possible, or break into intervals with 1-2 min rest.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Active Recovery"
- Duration: 3-5 min
- MUST include 3-5 exercises: Easy movement + stretching + breathing
- Example: Easy Walk 2 min, Quad Stretch 1 min each, Calf Stretch 1 min each, Deep Breathing 2 min
- Coaching cues: Aerobic recovery protocol (e.g., "Walk or move easy for 2 min to gradually lower heart rate below 100 bpm. Target hip flexors, quads, and calves with static stretches. Use 4-7-8 breathing to enhance recovery. Consider light carbohydrate within 30 min for glycogen replenishment. Scale: Extend easy movement if heart rate elevated, foam roll calves if tight.")

CRITICAL FORMATTING RULES:
- Main section MUST have creative title in quotes and capitals
- Main section MUST have 3-5 cardio blocks/intervals
- Focus on maintaining conversational pace
- Keep coaching cues SHORT (1-2 sentences max)`,
    
    'conditioning': `
CONDITIONING/METCON WODIFY-STYLE STRUCTURE:
You MUST create a workout with this EXACT 3-section structure:

SECTION 1 - WARM-UP (no creative title):
- Title: "Warm-Up" or "Movement Prep"
- Duration: 5-8 min
- MUST include 5-7 exercises: Cardio ramp + dynamic stretching + movement priming
- Example: 300m Easy Row, 10 Arm Circle, 10 Leg Swing each, 5 Inchworm, 10 Jumping Jack, 10 High Knees, 10 Butt Kicks
- Coaching cues: Movement-specific prep notes (e.g., "Gradually elevate heart rate to prepare cardiovascular system for high-intensity intervals. Focus on hip and shoulder mobility to support explosive movements. Prime movement patterns with bodyweight versions of main exercises. Scale: Reduce pace or rounds if breathing becomes labored.")

SECTION 2 - MAIN CONDITIONING (MUST have creative title):
- Creative Title: Generate a high-intensity name in ALL CAPS with quotes (examples: "THE METABOLIC INFERNO", "HEART RATE HAVOC", "CONDITIONING CHAOS", "CARDIO CRUCIBLE")
- Score Type: "For Time" or "AMRAP" or "Intervals" or "Score Rounds"
- Duration: 20-25 min (majority of workout time)
- CRITICAL: MUST include 3-5 movements (varies by format):
  * HIIT Intervals: 3-4 movements with work:rest (30:30, 40:20, Tabata 20:10)
  * Circuit: 4-5 movements, 3-4 rounds for time
  * AMRAP: 3-4 movements, maximum rounds in set time
  * Mix cardio + functional movements (Burpees, KB Swings, Box Jumps, Row, Bike)
- **MANDATORY**: ALL cardio MUST include distance/calories (e.g., "500m Row", "400m Run", "15 Cal Bike"), ALL weighted movements MUST include M/F weight (e.g., "KB Swing @ 24/16kg", "Wall Ball @ 20/14lb")
- **INTERVAL FORMAT RULE**: If using "Intervals" score type, MUST specify complete work/rest structure (e.g., "Work 5:00 / Rest 2:00 x 5 rounds" or "3:00 on / 1:00 off for 6 rounds" or "Tabata 8 rounds: Work 0:20 / Rest 0:10")
- Format example:
  * "AMRAP 20: 15 Burpees, 20 KB Swing @ 24/16kg, 25 Box Jump @ 24/20in, 30 Air Squats"
  * "4 Rounds For Time: 400m Run, 20 Burpees, 30 Wall Ball @ 20/14lb"
  * "Intervals - Work 5:00 / Rest 2:00 x 5 rounds: 500m Row, 15 Cal Bike, 400m Run, 10 Burpee"
- Coaching cues: Movement-specific intensity and pacing strategy (e.g., "Target 85-90% max heart rate during work intervals with full recovery to 65-70% during rest. Focus on maintaining power output in rowing stroke and explosive hip extension in burpees. Break movements strategically to sustain pace across all rounds. Scale: Reduce work periods to 3:00 or extend rest to 3:00, substitute step-ups for box jumps, or reduce KB weight to 16/12kg.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Active Recovery"
- Duration: 5 min
- MUST include 3-5 exercises: Easy movement + static stretching + breathing work
- Example: Easy Walk 2 min, Cat-Cow 10 reps, Child's Pose 1 min, Quad Stretch 1 min each, Deep Breathing 2 min
- Coaching cues: Specific recovery guidance (e.g., "Bring heart rate below 100 bpm gradually through easy movement. Focus on hip flexor and quad stretches after high-volume running and jumping. Use diaphragmatic breathing to activate parasympathetic recovery. Scale: Extend cool-down duration if heart rate remains elevated, reduce stretch intensity based on comfort.")

CRITICAL FORMATTING RULES:
- Main section MUST have creative title in quotes and capitals
- Main section MUST have 3-5 movements
- **MANDATORY**: ALL cardio MUST include distance in meters or calories (e.g., "500m Row", "400m Run", "15 Cal Bike")
- **MANDATORY**: ALL weighted movements MUST include M/F weight (e.g., "@ 24/16kg", "@ 20/14lb", "@ 50/35lb")
- Emphasize work capacity and high heart rate
- Keep coaching cues SHORT (1-2 sentences max)`,
    
    'gymnastics': `
GYMNASTICS/BODYWEIGHT WODIFY-STYLE STRUCTURE:
You MUST create a workout with this EXACT 3-section structure:

SECTION 1 - WARM-UP (no creative title):
- Title: "Warm-Up" or "Movement Prep"
- Duration: 8-10 min
- MUST include 5-7 exercises: Joint prep + wrist/shoulder activation + hollow/arch work
- Example: Wrist Circles 20, Wrist Push-Ups 10, Scap Pull-Up 10, Hollow Hold 30 sec, Arch Hold 30 sec, Cat-Cow 10 reps, Light Plank Hold 30 sec
- Coaching cues: Gymnastics-specific preparation (e.g., "Prepare wrists for load-bearing with circles and push-ups. Activate scapular stabilizers and practice hollow/arch positions for core control. Mobilize shoulders for overhead and hanging work. Build wrist, shoulder, and core strength progressively. Scale: Use knees for plank if core weak, reduce hollow/arch hold times to 15 sec, add extra wrist prep if sensitive.")

SECTION 2 - MAIN SKILL WORK (MUST have creative title):
- Creative Title: Generate a skill-focused name in ALL CAPS with quotes (examples: "THE CALISTHENICS CHALLENGE", "BODYWEIGHT MASTERY", "GYMNAST'S CRUCIBLE")
- Score Type: "For Quality" or "EMOM" or "AMRAP" or "Score Rounds"
- Duration: 15-20 min (majority of workout time)
- CRITICAL: MUST include 3-5 movements:
  1. Pull movement (REQUIRED - e.g., "Pull-Ups 5x5" or "Ring Rows 4x8")
  2. Push movement (REQUIRED - e.g., "Push-Ups 5x10" or "Dips 4x6")
  3. Core/Hold (REQUIRED - e.g., "Hollow Hold 4x30 sec" or "Plank 4x45 sec")
  4. Skill work (optional - e.g., "Handstand Hold Practice 5x15 sec" or "L-Sit 4x10 sec")
  5. Additional movement (optional - e.g., "Pike Push-Up 3x8")
- Format: Quality reps, short sets with full recovery OR EMOM/AMRAP with gymnastics movements
- Coaching cues: Gymnastics skill and quality emphasis (e.g., "Prioritize strict form and controlled tempo over volume or speed. Focus on full range of motion with active shoulders in pulls and locked-out elbows in pushes. Maintain hollow body position in all core work. Rest fully between sets for neurological recovery and movement quality. Target RPE 7-8 with 2-3 reps in reserve on skill work. Scale: Use resistance bands for pull assistance, perform negatives if can't do full reps, elevate hands for push-ups, or reduce hold times while maintaining position quality.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Recovery"
- Duration: 5 min
- MUST include 3-5 exercises: Stretching + mobility + relaxation
- Example: Shoulder Stretch 1 min each, Pike Stretch 2 min, Wrist Stretch 1 min, Lat Stretch 1 min each, Deep Breathing 1 min
- Coaching cues: Gymnastics recovery focus (e.g., "Target shoulders, wrists, and lats after bodyweight loading. Hold stretches 90+ seconds to improve flexibility for gymnastics movements. Gently mobilize wrists in all directions after compression. Focus on pike and shoulder flexibility for skill development. Use deep breathing to calm nervous system. Scale: Add foam rolling for lats and upper back, extend wrist stretches if sensitive.")

CRITICAL FORMATTING RULES:
- Main section MUST have creative title in quotes and capitals
- Main section MUST have 3-5 movements
- Prioritize movement quality and control over volume
- Include progressions and regressions in coaching cues
- Keep coaching cues SHORT (1-2 sentences max)`,
  };

  const styleGuide = styleGuidelines[style.toLowerCase()] || styleGuidelines['crossfit'];

  // Build enhanced prompt with movement library and style-specific structure
  const prompt = `You are AXLE, an expert fitness trainer specializing in ${style} workouts.

WORKOUT REQUEST:
- Category/Style: ${style}
- Duration: ${request.duration} minutes
- Intensity: ${request.intensity}/10
- Equipment Available: ${normalizedEquipment.length > 0 ? normalizedEquipment.join(', ') : 'All equipment'}

MOVEMENT LIBRARY (choose from these ${availableMovements.length} movements):
${movementLibrary}

${styleGuide}

GENERAL INSTRUCTIONS:
1. Uses ONLY movements from the library above - match names EXACTLY
2. Follow the ${style} structure guidelines above
3. Scale difficulty to ${request.intensity}/10 intensity
4. Fit within ${request.duration} minutes total
5. Provide VARIETY - don't repeat the same movements

CRITICAL: Return ONLY valid JSON matching this EXACT structure (no markdown, no extra text):

EXAMPLE OUTPUT FOR CROSSFIT:
{
  "title": "CrossFit High-Intensity Workout",
  "notes": "A challenging bodyweight CrossFit session focusing on cardio and strength",
  "sets": [
    {
      "id": "unique-id-1",
      "exercise": "Warm-Up",
      "is_header": true
    },
    { "id": "unique-id-2", "exercise": "Inchworm", "reps": 5 },
    { "id": "unique-id-3", "exercise": "Arm Circle", "reps": 10 },
    {
      "id": "unique-id-4",
      "exercise": "Main - AMRAP 15",
      "is_header": true,
      "workoutTitle": "\\"THE RELENTLESS CRUSHER\\"",
      "scoreType": "15:00 AMRAP",
      "coachingCues": "Maintain steady pacing throughout all 15 minutes. Scale: reduce reps to 15-20-25 or substitute knee push-ups for standard push-ups."
    },
    { "id": "unique-id-5", "exercise": "Push-up", "reps": 20 },
    { "id": "unique-id-6", "exercise": "Air Squat", "reps": 30 },
    { "id": "unique-id-7", "exercise": "Burpee", "reps": 40 },
    {
      "id": "unique-id-8",
      "exercise": "Cool Down",
      "is_header": true
    },
    { "id": "unique-id-9", "exercise": "Cat-Cow", "reps": 10 }
  ]
}

YOUR RESPONSE MUST:
1. Include 3 headers with is_header:true (Warm-Up, Main, Cool Down)
2. ONLY the MAIN header gets workoutTitle, scoreType, and coachingCues
3. Creative title in workoutTitle must be ALL CAPS with quotes (e.g., "\\"THE RELENTLESS CRUSHER\\"")
4. Exercise names must EXACTLY match the movement library above (e.g., "Row", "Run", "Bike" - NOT "1000m Row" or "15 Cal Bike")
5. **CRITICAL**: For cardio exercises, put distance in meters in the distance_m field (e.g., {"exercise": "Row", "distance_m": 1000}) OR calories in the calories field (e.g., {"exercise": "Bike", "calories": 15})
6. **CRITICAL**: For weighted movements, include weight specifications in the notes field (e.g., {"exercise": "KB Swing", "notes": "@ 24/16kg"})
7. Keep coaching cues to 1-2 sentences max with embedded scaling suggestions`;

  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  // Define strict JSON schema for Wodify-style workouts
  const workoutSchema = {
    name: "workout_structure",
    strict: true,
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        notes: { type: "string" },
        sets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              exercise: { type: "string" },
              is_header: { type: "boolean" },
              reps: { 
                anyOf: [
                  { type: "number" },
                  { type: "null" }
                ]
              },
              duration: { 
                anyOf: [
                  { type: "number" },
                  { type: "null" }
                ]
              },
              distance_m: { 
                anyOf: [
                  { type: "number" },
                  { type: "null" }
                ]
              },
              calories: { 
                anyOf: [
                  { type: "number" },
                  { type: "null" }
                ]
              },
              num_sets: { 
                anyOf: [
                  { type: "number" },
                  { type: "null" }
                ]
              },
              rest_s: { 
                anyOf: [
                  { type: "number" },
                  { type: "null" }
                ]
              },
              notes: { 
                anyOf: [
                  { type: "string" },
                  { type: "null" }
                ]
              },
              workoutTitle: { 
                anyOf: [
                  { type: "string" },
                  { type: "null" }
                ]
              },
              scoreType: { 
                anyOf: [
                  { type: "string" },
                  { type: "null" }
                ]
              },
              coachingCues: { 
                anyOf: [
                  { type: "string" },
                  { type: "null" }
                ]
              }
            },
            required: ["id", "exercise", "is_header", "reps", "duration", "distance_m", "calories", "num_sets", "rest_s", "notes", "workoutTitle", "scoreType", "coachingCues"],
            additionalProperties: false
          }
        }
      },
      required: ["title", "notes", "sets"],
      additionalProperties: false
    }
  };

  // Add timeout wrapper to prevent hanging
  // Reduced to 30s to stay within Vercel's function timeout limits
  const timeoutMs = 30000; // 30 second timeout (Vercel Pro allows 60s max)
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('OpenAI request timed out after 30s')), timeoutMs);
  });

  console.log('[WG] Calling OpenAI API', {
    model: 'gpt-4o-mini',
    category,
    style,
    movementCount: availableMovements.length,
    timeoutMs
  });

  let response;
  try {
    const startTime = Date.now();
    response = await Promise.race([
      openai!.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are AXLE, an expert fitness trainer creating Wodify-style workouts. Follow the JSON schema EXACTLY - especially workoutTitle, scoreType, and coachingCues for the MAIN section header."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { 
          type: "json_schema",
          json_schema: workoutSchema
        },
        max_tokens: 2000,
        temperature: 0.9, // Higher temperature for more variety
      }),
      timeoutPromise
    ]) as any;
    
    const duration = Date.now() - startTime;
    console.log('[WG] OpenAI API success', {
      duration: `${duration}ms`,
      tokenUsage: response.usage
    });
  } catch (err: any) {
    console.error('[WG] OpenAI API call failed', {
      error: err?.message || String(err),
      code: err?.code,
      status: err?.status,
      type: err?.type,
      stack: err?.stack,
      fullError: JSON.stringify(err, null, 2)
    });
    throw new Error(`OpenAI API failed: ${err?.message || 'Unknown error'}`);
  }

  if (!response?.choices?.[0]?.message?.content) {
    throw new Error('OpenAI returned empty response');
  }

  let aiResponse;
  try {
    aiResponse = JSON.parse(response.choices[0].message.content);
    
    // Find ALL header sets to debug Wodify fields
    const headers = aiResponse.sets?.filter((s: any) => s.is_header) || [];
    console.log('[WG] OpenAI response parsed successfully', {
      title: aiResponse.title,
      setsCount: aiResponse.sets?.length,
      headersCount: headers.length,
      allHeaders: headers.map((h: any) => ({
        exercise: h.exercise,
        workoutTitle: h.workoutTitle,
        scoreType: h.scoreType,
        coachingCues: h.coachingCues
      }))
    });
    
    // DEBUG: Log first 5 cardio exercises to check distance_m and calories
    const cardioNames = ['run', 'row', 'bike', 'ski', 'assault'];
    const cardioSets = aiResponse.sets?.filter((s: any) => {
      const name = (s.exercise || '').toLowerCase();
      return cardioNames.some(c => name.includes(c));
    }) || [];
    if (cardioSets.length > 0) {
      console.log('[WG] DEBUG: Cardio exercises from OpenAI:', cardioSets.slice(0, 5).map((s: any) => ({
        exercise: s.exercise,
        distance_m: s.distance_m,
        calories: s.calories,
        duration: s.duration,
        reps: s.reps
      })));
    }
  } catch (err) {
    console.error('[WG] Failed to parse OpenAI JSON response', {
      content: response.choices[0].message.content?.slice(0, 200)
    });
    throw new Error('OpenAI returned invalid JSON');
  }
  
  // Create a map of valid movement names (case-insensitive for matching)
  const validMovementNames = new Set(
    availableMovements.map(m => m.name.toLowerCase())
  );
  
  // Validate and map exercises to ensure they exist in the movement library
  const validatedSets = (aiResponse.sets || []).map((set: any, index: number) => {
    // Headers include Wodify fields (workoutTitle, scoreType, coachingCues)
    if (set.is_header) {
      return {
        id: set.id || `header-${Date.now()}-${index}`,
        exercise: set.exercise,
        notes: set.notes || undefined,
        is_header: true,
        // Preserve Wodify fields for main section
        workoutTitle: set.workoutTitle || undefined,
        scoreType: set.scoreType || undefined,
        coachingCues: set.coachingCues || undefined,
      };
    }
    
    // Validate exercise name against movement library
    const exerciseLower = (set.exercise || '').toLowerCase().trim();
    
    // Reject empty or too-short exercise names (prevents fuzzy matching "" to everything)
    if (!exerciseLower || exerciseLower.length < 3) {
      console.error('[WG] Invalid exercise: empty or too short', { 
        exercise: set.exercise 
      });
      return null;
    }
    
    // Try to find exact match
    const exactMatch = availableMovements.find(m => m.name.toLowerCase() === exerciseLower);
    
    if (exactMatch) {
      return {
        id: set.id || `set-${Date.now()}-${index}`,
        exercise: exactMatch.name, // Use canonical name from library
        num_sets: set.num_sets || undefined, // CRITICAL: Capture number of sets for bodybuilding/strength workouts
        reps: set.reps || undefined,
        duration: set.duration || undefined,
        distance: set.distance_m || undefined, // Map distance_m -> distance
        calories: set.calories || undefined, // Map calories field
        rest_s: set.rest_s || undefined, // Keep original field name for transformation
        notes: set.notes || undefined
      };
    }
    
    // Try fuzzy match (contains) - only for reasonable length strings
    if (exerciseLower.length >= 4) {
      const fuzzyMatch = availableMovements.find(m => 
        m.name.toLowerCase().includes(exerciseLower) || 
        exerciseLower.includes(m.name.toLowerCase())
      );
      
      if (fuzzyMatch) {
        console.warn('[WG] Fuzzy matched exercise', { 
          aiGenerated: set.exercise, 
          matched: fuzzyMatch.name 
        });
        return {
          id: set.id || `set-${Date.now()}-${index}`,
          exercise: fuzzyMatch.name, // Use canonical name from library
          num_sets: set.num_sets || undefined, // CRITICAL: Capture number of sets for bodybuilding/strength workouts
          reps: set.reps || undefined,
          duration: set.duration || undefined,
          distance: set.distance_m || undefined, // Map distance_m -> distance
          calories: set.calories || undefined, // Map calories field
          rest_s: set.rest_s || undefined, // Keep original field name for transformation
          notes: set.notes || undefined
        };
      }
    }
    
    // No match found - log error and skip
    console.error('[WG] Invalid exercise generated by AI (not in library)', { 
      exercise: set.exercise,
      exerciseLower,
      availableCount: availableMovements.length 
    });
    return null;
  }).filter(Boolean); // Remove nulls
  
  // Ensure we have at least one non-header exercise
  const nonHeaderSets = validatedSets.filter((s: any) => !s.is_header);
  if (nonHeaderSets.length === 0) {
    throw new Error('OpenAI generated no valid non-header exercises from the movement library');
  }
  
  // Convert to GeneratedWorkout format
  const workoutData = {
    name: aiResponse.title || `${style} Workout`,
    category: category,
    description: aiResponse.notes || `A ${request.intensity}/10 intensity ${style} workout`,
    duration: request.duration,
    intensity: request.intensity,
    sets: validatedSets
  };

  const validation = generatedWorkoutSchema.safeParse(workoutData);
  if (!validation.success) {
    console.error('[WG] Validation failed', validation.error);
    throw new Error('OpenAI response validation failed');
  }
  
  return validation.data;
}

export async function generateWorkout(request: EnhancedWorkoutRequest): Promise<GeneratedWorkout> {
  // SIMPLIFIED: Direct OpenAI generation with movement registry
  const rawCategory = request.category || 'mixed';
  const category = normalizeCategoryToEnum(rawCategory);
  const style = (request as any).style || rawCategory;
  
  console.warn('[WG] OpenAI-first generation', { 
    stamp: GENERATOR_STAMP, 
    category,
    rawCategory,
    style,
    duration: request.duration,
    intensity: request.intensity,
    hasApiKey: !!openai
  });

  // If no OpenAI API key is configured, use fallback immediately
  if (!openai) {
    console.warn('[WG] No OpenAI API key configured, using fallback', { stamp: GENERATOR_STAMP, category });
    
    if (!DISABLE_MOCK) {
      console.warn('[WG] → mock_fallback (no API key)', { stamp: GENERATOR_STAMP, category });
      return generateMockWorkout(request, 'no-api-key');
    }
    
    throw new Error('Workout generation requires OPENAI_API_KEY environment variable. Please configure it in your deployment settings.');
  }

  // Call OpenAI with movement library
  try {
    const result = await generateWithOpenAI(request);
    console.warn('[WG] OpenAI success', { stamp: GENERATOR_STAMP, category, style });
    return result;
  } catch (err: any) {
    console.error('[WG] OpenAI failed', { stamp: GENERATOR_STAMP, category, err: String(err?.message || err) });
    
    // Fallback to mock only if OpenAI fails
    if (!DISABLE_MOCK) {
      console.warn('[WG] → mock_fallback (OpenAI error)', { stamp: GENERATOR_STAMP, category });
      return generateMockWorkout(request, err?.message || 'openai-error');
    }
    
    throw err;
  }
}

// Simple fallback generator
async function generateSimpleFallback(request: EnhancedWorkoutRequest): Promise<any> {
  if (!openai) throw new Error('No OpenAI API available');
  
  const prompt = createPromptTemplate(request);
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system", 
        content: "You are AXLE, an expert fitness planner. Always respond with valid JSON matching the exact schema provided. No additional text or markdown formatting."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
    max_tokens: 1500,
    temperature: 0.7,
  });

  const aiResponse = JSON.parse(response.choices[0].message.content || '{}');
  
  const workoutData = {
    name: aiResponse.title || `${request.category} Workout`,
    category: request.category,
    description: aiResponse.notes || `A ${request.intensity}/10 intensity ${request.category} workout`,
    duration: request.duration,
    intensity: request.intensity,
    sets: aiResponse.sets?.map((set: any, index: number) => ({
      id: `ai-set-${Date.now()}-${index}`,
      exercise: set.description?.split(' ')[0] || `Exercise ${index + 1}`,
      weight: set.target?.weightKg ? Math.round(set.target.weightKg * 2.205) : undefined,
      reps: set.target?.reps || undefined,
      duration: set.target?.timeSec || undefined,
      distance: set.target?.distanceM || undefined,
      restTime: request.intensity >= 7 ? 60 : 90,
      notes: set.description || `Perform with ${request.intensity}/10 intensity`
    })) || []
  };

  const validation = generatedWorkoutSchema.safeParse(workoutData);
  if (!validation.success) {
    throw new Error('Simple generator validation failed');
  }
  
  return validation.data;
}

// Fallback mock workout generator
export function generateMockWorkout(request: EnhancedWorkoutRequest, reason?: string): GeneratedWorkout {
  const workoutTemplates = {
    [Category.CROSSFIT]: {
      name: '"THE MOCK HERO CHALLENGE"',
      description: `Warm up
2:00 cardio machine, increasing speed every :30
then, 2 rounds of
5 inchworms
10 air squats
7 push ups
5 jumping pull-ups

Metcon
"THE MOCK HERO CHALLENGE"

Rx+
21-15-9
Double Dumbbell Thrusters @ 50/35#
Chest-to-Bar Pull-ups
Double Unders x 30 each round
10:00 time cap!

Rx
21-15-9
Double Dumbbell Thrusters @ 35/25#
Pull-ups
Single Unders x 30 each round
12:00 time cap!`,
      exercises: [
        { exercise: "Warm-up", duration: 120, restTime: 0, notes: "2:00 cardio machine, increasing speed every :30" },
        { exercise: "Dynamic Movements", reps: 2, restTime: 60, notes: "2 rounds of: 5 inchworms, 10 air squats, 7 push ups, 5 jumping pull-ups" },
        { exercise: "Metcon (Rx+)", reps: 6, duration: 600, restTime: 0, notes: "Metcon: \"THE MOCK HERO CHALLENGE\"\n\nRx+\n21-15-9\nDouble Dumbbell Thrusters @ 50/35#\nChest-to-Bar Pull-ups\nDouble Unders x 30 each round\n10:00 time cap!" },
        { exercise: "Metcon (Rx)", reps: 6, duration: 720, restTime: 0, notes: "Rx\n21-15-9\nDouble Dumbbell Thrusters @ 35/25#\nPull-ups\nSingle Unders x 30 each round\n12:00 time cap!" }
      ]
    },
    [Category.STRENGTH]: {
      name: "Strength Builder",
      description: "Progressive strength training session",
      exercises: [
        { exercise: "Bench Press", weight: 135, reps: 8, restTime: 90 },
        { exercise: "Squats", weight: 155, reps: 8, restTime: 90 },
        { exercise: "Deadlift", weight: 185, reps: 6, restTime: 120 },
        { exercise: "Overhead Press", weight: 85, reps: 8, restTime: 75 },
        { exercise: "Barbell Rows", weight: 115, reps: 10, restTime: 75 }
      ]
    },
    [Category.HIIT]: {
      name: "HIIT Cardio Blast",
      description: "High-intensity interval training",
      exercises: [
        { exercise: "Jumping Jacks", duration: 45, restTime: 15 },
        { exercise: "Burpees", reps: 12, restTime: 30 },
        { exercise: "High Knees", duration: 30, restTime: 15 },
        { exercise: "Plank Hold", duration: 45, restTime: 30 },
        { exercise: "Jump Squats", reps: 15, restTime: 30 }
      ]
    },
    [Category.CARDIO]: {
      name: "Cardio Endurance",
      description: "Steady-state and interval cardio",
      exercises: [
        { exercise: "Running", distance: 800, duration: 240, restTime: 60 },
        { exercise: "Cycling", duration: 300, restTime: 60 },
        { exercise: "Jumping Rope", duration: 120, restTime: 45 },
        { exercise: "Rowing Machine", distance: 500, duration: 120, restTime: 60 }
      ]
    }
  };

  const template = workoutTemplates[request.category as keyof typeof workoutTemplates] || workoutTemplates[Category.STRENGTH];
  
  return {
    name: template.name,
    category: request.category,
    description: template.description,
    duration: request.duration,
    intensity: request.intensity,
    sets: template.exercises.map((exercise: any, index: number) => ({
      id: `mock-set-${Date.now()}-${index}`,
      exercise: exercise.exercise,
      weight: (exercise as any).weight || undefined,
      reps: (exercise as any).reps || undefined,
      duration: (exercise as any).duration || undefined,
      distance: (exercise as any).distance || undefined,
      restTime: (exercise as any).restTime || undefined,
      notes: `Intensity level ${request.intensity}/10`,
    })),
    meta: {
      generator: 'mock' as const,
      acceptance: {},
      reason: reason || 'no-api-key'
    }
  } as any;
}