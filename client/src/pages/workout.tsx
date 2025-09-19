import { SectionTitle } from "@/components/ui/section-title"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Card } from "@/components/ui/card"
import { Card as SwiftCard } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { Chip } from "@/components/swift/chip"
import { Play, Plus, Timer, Dumbbell, ChevronRight, Clock, Zap, CheckCircle, Activity, Heart, Move, Weight, Lightbulb } from "lucide-react"
import { useLocation, Link } from "wouter"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
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

// Suggested Workout Card Component
function SuggestedWorkoutCard({ setLocation }: { setLocation: (path: string) => void }) {
  const { data: suggestion, isLoading, error } = useQuery({
    queryKey: ['/api/suggestions/today'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/suggestions/today', {
        headers: {
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        }
      })
      if (!response.ok) throw new Error('Failed to fetch suggestion')
      return response.json()
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 1
  })

  const handleViewWorkout = () => {
    if (suggestion?.id) {
      setLocation(`/workout/${suggestion.id}`)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Suggested Workout</h3>
        <SwiftCard className="p-6" data-testid="suggested-workout-loading">
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
        </SwiftCard>
      </div>
    )
  }

  if (error || !suggestion) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Suggested Workout</h3>
        <SwiftCard className="p-6" data-testid="suggested-workout-error">
          <div className="text-center space-y-3">
            <Lightbulb className="w-8 h-8 text-muted-foreground mx-auto" />
            <div>
              <h4 className="font-semibold text-foreground">No Suggestion Available</h4>
              <p className="text-sm text-muted-foreground">Try creating a new workout below</p>
            </div>
          </div>
        </SwiftCard>
      </div>
    )
  }

  const CategoryIcon = getCategoryIcon(suggestion.category as Category)

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Suggested Workout</h3>
      
      <SwiftCard className="p-6 card-shadow cursor-pointer hover:shadow-lg transition-shadow" onClick={handleViewWorkout} data-testid="suggested-workout-card">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <CategoryIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">{suggestion.name}</h4>
                <p className="text-sm text-muted-foreground">Personalized for today</p>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Chip size="sm" variant="outline" data-testid={`chip-category`}>
                {suggestion.category}
              </Chip>
              <Chip size="sm" variant={getIntensityVariant(suggestion.intensity)} data-testid={`chip-intensity`}>
                {suggestion.intensity}/10
              </Chip>
              <Chip size="sm" variant="outline" data-testid={`chip-duration`}>
                <Clock className="w-3 h-3" />
                {suggestion.duration}min
              </Chip>
            </div>
            
            {suggestion.rationale && suggestion.rationale.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  {suggestion.rationale[0]}
                </p>
              </div>
            )}
          </div>
          
          <ChevronRight className="w-5 h-5 text-muted-foreground ml-4" />
        </div>
      </SwiftCard>
    </div>
  )
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

      {/* Suggested Workout */}
      <SuggestedWorkoutCard setLocation={setLocation} />

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
