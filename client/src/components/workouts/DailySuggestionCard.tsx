import { useState } from 'react';
import { Link } from 'wouter';
import { Card } from '@/components/swift/card';
import { Button } from '@/components/swift/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clock, Activity, Target, LogIn, RotateCcw, Info, Zap } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useDailySuggestion } from '@/features/workouts/useDailySuggestion';

export function DailySuggestionCard() {
  const { isAuthenticated } = useAppStore();
  const [showRationale, setShowRationale] = useState(false);
  const {
    data,
    isLoading,
    error,
    isStarting,
    isRotating,
    startNow,
    tryDifferentFocus
  } = useDailySuggestion();

  // Show sign-in state for unauthenticated users
  if (!isAuthenticated) {
    return (
      <Card data-testid="daily-suggestion-card-cta" className="w-full p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="text-body font-medium text-foreground">Daily Suggested Workout</h3>
          </div>
          <p className="text-caption text-muted-foreground">
            Sign in to get personalized daily workout suggestions based on your fitness history.
          </p>
          <Button data-testid="button-sign-in" className="w-full" asChild>
            <Link href="/auth/login">
              <LogIn className="h-4 w-4 mr-2" />
              Sign In
            </Link>
          </Button>
        </div>
      </Card>
    );
  }

  // Loading state for authenticated users
  if (isLoading) {
    return (
      <Card data-testid="daily-suggestion-card-loading" className="w-full p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="text-body font-medium text-foreground">Daily Suggested Workout</h3>
          </div>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="flex gap-2">
              <div className="h-6 bg-muted rounded-full w-16"></div>
              <div className="h-6 bg-muted rounded-full w-12"></div>
            </div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  // Error state for authenticated users
  if (error) {
    return (
      <Card data-testid="daily-suggestion-card-error" className="w-full p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="text-body font-medium text-foreground">Daily Suggested Workout</h3>
          </div>
          <p className="text-caption text-muted-foreground">
            Unable to load your daily suggestion right now. You can still generate a custom workout.
          </p>
          <Button data-testid="button-generate-workout" className="w-full" asChild>
            <Link href="/workout/generate">Generate Workout</Link>
          </Button>
        </div>
      </Card>
    );
  }

  // Handle missing data
  if (!data) {
    return (
      <Card data-testid="daily-suggestion-card-no-data" className="w-full p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="text-body font-medium text-foreground">Daily Suggested Workout</h3>
          </div>
          <p className="text-caption text-muted-foreground">
            Complete your profile and log a few workouts to get personalized suggestions.
          </p>
          <Button data-testid="button-configure-profile" className="w-full" asChild>
            <Link href="/profile">Configure Profile</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const { config, rationale } = data;

  // Helper to get intensity badge variant
  const getIntensityVariant = (intensity: number) => {
    if (intensity <= 3) return "secondary";
    if (intensity <= 6) return "default";
    if (intensity <= 8) return "destructive";
    return "destructive";
  };

  return (
    <>
      <Card data-testid="daily-suggestion-card" className="w-full p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="text-body font-medium text-foreground">Daily Suggested Workout</h3>
          </div>
          
          <p className="text-caption text-muted-foreground">Personalized for today</p>
          
          {/* Workout details */}
          <div className="space-y-3">
            <div className="text-subheading font-bold text-foreground" data-testid="text-focus">
              {config.focus || 'Mixed Training'}
            </div>
            
            {/* Pills for duration, intensity, equipment */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" data-testid="badge-duration">
                <Clock className="w-3 h-3 mr-1" />
                {config.duration || 30}min
              </Badge>
              <Badge variant={getIntensityVariant(config.intensity || 5)} data-testid="badge-intensity">
                <Zap className="w-3 h-3 mr-1" />
                {config.intensity || 5}/10
              </Badge>
              {config.equipment && config.equipment.length > 0 && (
                <Badge variant="outline" data-testid="badge-equipment">
                  {config.equipment[0]}
                </Badge>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <Button
              data-testid="button-start-now"
              onClick={startNow}
              disabled={isStarting}
              className="w-full"
            >
              <Target className="w-4 h-4 mr-2" />
              {isStarting ? 'Starting...' : 'Start Now'}
            </Button>
            
            <div className="flex gap-2">
              <Button
                data-testid="button-try-different"
                onClick={tryDifferentFocus}
                disabled={isRotating}
                variant="outline"
                className="flex-1"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {isRotating ? 'Rotating...' : 'Try Different Focus'}
              </Button>
              
              <Button
                data-testid="button-show-rationale"
                onClick={() => setShowRationale(true)}
                variant="outline"
                className="flex-1"
              >
                <Info className="w-4 h-4 mr-2" />
                Show Rationale
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Rationale Dialog */}
      <Dialog open={showRationale} onOpenChange={setShowRationale}>
        <DialogContent data-testid="rationale-dialog">
          <DialogHeader>
            <DialogTitle>Workout Rationale</DialogTitle>
            <DialogDescription>
              Why we chose this workout for you today
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div className="text-sm text-muted-foreground">
              {rationale || 'This workout was selected based on your fitness profile, recent activity, and recovery status.'}
            </div>
            {config.constraints && config.constraints.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Considerations:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {config.constraints.map((constraint, index) => (
                    <li key={index}>• {constraint}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}