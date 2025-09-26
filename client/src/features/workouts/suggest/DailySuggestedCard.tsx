import { useState } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { startSuggestedWorkout } from './api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity } from 'lucide-react';

export function DailySuggestedCard({ suggestion }: { suggestion: {
  focus: string; 
  minutes: number; 
  intensity: number; 
  seed?: Record<string, any>; 
  generatorVersion?: string;
}}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const onStart = async () => {
    setLoading(true);
    try {
      const id = await startSuggestedWorkout(suggestion);
      setLocation(`/workout/${id}`);
    } catch (e: any) {
      toast({
        title: 'Could not start workout',
        description: "We'll open the generator so you can build one quickly.",
        variant: 'destructive',
      });
      setLocation('/workout-generate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card data-testid="daily-suggested-card" className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Today's Suggestion
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-muted-foreground text-sm">Personalized for today</div>
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold" data-testid="text-focus">{suggestion.focus}</div>
          <div className="text-sm opacity-80" data-testid="text-details">
            {suggestion.minutes}m · {suggestion.intensity}/10
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            data-testid="button-start-now"
            onClick={onStart}
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Starting…' : 'Start Now'}
          </Button>
          <Button
            data-testid="button-try-different"
            onClick={() => setLocation('/workout-generate')}
            variant="outline"
          >
            Try Different Focus
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}