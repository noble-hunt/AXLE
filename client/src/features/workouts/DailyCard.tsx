import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Activity, Target, Play } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { fetchDailySuggestion, type DailySuggestionResponse } from './api';

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

  // Valid suggestion - show preview  
  const { suggestion } = data;
  const seed = (data as any).seed;
  const request = suggestion.request || {};
  
  return (
    <Card data-testid="daily-card-preview" className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Today's Suggestion
          </CardTitle>
          {showSeed && seed && (
            <Badge 
              data-testid="seed-chip" 
              variant="outline" 
              className="text-xs cursor-pointer"
              onClick={() => {
                navigator.clipboard.writeText(`${seed.rngSeed}:${seed.generatorVersion}`);
                toast({ description: "Seed copied to clipboard" });
              }}
            >
              {seed.rngSeed?.slice(0, 8)}...
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick preview bullets */}
        <div className="space-y-2">
          {request.category && (
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span data-testid="text-archetype">{request.category}</span>
            </div>
          )}
          {request.duration && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span data-testid="text-duration">{request.duration} minutes</span>
            </div>
          )}
          {request.intensity && (
            <div className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span data-testid="text-intensity">Intensity {request.intensity}/10</span>
            </div>
          )}
        </div>

        {/* Main block preview (if available) */}
        {suggestion.rationale?.mainFocus && (
          <p className="text-sm text-muted-foreground" data-testid="text-main-focus">
            {suggestion.rationale.mainFocus}
          </p>
        )}

        <Button data-testid="button-start-workout" className="w-full">
          <Play className="h-4 w-4 mr-2" />
          Start This Workout
        </Button>
      </CardContent>
    </Card>
  );
}