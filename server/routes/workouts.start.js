import * as Sentry from '@sentry/node';
import { z, ZodError } from 'zod';
import { createWorkoutFromSeed } from '../services/workouts/createFromSeed.js';
const StartSchema = z.object({
    // minimal set the client will send from the suggestion card
    focus: z.string().min(1),
    minutes: z.number().int().positive(),
    intensity: z.number().int().min(1).max(10),
    seed: z.record(z.any()).default({}),
    generatorVersion: z.string().default('v0.3.0'),
    source: z.string().default('daily-suggestion'),
});
export async function startSuggestedWorkout(req, res) {
    try {
        const authReq = req;
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
        // Guard: Ensure service returned valid id
        if (!created || typeof created.id !== 'string' || !created.id.trim()) {
            throw Object.assign(new Error('Service returned invalid workout id'), { statusCode: 502 });
        }
        return res.status(201).json({ id: created.id });
    }
    catch (err) {
        Sentry.captureException(err, { tags: { route: 'POST /api/workouts/start' } });
        // Handle Zod validation errors as 400 Bad Request
        if (err instanceof ZodError) {
            return res.status(400).json({ error: 'validation-failed', detail: err.message });
        }
        const status = err.statusCode ?? 500;
        return res.status(status).json({ error: 'start-failed', detail: err?.message });
    }
}
