import { useState, useEffect } from "react"
import { useParams, useLocation } from "wouter"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery, useMutation } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import { useAppStore } from "@/store/useAppStore"
import type { WorkoutFeedback } from "../types"
import type { Workout, LegacyWorkoutFeedback } from "@shared/schema"
import { ROUTES } from "@/lib/routes"

// Union type for workouts from local store vs API
type WorkoutUnion = Workout | {
  id?: string;
  name?: string;
  title?: string;
  category?: string;
  description?: string;
  duration?: number;
  intensity?: number;
  sets?: any[];
  date?: Date | string;
  createdAt?: Date | string;
  completed?: boolean;
  notes?: string;
  feedback?: any;
  rendered?: string;
  rationale?: string;
  criticScore?: number;
  criticIssues?: string[];
  request?: any;
};

// UUID v4 validation regex
const UUIDv4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { Chip } from "@/components/swift/chip"
import { SaveWorkoutButton } from "@/components/workouts/SaveWorkoutButton"
import { Sheet } from "@/components/swift/sheet"
import { Field } from "@/components/swift/field"
import { fadeIn, slideUp } from "@/lib/motion-variants"
import { motion } from "framer-motion"
import { Calendar, Clock, Dumbbell, Target, CheckCircle2, Activity, Star, Award, Sparkles, Trophy, PartyPopper, Brain, AlertTriangle, ThumbsUp, Hash, RotateCcw, Shuffle, Copy, Trash2 } from "lucide-react"
import { format } from "date-fns"
import confetti from "canvas-confetti"

const feedbackSchema = z.object({
  perceivedIntensity: z.number().min(1).max(10),
  notes: z.string().optional(),
})

