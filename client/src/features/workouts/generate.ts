import { httpJSON } from '@/lib/http';
import { toast } from '@/hooks/use-toast';

export async function generateWorkout(input:{category:string;durationMin:number;intensity:number;equipment?:string[];goal?:string;}) {
  try {
    const data = await httpJSON('/workouts/generate', {
      method: 'POST', 
      headers: { 'content-type': 'application/json' }, 
      body: JSON.stringify(input),
    });
    return data.workout;
  } catch (error: any) {
    toast({
      title: "Workout Generation Failed",
      description: error.message || "Unable to generate workout. Please try again.",
      variant: "destructive"
    });
    throw error;
  }
}