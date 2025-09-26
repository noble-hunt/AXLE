import type { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { z, ZodError } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { createWorkoutFromSeed } from '../services/workouts/createFromSeed';

const StartSchema = z.object({
  // minimal set the client will send from the suggestion card
  focus: z.string().min(1),
  minutes: z.number().int().positive(),
  intensity: z.number().int().min(1).max(10),
  seed: z.record(z.any()).default({}),
  generatorVersion: z.string().default('v0.3.0'),
  source: z.string().default('daily-suggestion'),
});

export async function startSuggestedWorkout(req: Request, res: Response) {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'auth-required' });
    }

    const input = StartSchema.parse(req.body);
    const created = await createWorkoutFromSeed({
      userId,
      focus: input.focus,
      minutes: input.minutes,
      intensity: input.intensity,
      seed: input.seed,
      generatorVersion: input.generatorVersion,
      source: input.source,
    });

    return res.status(201).json({ id: created.id });
  } catch (err: any) {
    Sentry.captureException(err, { tags: { route: 'POST /api/workouts/start' } });
    
    // Handle Zod validation errors as 400 Bad Request
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'validation-failed', detail: err.message });
    }
    
    const status = err.statusCode ?? 500;
    return res.status(status).json({ error: 'start-failed', detail: err?.message });
  }
}