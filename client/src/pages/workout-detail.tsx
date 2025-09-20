import { useState, useEffect } from "react"
import { useParams, useLocation } from "wouter"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { useAppStore } from "@/store/useAppStore"
import type { WorkoutFeedback } from "../types"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { Chip } from "@/components/swift/chip"
import { Sheet } from "@/components/swift/sheet"
import { Field } from "@/components/swift/field"
import { fadeIn, slideUp } from "@/lib/motion-variants"
import { motion } from "framer-motion"
import { Calendar, Clock, Dumbbell, Target, CheckCircle2, Activity, Star, Award, Sparkles, Trophy, PartyPopper } from "lucide-react"
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
  
  // First try local store, then API if not found
  const localWorkout = getWorkout(id as string)
  
  // Fetch from API if not in local store (for suggestions)
  const { data: apiWorkout, isLoading, error } = useQuery({
    queryKey: ['/api/workouts', id],
    enabled: !localWorkout && !!id, // Only fetch if not in local store and ID exists
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
  
  const workout = localWorkout || apiWorkout

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
        description: `Great job finishing "${workout?.name}"!`,
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
  if (!workout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
          <Dumbbell className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-heading font-bold text-foreground">Workout Not Found</h2>
        <p className="text-body text-muted-foreground text-center">The workout you're looking for doesn't exist.</p>
        <Button onClick={() => setLocation('/history')}>
          View All Workouts
        </Button>
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
          <p className="text-body text-muted-foreground">Amazing work on "{workout.name}"</p>
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
            <h1 className="text-heading font-bold text-foreground">{workout.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-body text-muted-foreground">
                {(() => {
                  const dateValue = workout.createdAt ?? workout.date;
                  if (!dateValue) return 'No date';
                  
                  const date = new Date(dateValue);
                  if (isNaN(date.getTime())) return 'Invalid date';
                  
                  return format(date, 'MMM d, yyyy');
                })()}
              </span>
            </div>
          </div>
          {workout.completed && (
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
            {workout.category}
          </Chip>
          <Chip variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            {workout.duration} min
          </Chip>
          <Chip variant="secondary">
            <Target className="w-3 h-3 mr-1" />
            Intensity {workout.intensity}/10
          </Chip>
        </div>

        {/* Description */}
        {workout.description && (
          <Card className="p-4">
            <p className="text-body text-muted-foreground">{workout.description}</p>
          </Card>
        )}
      </div>

      {/* Workout Sets as Cards */}
      <div className="space-y-4">
        <h2 className="text-subheading font-semibold text-foreground">Workout Structure</h2>
        
        {workout.sets.map((set, index) => (
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
      {!workout.completed && (
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
