import { SectionTitle } from "@/components/ui/section-title"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { Chip } from "@/components/swift/chip"
import { DailySuggestionCard } from "@/components/workouts/DailySuggestionCard"
import { SaveWorkoutButton } from "@/components/workouts/SaveWorkoutButton"
import { Play, Plus, Timer, Dumbbell, ChevronRight, Clock, Zap, CheckCircle, Activity, Heart, Move, Weight, Lightbulb, Edit3 } from "lucide-react"
import { useLocation, Link } from "wouter"
import { useAppStore } from "@/store/useAppStore"
import { Category } from "../types"
import { ROUTES } from "@/lib/routes"
import { format } from "date-fns"
import { useQuery } from "@tanstack/react-query"

// Category icon mapping
const getCategoryIcon = (category: Category): React.ComponentType<React.SVGProps<SVGSVGElement>> => {
  const iconMap: Record<Category, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
    [Category.CROSSFIT]: Zap,
    [Category.HIIT]: Timer,
    [Category.POWERLIFTING]: Dumbbell,
    [Category.OLYMPIC_LIFTING]: Weight,
    [Category.GYMNASTICS]: Activity,
    [Category.CARDIO]: Heart,
    [Category.STRENGTH]: Dumbbell,
    [Category.MOBILITY]: Move,
  }
  return iconMap[category] || Activity
}

// Intensity badge variants
const getIntensityVariant = (intensity: number) => {
  if (intensity <= 3) return "success"
  if (intensity <= 6) return "warning"
  if (intensity <= 8) return "destructive"
  return "destructive"
}


export default function Workout() {
  const [, setLocation] = useLocation()
  const { addWorkout, user } = useAppStore()

  // Fetch recent workouts from API - same query as home page
  const { data: recentCompletedWorkouts = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/workouts/recent'],
    enabled: !!user,
  })

  const handleCreateWorkout = () => {
    setLocation(ROUTES.WORKOUT_GENERATE)
  }

  const handleLogWorkout = () => {
    setLocation(ROUTES.WORKOUT_LOG)
  }

  const handleStartTemplate = () => {
    // Create a template workout
    addWorkout({
      name: 'Upper Body Strength',
      category: Category.STRENGTH,
      description: 'Upper body strength training template',
      duration: 45,
      intensity: 7,
      sets: [
        { id: 'template-1', exercise: 'Bench Press', weight: 185, reps: 10 },
        { id: 'template-2', exercise: 'Bent-Over Rows', weight: 155, reps: 10 },
        { id: 'template-3', exercise: 'Overhead Press', weight: 115, reps: 8 },
        { id: 'template-4', exercise: 'Lat Pulldowns', weight: 135, reps: 12 },
        { id: 'template-5', exercise: 'Incline Dumbbell Press', weight: 65, reps: 10 },
        { id: 'template-6', exercise: 'Barbell Curls', weight: 85, reps: 12 },
      ],
      date: new Date(),
      completed: false,
      notes: 'Template workout - Upper body strength',
    })
    setLocation('/history')
  }
  return (
    <>
      <SectionTitle title="Workouts" />

      {/* Suggested Workout */}
      <DailySuggestionCard />

      {/* Log Your Own Workout */}
      <Button 
        className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent/90"
        onClick={handleLogWorkout}
        data-testid="log-workout-button"
      >
        <Edit3 className="w-5 h-5 mr-2" />
        Log your own workout
      </Button>

      {/* Create New Workout */}
      <Button 
        className="w-full h-12 bg-workout-button text-workout-button-foreground hover:bg-workout-button/90"
        onClick={handleCreateWorkout}
        data-testid="primary-button"
      >
        <Plus className="w-5 h-5 mr-2" />
        Create New Workout
      </Button>

      {/* Workout History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle title="Workout History" />
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => setLocation(ROUTES.HISTORY)}
            data-testid="see-all-history"
          >
            See All
          </Button>
        </div>
        
        {recentCompletedWorkouts.length === 0 ? (
          <Card className="p-4 text-center" data-testid="no-history-card">
            <div className="space-y-2">
              <Dumbbell className="w-8 h-8 text-muted-foreground mx-auto" />
              <h4 className="font-semibold text-foreground">No completed workouts yet</h4>
              <p className="text-sm text-muted-foreground">Complete your first workout to see your history here</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {recentCompletedWorkouts.map((workout) => {
              const category = workout.request?.focus || workout.request?.category || workout.category || 'General'
              const intensity = workout.request?.intensity || workout.intensity || 5
              const duration = workout.request?.availableMinutes || workout.request?.duration || workout.duration || 30
              const CategoryIcon = getCategoryIcon(category)
              const workoutDate = new Date(workout.created_at || workout.createdAt)
              const exerciseCount = Array.isArray(workout.sets) ? workout.sets.length : Object.keys(workout.sets || {}).length
              
              return (
                <div key={workout.id} className="relative">
                  <Link href={`/workout/${workout.id}`} className="block">
                    <Card className="p-4 active:scale-98 transition-transform" data-testid={`recent-workout-${workout.id}`}>
                      <div className="space-y-3">
                        {/* Header Row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                              <CategoryIcon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-foreground">{workout.title}</h4>
                              <p className="text-xs text-muted-foreground">
                                {format(workoutDate, 'MMM d')} • {exerciseCount} exercises
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </div>
                        
                        {/* Chips Row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Chip variant="default" size="sm">
                            {category}
                          </Chip>
                          <Chip 
                            variant={getIntensityVariant(intensity)} 
                            size="sm"
                          >
                            <Zap className="w-3 h-3 mr-1" />
                            {intensity}/10
                          </Chip>
                          <Chip variant="default" size="sm">
                            <Clock className="w-3 h-3 mr-1" />
                            {duration}m
                          </Chip>
                          <Chip variant="success" size="sm">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Completed
                          </Chip>
                        </div>
                        
                        {/* Save Workout Button */}
                        <SaveWorkoutButton workoutId={workout.id} fullWidth />
                      </div>
                    </Card>
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
