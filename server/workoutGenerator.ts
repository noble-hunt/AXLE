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
- MUST include 4-6 exercises: Start with cardio, then dynamic movements
- Format: "Cardio Choice" followed by "2 rounds of:" with 4-5 dynamic movements
- Example: 300m Row, then 2 rounds of: 5 Inchworm, 10 Arm Circle, 10 Leg Swing, 5 Cat-Cow, 10 Jumping Jack
- Coaching cues: "Prepare joints and elevate heart rate. Scale: reduce rounds or movement complexity."

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
- Coaching cues: Brief goal statement (e.g., "Hold consistent pacing and movement quality across all seven rounds. Scale: Reduce load to maintain form, or substitute ring rows for pull-ups.")
- Format examples:
  * For Time: "21-15-9\\nThrusters @ 95/65lb\\nPull-ups"
  * AMRAP 15: "19 Cal Row\\n19 Wall Ball @ 20/14lb\\n15 Push-ups"
  * EMOM: "minute 1: 3 Wall Walks\\nminute 2: 200m Run\\nminute 3: 15/12 Cal Row"

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Recovery"
- Duration: 3-5 min
- MUST include 3-4 exercises: Static stretches, breathing, light movement
- Example: Child's Pose 1 min, Pigeon Stretch 1 min each, Cat-Cow 10 reps, Deep Breathing 1 min
- Coaching cues: "Focus on recovery. Scale: Hold stretches based on comfort level."

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
- MUST include 3-5 exercises: Joint mobility, light cardio, empty bar practice
- Example: PVC Pass Through 10 reps, Wrist Circles, Empty Bar Snatch Balance 8 reps, Overhead Squat 5 reps
- Coaching cues: "Prepare joints and practice positions. Scale: Use PVC pipe or reduce rounds."

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
- Coaching cues: Brief technique focus (e.g., "Maintain speed under the bar and stable catch positions across all lifts. Scale: Reduce percentages by 10% or use hang variations for technique work.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Recovery"
- Duration: 3-5 min
- MUST include 3-4 exercises: Static stretching, mobility work, breathing
- Example: Couch Stretch 2 min each, Thoracic Rotations, Child's Pose, Deep Breathing 2 min
- Coaching cues: "Focus on hip and shoulder mobility. Scale: Hold stretches based on comfort."

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
- MUST include 3-5 exercises: Dynamic stretching, activation exercises (band work, light movements)
- Example: 10 Hip Circle, 10 Air Squat, 10 Arm Circle, 10 Leg Swing
- Coaching cues: "Activate key muscle groups and prepare for heavy loads. Scale: Adjust based on mobility."

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
- Coaching cues: Brief focus on technique and intensity (e.g., "Build to heavy loads with proper form and full depth. Scale: Reduce weight or volume while maintaining quality movement.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Recovery"
- Duration: 3-5 min
- MUST include 3-4 exercises: Static stretches, foam rolling, breathing work
- Example: Foam Roll Quads 2 min, Pigeon Stretch 1 min each, Child's Pose 1 min
- Coaching cues: "Focus on recovery and flexibility. Scale: Based on comfort level."

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
- MUST include 3-5 exercises: Easy cardio with distance, dynamic movements, mobility
- Example: 500m Easy Row, Leg Swing 10 each, Arm Circle 10, Inchworm 5, Jumping Jack 20
- Coaching cues: "Gradually elevate heart rate. Scale: Adjust pace based on readiness."

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
- Coaching cues: Brief pacing strategy (e.g., "Maintain steady effort across all stations like a HYROX race. Scale: Reduce distance by 25% or substitute lower-impact cardio.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Active Recovery"
- Duration: 3-5 min
- MUST include 3-4 exercises: Easy movement, stretching, breathing
- Example: Easy Walk 2 min, Quad Stretch 1 min each, Hip Stretch 1 min each, Deep Breathing 1 min
- Coaching cues: "Bring heart rate down gradually. Scale: Based on recovery needs."

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
- MUST include 3-5 exercises: Movement prep, activation exercises, mobility
- Example: Hip Circle 10, Air Squat 10, Arm Circle 10, Band Pull-Apart 15, Light Cardio 2 min
- Coaching cues: "Prepare muscles and joints for loading. Scale: Adjust based on mobility needs."

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
- Coaching cues: Brief technique and effort cues (e.g., "Maintain braced core and controlled tempo on all lifts. Scale: Reduce load or reps while keeping quality movement.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Recovery"
- Duration: 3-5 min
- MUST include 3-4 exercises: Stretching, foam rolling, breathing
- Example: Foam Roll 2 min, Hip Stretch 1 min each, Deep Breathing 2 min
- Coaching cues: "Focus on recovery. Scale: Based on comfort level."

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
- MUST include 3-5 exercises: Shoulder circles, band pull-aparts, light cardio, scapular activation
- Example: Arm Circles 20 reps, Band Pull-Aparts 15 reps, Push-Up 10 reps, Scap Pull-Ups 8 reps
- Coaching cues: "Activate upper body muscles. Scale: Adjust intensity based on readiness."

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
- Coaching cues: Brief form and tempo focus (e.g., "Emphasize mind-muscle connection with controlled tempo on all movements. Scale: Reduce weight to maintain 2-3 second eccentrics and full contraction at peak.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Recovery"
- Duration: 3-5 min
- MUST include 3-4 exercises: Upper body stretches, foam rolling, breathing
- Example: Doorway Pec Stretch 1 min each, Lat Stretch 1 min each, Foam Roll Upper Back 2 min
- Coaching cues: "Focus on flexibility. Scale: Based on comfort level."

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
- MUST include 3-5 exercises: Leg swings, hip circles, bodyweight squats, ankle mobility
- Example: Leg Swing 10 each, Hip Circle 10 each, Air Squat 15 reps, Glute Bridge 15 reps
- Coaching cues: "Prepare lower body for loading. Scale: Adjust range of motion based on mobility."

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
- Coaching cues: Brief technique focus (e.g., "Emphasize full range of motion and controlled tempo on all movements. Scale: Reduce weight to maintain 3-second eccentrics and full stretch at bottom.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Recovery"
- Duration: 3-5 min
- MUST include 3-4 exercises: Lower body stretches, foam rolling, breathing
- Example: Foam Roll Quads 2 min, Pigeon Stretch 1 min each, Hamstring Stretch 1 min each
- Coaching cues: "Focus on flexibility and recovery. Scale: Based on comfort level."

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
- MUST include 3-5 exercises: Dynamic movements, light cardio, joint mobility
- Example: Arm Circles, Leg Swings, Air Squat 10 reps, Push-Up 8 reps, Jumping Jack 20 reps
- Coaching cues: "Prepare entire body for training. Scale: Adjust based on readiness."

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
- Coaching cues: Brief balance focus (e.g., "Balance push/pull and upper/lower movements for complete development. Scale: Adjust weight or reps to maintain quality form throughout.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down"
- Duration: 3-5 min
- MUST include 3-4 exercises: Full body stretching, foam rolling
- Example: Cat-Cow 10 reps, Child's Pose 1 min, Foam Roll Back 2 min
- Coaching cues: "Focus on recovery. Scale: Based on comfort level."

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
- MUST include 3-4 exercises: Deep breathing, body scan, gentle movements
- Example: Box Breathing 2 min, Body Scan 1 min, Gentle Neck Circles 10 each, Shoulder Rolls 10
- Coaching cues: "Center your mind and body. Scale: Adjust breath depth based on comfort."

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
- Coaching cues: Brief quality focus (e.g., "Emphasize quality over quantity, no forced stretching. Scale: Reduce hold times or range of motion based on comfort.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Relaxation" or "Recovery"
- Duration: 3-5 min
- MUST include 2-3 exercises: Gentle breathing, final relaxation, meditation
- Example: Savasana 3 min, Deep Breathing 2 min
- Coaching cues: "Relax and integrate. Scale: Based on comfort level."

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
- MUST include 3-5 exercises: Dynamic movements, light cardio, mobility
- Example: 300m Easy Row, Inchworm 5, Leg Swing 10 each, Arm Circle 10, Jumping Jack 20
- Coaching cues: "Prepare for varied work. Scale: Adjust based on readiness."

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
- Coaching cues: Brief variety focus (e.g., "Maintain quality across all modalities. Scale: Reduce complexity or volume as needed.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down"
- Duration: 3-5 min
- MUST include 3-4 exercises: Light movement, stretching, breathing
- Example: Easy Walk 2 min, Cat-Cow 10, Child's Pose 1 min, Deep Breathing 1 min
- Coaching cues: "Focus on recovery. Scale: Based on comfort level."

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
- MUST include 3-4 exercises: Easy cardio, dynamic stretching, mobility
- Example: 400m Easy Row, Leg Swing 10 each, Arm Circle 10, Inchworm 5
- Coaching cues: "Gradually elevate heart rate. Scale: Adjust pace based on readiness."

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
- Coaching cues: Brief pacing focus (e.g., "Maintain conversational pace for aerobic development. Scale: Reduce duration or distance by 25%.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Active Recovery"
- Duration: 3-5 min
- MUST include 3-4 exercises: Easy movement, stretching, breathing
- Example: Easy Walk 2 min, Quad Stretch 1 min each, Deep Breathing 2 min
- Coaching cues: "Bring heart rate down gradually. Scale: Based on recovery needs."

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
- MUST include 3-5 exercises: Dynamic movements, cardio ramp, mobility
- Example: 300m Easy Row, Inchworm 5, Jumping Jack 20, High Knees 20, Butt Kicks 20
- Coaching cues: "Elevate heart rate and prepare for high intensity. Scale: Reduce complexity or pace."

SECTION 2 - MAIN CONDITIONING (MUST have creative title):
- Creative Title: Generate a high-intensity name in ALL CAPS with quotes (examples: "THE METABOLIC INFERNO", "HEART RATE HAVOC", "CONDITIONING CHAOS")
- Score Type: "For Time" or "AMRAP" or "Intervals" or "Score Rounds"
- Duration: 20-25 min (majority of workout time)
- CRITICAL: MUST include 3-5 movements (varies by format):
  * HIIT Intervals: 3-4 movements with work:rest (30:30, 40:20, Tabata 20:10)
  * Circuit: 4-5 movements, 3-4 rounds for time
  * AMRAP: 3-4 movements, maximum rounds in set time
  * Mix cardio + functional movements (Burpees, KB Swings, Box Jumps, Row, Bike)
- **MANDATORY**: ALL cardio MUST include distance/calories (e.g., "500m Row", "400m Run", "15 Cal Bike"), ALL weighted movements MUST include M/F weight (e.g., "KB Swing @ 24/16kg", "Wall Ball @ 20/14lb")
- Format example:
  * "AMRAP 20: 15 Burpees, 20 KB Swing @ 24/16kg, 25 Box Jump @ 24/20in, 30 Air Squats"
  * "4 Rounds For Time: 400m Run, 20 Burpees, 30 Wall Ball @ 20/14lb"
- Coaching cues: Brief intensity guidance (e.g., "Push hard during work intervals, recover fully during rest. Scale: Reduce intensity or extend rest periods.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Active Recovery"
- Duration: 5 min
- MUST include 3-4 exercises: Easy movement, stretching, breathing exercises
- Example: Easy Walk 2 min, Cat-Cow 10 reps, Child's Pose 1 min, Deep Breathing 2 min
- Coaching cues: "Bring heart rate down safely. Scale: Based on recovery needs."

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
- MUST include 4-5 exercises: Joint mobility, wrist prep, shoulder activation, scapular work
- Example: Wrist Circles 20, Scap Pull-Up 10, Hollow Hold 30 sec, Arch Hold 30 sec, Cat-Cow 10 reps
- Coaching cues: "Prepare joints for bodyweight loading. Scale: Adjust range of motion based on mobility."

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
- Coaching cues: Brief movement quality focus (e.g., "Prioritize strict form and full range of motion on all movements. Scale: Use bands, negatives, or reduce volume while maintaining quality.")

SECTION 3 - COOL-DOWN (no creative title):
- Title: "Cool Down" or "Recovery"
- Duration: 5 min
- MUST include 3-4 exercises: Stretching, mobility work, relaxation
- Example: Shoulder Stretch 1 min each, Pike Stretch 2 min, Wrist Stretch 1 min, Deep Breathing 1 min
- Coaching cues: "Focus on flexibility and recovery. Scale: Based on comfort level."

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
  // Structured outputs need more time than regular JSON generation
  const timeoutMs = 45000; // 45 second timeout for structured outputs
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('OpenAI request timed out after 45s')), timeoutMs);
  });

  let response;
  try {
    response = await Promise.race([
      openai.chat.completions.create({
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