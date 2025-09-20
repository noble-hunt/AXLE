import OpenAI from "openai";
import { z } from "zod";

// Initialize OpenAI client
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Schema for freeform parsed workout
const FreeformSetSchema = z.object({
  movement: z.string(),
  repScheme: z.string().optional(),
  reps: z.number().int().optional(),
  weightKg: z.number().optional(),
  timeCapMinutes: z.number().int().optional(),
  notes: z.string().optional()
});

const FreeformRequestSchema = z.object({
  category: z.enum([
    "CrossFit", "HIIT", "Powerlifting", "Olympic Weightlifting", 
    "Bodybuilding Upper", "Bodybuilding Lower", "Bodybuilding Full", 
    "Gymnastics", "Aerobic"
  ]),
  durationMinutes: z.number().int().min(5).max(120),
  intensity: z.number().int().min(1).max(10)
});

const FreeformParsedSchema = z.object({
  request: FreeformRequestSchema,
  format: z.enum([
    "EMOM", "AMRAP", "For Time", "Strength", "Skill", 
    "Intervals", "Circuit", "Other"
  ]),
  title: z.string(),
  sets: z.array(FreeformSetSchema),
  notes: z.string().optional(),
  confidence: z.number().min(0).max(1)
});

export type FreeformParsed = z.infer<typeof FreeformParsedSchema>;

export async function parseFreeform(text: string, userId: string): Promise<FreeformParsed> {
  const systemPrompt = `You are a workout parser. Return ONLY valid JSON. 
Map the user description into:
{
  "request": { "category": <Category>, "durationMinutes": <int 5..120>, "intensity": <int 1..10> },
  "format": "EMOM|AMRAP|For Time|Strength|Skill|Intervals|Circuit|Other",
  "title": <short title>,
  "sets": [
    { "movement": <string>, "repScheme": <string|optional>, "reps": <int|optional>, "weightKg": <number|optional>, "timeCapMinutes": <int|optional>, "notes": <string|optional> }
  ],
  "notes": <string|optional>,
  "confidence": <0..1>
}
Rules:
- Convert any pounds to kilograms (1 lb = 0.45359237) and round to 0.5 kg.
- Parse schemes like "5x5", "3 x 10", "EMOM 12" into repScheme/time.
- If duration not stated, infer from format: EMOM N → N minutes; AMRAP usually 12–25; For Time use user-stated cap or 12–20.
- If intensity not stated, infer from language: easy(3-4), moderate(5-6), hard(7-8), max(9-10).
- Category inference examples:
  * Back squat/deadlift/bench → Powerlifting
  * Snatch/clean & jerk → Olympic Weightlifting
  * Pull-ups/push-ups/HS push-ups → Gymnastics
  * Runs/rows/rides/skis → Aerobic
  * Mixed couplets/triplets/time caps → CrossFit/HIIT
- Never invent unsafe values. If unsure, leave weightKg null and use repScheme text.`;

  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text.trim() }
        ],
        response_format: { type: "json_object" }
      });

      const rawParsed = JSON.parse(response.choices[0].message.content || '{}');
      
      // Validate with Zod
      const validated = FreeformParsedSchema.parse(rawParsed);
      
      // Normalize the parsed data
      return normalizeParsed(validated);

    } catch (error: unknown) {
      attempt++;
      
      if (error instanceof z.ZodError && attempt < maxAttempts) {
        // Retry with validation errors in prompt
        const validationErrors = error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        ).join(', ');
        
        const retryPrompt = systemPrompt + `\n\nPrevious attempt failed validation with these errors: ${validationErrors}. Please fix these issues.`;
        
        try {
          const retryResponse = await openai.chat.completions.create({
            model: "gpt-5",
            messages: [
              { role: "system", content: retryPrompt },
              { role: "user", content: text.trim() }
            ],
            response_format: { type: "json_object" }
          });

          const retryRawParsed = JSON.parse(retryResponse.choices[0].message.content || '{}');
          const retryValidated = FreeformParsedSchema.parse(retryRawParsed);
          return normalizeParsed(retryValidated);
        } catch (retryError) {
          throw new Error("Failed to parse workout after retry");
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse workout: ${errorMessage}`);
    }
  }

  throw new Error("Failed to parse workout after multiple attempts");
}

function normalizeParsed(parsed: FreeformParsed): FreeformParsed {
  return {
    ...parsed,
    request: {
      ...parsed.request,
      // Ensure durationMinutes is within [5,120]
      durationMinutes: Math.max(5, Math.min(120, parsed.request.durationMinutes)),
      // Clamp intensity to 1..10
      intensity: Math.max(1, Math.min(10, parsed.request.intensity))
    },
    // Clean title - collapse duplicate whitespace
    title: parsed.title.replace(/\s+/g, ' ').trim(),
    // Process sets to convert any remaining lbs to kg
    sets: parsed.sets.map(set => ({
      ...set,
      // Convert lbs to kg if weight is specified and notes mention lbs
      weightKg: set.weightKg && set.notes?.toLowerCase().includes('lb') 
        ? Math.round((set.weightKg / 0.45359237) * 2) / 2  // Round to 0.5 kg
        : set.weightKg,
      // Clean notes
      notes: set.notes ? set.notes.replace(/\s+/g, ' ').trim() : set.notes
    })),
    // Clean notes
    notes: parsed.notes ? parsed.notes.replace(/\s+/g, ' ').trim() : parsed.notes
  };
}