import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { 
  Sparkles, Clock, Target, Dumbbell, ChevronDown, 
  RotateCcw, Play, BookOpen, Zap, Activity, AlertTriangle
} from "lucide-react"
import type { WorkoutPlan, BlockItem } from "../../../../../shared/workoutSchema"
import type { WizardState } from "../WorkoutWizard"

export interface WorkoutPreviewData {
  preview: WorkoutPlan;
  seed: string;
}

export interface WorkoutPreviewProps {
  wizardState: WizardState;
  previewData: WorkoutPreviewData | null;
  isLoading: boolean;
  onRegenerate: () => void;
  onUse: () => void;
  isGenerating: boolean;
}

export function WorkoutPreview({ 
  wizardState, 
  previewData, 
  isLoading, 
  onRegenerate, 
  onUse, 
  isGenerating 
}: WorkoutPreviewProps) {
  const [explanationOpen, setExplanationOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <div>
            <h2 className="text-2xl font-bold text-foreground">Generating your workout...</h2>
            <p className="text-muted-foreground">
              Creating the perfect {wizardState.archetype} workout just for you
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!previewData) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Failed to generate preview</h2>
            <p className="text-muted-foreground">
              Something went wrong. Please try again.
            </p>
          </div>
          <Button onClick={onRegenerate} data-testid="retry-preview">
            <RotateCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const { preview: workout } = previewData;

  const formatSeedCode = (seed: string) => {
    // Show a short version of the seed
    return seed.substring(0, 8).toUpperCase();
  };

  const getArchetypeIcon = (archetype: string) => {
    switch (archetype) {
      case 'strength': return Dumbbell;
      case 'conditioning': return Zap;
      case 'endurance': return Activity;
      default: return Target;
    }
  };

  const ArchetypeIcon = getArchetypeIcon(wizardState.archetype);

  // Helper to format prescription text
  const formatPrescription = (item: BlockItem): string => {
    const { prescription } = item;
    const parts: string[] = [];
    
    // Sets
    if (prescription.sets > 1) {
      parts.push(`${prescription.sets} sets`);
    } else {
      parts.push(`${prescription.sets} set`);
    }

    // Reps/Time/Distance
    if (prescription.type === "reps" && prescription.reps) {
      parts.push(`x ${prescription.reps} reps`);
    } else if (prescription.type === "time" && prescription.seconds) {
      parts.push(`x ${prescription.seconds}s`);
    } else if (prescription.type === "distance" && prescription.meters) {
      parts.push(`x ${prescription.meters}m`);
    }

    // Load
    if (prescription.load) {
      parts.push(`@ ${prescription.load}`);
    }

    // Rest
    if (prescription.restSec > 0) {
      parts.push(`Rest ${prescription.restSec}s`);
    }

    return parts.join(", ");
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Your Workout Preview</h2>
        <p className="text-muted-foreground">
          Here's what we've created based on your preferences
        </p>
      </div>


      {/* Main Preview Card */}
      <Card className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <ArchetypeIcon className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-foreground">{workout.focus.charAt(0).toUpperCase() + workout.focus.slice(1)} Workout</h3>
              <p className="text-sm text-muted-foreground">{workout.summary}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  Seed: {formatSeedCode(previewData.seed)}
                </Badge>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <Clock className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">{workout.durationMin}</p>
              <p className="text-xs text-muted-foreground">minutes</p>
            </div>
            <div className="text-center">
              <Target className="w-5 h-5 text-chart-2 mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">{workout.intensity}</p>
              <p className="text-xs text-muted-foreground">intensity</p>
            </div>
            <div className="text-center">
              <Dumbbell className="w-5 h-5 text-chart-3 mx-auto mb-1" />
              <p className="text-lg font-bold text-foreground">{workout.blocks.length}</p>
              <p className="text-xs text-muted-foreground">blocks</p>
            </div>
          </div>

          {/* Detailed Block Breakdown */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Workout Details</h4>
            <div className="space-y-4">
              {workout.blocks.map((block, blockIndex) => (
                <Card key={`${block.key}-${blockIndex}`} className="p-4">
                  <div className="space-y-3">
                    {/* Block Header */}
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs capitalize">
                        {block.key}
                      </Badge>
                      <h5 className="text-sm font-medium text-foreground">{block.title}</h5>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {Math.round(block.targetSeconds / 60)}min
                      </span>
                    </div>
                    
                    {/* Empty Block Error */}
                    {block.items.length === 0 && (
                      <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                        <p className="text-sm text-destructive font-medium">
                          Generation returned an empty block. Please try again.
                        </p>
                      </div>
                    )}
                    
                    {/* Block Items */}
                    <div className="space-y-2">
                      {block.items.map((item, itemIndex) => (
                        <div key={`${item.movementId}-${itemIndex}`} className="flex items-start gap-3 p-2 bg-muted/20 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{formatPrescription(item)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Equipment Info */}
      <Card className="overflow-hidden">
        <Collapsible open={explanationOpen} onOpenChange={setExplanationOpen}>
          <CollapsibleTrigger className="w-full" data-testid="explain-workout-toggle">
            <div className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground">Equipment & Details</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${explanationOpen ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 pt-0 space-y-4 border-t border-border">
              <div>
                <h5 className="text-sm font-medium text-foreground mb-2">Equipment Used</h5>
                <div className="flex flex-wrap gap-1">
                  {workout.equipment.map((eq) => (
                    <Badge key={eq} variant="outline" className="text-xs capitalize">
                      {eq.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h5 className="text-sm font-medium text-foreground mb-2">Focus</h5>
                <p className="text-xs text-muted-foreground capitalize">
                  {workout.focus} training with intensity level {workout.intensity}/10
                </p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button 
          onClick={onUse}
          disabled={isGenerating}
          className="w-full"
          size="lg"
          data-testid="use-this-workout"
        >
          {isGenerating ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Saving Workout...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Use This Workout
            </>
          )}
        </Button>
        
        <Button 
          variant="outline"
          onClick={onRegenerate}
          disabled={isLoading}
          className="w-full"
          data-testid="regenerate-preview"
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Generating...
            </>
          ) : (
            <>
              <RotateCcw className="w-4 h-4 mr-2" />
              Regenerate Preview (New Seed)
            </>
          )}
        </Button>
      </div>

      {/* Tip */}
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Pro tip</p>
            <p className="text-xs text-muted-foreground">
              Each regeneration creates a completely different workout using the same parameters. 
              Find one you like? Save the seed code to recreate it later!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}