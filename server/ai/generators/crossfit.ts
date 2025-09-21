/**
 * CrossFit-specific workout generator
 * 
 * Produces workouts that match the exact brand format:
 * - Multi-AMRAP with rest periods OR for-time ladders with time caps
 * - RX weight pairs (95/65#, 20/14#, 24/20")
 * - Movement balance and recovery awareness
 */

import OpenAI from 'openai';
import { WorkoutSchema, type Workout } from '../../../client/src/ai/schemas';
import { parseAndValidate } from '../../../client/src/ai/json';
import type { WorkoutGenerationRequest } from '../generateWorkout';

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
1. FOR TIME ladder with time cap: "21-15-9", "27-21-15-9", etc.
2. Multi-AMRAP with rest: Multiple AMRAPs with equal work/rest
3. EMOM or intervals with specific work periods

RX WEIGHT STANDARDS (use these exactly):
- Thruster: 95/65#
- Wall Ball: 20/14# to 10/9"  
- Kettlebell Swing: 53/35#
- Deadlift: 225/155# (light), 315/205# (heavy)
- Box Jump: 24/20"
- Pull-ups: BW or weighted
- Dumbbell: 50/35#, 35/25#

MOVEMENT BALANCE:
- Include 2-3 movements per workout
- Mix weightlifting + gymnastics + monostructural
- Avoid same muscle group dominance
- Consider grip fatigue and breathing patterns

RECOVERY LOGIC:
- If health shows "caution" (low HRV, stress, poor sleep): reduce intensity 1-2 points, choose lighter movements
- If yesterday was heavy legs: avoid heavy squats/deadlifts today
- If last week >60% one category: diversify with different stimulus

TITLE GENERATION:
- Use fun, memorable names like "Hardy Bacardi Party", "Slap Happy Samurai"
- 2-3 words, catchy and energetic
- Avoid generic names like "CrossFit Workout #1"

OUTPUT JSON SCHEMA (strict adherence):
{
  "title": "string (catchy CrossFit name)",
  "category": "CrossFit",
  "duration_min": "number (requested duration)",
  "intensity_1_to_10": "number (requested intensity)",
  "rationale": "string (brief programming rationale)",
  "blocks": [
    {
      "kind": "cf_for_time|cf_amrap|cf_interval",
      "movements": [
        {
          "name": "string (exact movement name)",
          "reps": "number",
          "weight_lbs": "number (use RX standards)",
          "weight_male_lbs": "number",
          "weight_female_lbs": "number",
          "height_male_in": "number (for box jumps)",
          "height_female_in": "number"
        }
      ],
      // For cf_for_time:
      "ladder": [21, 15, 9],
      "time_cap_min": "number",
      // For cf_amrap:
      "minutes": "number",
      // For cf_interval:
      "rounds": "number",
      "work_min": "number",
      "rest_sec": "number"
    }
  ],
  "cool_down": [
    {
      "name": "string (movement)",
      "duration_sec": "number"
    }
  ]
}`;
}

function getCrossFitFewShots(): string {
  return `
FEW-SHOT EXAMPLES:

Example 1 - For Time Ladder:
{
  "title": "Thunder Road",
  "category": "CrossFit", 
  "duration_min": 20,
  "intensity_1_to_10": 9,
  "rationale": "High-intensity combination work with classic CrossFit movements. Scale loads and reps as needed.",
  "blocks": [
    {
      "kind": "cf_for_time",
      "movements": [
        {
          "name": "thruster",
          "reps": "per round",
          "weight_lbs": 95,
          "weight_male_lbs": 95,
          "weight_female_lbs": 65
        },
        {
          "name": "pull_up",
          "reps": "per round"
        }
      ],
      "ladder": [27, 21, 15, 9],
      "time_cap_min": 17
    }
  ],
  "cool_down": [
    {
      "name": "walking",
      "duration_sec": 180
    },
    {
      "name": "couch stretch",
      "duration_sec": 60
    },
    {
      "name": "shoulder stretch", 
      "duration_sec": 60
    }
  ]
}

Example 2 - Multi-AMRAP:
{
  "title": "Electric Avenue",
  "category": "CrossFit",
  "duration_min": 25,
  "intensity_1_to_10": 8,
  "rationale": "Mixed modal workout combining strength, cardio, and gymnastics elements.",
  "blocks": [
    {
      "kind": "cf_interval",
      "movements": [
        {
          "name": "wall_ball",
          "reps": 15,
          "weight_lbs": 20,
          "weight_male_lbs": 20,
          "weight_female_lbs": 14,
          "height_male_in": 10,
          "height_female_in": 9
        },
        {
          "name": "box_jump",
          "reps": 12,
          "height_male_in": 24,
          "height_female_in": 20
        },
        {
          "name": "burpee",
          "reps": 9
        }
      ],
      "rounds": 5,
      "work_min": 3,
      "rest_sec": 60
    }
  ],
  "cool_down": [
    {
      "name": "easy bike",
      "duration_sec": 300
    },
    {
      "name": "hip flexor stretch",
      "duration_sec": 90
    }
  ]
}`;
}

export async function generateCrossFitWorkout(request: WorkoutGenerationRequest): Promise<Workout> {
  try {
    // Build user prompt
    const userPrompt = `
GENERATE CROSSFIT WORKOUT:
Category: CrossFit
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

    // Parse and validate
    const { data: workout, error } = parseAndValidate(content, WorkoutSchema);
    
    if (error) {
      // Attempt repair
      const repairPrompt = `The generated CrossFit workout had validation errors: ${error}

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

      const { data: repairedWorkout, error: repairError } = parseAndValidate(repairedContent, WorkoutSchema);
      
      if (repairError) {
        throw new Error(`Validation failed after repair: ${repairError}`);
      }

      return repairedWorkout;
    }

    return workout;
    
  } catch (error) {
    console.error('CrossFit generation failed:', error);
    throw error;
  }
}