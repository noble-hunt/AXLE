import { useState, useEffect } from "react"
import { useParams, useLocation } from "wouter"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { useAppStore } from "@/store/useAppStore"
import type { WorkoutFeedback } from "../types"
import type { Workout } from "@shared/schema"

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
import { Sheet } from "@/components/swift/sheet"
import { Field } from "@/components/swift/field"
import { fadeIn, slideUp } from "@/lib/motion-variants"
import { motion } from "framer-motion"
import { Calendar, Clock, Dumbbell, Target, CheckCircle2, Activity, Star, Award, Sparkles, Trophy, PartyPopper, Brain, AlertTriangle, ThumbsUp } from "lucide-react"
import { format } from "date-fns"
import confetti from "canvas-confetti"

const feedbackSchema = z.object({
  difficulty: z.number().min(1).max(10),
  satisfaction: z.number().min(1).max(10),
})

export default function WorkoutDetail() {
  const { id } = useParams()
  const [, setLocation] = useLocation()
  const { workouts, getWorkout, completeWorkout } = useAppStore()
  const [showCompletionSheet, setShowCompletionSheet] = useState(false)
  const [showSuccessState, setShowSuccessState] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  
  // Validate UUID and redirect if invalid
  const isValidUuid = id ? UUIDv4.test(id) : false
  
  useEffect(() => {
    if (!id || !isValidUuid) {
      console.log('Invalid or missing workout ID, redirecting to generator')
      toast({
        title: "Let's create a workout!",
        description: "We couldn't find that workout, so let's generate a new one instead.",
      })
      setLocation('/workout/generate', { replace: true })
      return
    }
  }, [id, isValidUuid, setLocation, toast])
  
  // First try local store, then API if not found
  const localWorkout = getWorkout(id as string)
  
  // Fetch from API if not in local store (only if UUID is valid)
  const { data: apiWorkout, isLoading, error } = useQuery({
    queryKey: ['/api/workouts', id],
    enabled: !localWorkout && !!id && isValidUuid, // Only fetch if not in local store, ID exists, and is valid UUID
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
  
  const workout = localWorkout || apiWorkout as WorkoutUnion | undefined

  const form = useForm<z.infer<typeof feedbackSchema>>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      difficulty: 5,
      satisfaction: 5,
    },
  })

  const difficulty = form.watch("difficulty")
  const satisfaction = form.watch("satisfaction")

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
      const feedback: WorkoutFeedback = {
        difficulty: data.difficulty,
        satisfaction: data.satisfaction,
        completedAt: new Date(),
      }

      await completeWorkout(id as string, feedback)

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

  // Show loading state while fetching from API
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
          <Dumbbell className="w-8 h-8 text-muted-foreground animate-pulse" />
        </div>
        <h2 className="text-heading font-bold text-foreground">Loading Workout...</h2>
        <p className="text-body text-muted-foreground text-center">Fetching your workout details.</p>
      </div>
    )
  }

  // Show not found only after loading is complete and no workout found
  // This only shows if UUID is valid but workout doesn't exist
  if (!workout && isValidUuid) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
          <Dumbbell className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-heading font-bold text-foreground">Workout Not Found</h2>
        <p className="text-body text-muted-foreground text-center">
          This workout doesn't exist. Let's create a new one instead!
        </p>
        <div className="space-y-3 w-full max-w-xs">
          <Button 
            onClick={() => setLocation('/workout/generate')} 
            className="w-full"
            data-testid="button-generate-workout"
          >
            Generate New Workout
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => setLocation('/history')} 
            className="w-full"
            data-testid="button-view-history"
          >
            View Workout History
          </Button>
        </div>
      </div>
    )
  }

  if (showSuccessState) {
    return (
      <motion.div 
        className="min-h-screen flex flex-col items-center justify-center space-y-6 p-6"
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

        <Card className="p-6 w-full max-w-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-body text-muted-foreground">Difficulty</span>
              <span className="text-subheading font-bold text-foreground">{workout.feedback?.difficulty}/10</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-body text-muted-foreground">Satisfaction</span>
              <span className="text-subheading font-bold text-foreground">{workout.feedback?.satisfaction}/10</span>
            </div>
          </div>
        </Card>

        <div className="space-y-3 w-full max-w-sm">
          <Button className="w-full" onClick={() => setLocation('/history')}>
            View All Workouts
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => setLocation('/')}>
            Generate New Workout
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
      <div className="space-y-4">
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
          <Chip variant="secondary">
            <Activity className="w-3 h-3 mr-1" />
{(workout as any)?.category}
          </Chip>
          <Chip variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
{(workout as any)?.duration} min
          </Chip>
          <Chip variant="secondary">
            <Target className="w-3 h-3 mr-1" />
Intensity {(workout as any)?.intensity}/10
          </Chip>
        </div>

        {/* Description */}
        {(workout as any)?.description && (
          <Card className="p-4">
            <p className="text-body text-muted-foreground">{(workout as any)?.description}</p>
          </Card>
        )}
      </div>

      {/* AI Insights Section */}
      {((workout as any)?.rendered || (workout as any)?.rationale || (workout as any)?.criticScore || (workout as any)?.criticIssues) && (
        <div className="space-y-4">
          <h2 className="text-subheading font-semibold text-foreground flex items-center gap-2">
            <Brain className="w-5 h-5" />
            AI Insights
          </h2>
          
          {/* Critic Score */}
          {(workout as any)?.criticScore && (
            <Card className="p-4">
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
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ThumbsUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-body font-medium text-foreground">AI Rationale</span>
              </div>
              <p className="text-body text-muted-foreground">{(workout as any)?.rationale}</p>
            </Card>
          )}

          {/* Critic Issues */}
          {(workout as any)?.criticIssues && (workout as any)?.criticIssues.length > 0 && (
            <Card className="p-4">
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
            <Card className="p-4">
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
      <div className="space-y-4">
        <h2 className="text-subheading font-semibold text-foreground">Workout Structure</h2>
        
        {(workout as any)?.sets?.map((set: any, index: number) => (
          <Card key={index} className="p-4" data-testid={`exercise-set-${index}`}>
            <div className="space-y-2">
              <h3 className="text-body font-semibold text-foreground">{set.exercise}</h3>
              <div className="grid grid-cols-2 gap-4 text-caption text-muted-foreground">
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
        ))}
      </div>

      {/* Action Buttons */}
      {!(workout as any)?.completed && (
        <div className="space-y-3">
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
        </div>
      )}

      {/* Completion Sheet */}
      <Sheet 
        open={showCompletionSheet} 
        onOpenChange={setShowCompletionSheet}
        data-testid="completion-sheet"
      >
        <div className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Award className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-subheading font-bold text-foreground">Complete Workout</h2>
            <p className="text-body text-muted-foreground">How was your workout?</p>
          </div>

          <form onSubmit={form.handleSubmit(handleCompleteWorkout)} className="space-y-6">
            
            {/* Difficulty Slider */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-body font-medium text-foreground">
                  How hard was that?
                </label>
                <span className="text-subheading font-bold text-primary">{difficulty}/10</span>
              </div>
              
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={difficulty}
                onChange={(e) => form.setValue("difficulty", parseInt(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                data-testid="difficulty-slider"
              />
              
              <div className="flex justify-between text-caption text-muted-foreground">
                <span>Very Easy</span>
                <span>Very Hard</span>
              </div>
            </div>

            {/* Satisfaction Slider */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-body font-medium text-foreground">
                  Was this what you were looking for?
                </label>
                <span className="text-subheading font-bold text-primary">{satisfaction}/10</span>
              </div>
              
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={satisfaction}
                onChange={(e) => form.setValue("satisfaction", parseInt(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                data-testid="satisfaction-slider"
              />
              
              <div className="flex justify-between text-caption text-muted-foreground">
                <span>Not at all</span>
                <span>Perfect!</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4">
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
