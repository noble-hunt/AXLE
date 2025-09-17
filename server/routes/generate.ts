import express from 'express';
import OpenAI from "openai";
import { z } from 'zod';
import type { WorkoutRequest, GeneratedWorkout, WorkoutSet, Workout, PersonalRecord } from "../shared/schema";
import { Category, workoutRequestSchema, generatedWorkoutSchema } from "../shared/schema";

const router = express.Router();

// OpenAI configuration
const apiKey = process.env.OPENAI_API_KEY || process.env.MODEL_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

// Enhanced workout request schema with context data
const enhancedWorkoutRequestSchema = workoutRequestSchema.extend({
  recentPRs: z.array(z.object({
    exercise: z.string(),
    weight: z.number().optional(),
    reps: z.number().optional(),
    date: z.string(),
    unit: z.string().optional()
  })).optional(),
  lastWorkouts: z.array(z.object({
    name: z.string(),
    category: z.string(),
    duration: z.number(),
    intensity: z.number(),
    date: z.string(),
    exercises: z.array(z.string())
  })).optional(),
  todaysReport: z.object({
    energy: z.number(),
    stress: z.number(),
    sleep: z.number(),
    soreness: z.number()
  }).optional()
});

type EnhancedWorkoutRequest = z.infer<typeof enhancedWorkoutRequestSchema>;

// AXLE Fitness Expert Prompt Template
const createPromptTemplate = (request: EnhancedWorkoutRequest): string => {
  const { category, duration, intensity, recentPRs = [], lastWorkouts = [], todaysReport } = request;
  
  // Format recent PRs for context
  const prContext = recentPRs.length > 0 
    ? `Recent Personal Records (Top 3):
${recentPRs.slice(0, 3).map(pr => 
  `- ${pr.exercise}: ${pr.weight ? `${pr.weight} ${pr.unit || 'lbs'}` : ''} ${pr.reps ? `x${pr.reps} reps` : ''} (${new Date(pr.date).toLocaleDateString()})`
).join('\n')}`
    : "No recent PRs available.";

  // Format last 3 workouts for variety context
  const workoutContext = lastWorkouts.length > 0
    ? `Last 3 Workouts:
${lastWorkouts.slice(0, 3).map(workout => 
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
- Respect category constraints (e.g., no PR tracking for Bodybuilding-focused workouts)
- Scale difficulty by intensity level 1-10 (1=very easy, 10=extremely challenging)
- Respect duration target within ±10% (${Math.round(duration * 0.9)}-${Math.round(duration * 1.1)} minutes)
- Prefer varied movement patterns compared to recent workouts to prevent overuse
- If risky combinations detected (e.g., heavy spinal loading after max deadlifts), adjust to safer alternatives
- Consider wellness metrics: low energy/sleep = easier workout, high soreness = avoid affected muscle groups
- Include proper warm-up and cool-down exercises
- Use metric units (kg for weight, meters for distance, seconds for time)
- Provide realistic weights and targets based on recent PR context

Return ONLY the JSON object. No markdown formatting, explanations, or additional text.`;
};

// Mock workout generator for fallback
const generateMockWorkout = (request: EnhancedWorkoutRequest): GeneratedWorkout => {
  const mockTemplates = {
    [Category.CROSSFIT]: {
      title: "CrossFit AMRAP Challenge",
      notes: "As Many Rounds As Possible in the time limit. Focus on form over speed.",
      exercises: [
        { description: "Burpees with jump", target: { reps: 10 } },
        { description: "Kettlebell swings", target: { reps: 15, weightKg: 24 } },
        { description: "Box step-ups alternating legs", target: { reps: 20 } },
        { description: "Mountain climbers", target: { timeSec: 30 } }
      ]
    },
    [Category.STRENGTH]: {
      title: "Compound Strength Builder", 
      notes: "Progressive strength training focusing on major movement patterns. Rest 90-120 seconds between sets.",
      exercises: [
        { description: "Barbell back squats", target: { reps: 8, weightKg: 70 } },
        { description: "Bench press", target: { reps: 8, weightKg: 60 } },
        { description: "Bent-over barbell rows", target: { reps: 10, weightKg: 55 } },
        { description: "Overhead press", target: { reps: 8, weightKg: 40 } },
        { description: "Romanian deadlifts", target: { reps: 10, weightKg: 65 } }
      ]
    },
    [Category.HIIT]: {
      title: "High-Intensity Cardio Blast",
      notes: "Work hard during intervals, rest completely during breaks. Monitor heart rate.",
      exercises: [
        { description: "Jump squats explosive", target: { timeSec: 45 } },
        { description: "High knees running in place", target: { timeSec: 30 } }, 
        { description: "Burpees with tuck jump", target: { reps: 8 } },
        { description: "Plank to downward dog", target: { timeSec: 45 } },
        { description: "Jumping lunges alternating", target: { timeSec: 30 } }
      ]
    },
    [Category.CARDIO]: {
      title: "Steady-State Endurance",
      notes: "Maintain consistent pace throughout. Focus on breathing and form.",
      exercises: [
        { description: "Treadmill running moderate pace", target: { timeSec: 600, distanceM: 1600 } },
        { description: "Rowing machine steady state", target: { timeSec: 300, distanceM: 1000 } },
        { description: "Stationary bike moderate resistance", target: { timeSec: 600 } },
        { description: "Walking recovery", target: { timeSec: 300 } }
      ]
    },
    [Category.POWERLIFTING]: {
      title: "Powerlifting Development",
      notes: "Focus on the big three lifts. Use proper spotting and progressive loading.",
      exercises: [
        { description: "Competition squat with pause", target: { reps: 5, weightKg: 90 } },
        { description: "Competition bench press with commands", target: { reps: 5, weightKg: 75 } },
        { description: "Competition deadlift from floor", target: { reps: 5, weightKg: 100 } },
        { description: "Close-grip bench press accessory", target: { reps: 8, weightKg: 60 } },
        { description: "Front squats for quad strength", target: { reps: 8, weightKg: 60 } }
      ]
    }
  };

  const template = mockTemplates[request.category as keyof typeof mockTemplates] || mockTemplates[Category.STRENGTH];
  
  return {
    name: template.title,
    category: request.category,
    description: template.notes,
    duration: request.duration,
    intensity: request.intensity,
    sets: template.exercises.map((exercise: any, index: number) => ({
      id: `mock-set-${Date.now()}-${index}`,
      exercise: exercise.description.split(' ')[0], // Extract exercise name
      weight: exercise.target.weightKg ? Math.round(exercise.target.weightKg * 2.205) : undefined, // Convert kg to lbs for storage
      reps: exercise.target.reps || undefined,
      duration: exercise.target.timeSec || undefined,  
      distance: exercise.target.distanceM || undefined,
      restTime: request.intensity >= 7 ? 60 : 90,
      notes: exercise.description
    }))
  };
};

