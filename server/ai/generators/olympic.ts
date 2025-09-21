/**
 * Olympic weightlifting-specific workout generator
 * 
 * Produces workouts that match Olympic lifting brand format:
 * - A/B/C/D/E section structure
 * - %1RM progressions with ref_1rm_of notation
 * - Complex movements with specific timing/pauses
 * - Proper strength progression patterns
 */

import OpenAI from 'openai';
import { WorkoutSchema, type Workout } from '../../../client/src/ai/schemas';
import { extractAndValidate } from '../../../client/src/ai/json';
import type { WorkoutGenerationRequest } from '../generateWorkout';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.MODEL_API_KEY,
  dangerouslyAllowBrowser: process.env.NODE_ENV === 'test'
});

function createOlympicSystemPrompt(): string {
  return `You are an Olympic weightlifting coach specializing in technical development and strength progression. Create structured training sessions that follow classic Oly programming patterns.

OLYMPIC LIFTING PRINCIPLES:
- Technical mastery before load progression
- Proper warm-up and movement preparation
- Block periodization with clear objectives
- %1RM based loading with reference lifts
- Complex training (combinations)
- Accessory work for weaknesses

SESSION STRUCTURE (use A/B/C/D/E sections in block names):
A. Main snatch work (technique, power, or heavy)
B. Main clean & jerk work (technique, power, or heavy)  
C. Squat variation (back/front, related to main lifts)
D. Pulls or accessory strength
E. Additional accessory or corrective work

%1RM PROGRESSION PATTERNS:
- Technique work: 60-75% of 1RM
- Power development: 70-85% of 1RM  
- Heavy singles: 85-105% of 1RM
- Volume work: 65-80% of 1RM

COMPLEX NOTATION in notes:
- "(1+2+1)" = 1 from floor + 2 from hang + 1 from floor
- "(2+1)" = 2 reps + 1 rep (different positions)
- Use for snatch/clean combinations

INTENSITY GUIDELINES:
- 6/10: Technical work, 65-75%
- 7/10: Power development, 75-85%
- 8/10: Heavy work, 85-95%
- 9/10: Competition prep, 90-105%

RECOVERY LOGIC:
- If health shows "caution": reduce intensity 1-2 points, focus on technique
- If yesterday was heavy legs: lighter squats, more upper body accessory
- Alternate heavy/light days appropriately

TITLE GENERATION:
- Use training-focused names: "Power Development", "Technical Flow", "Competition Prep"
- Can include intensity or focus: "Heavy Singles", "Speed Work"

OUTPUT JSON SCHEMA (strict adherence):
{
  "name": "string (training session name)",
  "category": "Olympic",
  "format": "complex",
  "duration_min": "number (requested duration)",
  "intensity_1_to_10": "number (requested intensity)",
  "description": "string (session objective and focus)",
  "blocks": [
    {
      "name": "string (A. Main Snatch, B. Clean & Jerk, C. Squats, etc)",
      "type": "main|accessory",
      "estimated_duration_min": "number (duration for this block)",
      "sets": [
        {
          "rounds": "number (sets)",
          "movements": [
            {
              "name": "string (exact movement name from Olympic whitelist)",
              "category": "Olympic",
              "reps": "number (1-12)",
              "weight_percent_1rm": "number (60-105, optional)",
              "rest_seconds": "number (120-300, optional)",
              "notes": "string (coaching cues, %1RM reference, complex notation)"
            }
          ]
        }
      ]
    }
  ],
  "equipment_needed": ["barbell", "platform", "squat_rack"],
  "coaching_notes": "string (session focus and progression notes)"
}`;
}

