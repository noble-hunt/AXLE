import OpenAI from "openai";
import type { WorkoutRequest, GeneratedWorkout, WorkoutSet } from "../shared/schema";
import { Category } from "../shared/schema";
import { generatedWorkoutSchema } from "../shared/schema";
import { generatePremiumWorkout, computeHardness } from "./ai/generators/premium";
import type { WorkoutGenerationRequest } from "./ai/generateWorkout";

// Using gpt-4o model for reliable workout generation. Do not change this unless explicitly requested by the user
const apiKey = process.env.OPENAI_API_KEY || process.env.MODEL_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

// Force premium generator for CrossFit/HIIT and equipped workouts (default: true)
const FORCE_PREMIUM = process.env.HOBH_FORCE_PREMIUM?.toLowerCase() !== 'false';

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
function addHeaderSet(sets: any[], title: string, mins: number) {
  sets.push({
    id: `hdr-${Math.random().toString(36).slice(2, 8)}`,
    exercise: title,
    duration: Math.round(mins * 60),
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
      // Add _source tag and default duration for warm-up items
      const lastItem = sets[sets.length - 1];
      lastItem._source = 'warmup';
      lastItem.duration = Math.round((wu.time_min || 6) * 60 / Math.max(1, (wu.items || []).length));
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

export async function generateWorkout(request: EnhancedWorkoutRequest): Promise<GeneratedWorkout> {
  console.log('Generating workout with enhanced context:', {
    category: request.category,
    duration: request.duration,
    intensity: request.intensity,
    prCount: request.recentPRs?.length || 0,
    workoutCount: request.lastWorkouts?.length || 0,
    hasReport: !!request.todaysReport
  });

  // If no API key available, fall back to mock immediately
  if (!openai) {
    console.log('No OpenAI API key available, using enhanced mock workout');
    const mockResult = generateMockWorkout(request) as any;
    mockResult.meta = {
      ...mockResult.meta,
      generator: 'mock',
      acceptance: {},
      seed: (request as any).seed || Math.random().toString(16).slice(2, 10)
    };
    return mockResult;
  }

  // ===== HOBH: Style resolver for new workout focuses =====
  function resolveStyle(goal: string) {
    const g = (goal || '').toLowerCase();
    if (['crossfit', 'mixed'].includes(g))           return { engine: 'premium', style: 'crossfit' };
    if (g === 'olympic_weightlifting')               return { engine: 'premium', style: 'olympic_weightlifting' };
    if (g === 'powerlifting')                        return { engine: 'premium', style: 'powerlifting' };
    if (g === 'bb_full_body')                        return { engine: 'premium', style: 'bb_full_body' };
    if (g === 'bb_upper')                            return { engine: 'premium', style: 'bb_upper' };
    if (g === 'bb_lower')                            return { engine: 'premium', style: 'bb_lower' };
    if (g === 'aerobic' || g === 'cardio')           return { engine: 'premium', style: 'aerobic' };
    if (g === 'gymnastics')                          return { engine: 'premium', style: 'gymnastics' };
    if (g === 'mobility')                            return { engine: 'premium', style: 'mobility' };
    if (['strength', 'conditioning', 'endurance'].includes(g)) return { engine: 'premium', style: g };
    return { engine: 'simple', style: g };
  }

  // ===== HOBH: generator selection (forced premium for CF/HIIT or any DB/KB/BB) =====
  const goalStr = String((request as any).goal || (request as any).focus || '').toLowerCase();
  const { engine, style } = resolveStyle(goalStr);
  (request as any).style = style;  // attach for downstream (premium generator)
  console.log(`🎨 Style resolved: goal="${goalStr}" → engine="${engine}", style="${style}"`);
  
  const hasLoadEq = ((request as any).equipment || []).some((e: string) => /(barbell|dumbbell|kettlebell)/i.test(e));
  const wantsPremium = engine === 'premium' || hasLoadEq;

  let generatorUsed: 'premium'|'simple'|'mock' = 'premium';
  let result: any;

  try {
    if (wantsPremium) {
      // Try premium generator
      const equipment = (request as any).equipment || ['barbell', 'dumbbell', 'kettlebell', 'bike', 'rower'];
      console.log('🎯 Using premium workout generator with warm-up/cool-down');
      const premiumRequest: WorkoutGenerationRequest = {
        category: request.category,
        duration: request.duration,
        intensity: request.intensity,
        context: {
          yesterday: request.lastWorkouts?.[0] ? {
            category: request.lastWorkouts[0].category,
            intensity: request.lastWorkouts[0].intensity
          } : undefined,
          health_snapshot: request.todaysReport ? {
            hrv: undefined,
            resting_hr: undefined,
            sleep_score: request.todaysReport.sleep * 10,
            stress_flag: request.todaysReport.stress > 7
          } : undefined,
          equipment,
          constraints: [],
          goals: ['general_fitness'],
          focus: (request as any).style || (request as any).focus,
          categories_for_mixed: (request as any).categories_for_mixed
        }
      };
      
      const premiumWorkout = await generatePremiumWorkout(premiumRequest, (request as any).seed);
      
      // Apply intensity upgrader (post-generation, pre-conversion)
      const readiness = { sleep_score: request.todaysReport?.sleep ? request.todaysReport.sleep * 10 : undefined };
      console.log('🔧 Running upgradeIntensity with equipment:', equipment, 'readiness:', readiness);
      const upgradedWorkout = upgradeIntensity(premiumWorkout, equipment, readiness);
      console.log('✅ Intensity upgrade complete. Hardness:', upgradedWorkout.variety_score, 'hardness_ok:', upgradedWorkout.acceptance_flags?.hardness_ok);
      
      result = convertPremiumToGenerated(upgradedWorkout);
      // Bubble meta to top-level
      result.meta = upgradedWorkout.meta || result.meta || {};
    } else {
      generatorUsed = 'simple';
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
      console.log('AI generated workout:', aiResponse);
      
      // Transform AI response to match GeneratedWorkout schema
      const workoutData = {
        name: aiResponse.title || `${request.category} Workout`,
        category: request.category,
        description: aiResponse.notes || `A ${request.intensity}/10 intensity ${request.category} workout`,
        duration: request.duration,
        intensity: request.intensity,
        sets: aiResponse.sets?.map((set: any, index: number) => {
          // Improved exercise labeling for better UI display
          let exerciseName = `Exercise ${index + 1}`;
          if (set.description) {
            const desc = set.description.toLowerCase();
            if (desc.includes('warm-up') || desc.includes('warm up')) {
              exerciseName = 'Warm-up';
            } else if (desc.includes('metcon') && desc.includes('rx+')) {
              exerciseName = 'Metcon (Rx+)';
            } else if (desc.includes('metcon') && desc.includes('rx')) {
              exerciseName = 'Metcon (Rx)';
            } else if (desc.includes('metcon')) {
              exerciseName = 'Metcon';
            } else if (desc.includes('cool') || desc.includes('stretch')) {
              exerciseName = 'Cool Down';
            } else {
              // Extract first meaningful word, avoiding common prefixes
              const words = set.description.split(' ').filter((word: string) => 
                word.length > 2 && !['the', 'and', 'for', 'with'].includes(word.toLowerCase())
              );
              exerciseName = words[0] || `Exercise ${index + 1}`;
            }
          }
          
          return {
            id: `ai-set-${Date.now()}-${index}`,
            exercise: exerciseName,
            weight: set.target?.weightKg ? Math.round(set.target.weightKg * 2.205) : undefined, // Convert kg to lbs
            reps: set.target?.reps || undefined,
            duration: set.target?.timeSec || undefined,
            distance: set.target?.distanceM || undefined,
            restTime: request.intensity >= 7 ? 60 : 90,
            notes: set.description || `Perform with ${request.intensity}/10 intensity`
          };
        }) || []
      };

      // Validate against schema
      const validation = generatedWorkoutSchema.safeParse(workoutData);
      
      if (!validation.success) {
        console.error('AI response validation failed:', validation.error.issues);
        throw new Error('Validation failed');
      }
      
      result = validation.data;
    }
  } catch (err) {
    try { generatorUsed = 'simple'; result = await generateSimpleFallback(request); }
    catch (err2) { generatorUsed = 'mock'; result = generateMockWorkout(request); }
  }

  // attach meta/trace (seed, acceptance flags, generator)
  result.meta = {
    ...(result.meta || {}),
    generator: generatorUsed,
    acceptance: result.acceptance_flags || {},
    seed: (request as any).seed || result.meta?.seed || Math.random().toString(16).slice(2, 10)
  };

  console.log('HOBH: generator=%s seed=%s acceptance=%j',
    result.meta.generator, result.meta.seed, result.meta.acceptance);

  return result;
  // ===== END selection =====
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