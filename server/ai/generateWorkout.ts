import OpenAI from 'openai';
import { WorkoutSchema, buildUserContextString, intensityGuidelines } from '../../client/src/ai/schemas';
import { parseAndValidate } from '../../client/src/ai/json';
import type { WorkoutRequest } from '@shared/schema';

// Initialize OpenAI client
const apiKey = process.env.OPENAI_API_KEY || process.env.MODEL_API_KEY;
const openai = apiKey ? new OpenAI({ 
  apiKey,
  dangerouslyAllowBrowser: process.env.NODE_ENV === 'test' 
}) : null;

// Extended request interface with user context
export interface WorkoutGenerationContext {
  yesterday?: {
    category?: string;
    duration?: number;
    intensity?: number;
    type?: string;
    movements?: string[];
  };
  week_summary?: {
    category_counts?: Record<string, number>;
    total_volume?: number;
    last_heavy_lift?: string;
  };
  month_summary?: {
    category_counts?: Record<string, number>;
    total_volume?: number;
  };
  health_snapshot?: {
    hrv?: number;
    resting_hr?: number;
    sleep_score?: number;
    stress_flag?: boolean;
  };
  equipment?: string[];
  constraints?: string[];
  goals?: string[];
  seed?: string;
}

export interface WorkoutGenerationRequest extends WorkoutRequest {
  context?: WorkoutGenerationContext;
}

export interface WorkoutGenerationResult {
  workout: any; // Will match our WorkoutSchema
  rationale: string;
  estimated_rpe: number;
  timecaps?: string[];
  equipment_list: string[];
  hazards: string[];
}

// Create comprehensive system prompt
function createSystemPrompt(): string {
  return `You are AXLE, a certified coach. Create a single safe, effective workout tailored to the user.

OBJECTIVES:
- Quality programming with progressive overload
- Movement balance and variation
- Recovery awareness and safety
- Precise adherence to user constraints

RECOVERY LOGIC:
- If health status shows "caution" indicators (low HRV <30, high stress, poor sleep <60), automatically reduce intensity by 1-2 points and bias toward aerobic Zone 2 or mobility work
- If yesterday included heavy legs or high eccentric volume, avoid heavy leg strength today; choose skill work, upper body, aerobic, or mobility instead
- If the last 7 days overweight one category (e.g., >60% strength), diversify today with gymnastics, aerobic, or skill work

PROGRAMMING LOGIC:
- Map intensity_1_to_10 to category-specific effort levels
- Include warmup blocks, main training blocks, and cooldown
- Prefer quality over quantity - better to do less well than more poorly
- Stay within duration_min ±10% (blocks must sum to target duration ±10%)
- For CrossFit/HIIT: use clear time-caps and appropriate RPE scaling
- For aerobic work: set precise paces, zones, or heart rate targets
- For Powerlifting/Olympic: include proper rest intervals and %1RM guidance

MOVEMENT RESTRICTIONS BY CATEGORY (CRITICAL - USE ONLY THESE):

CrossFit/HIIT: air_squat, back_squat, front_squat, overhead_squat, thruster, deadlift, sumo_deadlift, romanian_deadlift, press, push_press, push_jerk, split_jerk, pull_up, chin_up, chest_to_bar, muscle_up, push_up, handstand_push_up, burpee, box_jump, kettlebell_swing, kettlebell_snatch, kettlebell_clean, rowing, running, assault_bike, ski_erg, wall_ball, ball_slam, rope_climb, double_under

Powerlifting: back_squat, front_squat, pause_squat, box_squat, conventional_deadlift, sumo_deadlift, deficit_deadlift, rack_pull, bench_press, close_grip_bench, incline_bench, pause_bench, overhead_press, push_press, pin_press, barbell_row, pendlay_row, chest_supported_row, good_morning, stiff_leg_deadlift, romanian_deadlift

Olympic: snatch, clean_and_jerk, clean, jerk, power_snatch, power_clean, hang_snatch, hang_clean, snatch_pull, clean_pull, snatch_deadlift, clean_deadlift, overhead_squat, front_squat, back_squat, push_press, push_jerk, split_jerk, squat_jerk

Bodybuilding_Upper/Lower/Full: bench_press, incline_bench, decline_bench, dumbbell_press, shoulder_press, lateral_raise, rear_delt_fly, upright_row, pull_up, lat_pulldown, barbell_row, dumbbell_row, cable_row, bicep_curl, hammer_curl, preacher_curl, cable_curl, tricep_extension, close_grip_bench, dips, cable_pushdown, squat, leg_press, bulgarian_split_squat, walking_lunge, romanian_deadlift, leg_curl, stiff_leg_deadlift, calf_raise, seated_calf_raise, leg_extension, deadlift, thruster, clean_and_press, turkish_getup

Gymnastics: handstand, handstand_walk, handstand_push_up, muscle_up, ring_muscle_up, pull_up, chin_up, dips, ring_dips, push_up, pike_push_up, l_sit, v_sit, tuck_planche, front_lever, back_lever, human_flag, pistol_squat, rope_climb, pegboard_climb

Aerobic: running, jogging, walking, sprints, cycling, stationary_bike, assault_bike, rowing, swimming, elliptical, stair_climber, ski_erg, versa_climber

SAFETY REQUIREMENTS:
- Avoid contraindicated movements based on injuries/constraints
- Match available equipment exactly
- Respect all user limitations and preferences
- Never program unsafe movement combinations
- Consider fatigue from recent training
- ONLY use movements from the category's approved list above

OUTPUT REQUIREMENTS:
- Valid JSON only (no explanation text)
- Must conform exactly to the provided JSON Schema
- Include a brief "rationale" explaining why this fits the user's history & health snapshot
- Ensure all movements are appropriate for the declared category
- All block durations must sum to within ±10% of target duration
- Each movement MUST have movement.category matching the workout category`;
}