// Generate workout with AI or fallback to mock
const generateWorkout = async (request: EnhancedWorkoutRequest): Promise<GeneratedWorkout> => {
  console.log('Generating workout with enhanced context:', {
    category: request.category,
    duration: request.duration,
    intensity: request.intensity,
    prCount: request.recentPRs?.length || 0,
    workoutCount: request.lastWorkouts?.length || 0,
    hasReport: !!request.todaysReport
  });

  // Fallback to mock if no API key
  if (!openai) {
    console.log('No OpenAI API key available, using enhanced mock workout');
    return generateMockWorkout(request);
  }

  try {
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
      max_completion_tokens: 1500,
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
      sets: aiResponse.sets?.map((set: any, index: number) => ({
        id: `ai-set-${Date.now()}-${index}`,
        exercise: set.description?.split(' ')[0] || `Exercise ${index + 1}`,
        weight: set.target?.weightKg ? Math.round(set.target.weightKg * 2.205) : undefined, // Convert kg to lbs
        reps: set.target?.reps || undefined,
        duration: set.target?.timeSec || undefined,
        distance: set.target?.distanceM || undefined,
        restTime: request.intensity >= 7 ? 60 : 90,
        notes: set.description || `Perform with ${request.intensity}/10 intensity`
      })) || []
    };

    // Validate against schema
    const validation = generatedWorkoutSchema.safeParse(workoutData);
    
    if (validation.success) {
      return validation.data;
    } else {
      console.error('AI response validation failed:', validation.error.issues);
      console.log('Falling back to mock workout due to validation failure');
      return generateMockWorkout(request);
    }

  } catch (error: any) {
    console.error('OpenAI generation error:', error.message);
    console.log('Falling back to mock workout generation');
    return generateMockWorkout(request);
  }
};

// Workout generation endpoint
router.post('/generate-workout', async (req, res) => {
  try {
    // Validate input with enhanced schema
    const validatedData = enhancedWorkoutRequestSchema.parse(req.body);
    
    // Generate workout with context
    const generatedWorkout = await generateWorkout(validatedData);
    
    res.json(generatedWorkout);
    
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      // Provide friendly validation error messages
      const friendlyErrors = error.issues.map(issue => {
        switch (issue.path.join('.')) {
          case 'category':
            return 'Please select a valid workout category (CrossFit, Strength, HIIT, Cardio, or Powerlifting)';
          case 'duration': 
            return 'Workout duration must be between 5 and 120 minutes';
          case 'intensity':
            return 'Intensity level must be between 1 and 10';
          case 'recentPRs':
            return 'Recent PRs data format is invalid';
          case 'lastWorkouts':
            return 'Recent workouts data format is invalid';
          case 'todaysReport':
            return 'Today\'s wellness report data format is invalid';
          default:
            return `Invalid ${issue.path.join('.')}: ${issue.message}`;
        }
      });
      
      return res.status(400).json({ 
        message: "Invalid workout request data",
        errors: friendlyErrors,
        details: "Please check your request parameters and try again"
      });
    }
    
    console.error("Workout generation error:", error);
    res.status(500).json({ 
      message: "Failed to generate workout",
      error: "An internal error occurred while generating your workout. Please try again." 
    });
  }
});

export default router;