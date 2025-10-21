// api/workouts/preview.ts (Vercel serverless function - LIGHTWEIGHT VERSION)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin } from '../../lib/api-helpers/supabase';
import { openai } from '../../lib/api-helpers/openai';

export const config = { runtime: 'nodejs' };

type PreviewInput = {
  focus?: string;
  durationMin: number;
  intensity: number;
  equipment?: string[];
  seed?: string;
  archetype?: string;
  style?: string;
  goal?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Extract and verify auth token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: { message: 'Unauthorized - missing auth token' } });
  }

  const token = authHeader.substring(7);
  
  // Verify the user with Supabase
  const { data: { user }, error: authError } = await admin().auth.getUser(token);
  if (authError || !user) {
    console.error('[preview] auth error:', authError);
    return res.status(401).json({ ok: false, error: { message: 'Unauthorized - invalid token' } });
  }

  const payload: PreviewInput = req.body;

  const { focus, durationMin, intensity, equipment, seed: providedSeed, archetype, style, goal } = payload;
  
  if (!durationMin || !intensity) {
    return res.status(400).json({ 
      ok: false, 
      error: { code: 'BAD_INPUT', message: 'Missing required fields: durationMin, intensity' } 
    });
  }

  try {
    // Validate OPENAI_API_KEY is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('[preview] OPENAI_API_KEY not found in environment');
      return res.status(500).json({ 
        ok: false, 
        error: { code: 'CONFIG_ERROR', message: 'OpenAI API key not configured' } 
      });
    }
    
    console.log('[preview] Generating lightweight workout preview');
    
    const equipmentList = equipment || ['bodyweight'];
    const workoutSeed = providedSeed || Math.random().toString(36).substring(7);
    const workoutStyle = archetype || style || focus || goal || 'crossfit';
    
    // Smart duration allocation based on total workout time
    let warmupMin, cooldownMin, mainMin;
    if (durationMin <= 10) {
      // Short workout: minimal warmup/cooldown
      warmupMin = 2;
      cooldownMin = 2;
      mainMin = Math.max(1, durationMin - 4);
    } else if (durationMin <= 20) {
      // Medium workout: balanced
      warmupMin = 3;
      cooldownMin = 3;
      mainMin = durationMin - 6;
    } else {
      // Long workout: full warmup/cooldown
      warmupMin = 5;
      cooldownMin = 5;
      mainMin = durationMin - 10;
    }
    
    // Lightweight OpenAI prompt for preview
    const systemPrompt = `You are a professional fitness coach generating Wodify-style workouts. 
Return ONLY valid JSON with this EXACT structure (no markdown, no code blocks):
{
  "title": "CREATIVE WORKOUT TITLE IN ALL CAPS",
  "description": "Brief workout description",
  "duration_min": ${durationMin},
  "intensity": ${intensity},
  "blocks": [
    {
      "kind": "warmup",
      "title": "Warm-up",
      "duration_min": ${warmupMin},
      "items": [
        { "exercise": "Exercise Name", "scheme": { "reps": 10 }, "notes": "Form cues" }
      ]
    },
    {
      "kind": "main",
      "title": "Main Workout",
      "duration_min": ${mainMin},
      "items": [
        { "exercise": "Exercise Name", "scheme": { "reps": 15 }, "notes": "Intensity notes" }
      ]
    },
    {
      "kind": "cooldown",
      "title": "Cool-down",
      "duration_min": ${cooldownMin},
      "items": [
        { "exercise": "Stretch Name", "scheme": { "duration_sec": 30 }, "notes": "Breathing cues" }
      ]
    }
  ],
  "coaching_notes": "Professional coaching tips for this workout"
}`;

    const userPrompt = `Generate a ${workoutStyle} workout:
- Duration: ${durationMin} minutes
- Intensity: ${intensity}/10
- Equipment: ${equipmentList.join(', ')}
- Style: ${workoutStyle}

Create a complete workout with warm-up (3-5 exercises), main section (3-7 exercises), and cool-down (3-4 exercises).
Use creative workout titles and include proper form cues.`;

    console.log('[preview] Calling OpenAI with lightweight prompt');

    // Generate workout with OpenAI
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.9, // Higher temperature for variety
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }
    });

    const raw = resp.choices?.[0]?.message?.content ?? '{}';
    let preview: any;
    
    try { 
      preview = JSON.parse(raw);
      console.log('[preview] Successfully generated preview');
    } catch (parseError) {
      console.error('[preview] Failed to parse OpenAI response:', parseError);
      return res.status(500).json({ 
        ok: false, 
        error: { code: 'PARSE_ERROR', message: 'Failed to parse workout preview' } 
      });
    }
    
    // Return the generated workout preview (DO NOT save to database)
    return res.status(200).json({ 
      ok: true, 
      preview,
      seed: workoutSeed,
      meta: {
        generator: 'openai-lightweight',
        model: 'gpt-4o-mini',
        timestamp: new Date().toISOString()
      }
    });
  } catch (e: any) {
    console.error('[preview] Error:', e);
    console.error('[preview] Stack:', e?.stack);
    return res.status(500).json({ 
      ok: false, 
      error: { code: 'INTERNAL', message: e?.message || 'Preview generation failed' } 
    });
  }
}