// Category-specific few-shot examples
function getFewShotExamples(): string {
  return `
FEW-SHOT EXAMPLES:

CrossFit/HIIT Sample:
{
  "name": "Engine Builder",
  "category": "CrossFit/HIIT",
  "format": "amrap",
  "duration_min": 20,
  "intensity_1_to_10": 7,
  "description": "Mixed modal workout focusing on aerobic capacity",
  "blocks": [
    {
      "name": "Warmup",
      "type": "warmup",
      "estimated_duration_min": 8,
      "warmup_steps": [
        {
          "movement": "light_rowing",
          "duration_seconds": 300,
          "intensity_percent": 60,
          "notes": "Build pace gradually"
        }
      ]
    },
    {
      "name": "Main AMRAP",
      "type": "main",
      "estimated_duration_min": 12,
      "format": "amrap",
      "sets": [
        {
          "rounds": 1,
          "time_cap_seconds": 720,
          "movements": [
            {
              "name": "rowing",
              "category": "CrossFit/HIIT",
              "distance_meters": 250
            },
            {
              "name": "air_squat",
              "category": "CrossFit/HIIT", 
              "reps": 15
            },
            {
              "name": "push_up",
              "category": "CrossFit/HIIT",
              "reps": 10
            }
          ]
        }
      ]
    }
  ],
  "rationale": "Aerobic-focused AMRAP with movement variety"
}

Powerlifting Sample:
{
  "name": "Heavy Squat Focus",
  "category": "Powerlifting",
  "format": "complex",
  "duration_min": 60,
  "intensity_1_to_10": 8,
  "description": "Heavy back squat with accessory work",
  "blocks": [
    {
      "name": "Movement Prep", 
      "type": "warmup",
      "estimated_duration_min": 15,
      "warmup_steps": [
        {
          "movement": "bodyweight_squat",
          "duration_seconds": 600,
          "intensity_percent": 40
        }
      ]
    },
    {
      "name": "Heavy Squats",
      "type": "main",
      "estimated_duration_min": 35,
      "format": "complex",
      "sets": [
        {
          "rounds": 5,
          "movements": [
            {
              "name": "back_squat",
              "category": "Powerlifting",
              "sets": 1,
              "reps": 3,
              "weight_percent_1rm": 85,
              "rest_seconds": 180
            }
          ]
        }
      ]
    },
    {
      "name": "Recovery",
      "type": "cooldown", 
      "estimated_duration_min": 10,
      "cooldown_steps": [
        {
          "movement": "hip_flexor_stretch",
          "duration_seconds": 600
        }
      ]
    }
  ],
  "rationale": "Heavy squat work at 85% for strength development"
}

Aerobic Sample:
{
  "name": "Zone 2 Base Build",
  "category": "Aerobic",
  "format": "steady",
  "duration_min": 45,
  "intensity_1_to_10": 4,
  "description": "Aerobic base building session",
  "blocks": [
    {
      "name": "Warmup",
      "type": "warmup", 
      "estimated_duration_min": 10,
      "warmup_steps": [
        {
          "movement": "easy_walk",
          "duration_seconds": 600,
          "intensity_percent": 50
        }
      ]
    },
    {
      "name": "Main Set",
      "type": "main",
      "estimated_duration_min": 30,
      "format": "steady",
      "sets": [
        {
          "rounds": 1,
          "movements": [
            {
              "name": "running",
              "category": "Aerobic",
              "duration_seconds": 1800,
              "notes": "Zone 2 pace, conversational effort"
            }
          ]
        }
      ]
    },
    {
      "name": "Cooldown",
      "type": "cooldown",
      "estimated_duration_min": 5,
      "cooldown_steps": [
        {
          "movement": "walking",
          "duration_seconds": 300
        }
      ]
    }
  ],
  "rationale": "Zone 2 aerobic development for base fitness"
}`;
}

