import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Activity, Target, Play } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { fetchDailySuggestion, type DailySuggestionResponse } from './api';
import { DailySuggestedCard } from './suggest/DailySuggestedCard';

export function DailyCard() {
  // Check for QA toggle in URL
  const showSeed = new URLSearchParams(window.location.search).get('showSeed') === '1';

  const {
    data,
    isLoading
  } = useQuery({
    queryKey: ['/api/suggestions/today'],
    queryFn: fetchDailySuggestion,
    retry: 1,
    staleTime: 2 * 60 * 1000 // 2 minutes
  });

  // Show toast for server errors (only once)
  useEffect(() => {
    if (data && data.suggestion === null && 'reason' in data && data.reason === 'server-error') {
      const errorData = data as { suggestion: null; reason: 'server-error'; error: string; requestId?: string };
      toast({
        title: "Couldn't load today's suggestion",
        description: `${errorData.error}${errorData.requestId ? ` (requestId: ${errorData.requestId})` : ''}`,
        variant: "destructive"
      });
    }
  }, [data]);

  // Loading state
  if (isLoading) {
    return (
      <Card data-testid="daily-card-loading" className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Today's Suggestion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Handle all null suggestion cases (unauth, insufficient-context, server-error)
  if (!data || data.suggestion === null) {
    const reason = data?.suggestion === null ? (data as any).reason : undefined;
    
    return (
      <Card data-testid="daily-card-cta" className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Today's Suggestion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {reason === 'unauthenticated' ? (
            <>
              <p className="text-muted-foreground">
                Sign in to get personalized daily workout suggestions based on your fitness history.
              </p>
              <Button data-testid="button-sign-in" className="w-full">
                Sign In
              </Button>
            </>
          ) : reason === 'insufficient-context' ? (
            <>
              <p className="text-muted-foreground">
                Complete your profile and log a few workouts to get personalized suggestions.
              </p>
              <Button data-testid="button-configure-profile" className="w-full">
                Configure Profile
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                Unable to load your daily suggestion right now. You can still generate a custom workout.
              </p>
              <Button data-testid="button-generate-workout" className="w-full">
                Generate Workout
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // Valid suggestion - extract data and use new component
  const { suggestion } = data;
  const seed = (data as any).seed;
  const request = suggestion.request || {};
  
  // Transform data for the new component
  const suggestionData = {
    focus: request.category || 'Mixed Training',
    minutes: request.duration || 30,
    intensity: request.intensity || 5,
    seed: seed || {},
    generatorVersion: seed?.generatorVersion || 'v0.3.0'
  };
  
  // Show seed debug info if enabled
  if (showSeed && seed) {
    return (
      <div className="space-y-4">
        <DailySuggestedCard suggestion={suggestionData} />
        <Badge 
          data-testid="seed-chip" 
          variant="outline" 
          className="text-xs cursor-pointer mx-auto block w-fit"
          onClick={() => {
            navigator.clipboard.writeText(`${seed.rngSeed}:${seed.generatorVersion}`);
            toast({ description: "Seed copied to clipboard" });
          }}
        >
          Debug: {seed.rngSeed?.slice(0, 8)}...
        </Badge>
      </div>
    );
  }
  
  return <DailySuggestedCard suggestion={suggestionData} />;
}