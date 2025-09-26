import { httpJSON } from '@/lib/http';
import { toast } from '@/hooks/use-toast';

export async function parseFreeform(text: string) {
  try {
    const data = await httpJSON('/workouts/parse-freeform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
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
    const data = await httpJSON('/workouts/log-freeform', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ parsed, title }),
    });
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