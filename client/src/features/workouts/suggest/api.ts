import { httpJSON } from '@/lib/http';
import { API_ENDPOINTS } from '@shared/endpoints';

// Helper to convert server API paths to client httpJSON format
function apiPath(endpoint: string): string {
  // httpJSON expects paths relative to /api/ base
  return endpoint.replace(/^\/api\//, '');
}

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
  return await httpJSON(apiPath(API_ENDPOINTS.WORKOUTS_SUGGEST_TODAY));
}

export async function startSuggestedWorkout(s: Suggestion) {
  // Try the new endpoint first
  try {
    const res = await httpJSON<{ workoutId: string }>(apiPath(API_ENDPOINTS.WORKOUTS_SUGGEST_TODAY_START), {
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