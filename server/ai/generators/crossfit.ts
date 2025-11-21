/**
 * CrossFit-specific workout generator
 * 
 * Produces workouts that match the exact brand format:
 * - Multi-AMRAP with rest periods OR for-time ladders with time caps
 * - RX weight pairs (95/65#, 20/14#, 24/20")
 * - Movement balance and recovery awareness
 */

import OpenAI from 'openai';
import { WorkoutSchema, type Workout } from '../../../client/src/ai/schemas.js';
import { extractAndValidate } from '../../../client/src/ai/json.js';
import type { WorkoutGenerationRequest } from '../generateWorkout.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.MODEL_API_KEY,
  dangerouslyAllowBrowser: process.env.NODE_ENV === 'test'
});

function createCrossFitSystemPrompt(): string {
  return `You are a CrossFit coach specializing in programming quality WODs. Create authentic CrossFit workouts that follow established patterns and brand format.

CROSSFIT PRINCIPLES:
- Constantly varied functional movements at high intensity
- Balance across 10 fitness domains
- Scale loads and reps appropriately for fitness level
- Time domains: Short (<5min), Medium (5-15min), Long (15-30min)
- Movement patterns: mono-structural, gymnastics, weightlifting

WORKOUT FORMATS (choose ONE):
1. FOR TIME ladder: use "for_time" format with decreasing rep schemes
2. AMRAP: use "amrap" format with fixed time domain
3. EMOM/Intervals: use "intervals" format with work/rest

RX WEIGHT STANDARDS (use kg):
- Thruster: 43kg/29kg (95#/65#)
- Wall Ball: 9kg/6kg (20#/14#) 
- Kettlebell Swing: 24kg/16kg (53#/35#)
- Deadlift: 102kg/70kg (225#/155#) light, 143kg/93kg (315#/205#) heavy
- Box Jump: 61cm/51cm (24"/20")
- Pull-ups: bodyweight or weighted

MOVEMENT BALANCE:
- Include 2-3 movements per workout
- Mix weightlifting + gymnastics + monostructural
- Avoid same muscle group dominance
- Consider grip fatigue and breathing patterns

RECOVERY LOGIC:
- If health shows "caution": reduce intensity 1-2 points, choose lighter movements
- If yesterday was heavy legs: avoid heavy squats/deadlifts today
- If last week >60% one category: diversify with different stimulus

TITLE GENERATION:
- Use fun, memorable names like "Hardy Bacardi Party", "Slap Happy Samurai"
- 2-3 words, catchy and energetic
- Avoid generic names like "CrossFit Workout #1"

OUTPUT JSON SCHEMA (strict adherence):
{
  "name": "string (catchy CrossFit name)",
  "category": "CrossFit/HIIT",
  "format": "amrap|for_time|intervals",
  "duration_min": "number (requested duration)",
  "intensity_1_to_10": "number (requested intensity)", 
  "description": "string (programming rationale)",
  "blocks": [
    {
      "name": "string (block name like 'Warm-up', 'Main WOD', 'Cool Down')",
      "type": "warmup|main|accessory|cooldown",
      "estimated_duration_min": "number (duration for this block)",
      "format": "amrap|for_time|intervals (optional, for main blocks)",
      "sets": [
        {
          "rounds": "number",
          "movements": [
            {
              "name": "string (exact movement name from whitelist)",
              "category": "CrossFit/HIIT",
              "reps": "number (optional)",
              "weight_kg": "number (optional)",
              "duration_seconds": "number (optional)",
              "rest_seconds": "number (optional)",
              "notes": "string (optional)"
            }
          ],
          "rest_between_rounds_seconds": "number (optional)",
          "time_cap_seconds": "number (optional)"
        }
      ]
    }
  ],
  "equipment_needed": ["array of strings"],
  "coaching_notes": "string (optional)"
}`;
}