function getOlympicFewShots(): string {
  return `
FEW-SHOT EXAMPLES:

Example 1 - Power Development:
{
  "name": "Power Development",
  "category": "Olympic",
  "format": "complex",
  "duration_min": 60,
  "intensity_1_to_10": 7,
  "description": "Technical session focusing on power development and consistency. Work on speed under the bar.",
  "blocks": [
    {
      "name": "A. Main Snatch",
      "type": "main",
      "estimated_duration_min": 20,
      "sets": [
        {
          "rounds": 6,
          "movements": [
            {
              "name": "snatch",
              "category": "Olympic",
              "reps": 2,
              "weight_percent_1rm": 75,
              "rest_seconds": 180,
              "notes": "Focus on third pull timing at 75% of 1RM Snatch"
            }
          ]
        }
      ]
    },
    {
      "name": "B. Clean & Jerk Complex",
      "type": "main",
      "estimated_duration_min": 20,
      "sets": [
        {
          "rounds": 5,
          "movements": [
            {
              "name": "clean_and_jerk",
              "category": "Olympic",
              "reps": 1,
              "weight_percent_1rm": 70,
              "rest_seconds": 240,
              "notes": "(1+2+1) complex at 70% of 1RM Clean. Pause 2s in front squat bottom"
            }
          ]
        }
      ]
    },
    {
      "name": "C. Back Squat",
      "type": "accessory",
      "estimated_duration_min": 15,
      "sets": [
        {
          "rounds": 4,
          "movements": [
            {
              "name": "back_squat",
              "category": "Olympic",
              "reps": 3,
              "weight_percent_1rm": 80,
              "rest_seconds": 180,
              "notes": "80% of 1RM Back Squat"
            }
          ]
        }
      ]
    },
    {
      "name": "D. Accessory Work",
      "type": "accessory",
      "estimated_duration_min": 5,
      "sets": [
        {
          "rounds": 3,
          "movements": [
            {
              "name": "snatch_pull",
              "category": "Olympic",
              "reps": 5,
              "weight_percent_1rm": 90,
              "notes": "90% of 1RM Snatch. Slow negative"
            },
            {
              "name": "overhead_squat",
              "category": "Olympic",
              "reps": 8,
              "weight_percent_1rm": 60,
              "notes": "60% of 1RM Snatch"
            }
          ]
        }
      ]
    }
  ],
  "equipment_needed": ["barbell", "platform", "squat_rack"],
  "coaching_notes": "Focus on speed under the bar and timing. Technical work with moderate loading."
}

Example 2 - Competition Prep:
{
  "name": "Competition Prep",
  "category": "Olympic",
  "format": "complex",
  "duration_min": 75,
  "intensity_1_to_10": 9,
  "description": "Competition simulation with opener-second-third attempt progression.",
  "blocks": [
    {
      "name": "A. Snatch Openers",
      "type": "main",
      "estimated_duration_min": 30,
      "sets": [
        {
          "rounds": 9,
          "movements": [
            {
              "name": "snatch",
              "category": "Olympic",
              "reps": 1,
              "weight_percent_1rm": 95,
              "rest_seconds": 180,
              "notes": "Work up to competition third attempt at 95% of 1RM Snatch. 3 openers, 3 seconds, 3 thirds."
            }
          ]
        }
      ]
    },
    {
      "name": "B. Clean & Jerk Openers",
      "type": "main",
      "estimated_duration_min": 30,
      "sets": [
        {
          "rounds": 9,
          "movements": [
            {
              "name": "clean_and_jerk",
              "category": "Olympic",
              "reps": 1,
              "weight_percent_1rm": 95,
              "rest_seconds": 180,
              "notes": "Work up to competition third attempt at 95% of 1RM Clean. 3 openers, 3 seconds, 3 thirds."
            }
          ]
        }
      ]
    },
    {
      "name": "C. Recovery Strength",
      "type": "accessory",
      "estimated_duration_min": 15,
      "sets": [
        {
          "rounds": 1,
          "movements": [
            {
              "name": "front_squat",
              "category": "Olympic",
              "reps": 3,
              "weight_percent_1rm": 105,
              "rest_seconds": 240,
              "notes": "105% of 1RM Clean for opener recovery strength"
            }
          ]
        }
      ]
    }
  ],
  "equipment_needed": ["barbell", "platform", "competition_plates"],
  "coaching_notes": "Simulate competition environment. Focus on opener confidence and competition timing."
}`;
}

