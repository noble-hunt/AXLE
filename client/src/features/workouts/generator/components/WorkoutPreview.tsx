import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Sheet } from "@/components/swift/sheet"
import { Field } from "@/components/swift/field"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useToast } from "@/hooks/use-toast"
import { 
  Sparkles, Clock, Target, Dumbbell, ChevronDown, 
  RotateCcw, Play, BookOpen, Zap, Activity, AlertTriangle, CheckCircle2, Star
} from "lucide-react"
import type { WorkoutPlan, BlockItem, Block } from "@shared/workoutSchema"
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
  onUse: (feedback: { perceivedIntensity: number; notes?: string }) => void;
  isGenerating: boolean;
}

const feedbackSchema = z.object({
  perceivedIntensity: z.number().min(1).max(10),
  notes: z.string().optional(),
})

export function WorkoutPreview({ 
  wizardState, 
  previewData, 
  isLoading, 
  onRegenerate, 
  onUse, 
  isGenerating 
}: WorkoutPreviewProps) {
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof feedbackSchema>>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      perceivedIntensity: 5,
      notes: "",
    },
  });

  const perceivedIntensity = form.watch("perceivedIntensity");

  const handleUseWorkout = () => {
    // Clear any previous errors and open the feedback sheet
    setSubmitError(null);
    setShowFeedbackSheet(true);
  };

  const handleFeedbackSubmit = async (data: z.infer<typeof feedbackSchema>) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      // Call the parent's onUse with feedback data
      await onUse({
        perceivedIntensity: data.perceivedIntensity,
        notes: data.notes,
      });
      
      // Mark as completed and close sheet
      setIsCompleted(true);
      setShowFeedbackSheet(false);
      
      // Reset form for potential future use
      form.reset();
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      const errorMessage = error?.message || "Failed to save workout. Please try again.";
      setSubmitError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // Helper to format exercise display name with set/rep schemes
  const formatExerciseName = (item: BlockItem): string => {
    const { name, prescription } = item;
    const parts: string[] = [];
    
    // For strength/bodybuilding: Show "Exercise Name 4x8" or "Exercise Name 4x8-10"
    if (prescription.type === "reps" && prescription.reps && prescription.sets > 1) {
      parts.push(name);
      parts.push(`${prescription.sets}x${prescription.reps}`);
      if (prescription.load) {
        parts.push(`- ${prescription.load}`);
      }
      return parts.join(" ");
    }
    
    // For single-set exercises or conditioning: Show "15 Air Squats"
    if (prescription.type === "reps" && prescription.reps) {
      return `${prescription.reps} ${name}`;
    } else if (prescription.type === "time" && prescription.seconds) {
      return `${prescription.seconds}s ${name}`;
    } else if (prescription.type === "distance" && prescription.meters) {
      return `${prescription.meters}m ${name}`;
    }
    
    return name;
  };

  // Helper to format additional prescription details (load, rest)
  const formatPrescriptionDetails = (item: BlockItem): string | null => {
    const { prescription } = item;
    const parts: string[] = [];

    // Load
    if (prescription.load) {
      parts.push(`@ ${prescription.load}`);
    }

    // Rest
    if (prescription.restSec > 0) {
      parts.push(`Rest ${prescription.restSec}s`);
    }

    return parts.length > 0 ? parts.join(", ") : null;
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
              <h3 className="text-xl font-bold text-foreground">{workout.focus ? workout.focus.charAt(0).toUpperCase() + workout.focus.slice(1) : 'Generated'} Workout</h3>
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

          {/* Wodify-Style Workout Blocks */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Workout Details</h4>
            <div className="space-y-4">
              {workout.blocks.map((block: Block, blockIndex: number) => (
                <Card key={`${block.key}-${blockIndex}`} className="p-4">
                  <div className="space-y-3">
                    {/* Block Header */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs capitalize">
                          {block.key}
                        </Badge>
                        <h5 className="text-sm font-medium text-foreground">{block.title}</h5>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {Math.round(block.targetSeconds / 60)}min
                        </span>
                      </div>
                      
                      {/* Wodify-Style: Creative Title for Main Section */}
                      {block.workoutTitle && (
                        <h3 className="text-lg font-bold text-primary tracking-wide">
                          {block.workoutTitle}
                        </h3>
                      )}
                      
                      {/* Wodify-Style: Score Type (italicized) */}
                      {block.scoreType && (
                        <p className="text-sm text-muted-foreground italic">
                          {block.scoreType}
                        </p>
                      )}
                      
                      {/* Wodify-Style: Coaching Cues */}
                      {block.coachingCues && (
                        <div className="bg-muted/30 rounded-lg p-3 border-l-2 border-primary">
                          <p className="text-sm text-foreground leading-relaxed">
                            {block.coachingCues}
                          </p>
                        </div>
                      )}
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
                      {block.items.map((item: BlockItem, itemIndex: number) => {
                        const details = formatPrescriptionDetails(item);
                        return (
                          <div key={`${item.movementId}-${itemIndex}`} className="flex items-start gap-3 p-2 bg-muted/20 rounded-lg">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">{formatExerciseName(item)}</p>
                              {details && (
                                <p className="text-xs text-muted-foreground">{details}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Wodify-Style: Add Result Button (only for main sections with scoreType) */}
                    {block.scoreType && (
                      <Button 
                        variant="secondary" 
                        className="w-full mt-3"
                        onClick={() => {
                          toast({
                            title: "Score Entry",
                            description: "Score entry feature coming soon!",
                          });
                        }}
                        data-testid={`button-add-result-${blockIndex}`}
                      >
                        Add result
                      </Button>
                    )}
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
                  {workout.equipment.map((eq: string) => (
                    <Badge key={eq} variant="outline" className="text-xs capitalize">
                      {eq.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h5 className="text-sm font-medium text-foreground mb-2">Focus</h5>
                <p className="text-xs text-muted-foreground capitalize">
                  {workout.focus || 'Mixed'} training with intensity level {workout.intensity}/10
                </p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button 
          onClick={handleUseWorkout}
          disabled={isGenerating || isCompleted}
          className="w-full"
          size="lg"
          data-testid="use-this-workout"
        >
          {isCompleted ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Completed!
            </>
          ) : isGenerating ? (
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

      {/* Feedback Sheet */}
      <Sheet
        open={showFeedbackSheet}
        onOpenChange={setShowFeedbackSheet}
        title="How was your workout?"
      >
        <form onSubmit={form.handleSubmit(handleFeedbackSubmit)} className="space-y-6">
          {/* Error Message */}
          {submitError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{submitError}</p>
              </div>
            </div>
          )}

          {/* RPE Scale */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Rate of Perceived Exertion (RPE)
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                How hard was this workout for you?
              </p>
            </div>

            {/* RPE Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Easy</span>
                <span className="text-2xl font-bold text-primary">{perceivedIntensity}</span>
                <span className="text-xs text-muted-foreground">Max Effort</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={perceivedIntensity}
                onChange={(e) => form.setValue('perceivedIntensity', parseInt(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                data-testid="input-perceived-intensity"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <span key={n} className={perceivedIntensity === n ? 'text-primary font-bold' : ''}>
                    {n}
                  </span>
                ))}
              </div>
            </div>

            {/* RPE Description */}
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">
                {perceivedIntensity <= 3 && "Very light effort - Could do this all day"}
                {perceivedIntensity >= 4 && perceivedIntensity <= 6 && "Moderate effort - Challenging but sustainable"}
                {perceivedIntensity >= 7 && perceivedIntensity <= 8 && "Hard effort - Tough but doable"}
                {perceivedIntensity >= 9 && "Maximum effort - Couldn't do much more"}
              </p>
            </div>
          </div>

          {/* Optional Notes */}
          <Field
            label="Notes (Optional)"
            name="notes"
            type="textarea"
            placeholder="Any thoughts on the workout?"
            value={form.watch('notes') || ''}
            onChange={(e) => form.setValue('notes', e.target.value)}
            data-testid="input-notes"
          />

          {/* Submit Button */}
          <div className="space-y-2">
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              data-testid="button-submit-feedback"
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Star className="w-4 h-4 mr-2" />
                  Complete Workout
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => setShowFeedbackSheet(false)}
              disabled={isSubmitting}
              data-testid="button-cancel-feedback"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}