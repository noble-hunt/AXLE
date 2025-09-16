import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { useFitnessStore } from "@/store/fitness-store"
import { Link } from "wouter"
import { ChevronRight, Calendar, Clock } from "lucide-react"

export default function History() {
  const { workouts } = useFitnessStore()

  const groupedWorkouts = workouts.reduce((acc, workout) => {
    const date = workout.date.split(' •')[0]
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(workout)
    return acc
  }, {} as Record<string, typeof workouts>)

  return (
    <>
      <SectionTitle title="Workout History" />

      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 card-shadow border border-border text-center" data-testid="total-workouts">
          <Calendar className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{workouts.length}</p>
          <p className="text-xs text-muted-foreground">Total Workouts</p>
        </Card>
        
        <Card className="p-4 card-shadow border border-border text-center" data-testid="total-time">
          <Clock className="w-6 h-6 text-chart-2 mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">
            {workouts.reduce((sum, w) => sum + w.duration, 0)}
          </p>
          <p className="text-xs text-muted-foreground">Total Minutes</p>
        </Card>
        
        <Card className="p-4 card-shadow border border-border text-center" data-testid="avg-duration">
          <Clock className="w-6 h-6 text-chart-3 mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">
            {Math.round(workouts.reduce((sum, w) => sum + w.duration, 0) / workouts.length)}
          </p>
          <p className="text-xs text-muted-foreground">Avg Minutes</p>
        </Card>
      </div>

      {/* Workout List */}
      <div className="space-y-6">
        {Object.entries(groupedWorkouts).map(([date, dayWorkouts]) => (
          <div key={date} className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">{date}</h3>
            
            {dayWorkouts.map((workout) => (
              <Link key={workout.id} href={`/workout/${workout.id}`}>
                <Card className="p-4 card-shadow border border-border hover:bg-accent/50 transition-colors cursor-pointer" data-testid={`history-workout-${workout.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{workout.name}</h4>
                      <p className="text-sm text-muted-foreground">{workout.duration} minutes</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {workout.exercises} exercises
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {workout.sets} sets
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ))}
      </div>

      {workouts.length === 0 && (
        <div className="text-center space-y-4 py-12">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold text-foreground">No workouts yet</h3>
          <p className="text-muted-foreground">Start your first workout to see it here!</p>
        </div>
      )}
    </>
  )
}
