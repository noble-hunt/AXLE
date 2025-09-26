import { httpJSON } from '@/lib/http';


export type Suggestion = {
  focus: string;
  minutes: number;
  intensity: number;
  seed?: Record<string, any>;
  generatorVersion?: string;
};

export type TodaySuggestionResponse = {
  config: {
    focus: string;
    duration: number;
    intensity: number;
    equipment: string[];
    constraints: string[];
  };
  rationale: string;
  seed: {
    rngSeed: string;
    generatorVersion: string;
  };
};

export async function fetchTodaySuggestion(): Promise<TodaySuggestionResponse> {
  return await httpJSON('workouts/suggest/today');
}

export async function rotateSuggestion(): Promise<TodaySuggestionResponse> {
  try {
    const res = await httpJSON<{ suggestion: TodaySuggestionResponse }>('/api/workouts/suggest/rotate', {
      method: 'POST',
    });
    return res.suggestion;
  } catch (err: any) {
    const status = err?.status ?? 0;
    const isAPIUnavailable = status === 404 || status === 405;
    
    if (isAPIUnavailable) {
      // If rotate endpoint doesn't exist, fall back to fetching a new suggestion
      return await fetchTodaySuggestion();
    }
    
    throw err;
  }
}

export async function startSuggestedWorkout(s: Suggestion) {
  // Try the new endpoint first
  try {
    const res = await httpJSON<{ workoutId: string }>('workouts/suggest/today/start', {
      method: 'POST',
    });
    
    if (res?.workoutId && typeof res.workoutId === 'string' && res.workoutId.trim()) {
      return res.workoutId;
    }
  } catch (err: any) {
    const status = err?.status ?? 0;
    const isAPIUnavailable = status === 404 || status === 405 || 
      (err?.body && typeof err.body === 'string' && err.body.includes('<!DOCTYPE html'));
    
    if (!isAPIUnavailable) {
      // If it's not an availability issue, throw the error to be handled by the component
      throw err;
    }
    
    // If API is unavailable (404/405/HTML), fall back to the old endpoint
  }

  // Fallback to old endpoint
  const res = await httpJSON('workouts/start', {
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

export async function generateWorkout(cfg: { focus: string; duration: number; intensity: number; equipment?: string[] }) {
  const res = await httpJSON<{ ok: boolean; workout: any }>('workouts/generate', {
    method: 'POST',
    body: JSON.stringify({
      goal: cfg.focus,
      durationMin: cfg.duration,
      intensity: cfg.intensity,
      equipment: cfg.equipment || ['bodyweight'],
    }),
  });
  
  if (!res || !res.workout) {
    throw new Error('Invalid response: missing workout data');
  }
  
  return res.workout;
}

export async function getWorkout(id: string) {
  return await httpJSON(`workouts/${id}`);
}

export async function startWorkout(id: string) {
  const res = await httpJSON<{ id: string }>(`workouts/${id}/start`, {
    method: 'POST',
  });
  
  if (!res || !res.id) {
    throw new Error('Invalid response: missing workout id');
  }
  
  return res.id;
}