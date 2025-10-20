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

// Using gpt-4o model for reliable workout generation. Do not change this unless explicitly requested by the user
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

  // CrossFit-specific instructions
  const crossfitInstructions = category === Category.CROSSFIT ? `
CROSSFIT WORKOUT REQUIREMENTS:
You must research authentic CrossFit WODs and create a workout that follows these EXACT formatting rules:

STRUCTURE:
1. WARM-UP SECTION: Always start with "2:00 cardio machine, increasing speed every :30" followed by "then, 2 rounds of" and 3-5 specific movements
2. METCON SECTION: Must have a creative, fun name in ALL CAPS and quotes (examples: "THE KRISS KROSS ROCKY ROAD", "BARBED WIRE CHARCUTERIE BOARD")
3. TWO SCALING OPTIONS: Rx+ (advanced) and Rx (scaled down version with lighter weights, easier movements, or modified reps)

FORMATTING RULES:
- Use CrossFit terminology: "AMRAP", "For Time", "Rounds", "Double Unders", "Single Unders"
- EXERCISE SPECIFICATIONS AND WEIGHTS:
  * Barbell Thrusters: Rx+ @ 95/65#, Rx @ 65/45#
  * Dumbbell Thrusters: Rx+ @ 50/35#, Rx @ 35/25# (specify as "Double Dumbbell Thrusters")
  * Deadlifts: Rx+ @ 185/135#, Rx @ 135/95#
  * Wall Balls: Rx+ @ 20/14# to 10ft, Rx @ 14/10# to 9ft
  * Kettlebells: Rx+ @ 24/16kg, Rx @ 20/12kg
- Always specify exercise variations clearly (e.g., "Barbell Back Squats", "Double Dumbbell Thrusters")
- Include time caps when appropriate (e.g., "15:00 time cap!")
- Use proper rep schemes like "3-6-9-12..." for ascending ladders
- Include specific movement notes with asterisks for clarification

EXAMPLE FORMAT TO FOLLOW:
{
  "title": "\"CREATIVE WORKOUT NAME IN QUOTES\"",
  "notes": "Warm up\\n2:00 cardio machine, increasing speed every :30\\nthen, 2 rounds of\\n5 inchworms\\n7 push ups\\n10 bodyweight squats\\n5 jumping pull-ups\\n\\nMetcon\\n\"CREATIVE NAME\"\\n\\nRx+\\n21-15-9\\nDouble Dumbbell Thrusters @ 50/35#\\nChest-to-Bar Pull-Ups\\nDouble Unders x 50 each round\\n\\nRx\\n21-15-9\\nDouble Dumbbell Thrusters @ 35/25#\\nPull-Ups\\nSingle Unders x 50 each round",
  "sets": [
    {
      "description": "Warm-up: 2:00 cardio machine, increasing speed every :30",
      "target": { "timeSec": 120 }
    },
    {
      "description": "Then, 2 rounds of: 5 inchworms, 7 push ups, 10 bodyweight squats, 5 jumping pull-ups",
      "target": { "reps": 2 }
    },
    {
      "description": "Metcon: \"CREATIVE NAME\"\\n\\nRx+\\n21-15-9\\nDouble Dumbbell Thrusters @ 50/35#\\nChest-to-Bar Pull-Ups\\nDouble Unders x 50 each round",
      "target": { "timeSec": 900, "reps": 6 }
    },
    {
      "description": "Rx\\n21-15-9\\nDouble Dumbbell Thrusters @ 35/25#\\nPull-Ups\\nSingle Unders x 50 each round",
      "target": { "timeSec": 900, "reps": 6 }
    }
  ]
}` : '';

  return `You are AXLE, an expert fitness planner with 20+ years of multi-disciplinary experience in all fields of physical fitness and athletic performance.

WORKOUT REQUEST:
- Category: ${category}
- Duration: ${duration} minutes
- Target Intensity: ${intensity}/10

CONTEXT INFORMATION:
${prContext}

${workoutContext}

${reportContext}
${crossfitInstructions}

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
- Format: "2:00 Cardio Choice" followed by "2 rounds of:" with 4-5 dynamic movements
- Coaching cues: "Prepare joints and elevate heart rate. Scale: reduce rounds or movement complexity."
- Example movements: Inchworm, Arm Circles, Leg Swings, Cat-Cow, Jumping Jacks

SECTION 2 - MAIN WOD (MUST have creative title):
- Creative Title: Generate a fun, memorable name in ALL CAPS with quotes (examples: "FRUIT LOOPS IN MY ORANGE JUICE", "THE THREE WISE WITCHES", "HOT DOG TREASURE CHEST")
- Score Type: MUST be one of these formats:
  * "For Time" (with time cap like "13:00 time cap!")
  * "AMRAP" (e.g., "15:00 AMRAP", "4:00 AMRAP")
  * "EMOM" (e.g., "28:00 EMOM", "Every 2:00 x 6 Sets")
  * "Intervals" (e.g., "Every 5:00 for 4 rounds", "2:00 on 1:00 off for 5 rounds")
- Duration: 10-20 min (majority of workout time)
- Coaching cues: Brief goal statement (e.g., "Hold consistent pacing and movement quality across all seven rounds. Scale: Reduce load to maintain form, or substitute ring rows for pull-ups.")
- Scaling notes: Quick suggestions embedded in coaching cues (lighter weights, easier variations, reduced complexity)
- Format examples:
  * For Time: "21-15-9\\nThrusters @ 95/65#\\nPull-ups"
  * AMRAP 15: "19 Calorie Row\\n19 Wall Balls @ 20/14#"
  * EMOM: "minute 1: 3 Wall Walks\\nminute 2: 6 Shuttle Runs\\nminute 3: 15/12 Calorie Row"

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Recovery"
- Duration: 3-5 min
- Format: Static stretches, breathing, light movement
- Coaching cues: "Focus on recovery. Scale: Hold stretches based on comfort level."

CRITICAL FORMATTING RULES:
- Main section MUST have creative title in quotes and capitals
- Include time notation (12:35, 15:00, etc.) where relevant  
- Use @ symbol for weights (e.g., @ 95/65#, @ 50/35#)
- Specify "For Time", "AMRAP", "EMOM", or interval format clearly
- Keep coaching cues SHORT (1-2 sentences max)
- Embed scaling suggestions in coaching cues, not separate section`,
    
    'olympic_weightlifting': `
OLYMPIC LIFTING STRUCTURE:
- Warm-up (8-10 min): Joint mobility, light cardio, empty bar practice
- Skill/Technique (10-15 min): Positional work (snatch/clean pulls, hang variations)
- Main Lifts (15-20 min): Build to heavy single or work sets
  * Focus on: Snatch, Clean & Jerk, variations (Hang, Power, Split)
  * Format: "Build to heavy single" or "5 sets @ 80%"
- Accessory (5-10 min): Squats, pulls, overhead work
- Cool-down (3-5 min): Stretching

CRITICAL: Use proper Olympic lift names from the library.`,
    
    'powerlifting': `
POWERLIFTING STRUCTURE:
- Warm-up (5-8 min): Dynamic stretching, activation exercises
- Main Lift (20-25 min): Focus on one of the big three (Squat, Bench, Deadlift)
  * Format: "5x5 @ 75%" or "3x3 @ 85%" or "Work up to 1RM"
- Accessory Work (10-15 min): Variations and supporting movements
  * Squat accessories: Front Squat, Bulgarian Split Squat, Leg Press
  * Bench accessories: DB Bench, Dips, Tricep work
  * Deadlift accessories: RDLs, Rows, Good Mornings
- Cool-down (3-5 min)

CRITICAL: Emphasize progressive overload and percentage-based programming.`,
    
    'endurance': `
ENDURANCE/HYROX STRUCTURE:
- Warm-up (5-8 min): Easy cardio, dynamic movements
- Main Circuit (20-30 min): Alternating cardio + functional stations
  * Station 1: Distance-based cardio (Row, Bike, Ski, Run) using distance_m field
  * Station 2: Functional movement (Burpees, Wall Balls, KB Swings) with reps
  * Station 3: Different cardio modality with distance_m
  * Station 4: Different functional movement
  * 4-5 total stations
- Cool-down (3-5 min): Easy movement, stretching

CRITICAL: Use distance_m (800-1000m) for cardio, NOT duration. Vary cardio modalities.`,
    
    'strength': `
STRENGTH TRAINING STRUCTURE:
- Warm-up (5-8 min): Movement prep, activation
- Main Lift (15-20 min): Compound movement with progressive loading
  * Format: "4x6 @ 75%" or "5x5 building" or "3x8-10"
- Supplemental (10-15 min): Secondary compound or heavy accessory
- Accessory (5-10 min): Isolation or weak point work
- Cool-down (3-5 min)

CRITICAL: Focus on load progression and proper rest intervals (2-3 min for main lifts).`,
    
    'bb_upper': `
BODYBUILDING UPPER BODY STRUCTURE:
- Warm-up (5 min): Shoulder circles, band pull-aparts, light cardio
- Primary (12-15 min): Compound upper push or pull (DB Bench, DB Row, DB Shoulder Press)
  * Format: "3x8-10" or "4x6-8" with controlled tempo
- Secondary (10-12 min): Another compound (opposite pattern from primary)
- Accessory (8-10 min): 2-3 isolation movements (DB Bicep Curl, Tricep Extension, Lateral Raise)
  * Format: "3x12-15" or "3x10-12"
- Cool-down (3 min): Stretching

CRITICAL: Emphasize muscle-mind connection, time under tension, and balanced push/pull work.`,
    
    'bb_lower': `
BODYBUILDING LOWER BODY STRUCTURE:
- Warm-up (5 min): Leg swings, hip circles, bodyweight squats
- Primary (12-15 min): Main compound (Goblet Squat, DB RDL, DB Lunge)
  * Format: "4x8-10" or "3x10-12" with controlled tempo
- Secondary (10-12 min): Another compound or unilateral (Step-ups, Bulgarian Split Squats)
- Accessory (8-10 min): Isolation work (Calf Raises, Single-Leg Glute Bridge)
  * Format: "3x12-15" or "3x15-20"
- Cool-down (3 min): Stretching, foam rolling

CRITICAL: Focus on full range of motion, controlled eccentrics, and balanced quad/hamstring/glute work.`,
    
    'bb_full_body': `
BODYBUILDING FULL BODY STRUCTURE:
- Warm-up (5 min): Dynamic movements, light cardio
- Upper Push (8-10 min): DB Bench, DB Shoulder Press, or Push-ups
  * Format: "3x8-10"
- Lower (8-10 min): Goblet Squat, DB Lunge, or DB RDL
  * Format: "3x8-10"
- Upper Pull (8-10 min): DB Row, Pull-ups, or DB Reverse Fly
  * Format: "3x8-10"
- Accessory Circuit (8-10 min): 2-3 exercises targeting weak points
  * Format: "3 rounds: 12-15 reps each"
- Cool-down (3 min)

CRITICAL: Balance upper/lower and push/pull movements for complete development.`,
    
    'mobility': `
MOBILITY & RECOVERY STRUCTURE:
- Breathing & Centering (3-5 min): Deep breathing, body scan
- Dynamic Mobility (10-12 min): Joint circles, leg/arm swings, Cat-Cow, Inchworms
  * Focus on major joints: hips, shoulders, spine, ankles
- Active Stretching (10-15 min): Controlled movements through full ROM
  * Cossack Squats, Hip Circles, Bird Dogs, Dead Bugs
- Static Stretching (8-10 min): Gentle holds (30-60 sec each)
- Cool-down (3-5 min): Relaxation, breathing

CRITICAL: Emphasize quality of movement over quantity. No forced or ballistic stretching.`,
    
    'mixed': `
MIXED/GENERAL FITNESS STRUCTURE:
- Warm-up (5-8 min): Dynamic movements, light cardio
- Block 1 (10-12 min): Strength focus (compound lifts)
  * Format: "3-4 sets" of main movements
- Block 2 (10-12 min): Conditioning/cardio circuit
  * Format: Interval or circuit style with 3-5 movements
- Block 3 (8-10 min): Accessory or skill work
- Cool-down (3-5 min)

CRITICAL: Provide variety across strength, cardio, and functional movements for general fitness development.`,
    
    'aerobic': `
AEROBIC/CARDIO STRUCTURE:
- Warm-up (5 min): Easy cardio, dynamic stretching
- Main Cardio (25-30 min): Sustained aerobic work
  * Zone 2 (60-70% max HR): Steady-state cardio (Row, Bike, Ski, Run)
  * Use distance_m for rowing/skiing (2000-5000m based on intensity)
  * Use duration for sustained efforts (10-20 min blocks)
  * Can include intervals: 5min on, 1min easy x 4
- Active Recovery (3-5 min): Easy movement
- Cool-down (3-5 min): Stretching

CRITICAL: Focus on maintaining conversational pace for aerobic base building.`,
    
    'conditioning': `
CONDITIONING/METCON STRUCTURE:
- Warm-up (5-8 min): Dynamic movements, cardio ramp
- Main Conditioning (20-25 min): High-intensity metabolic work
  * HIIT format: Work:rest intervals (30:30, 40:20, Tabata 20:10)
  * Circuit format: 3-5 movements, 3-4 rounds for time
  * AMRAP format: Maximum rounds in set time
  * Mix cardio + functional movements (Burpees, KB Swings, Box Jumps, Row, Bike)
- Cool-down (5 min): Easy movement, breathing

CRITICAL: Emphasize work capacity, high heart rate, minimal rest between movements.`,
    
    'gymnastics': `
GYMNASTICS/BODYWEIGHT SKILL STRUCTURE:
- Warm-up (8-10 min): Joint mobility, wrist prep, shoulder activation
- Skill Work (15-20 min): Technical practice
  * Focus: Pull-ups, Push-ups, Dips, Plank variations
  * Format: Quality reps, short sets with full recovery
  * Progressions: Negatives, holds, partial ROM, assisted variations
- Strength/Conditioning (10-12 min): Bodyweight circuit
  * Format: EMOM or AMRAP with gymnastics movements
- Cool-down (5 min): Stretching, mobility

CRITICAL: Prioritize movement quality and control over volume. Include progressions and regressions.`,
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

