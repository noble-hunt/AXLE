import { SectionTitle } from "@/components/ui/section-title"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Card } from "@/components/ui/card"
import { Card as SwiftCard } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { Chip } from "@/components/swift/chip"
import { Play, Plus, Timer, Dumbbell, ChevronRight, Clock, Zap, CheckCircle, Activity, Heart, Move, Weight } from "lucide-react"
import { useLocation, Link } from "wouter"
import { useAppStore } from "@/store/useAppStore"
import { Category } from "../types"
import { format } from "date-fns"

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
  const { addWorkout, workouts } = useAppStore()

  const handleCreateWorkout = () => {
    setLocation('/generate-workout')
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

  // Get recent completed workouts (last 5)
  const recentCompletedWorkouts = workouts
    .filter(workout => workout.completed)
    .sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date)
      const dateB = b.date instanceof Date ? b.date : new Date(b.date)
      return dateB.getTime() - dateA.getTime()
    })
    .slice(0, 5)
  return (
    <>
      <SectionTitle title="Workouts" />

      {/* Quick Start Options */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Quick Start</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 card-shadow border border-border" data-testid="quick-start-push">
            <div className="text-center space-y-2">
              <Dumbbell className="w-8 h-8 text-primary mx-auto" />
              <h4 className="font-semibold text-foreground">Push Day</h4>
              <p className="text-xs text-muted-foreground">Chest, Shoulders, Triceps</p>
            </div>
          </Card>
          
          <Card className="p-4 card-shadow border border-border" data-testid="quick-start-pull">
            <div className="text-center space-y-2">
              <Dumbbell className="w-8 h-8 text-chart-2 mx-auto" />
              <h4 className="font-semibold text-foreground">Pull Day</h4>
              <p className="text-xs text-muted-foreground">Back, Biceps</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Create New Workout */}
      <PrimaryButton 
        icon={<Plus className="w-5 h-5" />}
        onClick={handleCreateWorkout}
        data-testid="primary-button"
      >
        Create New Workout
      </PrimaryButton>

      {/* Workout History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle title="Workout History" />
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => setLocation('/history')}
            data-testid="see-all-history"
          >
            See All
          </Button>
        </div>
        
        {recentCompletedWorkouts.length === 0 ? (
          <Card className="p-6 card-shadow border border-border text-center" data-testid="no-history-card">
            <div className="space-y-2">
              <Dumbbell className="w-8 h-8 text-muted-foreground mx-auto" />
              <h4 className="font-semibold text-foreground">No completed workouts yet</h4>
              <p className="text-sm text-muted-foreground">Complete your first workout to see your history here</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentCompletedWorkouts.map((workout) => {
              const CategoryIcon = getCategoryIcon(workout.category)
              const workoutDate = workout.date instanceof Date ? workout.date : new Date(workout.date)
              
              return (
                <Link key={workout.id} href={`/workout/${workout.id}`}>
                  <SwiftCard className="p-4 active:scale-98 transition-transform" data-testid={`recent-workout-${workout.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-3">
                        {/* Header Row */}
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                            <CategoryIcon className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-foreground">{workout.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {format(workoutDate, 'MMM d')} • {workout.sets.length} exercises
                            </p>
                          </div>
                        </div>
                        
                        {/* Chips Row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Chip variant="default" size="sm">
                            {workout.category}
                          </Chip>
                          <Chip 
                            variant={getIntensityVariant(workout.intensity)} 
                            size="sm"
                          >
                            <Zap className="w-3 h-3 mr-1" />
                            {workout.intensity}/10
                          </Chip>
                          <Chip variant="default" size="sm">
                            <Clock className="w-3 h-3 mr-1" />
                            {workout.duration}m
                          </Chip>
                          <Chip variant="success" size="sm">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Completed
                          </Chip>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </SwiftCard>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
