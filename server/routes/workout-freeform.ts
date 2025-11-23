import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { openai } from '../lib/openai.js';
import { supabaseFromReq } from '../lib/supabaseFromReq.js';

const router = Router();

// Parse freeform workout description
router.post('/parse-freeform', requireAuth, async (req, res) => {
  const text = String(req.body?.text || '').slice(0, 12_000);
  if (!text) {
    return res.status(400).json({ error: 'text required' });
  }

  try {
    const r = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'FreeformParsed',
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              est_duration_min: { type: "number" },
              intensity: { type: "number" },
              confidence: { type: "number" },
              request: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  durationMinutes: { type: "number" },
                  intensity: { type: "number" }
                },
                required: ["category", "durationMinutes", "intensity"],
                additionalProperties: false
              },
              sets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    movement: { type: "string" },
                    sets: { anyOf: [{ type: "number" }, { type: "null" }] },
                    reps: { anyOf: [{ type: "string" }, { type: "null" }] },
                    repScheme: { anyOf: [{ type: "string" }, { type: "null" }] },
                    weightKg: { anyOf: [{ type: "number" }, { type: "null" }] },
                    timeCapMinutes: { anyOf: [{ type: "number" }, { type: "null" }] },
                    restMinutes: { anyOf: [{ type: "number" }, { type: "null" }] },
                    notes: { anyOf: [{ type: "string" }, { type: "null" }] }
                  },
                  required: ["movement", "sets", "reps", "repScheme", "weightKg", "timeCapMinutes", "restMinutes", "notes"],
                  additionalProperties: false
                }
              },
              notes: { anyOf: [{ type: "string" }, { type: "null" }] }
            },
            required: ["title", "est_duration_min", "intensity", "confidence", "request", "sets", "notes"],
            additionalProperties: false
          },
          strict: true
        }
      },
      messages: [
        {
          role: 'system',
          content: `You are a fitness workout parser. Parse the user's workout description into structured JSON.

CRITICAL INSTRUCTIONS FOR MOVEMENT EXTRACTION:
1. AMRAP (As Many Rounds As Possible): When user says "AMRAP" or "as many rounds", extract the individual movements that make up ONE round, not the word "AMRAP" itself.
   Example: "15 min AMRAP: 300m run, 10 push-ups, 5 pull-ups" 
   → Extract 3 movements: "300m Run", "10 Push-ups", "5 Pull-ups"
   
2. EMOM (Every Minute On the Minute): Extract the movements performed each minute.
   Example: "12 min EMOM: 10 burpees" 
   → Extract 1 movement: "10 Burpees"

3. For Time: Extract all movements in the workout.
   Example: "For time: 100 wall balls, 50 box jumps" 
   → Extract 2 movements: "100 Wall Balls", "50 Box Jumps"

4. DO NOT include warmup/cooldown unless explicitly mentioned by the user.

5. Each movement should include:
   - movement: the exercise name (e.g., "Run", "Push-ups", "Pull-ups", "Box Jumps")
   - reps: the rep scheme as a string (e.g., "10", "5-10", "Max")
   - repScheme: descriptive scheme (e.g., "10 reps", "300m", "5-10 reps")
   - weightKg: weight if mentioned (convert lbs to kg: 1 lb = 0.453592 kg)
   - notes: any additional context

WORKOUT FORMATS:
- AMRAP: As Many Rounds As Possible in a time cap
- EMOM: Every Minute On the Minute for X minutes
- For Time: Complete all movements as fast as possible
- Strength: Heavy lifting with rest periods
- Circuit: Multiple rounds of exercises
- Other: Any other format

CATEGORIES:
- CrossFit: Mixed modal, high intensity (AMRAP, metcons, WODs)
- HIIT: High intensity intervals
- Powerlifting: Squat, bench, deadlift focus
- Olympic Weightlifting: Snatch, clean & jerk
- Bodybuilding Upper/Lower/Full: Bodybuilding splits
- Gymnastics: Bodyweight skills
- Aerobic: Running, rowing, cycling, swimming

PARSING RULES:
- Extract duration in minutes (default to 30 if unclear)
- Extract intensity 1-10 (easy=3-4, moderate=5-6, hard=7-8, max=9-10)
- If user mentions rounds completed, add to notes
- If user mentions how they felt, add to notes
- Confidence: High (0.8-1.0) if clear, Medium (0.5-0.7) if ambiguous, Low (0-0.4) if very unclear

EXAMPLES:
Input: "Today I did 15 minute AMRAP, it was 300 meter run, 10 push-ups, 5 strict pull-ups, I got like 6 or so rounds and intensity was like 6 out of 10."
Output: {
  "title": "15 Minute AMRAP Workout",
  "est_duration_min": 15,
  "intensity": 6,
  "confidence": 0.9,
  "request": {"category": "CrossFit", "durationMinutes": 15, "intensity": 6},
  "sets": [
    {"movement": "Run", "sets": null, "reps": "300m", "repScheme": "300m", "weightKg": null, "timeCapMinutes": null, "restMinutes": null, "notes": null},
    {"movement": "Push-ups", "sets": null, "reps": "10", "repScheme": "10 reps", "weightKg": null, "timeCapMinutes": null, "restMinutes": null, "notes": null},
    {"movement": "Strict Pull-ups", "sets": null, "reps": "5", "repScheme": "5 reps", "weightKg": null, "timeCapMinutes": null, "restMinutes": null, "notes": null}
  ],
  "notes": "Completed approximately 6 rounds in 15 minutes."
}

Now parse the user's workout description following these rules exactly.`
        },
        { role: 'user', content: text }
      ]
    });

    const parsed = JSON.parse(r.choices?.[0]?.message?.content ?? '{}');
    res.json({ parsed, success: true });
  } catch (e: any) {
    console.error('[dev/parse] err', e);
    
    if (e?.message?.includes('Rate limit')) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }
    
    res.status(500).json({ error: e?.message || 'parse failed' });
  }
});