function getCrossFitFewShots(): string {
  return `
FEW-SHOT EXAMPLES:

Example 1 - For Time Ladder:
{
  "name": "Thunder Road",
  "category": "CrossFit/HIIT",
  "format": "for_time", 
  "duration_min": 20,
  "intensity_1_to_10": 9,
  "description": "High-intensity combination work with classic CrossFit movements. Scale loads and reps as needed.",
  "blocks": [
    {
      "name": "Warm-up",
      "type": "warmup",
      "estimated_duration_min": 3,
      "warmup_steps": [
        {
          "movement": "light_jog",
          "duration_seconds": 120,
          "intensity_percent": 50
        },
        {
          "movement": "air_squat",
          "duration_seconds": 60,
          "intensity_percent": 40
        }
      ]
    },
    {
      "name": "Main WOD",
      "type": "main",
      "estimated_duration_min": 15,
      "format": "for_time",
      "sets": [
        {
          "rounds": 4,
          "movements": [
            {
              "name": "thruster",
              "category": "CrossFit/HIIT",
              "reps": 21,
              "weight_kg": 43,
              "notes": "Reduce reps: 21-15-9-6"
            },
            {
              "name": "pull_up",
              "category": "CrossFit/HIIT", 
              "reps": 21,
              "notes": "Reduce reps: 21-15-9-6"
            }
          ],
          "time_cap_seconds": 1020
        }
      ]
    },
    {
      "name": "Cool Down",
      "type": "cooldown",
      "estimated_duration_min": 2,
      "cooldown_steps": [
        {
          "movement": "walking",
          "duration_seconds": 120
        }
      ]
    }
  ],
  "equipment_needed": ["barbell", "pull_up_bar"],
  "coaching_notes": "Scale thruster weight as needed. Band-assisted pull-ups for beginners."
}

Example 2 - AMRAP:
{
  "name": "Electric Avenue", 
  "category": "CrossFit/HIIT",
  "format": "amrap",
  "duration_min": 20,
  "intensity_1_to_10": 8,
  "description": "Mixed modal workout combining strength, cardio, and gymnastics elements.",
  "blocks": [
    {
      "name": "Warm-up",
      "type": "warmup", 
      "estimated_duration_min": 3,
      "warmup_steps": [
        {
          "movement": "rowing",
          "duration_seconds": 180,
          "intensity_percent": 60
        }
      ]
    },
    {
      "name": "Main AMRAP",
      "type": "main",
      "estimated_duration_min": 15,
      "format": "amrap",
      "sets": [
        {
          "rounds": 999,
          "movements": [
            {
              "name": "wall_ball",
              "category": "CrossFit/HIIT",
              "reps": 15,
              "weight_kg": 9
            },
            {
              "name": "box_jump",
              "category": "CrossFit/HIIT",
              "reps": 12
            },
            {
              "name": "burpee",
              "category": "CrossFit/HIIT",
              "reps": 9
            }
          ],
          "time_cap_seconds": 900
        }
      ]
    },
    {
      "name": "Cool Down",
      "type": "cooldown",
      "estimated_duration_min": 2,
      "cooldown_steps": [
        {
          "movement": "stretching",
          "duration_seconds": 120
        }
      ]
    }
  ],
  "equipment_needed": ["wall_ball", "box", "floor"],
  "coaching_notes": "Count total rounds completed in 15 minutes."
}`;
}

