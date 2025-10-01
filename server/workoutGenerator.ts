import OpenAI from "openai";
import type { WorkoutRequest, GeneratedWorkout, WorkoutSet } from "../shared/schema";
import { Category } from "../shared/schema";
import { generatedWorkoutSchema } from "../shared/schema";
import { generatePremiumWorkout } from "./ai/generators/premium";
import type { WorkoutGenerationRequest } from "./ai/generateWorkout";

// Using gpt-4o model for reliable workout generation. Do not change this unless explicitly requested by the user
const apiKey = process.env.OPENAI_API_KEY || process.env.MODEL_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

// Force premium generator for CrossFit/HIIT and equipped workouts (default: true)
const FORCE_PREMIUM = process.env.HOBH_FORCE_PREMIUM !== 'false';

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

// Determine if premium generator should be forced
function shouldForcePremium(request: EnhancedWorkoutRequest, equipment?: string[]): boolean {
  if (!FORCE_PREMIUM) return false;
  
  // Force premium for CrossFit and HIIT
  const category = request.category.toLowerCase();
  if (category.includes('crossfit') || category.includes('hiit')) {
    return true;
  }
  
  // Force premium if barbell, dumbbell, or kettlebell equipment available
  const equipmentList = equipment || [];
  const hasLoadedEquipment = equipmentList.some(eq => 
    eq.toLowerCase().includes('barbell') || 
    eq.toLowerCase().includes('dumbbell') || 
    eq.toLowerCase().includes('kettlebell')
  );
  
  return hasLoadedEquipment;
}

// Convert premium workout format to GeneratedWorkout format with meta
function convertPremiumToGenerated(premiumWorkout: any, request: EnhancedWorkoutRequest): GeneratedWorkout & { meta?: any } {
  const sets: WorkoutSet[] = [];
  
  // Convert each block to sets
  premiumWorkout.blocks.forEach((block: any, blockIndex: number) => {
    block.items.forEach((item: any, itemIndex: number) => {
      sets.push({
        id: `premium-${blockIndex}-${itemIndex}-${Date.now()}`,
        exercise: `${block.title}: ${item.exercise}`,
        weight: undefined,
        reps: typeof item.scheme.reps === 'number' ? item.scheme.reps : undefined,
        duration: item.scheme.rest_s || undefined,
        distance: undefined,
        restTime: item.scheme.rest_s || (request.intensity >= 7 ? 60 : 90),
        notes: `${block.kind.toUpperCase()} - ${item.notes}\n${block.coach_notes.join(' ')}`
      });
    });
  });

  return {
    name: premiumWorkout.title,
    category: request.category,
    description: `Premium ${premiumWorkout.focus} workout with warm-up and cool-down. ${premiumWorkout.blocks.length} blocks total.`,
    duration: premiumWorkout.duration_min,
    intensity: request.intensity,
    sets,
    meta: {
      generator: 'premium' as const,
      acceptance: premiumWorkout.acceptance_flags || {}
    }
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
    return generateMockWorkout(request);
  }

  // Extract equipment from request (if available in context)
  const equipment = (request as any).equipment || ['barbell', 'dumbbell', 'kettlebell', 'bike', 'rower'];
  const forcePremium = shouldForcePremium(request, equipment);
  
  console.log(`🎯 Force Premium: ${forcePremium} (category: ${request.category}, equipment: ${equipment.join(', ')})`);

  // Try premium generator first (with warm-up and cool-down)
  try {
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
        goals: ['general_fitness']
      }
    };
    
    const premiumWorkout = await generatePremiumWorkout(premiumRequest);
    
    // Convert premium format to GeneratedWorkout format
    return convertPremiumToGenerated(premiumWorkout, request);
  } catch (premiumError) {
    console.warn('Premium generator failed:', premiumError);
    
    // If premium is forced, skip simple generator and go straight to mock
    if (forcePremium) {
      console.warn('⚠️ Premium forced but failed - falling back to mock workout');
      return generateMockWorkout(request, 'premium-failed');
    }
    
    console.warn('Falling back to standard generator');
  }

  // Fallback to original prompt-based generator (only if not forced premium)
  const prompt = createPromptTemplate(request);

  try {
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
    
    if (validation.success) {
      return {
        ...validation.data,
        meta: {
          generator: 'simple' as const,
          acceptance: {}
        }
      } as any;
    } else {
      console.error('AI response validation failed:', validation.error.issues);
      console.log('Falling back to mock workout due to validation failure');
      return generateMockWorkout(request, 'validation-failed');
    }

  } catch (error: any) {
    console.error('OpenAI generation error:', error);
    
    // Fallback to mock workout if OpenAI fails
    console.log('Falling back to mock workout generation');
    return generateMockWorkout(request, 'simple-failed');
  }
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