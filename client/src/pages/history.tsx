import { useState } from "react"
import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useAppStore } from "@/store/useAppStore"
import { Link } from "wouter"
import { ChevronRight, Calendar, Clock, Dumbbell, Zap, Timer, Weight, Activity, Heart, Move, CheckCircle, XCircle, Filter } from "lucide-react"
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
  const { workouts } = useAppStore()
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [completionFilter, setCompletionFilter] = useState<string>("all")

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

      {/* Filter Controls */}
      <Card className="p-4 card-shadow border border-border">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filters</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Category</label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="rounded-lg" data-testid="category-filter">
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
            <Select value={completionFilter} onValueChange={setCompletionFilter}>
              <SelectTrigger className="rounded-lg" data-testid="completion-filter">
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
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 card-shadow border border-border text-center" data-testid="total-workouts">
          <Calendar className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{filteredWorkouts.length}</p>
          <p className="text-xs text-muted-foreground">{categoryFilter === "all" && completionFilter === "all" ? "Total" : "Filtered"} Workouts</p>
        </Card>
        
        <Card className="p-4 card-shadow border border-border text-center" data-testid="total-time">
          <Clock className="w-6 h-6 text-chart-2 mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">
            {filteredWorkouts.reduce((sum, w) => sum + w.duration, 0)}
          </p>
          <p className="text-xs text-muted-foreground">Total Minutes</p>
        </Card>
        
        <Card className="p-4 card-shadow border border-border text-center" data-testid="avg-duration">
          <Clock className="w-6 h-6 text-chart-3 mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">
            {filteredWorkouts.length > 0 ? Math.round(filteredWorkouts.reduce((sum, w) => sum + w.duration, 0) / filteredWorkouts.length) : 0}
          </p>
          <p className="text-xs text-muted-foreground">Avg Minutes</p>
        </Card>
      </div>

      {/* Workout List */}
      <div className="space-y-6">
        {Object.entries(groupedWorkouts).map(([date, dayWorkouts]) => (
          <div key={date} className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">{date}</h3>
            
            {dayWorkouts.map((workout) => {
              const CategoryIcon = getCategoryIcon(workout.category)
              return (
                <Link key={workout.id} href={`/workout/${workout.id}`}>
                  <Card className="p-4 card-shadow border border-border hover:bg-accent/50 transition-colors cursor-pointer" data-testid={`history-workout-${workout.id}`}>
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

      {workouts.length === 0 && (
        <div className="text-center space-y-4 py-12">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold text-foreground">No workouts yet</h3>
          <p className="text-muted-foreground">Start your first workout to see it here!</p>
        </div>
      )}

      {workouts.length > 0 && filteredWorkouts.length === 0 && (
        <div className="text-center space-y-4 py-12" data-testid="no-filtered-results">
          <Filter className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold text-foreground">No workouts match your filters</h3>
          <p className="text-muted-foreground">Try adjusting your category or completion status filters.</p>
          <div className="flex gap-2 justify-center">
            <button 
              onClick={() => setCategoryFilter("all")}
              className="text-sm text-primary hover:underline"
              data-testid="clear-category-filter"
            >
              Clear Category
            </button>
            <span className="text-muted-foreground">•</span>
            <button 
              onClick={() => setCompletionFilter("all")}
              className="text-sm text-primary hover:underline"
              data-testid="clear-completion-filter"
            >
              Clear Status
            </button>
          </div>
        </div>
      )}
    </>
  )
}