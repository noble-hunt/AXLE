import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Activity, Target, Play, LogIn } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAppStore } from '@/store/useAppStore';
import { fetchTodaySuggestion, type TodaySuggestionResponse } from './suggest/api';
import { DailySuggestedCard } from './suggest/DailySuggestedCard';

export function DailyCard() {
  const { isAuthenticated } = useAppStore();
  
  // Check for QA toggle in URL
  const showSeed = new URLSearchParams(window.location.search).get('showSeed') === '1';

  const {
    data,
    isLoading,
    error
  } = useQuery({
    queryKey: ['/api/workouts/suggest/today'],
    queryFn: fetchTodaySuggestion,
    enabled: isAuthenticated, // Only fetch when authenticated
    retry: 1,
    staleTime: 2 * 60 * 1000 // 2 minutes
  });

  // Show toast for server errors (only once)
  useEffect(() => {
    if (error) {
      toast({
        title: "Couldn't load today's suggestion",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
    }
  }, [error]);

  // Show sign-in state for unauthenticated users
  if (!isAuthenticated) {
    return (
      <Card data-testid="daily-card-cta" className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Today's Suggestion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Sign in to get personalized daily workout suggestions based on your fitness history.
          </p>
          <Button data-testid="button-sign-in" className="w-full" asChild>
            <Link href="/auth/login">
              <LogIn className="h-4 w-4 mr-2" />
              Sign In
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Loading state for authenticated users
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

  // Error state for authenticated users
  if (error) {
    return (
      <Card data-testid="daily-card-error" className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Today's Suggestion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Unable to load your daily suggestion right now. You can still generate a custom workout.
          </p>
          <Button data-testid="button-generate-workout" className="w-full" asChild>
            <Link href="/suggest">Generate Workout</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Handle missing data
  if (!data) {
    return (
      <Card data-testid="daily-card-no-data" className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Today's Suggestion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Complete your profile and log a few workouts to get personalized suggestions.
          </p>
          <Button data-testid="button-configure-profile" className="w-full" asChild>
            <Link href="/profile">Configure Profile</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Valid suggestion - extract data and transform for DailySuggestedCard
  const { config, seed } = data;
  
  // Transform data for the new component
  const suggestionData = {
    focus: config.focus || 'Mixed Training',
    minutes: config.duration || 30,
    intensity: config.intensity || 5,
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