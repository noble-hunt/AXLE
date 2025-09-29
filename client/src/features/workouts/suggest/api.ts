import { authFetch } from '@/lib/authFetch';
import { API_ORIGIN, API_PREFIX } from '@/lib/env';

export async function startSuggestion(): Promise<string> {
  const response = await authFetch(`${API_ORIGIN}${API_PREFIX}/suggest/start`, { 
    method: 'POST' 
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to start suggestion');
  }
  
  const data = await response.json();
  return data.workoutId;
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
  const response = await authFetch(`${API_ORIGIN}${API_PREFIX}/workouts/suggest/today`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to fetch daily suggestion');
  }
  
  const data = await response.json();
  return data.suggestion;
}

export async function rotateSuggestion(): Promise<TodaySuggestionResponse> {
  try {
    const response = await authFetch(`${API_ORIGIN}${API_PREFIX}/workouts/suggest/rotate`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to rotate suggestion');
    }
    
    const res = await response.json();
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
    const response = await authFetch(`${API_ORIGIN}${API_PREFIX}/workouts/suggest/today/start`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to start suggested workout');
    }
    
    const res = await response.json();
    
    if (res?.workoutId && typeof res.workoutId === 'string' && res.workoutId.trim()) {
      return res.workoutId;
    }
  } catch (err: any) {
    const status = err?.status ?? 0;
    const isAPIUnavailable = status === 404 || status === 405;
    
    if (!isAPIUnavailable) {
      // If it's not an availability issue, throw the error to be handled by the component
      throw err;
    }
    
    // If API is unavailable (404/405), fall back to the old endpoint
  }

  // Fallback to old endpoint (still using authFetch for consistency)
  const response = await authFetch(`${API_ORIGIN}${API_PREFIX}/workouts/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      focus: s.focus,
      minutes: s.minutes,
      intensity: s.intensity,
      seed: s.seed || {},
      generatorVersion: s.generatorVersion || 'v0.3.0',
      source: 'daily-suggestion',
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to start workout');
  }
  
  const res = await response.json();
  
  // Validate the response has a valid id
  if (!res || typeof res !== 'object' || !('id' in res) || typeof (res as any).id !== 'string' || !(res as any).id.trim()) {
    throw new Error('Invalid response: missing or invalid workout id');
  }
  
  return (res as { id: string }).id;
}

export async function generateWorkout(cfg: { focus: string; duration: number; intensity: number; equipment?: string[] }) {
  const response = await authFetch(`${API_ORIGIN}${API_PREFIX}/workouts/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal: cfg.focus,
      durationMin: cfg.duration,
      intensity: cfg.intensity,
      equipment: cfg.equipment || ['bodyweight'],
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to generate workout');
  }
  
  const res = await response.json();
  
  if (!res || !res.workout) {
    throw new Error('Invalid response: missing workout data');
  }
  
  return res.workout;
}

export async function getWorkout(id: string) {
  const response = await authFetch(`${API_ORIGIN}${API_PREFIX}/workouts/${id}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to get workout');
  }
  
  return await response.json();
}

export async function startWorkout(id: string) {
  const response = await authFetch(`${API_ORIGIN}${API_PREFIX}/workouts/${id}/start`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to start workout');
  }
  
  const res = await response.json();
  
  if (!res || !res.id) {
    throw new Error('Invalid response: missing workout id');
  }
  
  return res.id;
}