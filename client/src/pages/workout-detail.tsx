import { useState } from "react"
import { useParams, useLocation } from "wouter"
import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAppStore } from "@/store/useAppStore"
import { Calendar, Clock, Dumbbell, Target, CheckCircle2, Activity, Star } from "lucide-react"
import { format } from "date-fns"

export default function WorkoutDetail() {
  const { id } = useParams()
  const [, setLocation] = useLocation()
  const { workouts, getWorkout, completeWorkout } = useAppStore()
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  
  // Debug readout
  console.log('Workout Detail Page State:', { 
    workoutId: id,
    totalWorkouts: workouts.length,
    foundWorkout: !!workouts.find(w => w.id === id)
  })
  
  const workout = getWorkout(id as string)

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

      {/* Exercise Sets - SwiftUI style cards */}
      <div className="space-y-4">
        <SectionTitle title="Exercises" />
        
        {workout.sets.map((set, i) => (
          <Card 
            key={set.id || i} 
            className={`
              p-4 card-shadow border transition-all duration-200
              ${workout.completed 
                ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20' 
                : 'border-border hover:border-primary/30'
              }
            `}
            data-testid={`exercise-${set.id || i}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground mb-1">{set.exercise}</h4>
                
                {/* Exercise details */}
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {set.reps && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{set.reps}</span>
                      <span>reps</span>
                    </div>
                  )}
                  {set.weight && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{set.weight}</span>
                      <span>lbs</span>
                    </div>
                  )}
                  {set.duration && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{set.duration}</span>
                      <span>sec</span>
                    </div>
                  )}
                  {set.distance && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{set.distance}</span>
                      <span>m</span>
                    </div>
                  )}
                  {set.restTime && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{set.restTime}</span>
                      <span>rest</span>
                    </div>
                  )}
                </div>

                {set.notes && (
                  <p className="text-xs text-muted-foreground mt-2 italic">{set.notes}</p>
                )}
              </div>

              {/* Set number indicator */}
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20">
                <span className="text-sm font-semibold text-primary">{i + 1}</span>
              </div>
            </div>
          </Card>
        ))}
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
                        i < workout.feedback.difficulty
                          ? 'bg-red-500'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  ))}
                  <span className="ml-2 font-medium">{workout.feedback.difficulty}/10</span>
                </div>
              </div>
              
              <div>
                <span className="text-muted-foreground">Satisfaction:</span>
                <div className="flex items-center gap-1 mt-1">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i < workout.feedback.satisfaction
                          ? 'bg-green-500'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  ))}
                  <span className="ml-2 font-medium">{workout.feedback.satisfaction}/10</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-green-200 dark:border-green-800">
              <p className="text-xs text-muted-foreground">
                Completed on {format(new Date(workout.feedback.completedAt), 'MMM d, yyyy \'at\' h:mm a')}
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
    </>
  )
}