// Build user prompt with context
function buildUserPrompt(request: WorkoutGenerationRequest): string {
  const { category, duration, intensity, context = {} } = request;
  
  const userContext = buildUserContextString({
    yesterday: context.yesterday,
    week_summary: context.week_summary,
    month_summary: context.month_summary,
    health_snapshot: context.health_snapshot,
    equipment: context.equipment || [],
    constraints: context.constraints || []
  });

  const guidelines = intensityGuidelines(category, intensity);

  const schema = `{
  "name": "string (required)",
  "category": "CrossFit/HIIT | Powerlifting | Olympic | Bodybuilding_Upper | Bodybuilding_Lower | Bodybuilding_Full | Gymnastics | Aerobic",
  "format": "emom | amrap | for_time | intervals | steady | complex | superset | giantset", 
  "duration_min": "number (10-120)",
  "intensity_1_to_10": "number (1-10)",
  "description": "string (min 10 chars)",
  "blocks": [
    {
      "name": "string",
      "type": "warmup | main | accessory | cooldown",
      "estimated_duration_min": "number (1-60)",
      "format": "optional format enum",
      "sets": [
        {
          "rounds": "number (1-50)",
          "movements": [
            {
              "name": "string (must be in category whitelist)",
              "category": "must match workout category",
              "reps": "optional number (1-500)",
              "sets": "optional number (1-20)",
              "weight_kg": "optional number (0-500)",
              "weight_percent_1rm": "optional number (0-120)",
              "duration_seconds": "optional number (1-7200)",
              "distance_meters": "optional number (0-50000)",
              "rest_seconds": "optional number (0-600)",
              "notes": "optional string"
            }
          ],
          "rest_between_rounds_seconds": "optional number (0-600)",
          "time_cap_seconds": "optional number (30-7200)"
        }
      ],
      "warmup_steps": "array for warmup blocks",
      "cooldown_steps": "array for cooldown blocks"
    }
  ],
  "equipment_needed": "optional string array",
  "coaching_notes": "optional string"
}`;

  return `WORKOUT REQUEST:
Category: ${category}
Duration: ${duration} minutes
Intensity: ${intensity}/10

USER CONTEXT:
${userContext}

INTENSITY GUIDELINES:
${guidelines}

EQUIPMENT AVAILABLE: ${context.equipment?.join(', ') || 'Standard gym equipment'}
CONSTRAINTS: ${context.constraints?.join(', ') || 'None specified'}
GOALS: ${context.goals?.join(', ') || 'General fitness'}

${getFewShotExamples()}

JSON SCHEMA (answer must conform exactly):
${schema}

RESPOND WITH ONLY JSON. Do not include markdown fences or explanatory text.`;
}

// Adjust request based on recovery logic
function applyRecoveryLogic(request: WorkoutGenerationRequest): WorkoutGenerationRequest {
  const adjusted = { ...request };
  const health = request.context?.health_snapshot;
  const yesterday = request.context?.yesterday;
  
  // Health-based adjustments
  if (health) {
    let cautionFlags = 0;
    
    if (health.hrv && health.hrv < 30) cautionFlags++;
    if (health.resting_hr && health.resting_hr > 80) cautionFlags++;
    if (health.sleep_score && health.sleep_score < 60) cautionFlags++;
    if (health.stress_flag) cautionFlags++;
    
    // Reduce intensity if multiple caution flags
    if (cautionFlags >= 2) {
      adjusted.intensity = Math.max(1, adjusted.intensity - 2);
      if (!adjusted.context) adjusted.context = {};
      adjusted.context.constraints = [
        ...(adjusted.context.constraints || []),
        'recovery_focused_due_to_health_markers'
      ];
    } else if (cautionFlags === 1) {
      adjusted.intensity = Math.max(1, adjusted.intensity - 1);
    }
  }
  
  // Yesterday's workout adjustments
  if (yesterday?.type === 'heavy_legs' || 
      (yesterday?.movements && yesterday.movements.some(m => 
        ['squat', 'deadlift', 'lunge'].some(pattern => m.toLowerCase().includes(pattern))
      ))) {
    if (!adjusted.context) adjusted.context = {};
    adjusted.context.constraints = [
      ...(adjusted.context.constraints || []),
      'avoid_heavy_legs_due_to_yesterday'
    ];
  }
  
  return adjusted;
}