// Helper function to normalize Olympic workout data
function normalizeOlympicWorkout(workout: any): any {
  const normalized = { ...workout };
  
  // Ensure all required top-level fields exist
  if (!normalized.name) normalized.name = "Olympic Training";
  if (!normalized.description) normalized.description = "Olympic weightlifting technical session";
  if (!normalized.equipment_needed) normalized.equipment_needed = ["barbell", "platform", "squat_rack"];
  
  // Fix block types and movement categories
  if (normalized.blocks) {
    normalized.blocks = normalized.blocks.map((block: any) => {
      const fixedBlock = { ...block };
      
      // Fix block type enum values more comprehensively
      const validTypes = ["warmup", "main", "accessory", "cooldown"];
      if (!validTypes.includes(fixedBlock.type)) {
        // Map common Olympic types to valid enum values
        if (fixedBlock.type?.includes("strength") || fixedBlock.type?.includes("main")) {
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
                  fixedMovement.category !== "Olympic" ||
                  fixedMovement.category === "Strength" ||
                  fixedMovement.category === "Accessory" ||
                  fixedMovement.category === "olympic") {
                fixedMovement.category = "Olympic";
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

export async function generateOlympicWorkout(request: WorkoutGenerationRequest): Promise<Workout> {
  try {
    // Build user prompt
    const userPrompt = `
GENERATE OLYMPIC WEIGHTLIFTING WORKOUT:
Category: Olympic
Duration: ${request.duration} minutes
Intensity: ${request.intensity}/10
${request.context?.yesterday ? `Yesterday: ${request.context.yesterday.category} - ${request.context.yesterday.intensity}/10 intensity` : ''}
${request.context?.health_snapshot ? `Health: ${JSON.stringify(request.context.health_snapshot)}` : ''}
${request.context?.equipment ? `Equipment: ${request.context.equipment.join(', ')}` : 'Equipment: Full Olympic platform'}
${request.context?.constraints ? `Constraints: ${request.context.constraints.join(', ')}` : ''}

Requirements:
- Use A/B/C/D/E section structure  
- Include %1RM with ref_1rm_of notation
- At least one complex or progression pattern
- Appropriate intensity for requested level

Return ONLY valid JSON matching the schema. No explanations.`;

    // Generate workout
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: createOlympicSystemPrompt() },
        { role: "system", content: getOlympicFewShots() },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 2000
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content generated');
    }

    // Parse, normalize, and validate
    try {
      let workout = extractAndValidate(WorkoutSchema, content);
      workout = normalizeOlympicWorkout(workout);
      
      // Re-validate after normalization
      const finalWorkout = WorkoutSchema.parse(workout);
      return finalWorkout;
    } catch (validationError) {
      // Attempt repair
      const errorMessage = validationError instanceof Error ? validationError.message : String(validationError);
      const repairPrompt = `The generated Olympic weightlifting workout had validation errors: ${errorMessage}

Original JSON:
${content}

Fix the errors and return valid JSON matching the schema. Focus on:
- Correct block structure (strength blocks with %1RM, accessory blocks)
- Valid Olympic movement names
- Proper ref_1rm_of notation ("1RM Snatch", "1RM Clean", etc)
- Duration matching ±25% of target (${request.duration} min)
- A/B/C/D/E section structure

Return ONLY the corrected JSON:`;

      const repairCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a JSON repair specialist. Return ONLY valid JSON." },
          { role: "user", content: repairPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      const repairedContent = repairCompletion.choices[0]?.message?.content;
      if (!repairedContent) {
        throw new Error('Failed to repair workout');
      }

      try {
        let repairedWorkout = extractAndValidate(WorkoutSchema, repairedContent);
        repairedWorkout = normalizeOlympicWorkout(repairedWorkout);
        
        const finalWorkout = WorkoutSchema.parse(repairedWorkout);
        return finalWorkout;
      } catch (repairError) {
        const repairErrorMessage = repairError instanceof Error ? repairError.message : String(repairError);
        throw new Error(`Validation failed after repair: ${repairErrorMessage}`);
      }
    }
    
  } catch (error) {
    console.error('Olympic generation failed:', error);
    throw error;
  }
}