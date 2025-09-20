import { useState } from "react"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { Chip } from "@/components/swift/chip"
import { Sheet } from "@/components/swift/sheet"
import { useSuggestedWorkout } from "@/hooks/useSuggestedWorkout"
import { 
  Target, 
  Clock, 
  Zap, 
  RotateCcw, 
  Info,
  TrendingUp,
  Activity,
  Heart,
  Brain,
  Moon,
  Gauge
} from "lucide-react"

// Intensity badge variants
const getIntensityVariant = (intensity: number) => {
  if (intensity <= 3) return "success"
  if (intensity <= 6) return "warning"  
  if (intensity <= 8) return "destructive"
  return "destructive"
}

// Category color mapping
const getCategoryColor = (category: string) => {
  const colorMap: Record<string, string> = {
    'strength': 'bg-blue-500',
    'cardio': 'bg-red-500', 
    'flexibility': 'bg-green-500',
    'sports': 'bg-purple-500',
    'crossfit': 'bg-orange-500',
    'hiit': 'bg-yellow-500',
    'powerlifting': 'bg-indigo-500',
    'olympic_lifting': 'bg-pink-500'
  }
  return colorMap[category.toLowerCase()] || 'bg-gray-500'
}

// Simple chart component for 7-day category mix
function CategoryMixChart({ categories }: { categories: { category: string; count: number }[] }) {
  const total = categories.reduce((sum, cat) => sum + cat.count, 0)
  
  if (total === 0) {
    return (
      <div className="text-center py-4">
        <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No workout history</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Last 7 Days</span>
        <span>{total} workouts</span>
      </div>
      <div className="space-y-2">
        {categories.map((cat) => {
          const percentage = (cat.count / total) * 100
          return (
            <div key={cat.category} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="capitalize text-foreground">{cat.category}</span>
                <span className="text-muted-foreground">{cat.count}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${getCategoryColor(cat.category)}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface SuggestionCardProps {
  variant?: 'home' | 'workout'
  className?: string
}

export function SuggestionCard({ variant = 'home', className = '' }: SuggestionCardProps) {
  const [showRationale, setShowRationale] = useState(false)
  const { suggestion, isLoading, startNow, regenerate, isGenerating } = useSuggestedWorkout()

  // Mock 7-day category data - in real app this would come from API
  const mockCategoryData = [
    { category: 'strength', count: 3 },
    { category: 'cardio', count: 2 },
    { category: 'flexibility', count: 1 }
  ]

  // Render loading state
  if (isLoading) {
    return (
      <Card className={className} data-testid="suggestion-card-loading">
        <div className={`${variant === 'workout' ? 'space-y-2' : 'space-y-3'}`}>
            <div className="text-center">
              <h3 className="text-subheading font-semibold text-foreground mb-1">Daily Suggested Workout</h3>
              <p className="text-caption text-muted-foreground mb-4">Personalized for today</p>
            </div>
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
              <div className="flex gap-2 mt-3">
                <div className="h-6 bg-muted rounded w-16"></div>
                <div className="h-6 bg-muted rounded w-12"></div>
                <div className="h-6 bg-muted rounded w-14"></div>
              </div>
            </div>
        </div>
      </Card>
    )
  }

  // Render empty state
  if (!suggestion) {
    return (
      <Card className={className} data-testid="suggestion-card-empty">
        <div className="text-center">
            <h3 className="text-subheading font-semibold text-foreground mb-1">Daily Suggested Workout</h3>
            <p className="text-caption text-muted-foreground mb-4">Personalized for today</p>
            <p className="text-body text-foreground mb-4">
              Sign in to get daily suggestions tailored to your fitness goals and workout history.
            </p>
        </div>
      </Card>
    )
  }

  const handleStartNow = async () => {
    try {
      await startNow()
    } catch (error) {
      console.error('Failed to start workout:', error)
    }
  }

  const handleRegenerate = async () => {
    try {
      await regenerate()
    } catch (error) {
      console.error('Failed to regenerate suggestion:', error)
    }
  }

  // Helper function to extract health-related rules from rationale
  const getHealthInfluences = (): { rule: string; icon: JSX.Element }[] => {
    if (!suggestion?.rationale || typeof suggestion.rationale !== 'object') return [];
    
    const rationale = suggestion.rationale as any;
    if (!rationale.rulesApplied || !Array.isArray(rationale.rulesApplied)) return [];
    
    const healthRules = rationale.rulesApplied.filter((rule: string) => 
      rule.toLowerCase().includes('sleep') ||
      rule.toLowerCase().includes('stress') || 
      rule.toLowerCase().includes('hrv') ||
      rule.toLowerCase().includes('resting hr') ||
      rule.toLowerCase().includes('fatigue')
    );

    return healthRules.map((rule: string) => {
      let icon = <Gauge className="w-4 h-4" />;
      if (rule.toLowerCase().includes('sleep')) {
        icon = <Moon className="w-4 h-4" />;
      } else if (rule.toLowerCase().includes('stress')) {
        icon = <Brain className="w-4 h-4" />;
      } else if (rule.toLowerCase().includes('hrv') || rule.toLowerCase().includes('resting hr')) {
        icon = <Heart className="w-4 h-4" />;
      }
      
      return { rule, icon };
    });
  };

  const healthInfluences = getHealthInfluences();

  return (
    <>
      <Card className={className} data-testid="suggestion-card">
        <div className={`${variant === 'workout' ? 'space-y-3' : 'space-y-4'}`}>
            <div className="text-center">
              <h3 className="text-subheading font-semibold text-foreground mb-1">Daily Suggested Workout</h3>
              <p className="text-caption text-muted-foreground">Personalized for today</p>
            </div>
            
            {/* Pills for category, duration, intensity */}
            {suggestion?.request && (
              <div className="flex flex-wrap gap-2 justify-center">
                <Chip size="sm" variant="default" data-testid="chip-category">
                  {(() => {
                    const request = suggestion.request as any;
                    const category = request.category || 'Strength';
                    return String(category.charAt(0).toUpperCase() + category.slice(1));
                  })()}
                </Chip>
                <Chip size="sm" variant={getIntensityVariant((suggestion.request as any).intensity || 5)} data-testid="chip-intensity">
                  <Zap className="w-3 h-3 mr-1" />
                  {String((suggestion.request as any).intensity || 5)}/10
                </Chip>
                <Chip size="sm" variant="default" data-testid="chip-duration">
                  <Clock className="w-3 h-3 mr-1" />
                  {String((suggestion.request as any).duration || 30)}min
                </Chip>
              </div>
            )}

            {/* Brief rationale preview */}
            {suggestion?.rationale && (
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {((suggestion.rationale as any).rulesApplied?.[0]) || "Personalized workout based on your fitness profile"}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2">
              <Button 
                className="w-full"
                onClick={handleStartNow}
                disabled={isGenerating}
                aria-label="Start your suggested workout now"
                data-testid="button-start-now"
              >
                <Target className="w-4 h-4 mr-2" />
                {isGenerating ? 'Generating...' : 'Start Now'}
              </Button>
              
              <div className="flex gap-2">
                <Button 
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowRationale(true)}
                  aria-label="Show workout rationale and insights"
                  data-testid="button-show-rationale"
                  className="flex-1"
                >
                  <Info className="w-4 h-4 mr-2" />
                  Show Rationale
                </Button>
                
                <Button 
                  variant="secondary"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                  aria-label="Try a different workout focus"
                  data-testid="button-regenerate"
                  className="flex-1"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {isGenerating ? 'Regenerating...' : 'Try Different Focus'}
                </Button>
              </div>
            </div>
        </div>
      </Card>

      {/* Rationale Bottom Sheet */}
      <Sheet 
        open={showRationale} 
        onOpenChange={setShowRationale}
        data-testid="rationale-sheet"
      >
        <div className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
              <TrendingUp className="w-6 h-6 text-accent" />
            </div>
            <h2 className="text-subheading font-bold text-foreground">Workout Rationale</h2>
            <p className="text-body text-muted-foreground">Why we chose this workout for you</p>
          </div>

          {/* Health Influence Section */}
          {healthInfluences.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-body font-semibold text-foreground">Health Influence</h3>
              <div className="space-y-2">
                {healthInfluences.map(({ rule, icon }, index: number) => (
                  <div key={index} className="bg-muted/50 rounded-lg p-3 flex items-start gap-3">
                    <div className="text-accent mt-0.5">{icon}</div>
                    <p className="text-sm text-foreground flex-1">{rule}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Applied Rules */}
          <div className="space-y-3">
            <h3 className="text-body font-semibold text-foreground">Applied Logic</h3>
            <div className="space-y-2">
              {(() => {
                const rationale = suggestion?.rationale as any;
                const rulesApplied = rationale?.rulesApplied;
                return rulesApplied && Array.isArray(rulesApplied) && rulesApplied.length > 0 ? (
                  rulesApplied.map((rule: string, index: number) => (
                    <div key={index} className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm text-foreground">{rule}</p>
                    </div>
                  ))
                ) : (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm text-foreground">
                      This workout was selected based on your fitness profile, recent activity, and recovery status.
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 7-Day Category Mix Chart */}
          <div className="space-y-3">
            <h3 className="text-body font-semibold text-foreground">Recent Training Balance</h3>
            <CategoryMixChart categories={mockCategoryData} />
          </div>

          <Button 
            variant="secondary"
            className="w-full"
            onClick={() => setShowRationale(false)}
            data-testid="button-close-rationale"
          >
            Close
          </Button>
        </div>
      </Sheet>
    </>
  )
}