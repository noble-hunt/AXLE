import OpenAI from "openai";
import { z } from "zod";

// Initialize OpenAI client
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Validation schemas aligned with shared/schema.ts
const FreeformWorkoutSetSchema = z.object({
  id: z.string(),
  exercise: z.string().min(1),
  weight: z.number().positive().nullable(),
  reps: z.number().positive().nullable(),
  duration: z.number().positive().nullable(),
  repScheme: z.string().nullable(),
  notes: z.string().nullable()
});

const FreeformRequestSchema = z.object({
  category: z.enum([
    "CrossFit", 
    "HIIT", 
    "Powerlifting", 
    "Cardio", // Use existing enum values from shared schema
    "Strength"
  ]),
  duration: z.number().min(5).max(120), // Clamped 5-120 minutes
  intensity: z.number().min(1).max(10)   // Clamped 1-10 scale
});

const FreeformParsedSchema = z.object({
  request: FreeformRequestSchema,
  format: z.enum([
    "EMOM", 
    "AMRAP", 
    "For Time", 
    "Strength", 
    "Skill", 
    "Intervals", 
    "Circuit", 
    "Other"
  ]),
  sets: z.array(FreeformWorkoutSetSchema),
  title: z.string().min(1),
  notes: z.string().nullable(),
  confidence: z.number().min(0).max(1)
});

export type ValidatedFreeformParsed = z.infer<typeof FreeformParsedSchema>;

// Export schema for validation in routes
export { FreeformParsedSchema };

export async function parseFreeform(text: string, userId: string): Promise<ValidatedFreeformParsed> {
  if (!text || text.trim().length === 0) {
    throw new Error("Text description is required");
  }

  if (text.length > 10000) {
    throw new Error("Workout description too long (max 10,000 characters)");
  }

  const systemPrompt = `You are a fitness expert assistant that parses workout descriptions into structured data. 

Parse the workout description and return JSON with this exact structure:
{
  "request": {
    "category": "CrossFit" | "HIIT" | "Powerlifting" | "Olympic Weightlifting" | "Gymnastics" | "Aerobic" | "Strength" | "Mobility",
    "duration": number (5-120 minutes),
    "intensity": number (1-10 scale)
  },
  "format": "EMOM" | "AMRAP" | "For Time" | "Strength" | "Skill" | "Intervals" | "Circuit" | "Other",
  "sets": [
    {
      "id": "unique-id",
      "exercise": "exercise name",
      "weight": number | null,
      "reps": number | null,
      "duration": number | null,
      "repScheme": "3x10" | "EMOM 12" | "AMRAP 20" | null,
      "notes": "any additional notes" | null
    }
  ],
  "title": "descriptive workout title",
  "notes": "any general workout notes or context",
  "confidence": number (0.0-1.0 confidence score)
}

Guidelines:
- Use exact category names: "CrossFit", "HIIT", "Powerlifting", "Cardio", "Strength"
- Duration must be 5-120 minutes based on description or reasonable defaults
- Intensity must be 1-10 based on effort level, weight percentages, time pressure
- Extract individual exercises with sets/reps/weights
- Use appropriate repScheme format (3x10, EMOM 12, etc.)
- Generate a concise but descriptive title (3-8 words)
- Set confidence high (0.8+) for clear descriptions, lower for ambiguous ones
- Ensure all required fields are present and properly typed`;

  let attempt = 0;
  const maxAttempts = 2;
  let currentSystemPrompt = systemPrompt; // Make mutable copy

  while (attempt < maxAttempts) {
    try {
      // Create AbortController for proper timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          { role: "system", content: currentSystemPrompt },
          { role: "user", content: text.trim() }
        ],
        response_format: { type: "json_object" }
      }, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const rawParsed = JSON.parse(response.choices[0].message.content || '{}');
      
      // Validate with Zod and normalize
      const validated = FreeformParsedSchema.parse(rawParsed);
      return normalizeParsed(validated);

    } catch (error: unknown) {
      attempt++;
      
      // Handle Zod validation errors with prompt retry
      if (error instanceof z.ZodError && attempt < maxAttempts) {
        const validationErrors = error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        ).join(', ');
        
        currentSystemPrompt += `\n\nIMPORTANT: Previous attempt failed validation with these errors: ${validationErrors}. Please fix these issues.`;
        continue;
      }
      
      // Handle transient errors with exponential backoff retry
      const isTransientError = (error && typeof error === 'object' && (
        ('status' in error && typeof error.status === 'number' && (error.status === 429 || error.status >= 500)) ||
        ('code' in error && (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND')) ||
        ('name' in error && error.name === 'AbortError')
      ));
      
      if (isTransientError && attempt < maxAttempts) {
        // Exponential backoff with jitter (1-3 seconds)
        const backoffMs = Math.random() * 2000 + 1000;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
      
      // Final error handling
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid workout structure: ${error.issues[0].message}`);
      }
      if (error && typeof error === 'object' && 'code' in error) {
        const errorCode = error.code;
        if (errorCode === 'ENOTFOUND' || errorCode === 'ETIMEDOUT') {
          throw new Error("OpenAI service temporarily unavailable. Please try again.");
        }
      }
      if (error && typeof error === 'object' && 'status' in error) {
        const errorStatus = error.status;
        if (errorStatus === 429) {
          throw new Error("Rate limit exceeded. Please wait a moment and try again.");
        }
        if (errorStatus === 401) {
          throw new Error("AI service configuration error");
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse workout: ${errorMessage}`);
    }
  }

  throw new Error("Failed to parse workout after multiple attempts");
}

function normalizeParsed(parsed: ValidatedFreeformParsed): ValidatedFreeformParsed {
  return {
    ...parsed,
    request: {
      ...parsed.request,
      // Clamp duration and intensity to valid ranges
      duration: Math.max(5, Math.min(120, parsed.request.duration)),
      intensity: Math.max(1, Math.min(10, parsed.request.intensity))
    },
    // Clean title: trim whitespace and limit length
    title: parsed.title.trim().slice(0, 100),
    // Clean notes
    notes: parsed.notes ? parsed.notes.trim() || null : null,
    // Normalize sets
    sets: parsed.sets.map((set, index) => ({
      ...set,
      id: set.id || `set-${Date.now()}-${index}`,
      exercise: set.exercise.trim(),
      // Convert lbs to kg (round to 0.5kg)
      weight: set.weight && set.notes?.toLowerCase().includes('lbs') 
        ? Math.round((set.weight / 2.20462) * 2) / 2 
        : set.weight,
      notes: set.notes ? set.notes.trim() || null : null,
      repScheme: set.repScheme ? set.repScheme.trim() || null : null
    }))
  };
}