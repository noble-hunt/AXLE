import OpenAI from "openai";
import type { WorkoutRequest, GeneratedWorkout, WorkoutSet } from "../shared/schema";
import { Category } from "../shared/schema";
import { generatedWorkoutSchema } from "../shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const apiKey = process.env.OPENAI_API_KEY || process.env.MODEL_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

export async function generateWorkout(request: WorkoutRequest): Promise<GeneratedWorkout> {
  console.log('Generating workout with OpenAI:', request);

  // If no API key available, fall back to mock immediately
  if (!openai) {
    console.log('No OpenAI API key available, using mock workout');
    return generateMockWorkout(request);
  }

  // Create a detailed prompt based on the request
  const prompt = `Generate a detailed ${request.category} workout that is ${request.duration} minutes long with intensity level ${request.intensity}/10.

Please create a complete workout with the following requirements:
- Category: ${request.category}
- Duration: ${request.duration} minutes
- Intensity: ${request.intensity}/10 scale
- Include 5-8 exercises appropriate for the category
- Provide specific sets, reps, weights (if applicable), or duration for each exercise
- Include rest times between exercises
- Make it realistic and achievable
- Add helpful notes or form cues where appropriate

Return the response as a JSON object with this exact structure:
{
  "name": "Workout Name (creative and descriptive)",
  "category": "${request.category}",
  "description": "Brief description of the workout",
  "duration": ${request.duration},
  "intensity": ${request.intensity},
  "sets": [
    {
      "id": "unique-id",
      "exercise": "Exercise Name",
      "weight": 135,
      "reps": 10,
      "duration": 30,
      "distance": 400,
      "restTime": 60,
      "notes": "Form cues or instructions"
    }
  ]
}

Make sure to:
- Use appropriate weights for the exercises (realistic for average fitness level)
- Include proper rest times (30-120 seconds depending on intensity)
- Make exercise names clear and specific
- Only include weight/reps/duration/distance fields that are relevant for each exercise
- Generate unique IDs for each set`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert fitness trainer and workout designer. Create realistic, safe, and effective workouts based on the user's requirements. Always respond with valid JSON only."
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

    const workoutData = JSON.parse(response.choices[0].message.content || '{}');
    
    console.log('Generated workout data:', workoutData);
    
    // Validate the OpenAI response against our schema
    const validation = generatedWorkoutSchema.safeParse({
      name: workoutData.name || `${request.category} Workout`,
      category: request.category,
      description: workoutData.description || `A ${request.intensity}/10 intensity ${request.category} workout`,
      duration: request.duration,
      intensity: request.intensity,
      sets: workoutData.sets?.map((set: any, index: number) => ({
        id: set.id || `set-${Date.now()}-${index}`,
        exercise: set.exercise || `Exercise ${index + 1}`,
        weight: set.weight || undefined,
        reps: set.reps || undefined,
        duration: set.duration || undefined,
        distance: set.distance || undefined,
        restTime: set.restTime || undefined,
        notes: set.notes || undefined,
      })) || []
    });

    if (validation.success) {
      return validation.data;
    } else {
      console.error('OpenAI response validation failed:', validation.error);
      // Fall back to mock if validation fails
      return generateMockWorkout(request);
    }

  } catch (error: any) {
    console.error('OpenAI generation error:', error);
    
    // Fallback to mock workout if OpenAI fails
    console.log('Falling back to mock workout generation');
    return generateMockWorkout(request);
  }
}

// Fallback mock workout generator
export function generateMockWorkout(request: WorkoutRequest): GeneratedWorkout {
  const workoutTemplates = {
    [Category.CROSSFIT]: {
      name: "CrossFit Hero WOD",
      description: "High-intensity functional fitness workout",
      exercises: [
        { exercise: "Burpees", reps: 15, restTime: 60 },
        { exercise: "Pull-ups", reps: 10, restTime: 60 },
        { exercise: "Push-ups", reps: 20, restTime: 60 },
        { exercise: "Air Squats", reps: 25, restTime: 60 },
        { exercise: "Mountain Climbers", duration: 30, restTime: 45 }
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
    }))
  };
}