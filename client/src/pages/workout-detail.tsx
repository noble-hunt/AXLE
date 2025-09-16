import { useParams } from "wouter"
import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/store/useAppStore"
import { Calendar, Clock, Dumbbell, Target } from "lucide-react"

export default function WorkoutDetail() {
  const { id } = useParams()
  const { workouts, getWorkout } = useAppStore()
  
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
      <SectionTitle title={workout.name} />

      {/* Workout Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 card-shadow border border-border" data-testid="workout-duration">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Duration</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{workout.duration}</p>
          <p className="text-xs text-muted-foreground">minutes</p>
        </Card>

        <Card className="p-4 card-shadow border border-border" data-testid="workout-exercises">
          <div className="flex items-center gap-2 mb-2">
            <Dumbbell className="w-4 h-4 text-chart-2" />
            <span className="text-sm font-medium text-muted-foreground">Exercises</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{workout.sets.length}</p>
          <p className="text-xs text-muted-foreground">completed</p>
        </Card>
      </div>

      {/* Workout Details */}
      <Card className="p-4 card-shadow border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{workout.date.toLocaleDateString()}</span>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Sets</span>
            <span className="font-semibold text-foreground">{workout.sets.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Volume</span>
            <span className="font-semibold text-foreground">12,450 lbs</span>
          </div>
        </div>
      </Card>

      {/* Exercise List */}
      <div className="space-y-4">
        <SectionTitle title="Exercises" />
        
        {workout.sets.map((set, i) => (
          <Card key={set.id || i} className="p-4 card-shadow border border-border" data-testid={`exercise-${set.id || i}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">{set.exercise}</h4>
                <p className="text-sm text-muted-foreground">
                  {set.reps && `${set.reps} reps`}
                  {set.weight && ` × ${set.weight} lbs`}
                  {set.duration && ` × ${set.duration}s`}
                  {set.distance && ` × ${set.distance}m`}
                </p>
                {set.notes && (
                  <p className="text-xs text-muted-foreground mt-1">{set.notes}</p>
                )}
              </div>
              <div className="text-right">
                {set.weight && (
                  <>
                    <p className="font-semibold text-foreground">{set.weight} lbs</p>
                    <p className="text-xs text-muted-foreground">Weight</p>
                  </>
                )}
                {set.duration && !set.weight && (
                  <>
                    <p className="font-semibold text-foreground">{set.duration}s</p>
                    <p className="text-xs text-muted-foreground">Duration</p>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 rounded-2xl" data-testid="repeat-workout">
          Repeat Workout
        </Button>
        <Button className="flex-1 rounded-2xl bg-primary text-primary-foreground" data-testid="edit-workout">
          Edit Workout
        </Button>
      </div>
    </>
  )
}
