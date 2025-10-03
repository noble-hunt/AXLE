import { authFetch } from '@/lib/authFetch';
import { toast } from '@/hooks/use-toast';
import { API_ORIGIN, API_PREFIX } from '@/lib/env';

export async function parseFreeform(text: string) {
  try {
    const response = await authFetch(`${API_ORIGIN}${API_PREFIX}/workouts/parse-freeform`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Parse failed');
    }
    
    const data = await response.json();
    return data.parsed as any;
  } catch (error: any) {
    toast({
      title: "Workout Parsing Failed",
      description: error.message || "Unable to parse workout text. Please try again.",
      variant: "destructive"
    });
    throw error;
  }
}

export async function logFreeform(parsed: any, title?: string) {
  try {
    const response = await authFetch(`${API_ORIGIN}${API_PREFIX}/workouts/log-freeform`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ parsed, title }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Log failed');
    }
    
    const data = await response.json();
    return data.id as string;
  } catch (error: any) {
    toast({
      title: "Workout Logging Failed",
      description: error.message || "Unable to log workout. Please try again.",
      variant: "destructive"
    });
    throw error;
  }
}