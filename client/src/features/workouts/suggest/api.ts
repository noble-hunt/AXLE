import { httpJSON } from '@/lib/http';

export type Suggestion = {
  focus: string;
  minutes: number;
  intensity: number;
  seed?: Record<string, any>;
  generatorVersion?: string;
};

export async function startSuggestedWorkout(s: Suggestion) {
  const res = await httpJSON('/api/workouts/start', {
    method: 'POST',
    body: JSON.stringify({
      focus: s.focus,
      minutes: s.minutes,
      intensity: s.intensity,
      seed: s.seed || {},
      generatorVersion: s.generatorVersion || 'v0.3.0',
      source: 'daily-suggestion',
    }),
  });
  
  // Validate the response has a valid id
  if (!res || typeof res !== 'object' || !('id' in res) || typeof (res as any).id !== 'string' || !(res as any).id.trim()) {
    throw new Error('Invalid response: missing or invalid workout id');
  }
  
  return (res as { id: string }).id;
}