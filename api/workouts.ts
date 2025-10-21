// api/workouts.ts - Create workout (Vercel serverless function)
import { admin } from '../lib/api-helpers/supabase';
import { z } from 'zod';

export const config = { runtime: 'nodejs' };

// Workout validation schema
const insertWorkoutSchema = z.object({
  title: z.string(),
  request: z.record(z.any()),
  sets: z.array(z.any()),
  notes: z.string().optional(),
  completed: z.boolean().optional(),
  feedback: z.record(z.any()).optional()
});

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  // Extract and verify auth token
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized - missing auth token' }, 401);
  }

  const token = authHeader.substring(7);
  
  // Verify the user with Supabase
  const { data: { user }, error: authError } = await admin().auth.getUser(token);
  if (authError || !user) {
    console.error('[workouts:create] auth error:', authError);
    return json({ error: 'Unauthorized - invalid token' }, 401);
  }

  let payload: any;
  try { 
    payload = await req.json(); 
  } catch { 
    return json({ error: 'Invalid JSON body' }, 400); 
  }

  try {
    const validatedData = insertWorkoutSchema.parse(payload);
    
    // Create workout data for insertion
    const workoutData = {
      user_id: user.id,
      title: validatedData.title,
      request: validatedData.request,
      sets: validatedData.sets,
      notes: validatedData.notes || null,
      completed: validatedData.completed || false,
      feedback: validatedData.feedback || null
    };
    
    // Insert workout using Supabase admin client
    const { data: workout, error: dbError } = await admin()
      .from('workouts')
      .insert(workoutData)
      .select('id')
      .single();

    if (dbError || !workout) {
      console.error('[workouts:create] DB error:', dbError);
      return json({ error: 'create_failed' }, 500);
    }

    // Validate that we got a valid UUID back
    const UUIDv4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!workout?.id || !UUIDv4.test(workout.id)) {
      console.error('[workouts:create] invalid id returned:', workout?.id);
      return json({ error: 'no_valid_id' }, 500);
    }
    
    console.log(`[WORKOUTS] Created workout ${workout.id} for user ${user.id}`);
    
    // Return only the id
    return json({ id: workout.id }, 200);
  } catch (error: any) {
    console.error('[workouts:create] error:', error);
    if (error instanceof z.ZodError) {
      return json({ error: 'validation_failed', issues: error.issues }, 400);
    }
    return json({ error: 'create_failed' }, 500);
  }
}

function json(x: any, status = 200) {
  return new Response(JSON.stringify(x), {
    status, 
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}
