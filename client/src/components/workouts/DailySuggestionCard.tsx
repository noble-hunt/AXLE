import { useState } from 'react';
import { Link } from 'wouter';
import { Card } from '@/components/swift/card';
import { Button } from '@/components/swift/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Clock, Activity, LogIn, RotateCcw, Info, Zap, Heart, TrendingUp, Calendar } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useDailySuggestion } from '@/features/workouts/useDailySuggestion';
import { StartNowButton } from '@/features/workouts/suggest/StartNowButton';

export function DailySuggestionCard() {
  const { isAuthenticated } = useAppStore();
  const [showRationale, setShowRationale] = useState(false);
  const {
    data,
    isLoading,
    error,
    isRotating,
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
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-2">
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
            <div className="flex flex-wrap gap-2 justify-center">
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
            <StartNowButton />
            
            <div className="flex gap-2 px-4">
              <Button
                data-testid="button-try-different"
                onClick={tryDifferentFocus}
                disabled={isRotating}
                variant="secondary"
                size="sm"
                className="flex-1 text-xs"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                {isRotating ? 'Rotating...' : 'Try Different Focus'}
              </Button>
              
              <Button
                data-testid="button-show-rationale"
                onClick={() => setShowRationale(true)}
                variant="secondary"
                size="sm"
                className="flex-1 text-xs"
              >
                <Info className="w-3 h-3 mr-1" />
                Show Rationale
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Rationale Dialog */}
      <Dialog open={showRationale} onOpenChange={setShowRationale}>
        <DialogContent data-testid="rationale-dialog" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Workout Rationale</DialogTitle>
            <DialogDescription>
              Why we chose this workout for you today
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            {/* Why This Workout - Most Important Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-foreground">Why This Workout</h4>
              </div>
              <ul className="space-y-2">
                {rationale.rulesApplied.map((rule, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Suggestion Scores */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-foreground">Suggestion Scores</h4>
              </div>
              <div className="space-y-3">
                {Object.entries(rationale.scores).map(([key, value]) => {
                  const percentage = Math.round(value * 100);
                  const label = key.replace(/([A-Z])/g, ' $1').trim();
                  const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);
                  
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">{capitalizedLabel}</span>
                        <span className="font-medium text-foreground">{percentage}%</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Health Metrics */}
            {rationale.sources.health && Object.keys(rationale.sources.health).some(key => rationale.sources.health![key as keyof typeof rationale.sources.health] != null) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-foreground">Health Metrics</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(rationale.sources.health).map(([key, value]) => {
                    if (value == null) return null;
                    
                    const label = key.replace(/([A-Z])/g, ' $1').trim();
                    const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);
                    
                    return (
                      <div key={key} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                        <span className="text-xs text-muted-foreground">{capitalizedLabel}</span>
                        <span className="text-sm font-medium text-foreground">{Math.round(value as number)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            {(rationale.sources.weeklyCounts || rationale.sources.monthlyCounts) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-foreground">Recent Activity</h4>
                </div>
                <div className="space-y-3">
                  {rationale.sources.weeklyCounts && Object.keys(rationale.sources.weeklyCounts).length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">This Week</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(rationale.sources.weeklyCounts).map(([category, count]) => (
                          <Badge key={category} variant="outline" className="text-xs">
                            {category}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {rationale.sources.monthlyCounts && Object.keys(rationale.sources.monthlyCounts).length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">This Month</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(rationale.sources.monthlyCounts).map(([category, count]) => (
                          <Badge key={category} variant="secondary" className="text-xs">
                            {category}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Considerations */}
            {config.constraints && config.constraints.length > 0 && (
              <div>
                <h4 className="font-semibold text-foreground mb-3">Additional Considerations</h4>
                <ul className="space-y-1">
                  {config.constraints.map((constraint, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-primary">•</span>
                      <span>{constraint}</span>
                    </li>
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