import { useState } from "react"
import { useParams, useLocation } from "wouter"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/hooks/use-toast"
import { useAppStore } from "@/store/useAppStore"
import type { WorkoutFeedback } from "../types"
import { Calendar, Clock, Dumbbell, Target, CheckCircle2, Activity, Star, Award } from "lucide-react"
import { format } from "date-fns"

const feedbackSchema = z.object({
  difficulty: z.number().min(1).max(10),
  satisfaction: z.number().min(1).max(10),
})

export default function WorkoutDetail() {
  const { id } = useParams()
  const [, setLocation] = useLocation()
  const { workouts, getWorkout, completeWorkout } = useAppStore()
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const { toast } = useToast()
  
  // Debug readout
  console.log('Workout Detail Page State:', { 
    workoutId: id,
    totalWorkouts: workouts.length,
    foundWorkout: !!workouts.find(w => w.id === id)
  })
  
  const workout = getWorkout(id as string)

  const form = useForm<z.infer<typeof feedbackSchema>>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      difficulty: 5,
      satisfaction: 5,
    },
  })

  const handleCompleteWorkout = async (data: z.infer<typeof feedbackSchema>) => {
    try {
      // Create feedback object with completion timestamp
      const feedback: WorkoutFeedback = {
        difficulty: data.difficulty,
        satisfaction: data.satisfaction,
        completedAt: new Date(),
      }

      // Complete the workout with feedback (we'll need to update the store method)
      completeWorkout(id as string, feedback)

      toast({
        title: "Workout Completed! 🎉",
        description: `Great job finishing "${workout?.name}"! Your feedback has been saved.`,
      })

      setShowCompletionModal(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete workout. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (!workout) {
    return (
      <div className="text-center space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Workout not found</h2>
        <p className="text-muted-foreground">The workout you're looking for doesn't exist.</p>
      </div>
    )
  }

  return (
    <>
      {/* Header with completion status */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <SectionTitle title={workout.name} />
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Created {format(new Date(workout.createdAt ?? workout.date), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
          {workout.completed && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">Completed</span>
            </div>
          )}
        </div>

        {/* Original Request Chips */}
        <div className="flex flex-wrap gap-2" data-testid="request-chips">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Activity className="w-3 h-3" />
            {workout.category}
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {workout.duration} min
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Target className="w-3 h-3" />
            Intensity {workout.intensity}/10
          </Badge>
        </div>

        {/* Description */}
        {workout.description && (
          <Card className="p-4 card-shadow border border-border">
            <p className="text-sm text-muted-foreground">{workout.description}</p>
          </Card>
        )}
      </div>

      {/* Exercise Sets - Grouped by type */}
      <div className="space-y-4">
        <SectionTitle title="Workout Structure" />
        
        {(() => {
          // Group exercises by type
          const warmupSets = workout.sets.filter(set => 
            set.exercise.toLowerCase().includes('warm') || 
            set.exercise.toLowerCase().includes('dynamic')
          )
          
          const metconSets = workout.sets.filter(set => 
            set.exercise.toLowerCase().includes('metcon')
          )
          
          const otherSets = workout.sets.filter(set => 
            !set.exercise.toLowerCase().includes('warm') && 
            !set.exercise.toLowerCase().includes('dynamic') &&
            !set.exercise.toLowerCase().includes('metcon')
          )

          const formatExerciseContent = (sets: any[]) => {
            if (sets.length === 0) return null;
            
            // For single set, use the notes which contain the full formatted content
            if (sets.length === 1 && sets[0].notes) {
              return sets[0].notes.split('\n').map((line: string, i: number) => (
                <div key={i} className={line.trim() === '' ? 'h-3' : ''}>
                  {line.trim() === '' ? <br /> : line.trim()}
                </div>
              ));
            }
            
            // For multiple sets, format each exercise
            return sets.map((set: any, index: number) => (
              <div key={index} className="space-y-1">
                {set.exercise && (
                  <div className="font-medium text-foreground">{set.exercise}</div>
                )}
                {(set.reps || set.weight || set.duration || set.distance) && (
                  <div className="text-sm text-muted-foreground">
                    {set.reps && <div>{set.reps} reps</div>}
                    {set.weight && <div>{set.weight} lbs</div>}
                    {set.duration && <div>{set.duration} seconds</div>}
                    {set.distance && <div>{set.distance} meters</div>}
                  </div>
                )}
                {set.notes && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {set.notes.split('\n').map((line: string, i: number) => (
                      <div key={i} className={line.trim() === '' ? 'h-2' : ''}>
                        {line.trim() === '' ? <br /> : line.trim()}
                      </div>
                    ))}
                  </div>
                )}
                {index < sets.length - 1 && <div className="h-3" />}
              </div>
            ));
          };

          return (
            <>
              {/* Warm-up Section */}
              {warmupSets.length > 0 && (
                <Card 
                  className={`
                    p-6 card-shadow border transition-all duration-200
                    ${workout.completed 
                      ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20' 
                      : 'border-border hover:border-primary/30'
                    }
                  `}
                  data-testid="warmup-section"
                >
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-foreground">Warm-up</h3>
                    <div className="text-sm leading-relaxed">
                      {formatExerciseContent(warmupSets)}
                    </div>
                  </div>
                </Card>
              )}

              {/* Metcon Section */}
              {metconSets.length > 0 && (
                <Card 
                  className={`
                    p-6 card-shadow border transition-all duration-200
                    ${workout.completed 
                      ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20' 
                      : 'border-border hover:border-primary/30'
                    }
                  `}
                  data-testid="metcon-section"
                >
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground">Metcon</h3>
                    <div className="text-sm leading-relaxed space-y-4">
                      {formatExerciseContent(metconSets)}
                    </div>
                  </div>
                </Card>
              )}

              {/* Other Exercises */}
              {otherSets.length > 0 && (
                <Card 
                  className={`
                    p-6 card-shadow border transition-all duration-200
                    ${workout.completed 
                      ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20' 
                      : 'border-border hover:border-primary/30'
                    }
                  `}
                  data-testid="other-exercises-section"
                >
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-foreground">Exercises</h3>
                    <div className="text-sm leading-relaxed space-y-3">
                      {formatExerciseContent(otherSets)}
                    </div>
                  </div>
                </Card>
              )}
            </>
          );
        })()}
      </div>

      {/* Completion Status or Actions */}
      {workout.completed && workout.feedback ? (
        <Card className="p-4 card-shadow border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              Workout Completed
            </h3>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Difficulty:</span>
                <div className="flex items-center gap-1 mt-1">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i < (workout.feedback?.difficulty ?? 0)
                          ? 'bg-red-500'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  ))}
                  <span className="ml-2 font-medium">{workout.feedback?.difficulty ?? 0}/10</span>
                </div>
              </div>
              
              <div>
                <span className="text-muted-foreground">Satisfaction:</span>
                <div className="flex items-center gap-1 mt-1">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i < (workout.feedback?.satisfaction ?? 0)
                          ? 'bg-green-500'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  ))}
                  <span className="ml-2 font-medium">{workout.feedback?.satisfaction ?? 0}/10</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-green-200 dark:border-green-800">
              <p className="text-xs text-muted-foreground">
                Completed on {workout.feedback?.completedAt ? format(new Date(workout.feedback.completedAt), 'MMM d, yyyy \'at\' h:mm a') : 'Unknown'}
              </p>
            </div>

            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => setLocation('/history')}
              data-testid="view-history-button"
            >
              View History
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1 rounded-2xl" 
            data-testid="repeat-workout"
          >
            Repeat Workout
          </Button>
          <Button 
            className="flex-1 rounded-2xl bg-primary text-primary-foreground" 
            onClick={() => setShowCompletionModal(true)}
            data-testid="complete-workout-button"
          >
            Complete Workout
          </Button>
        </div>
      )}

      {/* Completion Modal */}
      <Dialog open={showCompletionModal} onOpenChange={setShowCompletionModal}>
        <DialogContent className="sm:max-w-md" data-testid="completion-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-500" />
              Complete Workout
            </DialogTitle>
            <DialogDescription>
              Help us improve your workout experience by sharing your feedback.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCompleteWorkout)} className="space-y-6">
              {/* Difficulty Rating */}
              <FormField
                control={form.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">
                      1–10, how hard was that?
                    </FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        <Slider
                          min={1}
                          max={10}
                          step={1}
                          value={[field.value]}
                          onValueChange={(value) => field.onChange(value[0])}
                          className="w-full"
                          data-testid="difficulty-slider"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Very Easy</span>
                          <span className="font-medium text-lg text-foreground">
                            {field.value}/10
                          </span>
                          <span>Very Hard</span>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Satisfaction Rating */}
              <FormField
                control={form.control}
                name="satisfaction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">
                      1–10, was this what you were looking for?
                    </FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        <Slider
                          min={1}
                          max={10}
                          step={1}
                          value={[field.value]}
                          onValueChange={(value) => field.onChange(value[0])}
                          className="w-full"
                          data-testid="satisfaction-slider"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Not at all</span>
                          <span className="font-medium text-lg text-foreground">
                            {field.value}/10
                          </span>
                          <span>Perfect</span>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCompletionModal(false)}
                  data-testid="cancel-completion-button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-primary text-primary-foreground"
                  data-testid="submit-feedback-button"
                >
                  Complete Workout
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