// Extract explainable fields from workout
function extractExplainableFields(workout: any): Pick<WorkoutGenerationResult, 'estimated_rpe' | 'timecaps' | 'equipment_list' | 'hazards'> {
  const estimated_rpe = workout.intensity_1_to_10;
  
  const timecaps: string[] = [];
  const equipment_list: string[] = workout.equipment_needed || [];
  const hazards: string[] = [];
  
  // Extract time caps from blocks
  for (const block of workout.blocks || []) {
    if (block.sets) {
      for (const set of block.sets) {
        if (set.time_cap_seconds) {
          timecaps.push(`${Math.round(set.time_cap_seconds / 60)}min time cap`);
        }
      }
    }
  }
  
  // Identify potential hazards
  if (workout.intensity_1_to_10 >= 9) {
    hazards.push('Very high intensity - monitor for fatigue');
  }
  
  for (const block of workout.blocks || []) {
    if (block.sets) {
      for (const set of block.sets) {
        for (const movement of set.movements || []) {
          if (movement.weight_percent_1rm && movement.weight_percent_1rm > 90) {
            hazards.push('Near-maximal loads - ensure proper warmup and spotting');
          }
          if (movement.name?.includes('deadlift') && movement.reps && movement.reps > 8) {
            hazards.push('High rep deadlifts - monitor form closely');
          }
        }
      }
    }
  }
  
  return { estimated_rpe, timecaps, equipment_list, hazards };
}

// Main generation function
export async function generateWorkout(request: WorkoutGenerationRequest): Promise<WorkoutGenerationResult> {
  if (!openai) {
    throw new Error('OpenAI API not configured. Please set OPENAI_API_KEY environment variable.');
  }
  
  // Apply recovery logic adjustments
  const adjustedRequest = applyRecoveryLogic(request);
  
  const systemPrompt = createSystemPrompt();
  const userPrompt = buildUserPrompt(adjustedRequest);
  
  let attempt = 0;
  const maxAttempts = 2;
  
  while (attempt < maxAttempts) {
    let rawResponse = '{}';
    
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: adjustedRequest.context?.seed ? 0.4 : 0.6, // Lower temp with seed for reproducibility
        max_tokens: 2000,
        seed: adjustedRequest.context?.seed ? parseInt(adjustedRequest.context.seed.slice(-8), 16) : undefined
      });
      
      rawResponse = response.choices[0].message.content || '{}';
      
      // Validate against our strict schema
      const workout = parseAndValidate(WorkoutSchema, rawResponse);
      
      // Extract explainable fields
      const explainableFields = extractExplainableFields(workout);
      
      return {
        workout,
        rationale: workout.coaching_notes || `Generated ${workout.category} workout at ${workout.intensity_1_to_10}/10 intensity`,
        ...explainableFields
      };
      
    } catch (error: any) {
      attempt++;
      
      if (attempt < maxAttempts) {
        // Repair attempt
        const errorMessage = error.message || 'Unknown validation error';
        const repairPrompt = `You produced invalid JSON. Here is the error: ${errorMessage}. Return a corrected JSON that fixes ONLY the invalid fields while maintaining the same workout structure and rationale.`;
        
        try {
          const repairResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
              { role: "assistant", content: rawResponse },
              { role: "user", content: repairPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3, // Lower temperature for repair
            max_tokens: 2000
          });
          
          const repairedResponse = repairResponse.choices[0].message.content || '{}';
          const workout = parseAndValidate(WorkoutSchema, repairedResponse);
          const explainableFields = extractExplainableFields(workout);
          
          return {
            workout,
            rationale: workout.coaching_notes || `Generated ${workout.category} workout at ${workout.intensity_1_to_10}/10 intensity`,
            ...explainableFields
          };
          
        } catch (repairError) {
          console.error(`Repair attempt ${attempt} failed:`, repairError);
          continue;
        }
      } else {
        console.error(`Generation failed after ${maxAttempts} attempts:`, error);
        throw new Error(`Failed to generate valid workout: ${error.message}`);
      }
    }
  }
  
  throw new Error('Failed to generate workout after maximum attempts');
}