import { useParams } from "wouter"
import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useFitnessStore } from "@/store/fitness-store"
import { Calendar, Clock, Dumbbell, Target } from "lucide-react"

export default function WorkoutDetail() {
  const { id } = useParams()
  const { workouts } = useFitnessStore()
  
  const workout = workouts.find(w => w.id === id)

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
          <p className="text-2xl font-bold text-foreground">{workout.exercises}</p>
          <p className="text-xs text-muted-foreground">completed</p>
        </Card>
      </div>

      {/* Workout Details */}
      <Card className="p-4 card-shadow border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{workout.date}</span>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Sets</span>
            <span className="font-semibold text-foreground">{workout.sets}</span>
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
        
        {Array.from({ length: workout.exercises }, (_, i) => (
          <Card key={i} className="p-4 card-shadow border border-border" data-testid={`exercise-${i}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">Exercise {i + 1}</h4>
                <p className="text-sm text-muted-foreground">3 sets × 8-12 reps</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-foreground">185 lbs</p>
                <p className="text-xs text-muted-foreground">Best set</p>
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
