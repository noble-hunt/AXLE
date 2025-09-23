import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { openai } from '../lib/openai';
import { supabaseFromReq } from '../lib/supabaseFromReq';

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
                required: ["category", "durationMinutes", "intensity"]
              },
              sets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    movement: { type: "string" },
                    sets: { type: "number", nullable: true },
                    reps: { type: "string", nullable: true },
                    repScheme: { type: "string", nullable: true },
                    weightKg: { type: "number", nullable: true },
                    timeCapMinutes: { type: "number", nullable: true },
                    restMinutes: { type: "number", nullable: true },
                    notes: { type: "string", nullable: true }
                  },
                  required: ["movement"]
                }
              },
              notes: { type: "string", nullable: true }
            },
            required: ["title", "est_duration_min", "intensity", "confidence", "request", "sets"]
          },
          strict: true
        }
      },
      messages: [
        {
          role: 'system',
          content: `Parse workout description into structured JSON matching the schema. Extract:
- title: descriptive workout name
- est_duration_min: estimated duration 
- intensity: 1-10 scale
- confidence: 0-1 parsing confidence
- request: {category, durationMinutes, intensity} 
- sets: array of exercises with movement, sets, reps, weight, etc
- notes: additional observations

Categories: strength, cardio, crossfit, yoga, sports, other
Use reasonable estimates when data is missing.`
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
  const sb = supabaseFromReq(req);
  const { parsed, title } = req.body ?? {};
  
  if (!parsed) {
    return res.status(400).json({ error: 'parsed required' });
  }

  try {
    // Get authenticated user (RLS)
    const { data: user, error: authError } = await sb.auth.getUser();
    if (authError || !user?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Transform freeform parsed data to match database schema
    const transformedSets = parsed.sets?.map((set: any, index: number) => ({
      id: `freeform-${index}`,
      exercise: set.movement,
      weight: set.weightKg ? Math.round(set.weightKg * 2.20462 * 2) / 2 : undefined, // kg to lbs
      reps: set.reps,
      duration: set.timeCapMinutes ? set.timeCapMinutes * 60 : undefined, // minutes to seconds
      restTime: set.restMinutes ? set.restMinutes * 60 : undefined, // minutes to seconds
      notes: set.notes,
      repScheme: set.repScheme,
      timeCapMinutes: set.timeCapMinutes
    })) || [];

    // Store workout in database
    const { data, error } = await sb.from('workouts').insert({
      user_id: user.user.id,
      title: title || parsed.title || 'Freeform workout',
      request: {
        category: parsed.request?.category || 'other',
        durationMinutes: parsed.request?.durationMinutes || parsed.est_duration_min || 30,
        intensity: parsed.request?.intensity || parsed.intensity || 5
      },
      sets: transformedSets,
      notes: parsed.notes || null,
      completed: true,
      feedback: {
        source: "freeform",
        confidence: parsed.confidence || 0.8
      }
    }).select('id').single();

    if (error) {
      console.error('[dev/log] db error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ id: data.id, success: true });
  } catch (e: any) {
    console.error('[dev/log] err', e);
    res.status(500).json({ error: e?.message || 'log failed' });
  }
});

export default router;