// api/workouts/preview.ts (Vercel serverless function)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin } from '../../lib/api-helpers/supabase';

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
    
    console.log('[preview] Starting import of workout generator');
    
    // Import the workout generator with detailed error logging
    let generateWorkout, generateSeed;
    try {
      const generatorModule = await import('../../server/workoutGenerator');
      generateWorkout = generatorModule.generateWorkout;
      console.log('[preview] Successfully imported generateWorkout');
    } catch (importError: any) {
      console.error('[preview] Failed to import workoutGenerator:', importError.message, importError.stack);
      return res.status(500).json({ 
        ok: false, 
        error: { code: 'IMPORT_ERROR', message: `Failed to load workout generator: ${importError.message}` } 
      });
    }
    
    try {
      const seedModule = await import('../../server/lib/seededRandom');
      generateSeed = seedModule.generateSeed;
      console.log('[preview] Successfully imported generateSeed');
    } catch (importError: any) {
      console.error('[preview] Failed to import seededRandom:', importError.message);
      return res.status(500).json({ 
        ok: false, 
        error: { code: 'IMPORT_ERROR', message: `Failed to load seed generator: ${importError.message}` } 
      });
    }
    
    const equipmentList = equipment || ['bodyweight'];
    const workoutSeed = providedSeed || generateSeed();
    const workoutStyle = style || focus || goal || archetype || 'crossfit';
    
    // Build request for the OpenAI-first generator
    const generatorRequest = {
      category: archetype || workoutStyle,
      duration: durationMin,
      intensity,
      goal: workoutStyle,
      focus: workoutStyle,
      style: workoutStyle,
      equipment: equipmentList,
      seed: workoutSeed,
      durationMin
    };
    
    console.log('[AXLE /preview] OpenAI-first generation:', {
      style: workoutStyle,
      duration: durationMin,
      equipment: equipmentList.length
    });
    
    // Generate workout using OpenAI-first approach
    const generatedWorkout = await generateWorkout(generatorRequest as any);
    const meta = (generatedWorkout as any)?.meta || {};
    
    // Return the generated workout with seed
    return res.status(200).json({ 
      ok: true, 
      preview: generatedWorkout,
      seed: workoutSeed,
      meta
    });
  } catch (e: any) {
    console.error('[AXLE][preview] Error:', e);
    console.error('[AXLE][preview] Stack:', e?.stack);
    return res.status(500).json({ 
      ok: false, 
      error: { code: 'INTERNAL', message: e?.message || 'Preview generation failed', stack: e?.stack?.split('\n')[0] } 
    });
  }
}
