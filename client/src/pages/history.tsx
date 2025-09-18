import { useState, useEffect } from "react"
import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingState, LoadingSkeleton } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import { useToast } from "@/hooks/use-toast"
import { useAppStore } from "@/store/useAppStore"
import { Link } from "wouter"
import { ChevronRight, Calendar, Clock, Dumbbell, Zap, Timer, Weight, Activity, Heart, Move, CheckCircle, XCircle, Filter, Search, RefreshCw, Info } from "lucide-react"
import { Category } from "../types"

// Category icon mapping
const getCategoryIcon = (category: Category) => {
  const iconMap = {
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

// Intensity color mapping
const getIntensityColor = (intensity: number) => {
  if (intensity <= 3) return "text-green-500"
  if (intensity <= 6) return "text-yellow-500"
  if (intensity <= 8) return "text-orange-500"
  return "text-red-500"
}

export default function History() {
  const { workouts, isAuthenticated, hydrateFromDb, user } = useAppStore()
  const { toast } = useToast()
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [completionFilter, setCompletionFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isReloading, setIsReloading] = useState(false)
  
  // Simulate loading state for better UX
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600)
    return () => clearTimeout(timer)
  }, [])
  
  const handleFilterError = (filterType: string) => {
    toast({
      title: "Filter Error",
      description: `Failed to apply ${filterType} filter. Please try again.`,
      variant: "destructive"
    })
  }

  const handleReload = async () => {
    if (!isAuthenticated || !user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to sync your workouts.",
        variant: "destructive"
      })
      return
    }

    setIsReloading(true)
    try {
      await hydrateFromDb(user.id)
      toast({
        title: "Data refreshed",
        description: "Your workout history has been updated from the database.",
      })
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Failed to refresh data. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsReloading(false)
    }
  }

  // Filter and sort workouts (most recent first)
  const filteredWorkouts = workouts
    .filter(workout => {
      const matchesCategory = categoryFilter === "all" || workout.category === categoryFilter
      const matchesCompletion = completionFilter === "all" || 
        (completionFilter === "completed" && workout.completed) ||
        (completionFilter === "uncompleted" && !workout.completed)
      return matchesCategory && matchesCompletion
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime())

  // Debug readout
  console.log('History Page State:', { 
    totalWorkouts: workouts.length,
    filteredWorkouts: filteredWorkouts.length,
    categoryFilter,
    completionFilter,
    completedWorkouts: workouts.filter(w => w.completed).length,
    recentWorkouts: workouts.slice(0, 5).map(w => ({ name: w.name, date: w.date, completed: w.completed }))
  })

  const groupedWorkouts = filteredWorkouts.reduce((acc, workout) => {
    const date = workout.date.toLocaleDateString()
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(workout)
    return acc
  }, {} as Record<string, typeof filteredWorkouts>)

  return (
    <>
      <SectionTitle title="Workout History" />

      {/* Guest Mode Banner */}
      {!isAuthenticated && (
        <Card className="p-4 card-shadow border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20 mb-4">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                Guest Mode
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-300">
                Sign in to sync workouts across devices and persist your data
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Reload Button for Authenticated Users */}
      {isAuthenticated && (
        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReload}
            disabled={isReloading}
            data-testid="reload-workouts"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isReloading ? 'animate-spin' : ''}`} />
            Reload from Database
          </Button>
        </div>
      )}

      {/* Filter Controls */}
      <Card className="p-4 card-shadow border border-border card-gradient">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filters</span>
        </div>
        
        {isLoading ? (
          <LoadingSkeleton rows={1} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <Select value={categoryFilter} onValueChange={(value) => {
                try {
                  setCategoryFilter(value)
                } catch (error) {
                  handleFilterError('category')
                }
              }}>
                <SelectTrigger className="rounded-lg focus-ring" data-testid="category-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.values(Category).map((category) => {
                    const IconComponent = getCategoryIcon(category)
                    return (
                      <SelectItem key={category} value={category}>
                        <div className="flex items-center gap-2">
                          <IconComponent className="w-4 h-4" />
                          {category}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <Select value={completionFilter} onValueChange={(value) => {
                try {
                  setCompletionFilter(value)
                } catch (error) {
                  handleFilterError('status')
                }
              }}>
                <SelectTrigger className="rounded-lg focus-ring" data-testid="completion-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Workouts</SelectItem>
                  <SelectItem value="completed">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Completed
                    </div>
                  </SelectItem>
                  <SelectItem value="uncompleted">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-orange-500" />
                      Uncompleted
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 card-shadow border border-border text-center" data-testid="total-workouts">
          {isLoading ? (
            <LoadingSkeleton rows={1} className="text-center" />
          ) : (
            <>
              <Calendar className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-lg font-bold text-foreground">{filteredWorkouts.length}</p>
              <p className="text-xs text-muted-foreground">{categoryFilter === "all" && completionFilter === "all" ? "Total" : "Filtered"} Workouts</p>
            </>
          )}
        </Card>
        
        <Card className="p-4 card-shadow border border-border text-center" data-testid="total-time">
          {isLoading ? (
            <LoadingSkeleton rows={1} className="text-center" />
          ) : (
            <>
              <Clock className="w-6 h-6 text-chart-2 mx-auto mb-2" />
              <p className="text-lg font-bold text-foreground">
                {filteredWorkouts.reduce((sum, w) => sum + w.duration, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Total Minutes</p>
            </>
          )}
        </Card>
        
        <Card className="p-4 card-shadow border border-border text-center" data-testid="avg-duration">
          {isLoading ? (
            <LoadingSkeleton rows={1} className="text-center" />
          ) : (
            <>
              <Clock className="w-6 h-6 text-chart-3 mx-auto mb-2" />
              <p className="text-lg font-bold text-foreground">
                {filteredWorkouts.length > 0 ? Math.round(filteredWorkouts.reduce((sum, w) => sum + w.duration, 0) / filteredWorkouts.length) : 0}
              </p>
              <p className="text-xs text-muted-foreground">Avg Minutes</p>
            </>
          )}
        </Card>
      </div>

      {/* Workout List */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="h-6 bg-muted rounded-md w-24 animate-pulse"></div>
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 card-shadow border border-border">
                <LoadingSkeleton rows={3} />
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedWorkouts).map(([date, dayWorkouts]) => (
            <div key={date} className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">{date}</h3>
              
              {dayWorkouts.map((workout) => {
                const CategoryIcon = getCategoryIcon(workout.category)
                return (
                  <Link key={workout.id} href={`/workout/${workout.id}`}>
                    <Card className="p-4 card-shadow border border-border hover:bg-accent/50 transition-all cursor-pointer button-pressed" data-testid={`history-workout-${workout.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <CategoryIcon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-foreground">{workout.name}</h4>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {workout.category}
                                </Badge>
                                <div className="flex items-center gap-1">
                                  <Zap className="w-3 h-3 text-muted-foreground" />
                                  <span className={`text-xs font-medium ${getIntensityColor(workout.intensity)}`}>
                                    {workout.intensity}/10
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{workout.duration} min</span>
                            </div>
                            <span>{workout.sets.length} exercises</span>
                            <div className="flex items-center gap-1">
                              {workout.completed ? (
                                <>
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                  <span className="text-green-500">Completed</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 text-orange-500" />
                                  <span className="text-orange-500">Pending</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {!isLoading && workouts.length === 0 && (
        <EmptyState
          icon={Calendar}
          title="No workouts yet"
          description="Start your fitness journey by creating your first workout! Track your progress and build healthy habits."
          actionLabel="Start First Workout"
          onAction={() => window.location.href = '/workout'}
          secondaryActionLabel="Generate Workout"
          onSecondaryAction={() => window.location.href = '/workout-generate'}
        />
      )}

      {!isLoading && workouts.length > 0 && filteredWorkouts.length === 0 && (
        <EmptyState
          icon={Search}
          title="No workouts match your filters"
          description="Try adjusting your category or completion status filters to see more results."
          actionLabel="Clear All Filters"
          onAction={() => {
            setCategoryFilter("all")
            setCompletionFilter("all")
          }}
          data-testid="no-filtered-results"
        />
      )}
    </>
  )
}