// Helper function to normalize and repair common validation issues
function normalizeWorkout(workout: any): any {
  const normalized = { ...workout };
  
  // Fix category if needed
  if (normalized.category === "CrossFit") {
    normalized.category = "CrossFit/HIIT";
  }
  
  // Ensure all required top-level fields exist
  if (!normalized.name) normalized.name = "CrossFit Workout";
  if (!normalized.description) normalized.description = "High-intensity functional fitness workout";
  if (!normalized.equipment_needed) normalized.equipment_needed = ["barbell", "pull_up_bar"];
  
  // Fix block types and movement categories
  if (normalized.blocks) {
    normalized.blocks = normalized.blocks.map((block: any) => {
      const fixedBlock = { ...block };
      
      // Fix block type enum values more comprehensively
      const validTypes = ["warmup", "main", "accessory", "cooldown"];
      if (!validTypes.includes(fixedBlock.type)) {
        // Map common CrossFit types to valid enum values
        if (fixedBlock.type?.includes("amrap") || fixedBlock.type?.includes("cf_amrap")) {
          fixedBlock.type = "main";
        } else if (fixedBlock.type?.includes("for_time") || fixedBlock.type?.includes("cf_for_time")) {
          fixedBlock.type = "main";
        } else if (fixedBlock.type?.includes("interval") || fixedBlock.type?.includes("cf_interval")) {
          fixedBlock.type = "main";
        } else if (fixedBlock.type?.includes("strength") || fixedBlock.type?.includes("metcon")) {
          fixedBlock.type = "main";
        } else {
          // Default fallback
          fixedBlock.type = "main";
        }
      }
      
      // Ensure valid block types
      if (!["warmup", "main", "accessory", "cooldown"].includes(fixedBlock.type)) {
        if (fixedBlock.name?.toLowerCase().includes("warm")) {
          fixedBlock.type = "warmup";
        } else if (fixedBlock.name?.toLowerCase().includes("cool")) {
          fixedBlock.type = "cooldown";
        } else {
          fixedBlock.type = "main";
        }
      }
      
      // Fix movement categories in sets
      if (fixedBlock.sets) {
        fixedBlock.sets = fixedBlock.sets.map((set: any) => {
          const fixedSet = { ...set };
          if (fixedSet.movements) {
            fixedSet.movements = fixedSet.movements.map((movement: any) => {
              const fixedMovement = { ...movement };
              // Fix various category format issues
              if (!fixedMovement.category || 
                  fixedMovement.category !== "CrossFit/HIIT" ||
                  fixedMovement.category === "CrossFit" ||
                  fixedMovement.category === "HIIT") {
                fixedMovement.category = "CrossFit/HIIT";
              }
              return fixedMovement;
            });
          }
          return fixedSet;
        });
      }
      
      return fixedBlock;
    });
  }
  
  return normalized;
}

export async function generateCrossFitWorkout(request: WorkoutGenerationRequest): Promise<Workout> {
  try {
    // Build user prompt
    const userPrompt = `
GENERATE CROSSFIT WORKOUT:
Category: CrossFit/HIIT
Duration: ${request.duration} minutes  
Intensity: ${request.intensity}/10
${request.context?.yesterday ? `Yesterday: ${request.context.yesterday.category} - ${request.context.yesterday.intensity}/10 intensity` : ''}
${request.context?.health_snapshot ? `Health: ${JSON.stringify(request.context.health_snapshot)}` : ''}
${request.context?.equipment ? `Equipment: ${request.context.equipment.join(', ')}` : 'Equipment: Full gym'}
${request.context?.constraints ? `Constraints: ${request.context.constraints.join(', ')}` : ''}

Return ONLY valid JSON matching the schema. No explanations.`;

    // Generate workout
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: createCrossFitSystemPrompt() },
        { role: "system", content: getCrossFitFewShots() },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 1500
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content generated');
    }

    // Parse, normalize, and validate
    try {
      let workout = extractAndValidate(WorkoutSchema, content);
      workout = normalizeWorkout(workout);
      
      // Re-validate after normalization
      const finalWorkout = WorkoutSchema.parse(workout);
      return finalWorkout;
    } catch (validationError) {
      // Attempt repair
      const errorMessage = validationError instanceof Error ? validationError.message : String(validationError);
      const repairPrompt = `The generated CrossFit workout had validation errors: ${errorMessage}

Original JSON:
${content}

Fix the errors and return valid JSON matching the schema. Focus on:
- Correct block structure (cf_for_time, cf_amrap, or cf_interval)
- Valid movement names from CrossFit category
- RX weight standards 
- Duration matching ±25% of target (${request.duration} min)

Return ONLY the corrected JSON:`;

      const repairCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a JSON repair specialist. Return ONLY valid JSON." },
          { role: "user", content: repairPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1500
      });

      const repairedContent = repairCompletion.choices[0]?.message?.content;
      if (!repairedContent) {
        throw new Error('Failed to repair workout');
      }

      try {
        const repairedWorkout = extractAndValidate(WorkoutSchema, repairedContent);
        return repairedWorkout;
      } catch (repairError) {
        const repairErrorMessage = repairError instanceof Error ? repairError.message : String(repairError);
        throw new Error(`Validation failed after repair: ${repairErrorMessage}`);
      }
    }
    
  } catch (error) {
    console.error('CrossFit generation failed:', error);
    throw error;
  }
}