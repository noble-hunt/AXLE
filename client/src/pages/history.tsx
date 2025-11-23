import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { useAppStore } from "@/store/useAppStore"
import { useQuery } from "@tanstack/react-query"
import { Link } from "wouter"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { Chip } from "@/components/swift/chip"
import { SaveWorkoutButton } from "@/components/workouts/SaveWorkoutButton"
import { StatBadge } from "@/components/swift/stat-badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { fadeIn } from "@/lib/motion-variants"
import { motion } from "framer-motion"
import { ChevronRight, Calendar, Clock, Dumbbell, Zap, Timer, Weight, Activity, Heart, Move, CheckCircle, XCircle, Filter, Search, RefreshCw, Info, TrendingUp, Sparkles } from "lucide-react"
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

const sourceOptions = [
  { value: "all", label: "All" },
  { value: "saved", label: "Saved Only" },
  { value: "suggested", label: "Suggested Only" },
  { value: "manual", label: "Manual Only" }
] as const

export default function History() {
  const { user, profile } = useAppStore()
  const { toast } = useToast()
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [completionFilter, setCompletionFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  
  // Fetch workouts from API
  const { data: workouts = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/workouts'],
    enabled: !!user,
  })

  // Helper function to determine if a workout is suggested
  const isSuggestedWorkout = (workout: any) => {
    // Check if workout has explicit suggestion markers
    if (workout.source === 'suggested' || workout.source === 'ai' || workout.suggested === true) {
      return true
    }
    
    // Check if the workout was generated from suggestions API
    // Workouts from suggestions typically have specific metadata or naming patterns
    if (workout.request && typeof workout.request === 'object') {
      // If request contains suggestion-specific fields
      if (workout.request.fromSuggestion === true || workout.request.suggested === true) {
        return true
      }
    }
    
    // Check for suggestion-related keywords in title or notes
    const suggestionKeywords = ['suggested', 'daily suggestion', 'recommended', 'ai-generated', 'personalized', 'daily workout']
    const hasSuggestionKeywords = suggestionKeywords.some(keyword => 
      workout.notes?.toLowerCase().includes(keyword) ||
      workout.title?.toLowerCase().includes(keyword)
    )
    
    // Check for typical AI-generated workout names from our system
    const aiGeneratedPatterns = [
      'flow', 'blast', 'circuit', 'crusher', 'fury', 'storm', 'thunder', 'power', 
      'endurance session', 'strength builder', 'cardio burn', 'hiit session'
    ]
    const hasAiPattern = aiGeneratedPatterns.some(pattern => 
      workout.title?.toLowerCase().includes(pattern)
    )
    
    // If workout was created recently (last 30 days) and has AI patterns, likely suggested
    const dateValue = workout.created_at || workout.date || workout.createdAt || workout.startedAt
    const workoutDate = dateValue ? new Date(dateValue) : null
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const isRecent = workoutDate && !isNaN(workoutDate.getTime()) && workoutDate >= thirtyDaysAgo
    
    return hasSuggestionKeywords || (isRecent && hasAiPattern)
  }

  // Filter and sort workouts (most recent first)
  const filteredWorkouts = workouts
    .filter(workout => {
      // Get category from request.focus or request object
      const workoutCategory = workout.request?.focus || workout.request?.category || workout.category
      const matchesCategory = categoryFilter === "all" || workoutCategory === categoryFilter
      const matchesCompletion = completionFilter === "all" || 
        (completionFilter === "completed" && workout.completed) ||
        (completionFilter === "pending" && !workout.completed)
      
      // Check if workout is saved
      const isSaved = profile?.savedWorkouts?.includes(workout.id) || false
      
      const matchesSource = sourceFilter === "all" ||
        (sourceFilter === "saved" && isSaved) ||
        (sourceFilter === "suggested" && isSuggestedWorkout(workout)) ||
        (sourceFilter === "manual" && !isSuggestedWorkout(workout))
      return matchesCategory && matchesCompletion && matchesSource
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at || a.date || a.createdAt || a.startedAt || 0)
      const dateB = new Date(b.created_at || b.date || b.createdAt || b.startedAt || 0)
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
    const dateValue = workout.created_at || workout.date || workout.createdAt || workout.startedAt
    if (!dateValue) return acc // Skip workouts without a valid date
    
    const workoutDate = new Date(dateValue)
    if (isNaN(workoutDate.getTime())) return acc // Skip invalid dates
    
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
  const totalTime = filteredWorkouts.reduce((sum, w) => {
    const duration = w.request?.availableMinutes || w.request?.duration || w.duration || 0
    return sum + duration
  }, 0)
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
          <div className="grid grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="space-y-5">
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
      <div className="space-y-2">
        <div className="space-y-1">
          <label className="text-body font-medium text-foreground">Category</label>
          <div className="flex flex-wrap gap-2" data-testid="category-filter-chips">
            {categoryOptions.map((option) => (
              <Chip 
                key={option.value}
                size="xl"
                variant={categoryFilter === option.value ? "primary" : "default"}
                onClick={() => setCategoryFilter(option.value)}
                data-testid={`category-filter-${option.value}`}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* More Filters Button */}
        <Dialog open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="secondary" 
              className="w-full h-12"
              data-testid="more-filters-button"
            >
              <Filter className="w-4 h-4 mr-2" />
              More Filters
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>More Filters</DialogTitle>
              <DialogDescription>
                Refine your workout history with additional filters
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <label className="text-body font-medium text-foreground">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {completionOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={completionFilter === option.value ? "primary" : "secondary"}
                      onClick={() => setCompletionFilter(option.value)}
                      className="h-10"
                      data-testid={`completion-${option.value}`}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-body font-medium text-foreground">Source</label>
                <div className="grid grid-cols-2 gap-2">
                  {sourceOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={sourceFilter === option.value ? "primary" : "secondary"}
                      onClick={() => setSourceFilter(option.value)}
                      className="h-10"
                      data-testid={`source-${option.value}`}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-5">
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

      {/* View More Stats Button */}
      <div className="mt-6">
        <Link href="/stats">
          <Button 
            variant="secondary" 
            className="w-full h-12"
            data-testid="view-more-stats-button"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            View More Stats
          </Button>
        </Link>
      </div>

      {/* Workout List */}
      <div className="space-y-8 pt-1">
        {(Object.entries(groupedWorkouts) as [string, { label: string; workouts: any[] }][]).map(([dateKey, dateGroup]) => (
          <div key={dateKey} className="space-y-6">
            <h2 className="text-subheading font-semibold text-foreground mb-3">{dateGroup.label}</h2>
            
            {dateGroup.workouts.map((workout: any) => {
              const workoutCategory = workout.request?.focus || workout.request?.category || workout.category
              const CategoryIcon = getCategoryIcon(workoutCategory)
              const exerciseCount = Array.isArray(workout.sets) ? workout.sets.length : 
                                  (workout.request?.blocks?.reduce((sum: number, block: any) => sum + (block.items?.length || 0), 0) || 0)
              return (
                <div key={workout.id} className="relative">
                  <Link href={`/workout/${workout.id}`} className="block">
                    <Card className="active:scale-98 transition-transform" data-testid={`history-workout-${workout.id}`}>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 space-y-4">
                            {/* Header Row */}
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <CategoryIcon className="w-5 h-5 text-primary" />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-body font-semibold text-foreground">{workout.title || workout.name || 'Untitled Workout'}</h3>
                                <p className="text-caption text-muted-foreground">{exerciseCount} exercises</p>
                              </div>
                            </div>
                            
                            {/* Chips Row */}
                            <div className="flex items-center gap-5 flex-wrap">
                              {workoutCategory && (
                                <Chip variant="default" size="sm">
                                  {workoutCategory}
                                </Chip>
                              )}
                              {isSuggestedWorkout(workout) && (
                                <Chip variant="accent" size="sm" data-testid="suggested-badge">
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  Suggested
                                </Chip>
                              )}
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
                        
                        {/* Save Workout Button */}
                        <SaveWorkoutButton workoutId={workout.id} fullWidth />
                      </div>
                    </Card>
                  </Link>
                </div>
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
              setSourceFilter("all")
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