CRITICAL: Return ONLY valid JSON matching this exact structure (no markdown, no extra text):

{
  "title": "Specific workout name reflecting ${style} and intensity",
  "notes": "Brief workout description with scaling options",
  "sets": [
    {
      "id": "unique-id-${Date.now()}",
      "exercise": "Exercise name (MUST match movement library EXACTLY)",
      "reps": number (if applicable),
      "duration": number in seconds (if applicable),
      "distance_m": number in meters (for cardio - use 800-1000m),
      "num_sets": number (if applicable),
      "rest_s": number in seconds (if applicable),
      "notes": "Form cues or scaling options",
      "is_header": true (only for section headers like "Warm-up", "Main - AMRAP 12", "Cool-down"),
      "workoutTitle": "Creative title in ALL CAPS with quotes (ONLY for main section, e.g., \\"FRUIT LOOPS IN MY ORANGE JUICE\\")",
      "scoreType": "Score format (ONLY for main section: 'For Time', 'AMRAP', 'EMOM', 'Intervals')",
      "coachingCues": "Short goal statement with scaling suggestions (1-2 sentences, ONLY for main section)",
      "scalingNotes": "Quick scaling suggestions embedded in coachingCues (ONLY for main section)"
    }
  ]
}

IMPORTANT RULES:
- Use "is_header": true for section headers (Warm-up, Main, Cool-down)
- ONLY add workoutTitle, scoreType, and coachingCues to the MAIN section header
- Warm-up and Cool-down should NOT have workoutTitle or scoreType
- Match movement names EXACTLY to the library above
- Keep coaching cues brief (1-2 sentences max)
- Embed scaling suggestions IN the coaching cues, don't create separate scalingNotes field`;

  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  // Add timeout wrapper to prevent hanging
  const timeoutMs = 25000; // 25 second timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('OpenAI request timed out after 25s')), timeoutMs);
  });

  let response;
  try {
    response = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are AXLE, an expert fitness trainer. Always respond with valid JSON matching the exact schema. No markdown, no extra text."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
        temperature: 0.9, // Higher temperature for more variety
      }),
      timeoutPromise
    ]) as any;
  } catch (err: any) {
    console.error('[WG] OpenAI API call failed', {
      error: err?.message || String(err),
      code: err?.code,
      status: err?.status,
      type: err?.type
    });
    throw new Error(`OpenAI API failed: ${err?.message || 'Unknown error'}`);
  }

  if (!response?.choices?.[0]?.message?.content) {
    throw new Error('OpenAI returned empty response');
  }

  let aiResponse;
  try {
    aiResponse = JSON.parse(response.choices[0].message.content);
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
  const validatedSets = (aiResponse.sets || []).map((set: any) => {
    // Skip headers
    if (set.is_header) {
      return {
        id: set.id || `header-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        exercise: set.exercise,
        is_header: true,
        notes: set.notes
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
        id: set.id || `set-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        exercise: exactMatch.name, // Use canonical name from library
        reps: set.reps || undefined,
        duration: set.duration || undefined,
        distance_m: set.distance_m || undefined,
        num_sets: set.num_sets || undefined,
        rest_s: set.rest_s || undefined,
        notes: set.notes || undefined,
        is_header: false
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
          id: set.id || `set-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          exercise: fuzzyMatch.name, // Use canonical name from library
          reps: set.reps || undefined,
          duration: set.duration || undefined,
          distance_m: set.distance_m || undefined,
          num_sets: set.num_sets || undefined,
          rest_s: set.rest_s || undefined,
          notes: set.notes || undefined,
          is_header: false
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
    intensity: request.intensity
  });

  // Call OpenAI with movement library
  try {
    if (!openai) throw new Error('OpenAI API key not configured');
    
    const result = await generateWithOpenAI(request);
    console.warn('[WG] OpenAI success', { stamp: GENERATOR_STAMP, category, style });
    return result;
  } catch (err: any) {
    console.error('[WG] OpenAI failed', { stamp: GENERATOR_STAMP, category, err: String(err?.message || err) });
    
    // Fallback to mock only if OpenAI fails
    if (!DISABLE_MOCK) {
      console.warn('[WG] → mock_fallback', { stamp: GENERATOR_STAMP, category });
      return generateMockWorkout(request);
    }
    
    throw err;
  }
}

// Simple fallback generator
async function generateSimpleFallback(request: EnhancedWorkoutRequest): Promise<any> {
  if (!openai) throw new Error('No OpenAI API available');
  
  const prompt = createPromptTemplate(request);
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
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