// Log freeform workout to database  
router.post('/log-freeform', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { parsed, title } = req.body ?? {};
  
  if (!parsed) {
    return res.status(400).json({ error: 'parsed required' });
  }

  try {
    // Transform freeform parsed data to match WorkoutSetSchema requirements
    const transformedSets = parsed.sets?.map((set: any, index: number) => ({
      id: `freeform-${index}`,
      exercise: set.movement || 'Unknown Exercise', // Required field
      weight: set.weightKg ? Math.round(set.weightKg * 2.20462 * 2) / 2 : undefined, // kg to lbs
      reps: set.reps || undefined, // Convert null to undefined
      duration: set.timeCapMinutes ? set.timeCapMinutes * 60 : undefined, // minutes to seconds
      restTime: set.restMinutes ? set.restMinutes * 60 : undefined, // minutes to seconds
      notes: set.notes || undefined, // Convert null to undefined
      repScheme: set.repScheme || set.reps || undefined // Required fallback to reps
    })) || [];

    // Use Drizzle ORM DAL for consistency with GET /api/workouts
    const { insertWorkout } = await import('../dal/workouts.js');
    
    const durationMinutes = parsed.request?.durationMinutes || parsed.est_duration_min || 30;
    
    const workout = await insertWorkout({
      userId: authReq.user.id,
      workout: {
        title: title || parsed.title || 'Freeform workout',
        // Both `duration` and `durationMinutes` are needed per WorkoutRequestSchema
        request: {
          category: parsed.request?.category || 'other',
          duration: durationMinutes,  // DAL consumers expect duration
          durationMinutes: durationMinutes, // Also populate durationMinutes
          intensity: parsed.request?.intensity || parsed.intensity || 5
        },
        sets: transformedSets,
        notes: parsed.notes || undefined, // Convert null to undefined
        completed: true,
        feedback: {
          source: "freeform",
          confidence: parsed.confidence || 0.8
        }
      }
    });

    if (!workout?.id) {
      console.error('[dev/log] no workout id returned');
      return res.status(500).json({ error: 'Failed to save workout' });
    }

    console.log(`[FREEFORM] Logged workout ${workout.id} for user ${authReq.user.id}`);
    res.json({ id: workout.id, success: true });
  } catch (e: any) {
    console.error('[dev/log] err', e);
    res.status(500).json({ error: e?.message || 'log failed' });
  }
});

// Add workout feedback endpoint
router.post('/:id/feedback', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    const workoutId = req.params.id;
    
    // Validate request body with Zod schema
    const { insertWorkoutFeedbackSchema } = await import('../../shared/schema.js');
    const validationResult = insertWorkoutFeedbackSchema.safeParse({
      workoutId,
      userId,
      perceivedIntensity: req.body.perceivedIntensity,
      notes: req.body.notes
    });
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid feedback data',
        details: validationResult.error.issues
      });
    }
    
    const { perceivedIntensity, notes } = validationResult.data;
    
    // Verify workout exists and belongs to user
    const { getWorkout, insertWorkoutFeedback } = await import('../dal/workouts.js');
    const workout = await getWorkout(userId, workoutId);
    
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    
    // Insert feedback (with duplicate handling)
    let feedback;
    try {
      feedback = await insertWorkoutFeedback({
        workoutId,
        userId,
        perceivedIntensity,
        notes: notes || ''
      } as any);
    } catch (error: any) {
      // Handle duplicate feedback submission
      if (error.message.includes('Feedback already submitted for this workout')) {
        return res.status(409).json({ 
          error: 'Feedback already submitted for this workout' 
        });
      }
      throw error; // Re-throw other errors
    }
    
    // Log telemetry for ML training data
    try {
      const { logFeedbackEvent } = await import('../workouts/telemetry.js');
      
      // Get generation ID from workout if available
      const generationId = workout.generationId || 'unknown';
      
      await logFeedbackEvent(userId, workoutId, generationId, {
        feedbackType: 'rpe',
        rpe: perceivedIntensity as any,
        comments: notes || undefined
      });
    } catch (telemetryError) {
      console.warn('Failed to log telemetry for feedback:', telemetryError);
      // Don't fail the request if telemetry fails
    }
    
    res.json({ success: true, feedback });
  } catch (error: any) {
    console.error('Failed to save workout feedback:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

export default router;