export default function WorkoutDetail() {
  // ALL HOOKS MUST BE AT THE TOP - Rules of Hooks
  const { id } = useParams()
  const [, setLocation] = useLocation()
  const { workouts, getWorkout, completeWorkout } = useAppStore()
  const [showCompletionSheet, setShowCompletionSheet] = useState(false)
  const [showSuccessState, setShowSuccessState] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  
  // Validate UUID and redirect if invalid
  const isValidUuid = id ? UUIDv4.test(id) : false
  
  // First try local store, then API if not found
  const localWorkout = id ? getWorkout(id as string) : null
  
  // Fetch from API if not in local store (only if UUID is valid)
  // This hook MUST be called unconditionally at the top
  const { data: apiWorkout, isLoading, error } = useQuery({
    queryKey: ['/api/workouts', id],
    enabled: !localWorkout && !!id && isValidUuid, // Only fetch if not in local store, ID exists, and is valid UUID
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Form hook MUST be called unconditionally at the top
  const form = useForm<z.infer<typeof feedbackSchema>>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      perceivedIntensity: 5,
      notes: "",
    },
  })

  const perceivedIntensity = form.watch("perceivedIntensity")
  const notes = form.watch("notes")

  // Delete workout mutation
  const deleteWorkoutMutation = useMutation({
    mutationFn: async (workoutId: string) => {
      return apiRequest('DELETE', `/api/workouts/${workoutId}`)
    },
    onSuccess: async () => {
      // Invalidate and wait for refetch to ensure fresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/workouts'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/workouts/recent'] })
      ]);
      
      toast({
        title: "Workout deleted",
        description: "The workout has been removed from your history.",
      })
      
      // Navigate after cache is invalidated
      setLocation(ROUTES.HISTORY)
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete workout. Please try again.",
        variant: "destructive",
      })
    },
  })

  const handleDeleteWorkout = () => {
    if (confirm('Are you sure you want to delete this workout? This action cannot be undone.')) {
      deleteWorkoutMutation.mutate(id as string)
    }
  }
  
  // Handle redirects in useEffect, not with early returns
  useEffect(() => {
    if (!id || !isValidUuid) {
      console.log('Invalid or missing workout ID, redirecting to generator')
      setLocation(`${ROUTES.WORKOUT_GENERATE}?reason=missing`, { replace: true })
      return
    }
  }, [id, isValidUuid, setLocation])

  // NOW we can handle conditional rendering AFTER all hooks
  const workout = localWorkout || apiWorkout as WorkoutUnion | undefined

  // Early return if redirecting due to invalid ID
  if (!id || !isValidUuid) {
    return null
  }

  // Show loading while fetching from API
  if (!localWorkout && isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading workout...</p>
        </div>
      </div>
    )
  }

  // If still no workout after loading (including API errors), redirect
  if (!workout && !isLoading) {
    console.log('No workout found, redirecting to generator')
    setLocation(`${ROUTES.WORKOUT_GENERATE}?reason=missing`, { replace: true })
    return null
  }

  // Trigger confetti effect
  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    })
  }

  const handleCompleteWorkout = async (data: z.infer<typeof feedbackSchema>) => {
    // Prevent multiple submissions
    if (isSubmitting) {
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Save workout feedback to new table
      const { apiRequest } = await import('@/lib/queryClient');
      await apiRequest('POST', `/api/workouts/${id}/feedback`, {
        perceivedIntensity: data.perceivedIntensity,
        notes: data.notes || ""
      });

      // Also mark workout as completed (legacy flow)
      const legacyFeedback: LegacyWorkoutFeedback = {
        difficulty: data.perceivedIntensity, // Map RPE to difficulty for compatibility
        satisfaction: 8, // Default to high satisfaction
        completedAt: new Date(),
      }

      await completeWorkout(id as string, legacyFeedback)

      setShowCompletionSheet(false)
      setShowSuccessState(true)
      
      // Trigger confetti after a short delay
      setTimeout(() => {
        triggerConfetti()
      }, 300)

      toast({
        title: "Workout Completed! 🎉",
        description: `Great job finishing "${(workout as any)?.title || (workout as any)?.name}"!`,
      })

    } catch (error) {
      console.error('Error completing workout:', error)
      toast({
        title: "Error",
        description: "Failed to complete workout. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }



  if (showSuccessState) {
    return (
      <motion.div 
        className="min-h-screen flex flex-col items-center justify-center space-y-6 p-7"
        variants={fadeIn}
        initial="initial"
        animate="animate"
      >
        <motion.div 
          className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center"
          variants={slideUp}
        >
          <Trophy className="w-12 h-12 text-primary" />
        </motion.div>
        
        <div className="text-center space-y-2">
          <h1 className="text-heading font-bold text-foreground">Workout Complete!</h1>
          <p className="text-body text-muted-foreground">Amazing work on "{workout.title || workout.name}"</p>
        </div>

        <Card className="w-full max-w-sm">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-body text-muted-foreground">Perceived Intensity (RPE)</span>
              <span className="text-subheading font-bold text-foreground">{workout.feedback?.difficulty || 'N/A'}/10</span>
            </div>
          </div>
        </Card>

        <div className="space-y-4 w-full max-w-sm">
          <Button className="w-full" onClick={() => setLocation(ROUTES.HISTORY)}>
            View All Workouts
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => setLocation(ROUTES.HOME)}>
            Back to Home
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div 
      className="space-y-6"
      variants={fadeIn}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-heading font-bold text-foreground">{(workout as any)?.title || (workout as any)?.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-body text-muted-foreground">
                {(() => {
                  const dateValue = (workout as any)?.createdAt ?? (workout as any)?.date;
                  if (!dateValue) return 'No date';
                  
                  const date = new Date(dateValue);
                  if (isNaN(date.getTime())) return 'Invalid date';
                  
                  return format(date, 'MMM d, yyyy');
                })()}
              </span>
            </div>
          </div>
          {(workout as any)?.completed && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span className="text-body font-medium text-primary">Completed</span>
            </div>
          )}
        </div>

        {/* Request Meta Chips */}
        <div className="flex flex-wrap gap-2" data-testid="request-chips">
          <Chip variant="default">
            <Activity className="w-3 h-3 mr-1" />
{(workout as any)?.category}
          </Chip>
          <Chip variant="default">
            <Clock className="w-3 h-3 mr-1" />
{(workout as any)?.duration} min
          </Chip>
          <Chip variant="default">
            <Target className="w-3 h-3 mr-1" />
Intensity {(workout as any)?.intensity}/10
          </Chip>
          {(workout as any)?.genSeed?.rngSeed && (
            <Chip 
              variant="default" 
              className="cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(JSON.stringify((workout as any).genSeed, null, 2));
                  toast({
                    title: "Seed Copied!",
                    description: "Generator seed has been copied to clipboard.",
                  });
                }
              }}
              data-testid="seed-chip"
            >
              <Hash className="w-3 h-3 mr-1" />
              Seed: {(workout as any).genSeed.rngSeed.slice(0, 8)}...
            </Chip>
          )}
        </div>

        {/* Save Workout Button */}
        {workout.id && <SaveWorkoutButton workoutId={workout.id} fullWidth />}

        {/* Description */}
        {(workout as any)?.description && (
          <Card>
            <p className="text-body text-muted-foreground">{(workout as any)?.description}</p>
          </Card>
        )}
      </div>

      {/* AI Insights Section */}
      {((workout as any)?.rendered || (workout as any)?.rationale || (workout as any)?.criticScore || (workout as any)?.criticIssues) && (
        <div className="space-y-5">
          <h2 className="text-subheading font-semibold text-foreground flex items-center gap-2">
            <Brain className="w-5 h-5" />
            AI Insights
          </h2>
          
          {/* Critic Score */}
          {(workout as any)?.criticScore && (
            <Card>
              <div className="flex items-center justify-between mb-2">
                <span className="text-body font-medium text-foreground">Quality Score</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    (workout as any)?.criticScore >= 80 ? 'bg-green-500' : 
                    (workout as any)?.criticScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <span className="text-subheading font-bold text-foreground">{(workout as any)?.criticScore}/100</span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    (workout as any)?.criticScore >= 80 ? 'bg-green-500' : 
                    (workout as any)?.criticScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${(workout as any)?.criticScore}%` }}
                />
              </div>
            </Card>
          )}

          {/* Rationale */}
          {(workout as any)?.rationale && (
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <ThumbsUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-body font-medium text-foreground">AI Rationale</span>
              </div>
              <p className="text-body text-muted-foreground">{(workout as any)?.rationale}</p>
            </Card>
          )}

          {/* Critic Issues */}
          {(workout as any)?.criticIssues && (workout as any)?.criticIssues.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span className="text-body font-medium text-foreground">Areas for Improvement</span>
              </div>
              <ul className="space-y-1">
                {(workout as any)?.criticIssues.map((issue: any, index: number) => (
                  <li key={index} className="text-body text-muted-foreground flex items-start gap-2">
                    <span className="text-yellow-600 mt-1">•</span>
                    {issue}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Rendered Workout */}
          {(workout as any)?.rendered && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Dumbbell className="w-4 h-4 text-muted-foreground" />
                <span className="text-body font-medium text-foreground">Professional Format</span>
              </div>
              <pre className="text-caption font-mono text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-lg overflow-x-auto">
                {(workout as any)?.rendered}
              </pre>
            </Card>
          )}
        </div>
      )}

      {/* Workout Sets as Cards */}
      <div className="space-y-5">
        <h2 className="text-subheading font-semibold text-foreground">Workout Structure</h2>
        
        {(workout as any)?.sets?.map((set: any, index: number) => {
          if (set.is_header) {
            return (
              <div key={set.id || index} className="mb-2 mt-4 text-sm uppercase tracking-wide text-muted-foreground">
                {set.exercise} <span className="ml-2 text-xs opacity-70">~{Math.round((set.duration||0)/60)} min</span>
              </div>
            );
          }
          
          return (
            <Card key={index} data-testid={`exercise-set-${index}`}>
              <div className="space-y-2">
                <h3 className="text-body font-semibold text-foreground">{set.exercise}</h3>
                <div className="grid grid-cols-2 gap-5 text-caption text-muted-foreground">
                  {set.reps && <div>Reps: {set.reps}</div>}
                  {set.weight && <div>Weight: {set.weight} lbs</div>}
                  {set.duration && <div>Duration: {set.duration}s</div>}
                  {set.distance && <div>Distance: {set.distance}m</div>}
                </div>
                {set.notes && (
                  <p className="text-caption text-muted-foreground mt-2">{set.notes}</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Action Buttons */}
      {!(workout as any)?.completed && (
        <div className="space-y-4">
          <Button 
            variant="secondary" 
            className="w-full"
            data-testid="repeat-workout"
          >
            Repeat Workout
          </Button>
          <Button 
            className="w-full"
            onClick={() => setShowCompletionSheet(true)}
            data-testid="complete-workout-button"
          >
            Complete Workout
          </Button>
          <Button 
            variant="ghost"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDeleteWorkout}
            disabled={deleteWorkoutMutation.isPending}
            data-testid="delete-workout-button"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {deleteWorkoutMutation.isPending ? 'Deleting...' : 'Delete Workout'}
          </Button>
        </div>
      )}

      {/* Completion Sheet */}
      <Sheet 
        open={showCompletionSheet} 
        onOpenChange={setShowCompletionSheet}
        data-testid="completion-sheet"
      >
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Award className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-subheading font-bold text-foreground">Complete Workout</h2>
            <p className="text-body text-muted-foreground">How was your workout?</p>
          </div>

          <form onSubmit={form.handleSubmit(handleCompleteWorkout)} className="space-y-6">
            
            {/* RPE Selection */}
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <label className="text-body font-medium text-foreground">
                  How intense was this workout?
                </label>
                <p className="text-caption text-muted-foreground">Rate of Perceived Exertion (RPE)</p>
              </div>
              
              {/* Quick tap grid for RPE 1-10 */}
              <div className="grid grid-cols-5 gap-4">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((rpe) => (
                  <button
                    key={rpe}
                    type="button"
                    onClick={() => form.setValue("perceivedIntensity", rpe)}
                    className={`
                      h-12 rounded-lg border-2 font-semibold transition-all
                      ${perceivedIntensity === rpe 
                        ? 'border-primary bg-primary text-primary-foreground' 
                        : 'border-muted bg-background text-foreground hover:border-primary/50'
                      }
                    `}
                    data-testid={`rpe-${rpe}`}
                  >
                    {rpe}
                  </button>
                ))}
              </div>
              
              <div className="flex justify-between text-caption text-muted-foreground">
                <span>Very Easy</span>
                <span>Maximum</span>
              </div>
            </div>

            {/* Optional Notes */}
            <div className="space-y-2">
              <label className="text-body font-medium text-foreground">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => form.setValue("notes", e.target.value)}
                placeholder="How did it feel? Any observations?"
                className="w-full h-20 p-3 border border-muted rounded-lg resize-none text-body"
                data-testid="workout-notes"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-4 pt-4">
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
                data-testid="submit-feedback-button"
              >
                {isSubmitting ? "Completing..." : "Complete Workout"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => setShowCompletionSheet(false)}
                data-testid="cancel-completion-button"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </Sheet>
    </motion.div>
  )
}
