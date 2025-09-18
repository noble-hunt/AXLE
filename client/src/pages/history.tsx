import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { useAppStore } from "@/store/useAppStore"
import { Link } from "wouter"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { Chip } from "@/components/swift/chip"
import { SegmentedControl } from "@/components/swift/segmented-control"
import { StatBadge } from "@/components/swift/stat-badge"
import { fadeIn } from "@/lib/motion-variants"
import { motion } from "framer-motion"
import { ChevronRight, Calendar, Clock, Dumbbell, Zap, Timer, Weight, Activity, Heart, Move, CheckCircle, XCircle, Filter, Search, RefreshCw, Info, TrendingUp } from "lucide-react"
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

const completionOptions = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" }
] as const

export default function History() {
  const { workouts, isAuthenticated, hydrateFromDb, user } = useAppStore()
  const { toast } = useToast()
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [completionFilter, setCompletionFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  
  // Simulate loading state for better UX
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  // Filter and sort workouts (most recent first)
  const filteredWorkouts = workouts
    .filter(workout => {
      const matchesCategory = categoryFilter === "all" || workout.category === categoryFilter
      const matchesCompletion = completionFilter === "all" || 
        (completionFilter === "completed" && workout.completed) ||
        (completionFilter === "pending" && !workout.completed)
      return matchesCategory && matchesCompletion
    })
    .sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date)
      const dateB = b.date instanceof Date ? b.date : new Date(b.date)
      return dateB.getTime() - dateA.getTime()
    })

  // Category filter options
  const categoryOptions = [
    { value: "all", label: "All" },
    ...Object.values(Category).map(category => ({
      value: category,
      label: category
    }))
  ]

  // Group workouts by date (ensure dates are Date objects)
  const groupedWorkouts = filteredWorkouts.reduce((acc, workout) => {
    const workoutDate = workout.date instanceof Date ? workout.date : new Date(workout.date)
    const dateKey = format(workoutDate, 'yyyy-MM-dd')
    const dateLabel = format(workoutDate, 'MMM d, yyyy')
    if (!acc[dateKey]) {
      acc[dateKey] = {
        label: dateLabel,
        workouts: []
      }
    }
    acc[dateKey].workouts.push(workout)
    return acc
  }, {} as Record<string, { label: string; workouts: typeof filteredWorkouts }>)

  // Stats
  const totalTime = filteredWorkouts.reduce((sum, w) => sum + w.duration, 0)
  const avgTime = filteredWorkouts.length > 0 ? Math.round(totalTime / filteredWorkouts.length) : 0
  const completedCount = filteredWorkouts.filter(w => w.completed).length

  if (isLoading) {
    return (
      <motion.div 
        className="space-y-6"
        variants={fadeIn}
        initial="initial"
        animate="animate"
      >
        <div className="space-y-4">
          <div className="h-8 bg-muted rounded-2xl w-48 animate-pulse" />
          <div className="h-10 bg-muted rounded-2xl animate-pulse" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
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
      <div className="flex items-center justify-between">
        <h1 className="text-heading font-bold text-foreground">Workout History</h1>
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
      </div>

      {/* Filter Chips */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-body font-medium text-foreground">Category</label>
          <div className="flex flex-wrap gap-2" data-testid="category-filter-chips">
            {categoryOptions.map((option) => (
              <Chip 
                key={option.value}
                variant={categoryFilter === option.value ? "default" : "outline"}
                onClick={() => setCategoryFilter(option.value)}
                data-testid={`category-filter-${option.value}`}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-body font-medium text-foreground">Status</label>
          <SegmentedControl
            options={completionOptions}
            value={completionFilter}
            onChange={setCompletionFilter}
            data-testid="completion-filter"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatBadge
          icon={<Calendar className="w-4 h-4" />}
          value={filteredWorkouts.length.toString()}
          label="Workouts"
          data-testid="total-workouts"
        />
        <StatBadge
          icon={<Clock className="w-4 h-4" />}
          value={totalTime.toString()}
          label="Minutes"
          data-testid="total-time"
        />
        <StatBadge
          icon={<CheckCircle className="w-4 h-4" />}
          value={completedCount.toString()}
          label="Completed"
          data-testid="completed-count"
        />
      </div>

      {/* Workout List */}
      <div className="space-y-6">
        {Object.entries(groupedWorkouts).map(([dateKey, dateGroup]) => (
          <div key={dateKey} className="space-y-3">
            <h2 className="text-subheading font-semibold text-foreground">{dateGroup.label}</h2>
            
            {dateGroup.workouts.map((workout) => {
              const CategoryIcon = getCategoryIcon(workout.category)
              return (
                <Link key={workout.id} href={`/workout/${workout.id}`}>
                  <Card className="p-4 active:scale-98 transition-transform" data-testid={`history-workout-${workout.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-3">
                        {/* Header Row */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <CategoryIcon className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-body font-semibold text-foreground">{workout.name}</h3>
                            <p className="text-caption text-muted-foreground">{workout.sets.length} exercises</p>
                          </div>
                        </div>
                        
                        {/* Chips Row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Chip variant="outline" size="sm">
                            {workout.category}
                          </Chip>
                          <Chip 
                            variant={getIntensityVariant(workout.intensity)} 
                            size="sm"
                            data-testid={`intensity-${workout.intensity}`}
                          >
                            <Zap className="w-3 h-3 mr-1" />
                            {workout.intensity}/10
                          </Chip>
                          <Chip variant="outline" size="sm">
                            <Clock className="w-3 h-3 mr-1" />
                            {workout.duration}m
                          </Chip>
                          {workout.completed ? (
                            <Chip variant="success" size="sm" data-testid="completion-completed">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Completed
                            </Chip>
                          ) : (
                            <Chip variant="warning" size="sm" data-testid="completion-pending">
                              <XCircle className="w-3 h-3 mr-1" />
                              Pending
                            </Chip>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        ))}
      </div>

      {/* Empty States */}
      {workouts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
            <Calendar className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-subheading font-bold text-foreground">No workouts yet</h3>
            <p className="text-body text-muted-foreground max-w-sm">
              Start your fitness journey by generating your first workout
            </p>
          </div>
          <Link href="/">
            <Button data-testid="generate-first-workout">
              Generate Workout
            </Button>
          </Link>
        </div>
      )}

      {workouts.length > 0 && filteredWorkouts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-subheading font-bold text-foreground">No matches found</h3>
            <p className="text-body text-muted-foreground max-w-sm">
              Try adjusting your filters to see more results
            </p>
          </div>
          <Button 
            variant="secondary"
            onClick={() => {
              setCategoryFilter("all")
              setCompletionFilter("all")
            }}
            data-testid="clear-filters"
          >
            Clear Filters
          </Button>
        </div>
      )}
    </motion.div>
  )
}