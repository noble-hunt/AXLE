import { useState } from "react"
import { useLocation, Link } from "wouter"
import { useAppStore } from "@/store/useAppStore"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { Chip } from "@/components/swift/chip"
import { Sheet } from "@/components/swift/sheet"
import { DailySuggestionCard } from "@/components/workouts/DailySuggestionCard"
import { SaveWorkoutButton } from "@/components/workouts/SaveWorkoutButton"
import { GroupsShortcutCard } from "@/components/groups/GroupsShortcutCard"
import { fadeIn, slideUp } from "@/lib/motion-variants"
import { motion } from "framer-motion"
import { Category } from "../types"
import { 
  Dumbbell, 
  Clock, 
  Target, 
  Trophy, 
  Flame, 
  Heart, 
  Activity, 
  TrendingUp,
  ChevronRight,
  Sparkles,
  User,
  Zap,
  Timer,
  Weight,
  Move,
  CheckCircle,
  XCircle
} from "lucide-react"

// Category icon mapping (same as history page)
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

// Helper function to determine if a workout is suggested (matching history page logic)
const isSuggestedWorkout = (workout: any) => {
  // Check if workout has explicit suggestion markers
  if (workout.source === 'suggested' || workout.source === 'ai' || workout.suggested === true) {
    return true
  }
  
  // Check if the workout was generated from suggestions API
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
  
  const isRecent = workoutDate ? workoutDate >= thirtyDaysAgo : false
  
  // Return true if keywords found, or if it has AI patterns and is recent
  return hasSuggestionKeywords || (hasAiPattern && isRecent)
}

// Quick Stats Component
function QuickStats() {
  const { workouts, prs } = useAppStore()
  
  // Calculate stats
  const thisWeekWorkouts = workouts.filter(w => {
    const workoutDate = new Date(w.date)
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return workoutDate >= weekAgo
  }).length

  const totalPRs = prs.length
  const currentStreak = 7 // This could be calculated based on consecutive workout days

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card className="text-center p-4">
        <Activity className="w-5 h-5 text-info mx-auto mb-1" />
        <p className="text-heading font-bold text-foreground">{thisWeekWorkouts}</p>
        <p className="text-caption text-muted-foreground">Workouts This Week</p>
      </Card>
      <Card className="text-center p-4">
        <Trophy className="w-5 h-5 text-warning mx-auto mb-1" />
        <p className="text-heading font-bold text-foreground">{totalPRs}</p>
        <p className="text-caption text-muted-foreground">Personal Records</p>
      </Card>
      <Card className="text-center p-4">
        <Flame className="w-5 h-5 text-accent mx-auto mb-1" />
        <p className="text-heading font-bold text-foreground">{currentStreak}</p>
        <p className="text-caption text-muted-foreground">Day<br />Streak</p>
      </Card>
    </div>
  )
}

// Health Insights Component - Shows zeroed out data when no health data is available
function HealthInsights() {
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Heart className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-body font-medium text-foreground">Resting Heart Rate</p>
              <p className="text-caption text-muted-foreground">No data</p>
            </div>
          </div>
          <p className="text-subheading font-bold text-accent">--</p>
        </div>
      </Card>
      
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-body font-medium text-foreground">Recovery Score</p>
              <p className="text-caption text-muted-foreground">No data</p>
            </div>
          </div>
          <p className="text-subheading font-bold text-info">--</p>
        </div>
      </Card>
    </div>
  )
}


export default function Home() {
  const [showWorkoutGenerator, setShowWorkoutGenerator] = useState(false)
  const { user, profile } = useAppStore()
  const [, setLocation] = useLocation()

  // Fetch recent workouts from API instead of using seed data
  const { data: recentWorkouts = [], isLoading, error } = useQuery<any[]>({
    queryKey: ['/api/workouts/recent'],
    enabled: !!user,
  })


  const handleGenerateWorkout = () => {
    setShowWorkoutGenerator(true)
  }

  const handleSeeAllWorkouts = () => {
    setLocation('/history')
  }

  const handleSeeAllHealth = () => {
    setLocation('/health')
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) {
      return 'Today'
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      return diffInDays === 1 ? 'Yesterday' : `${diffInDays} days ago`
    }
  }

  return (
    <div className="min-h-screen pb-safe-area-inset-bottom">
      <motion.div 
        className="space-y-6 pb-[calc(theme(spacing.20)+env(safe-area-inset-bottom))]"
        variants={fadeIn}
        initial="initial"
        animate="animate"
      >
        {/* Welcome Banner */}
        <motion.div
          className="relative overflow-hidden rounded-3xl p-6 theme-gradient-animate border-none shadow-soft"
          variants={slideUp}
          data-testid="welcome-card"
        >
          <div className="relative z-10 flex items-center justify-between text-white drop-shadow-sm">
            <div>
              <h1 className="text-subheading font-bold">Welcome back!</h1>
              <h2 className="text-heading font-bold">{(() => {
                const firstName = profile?.firstName || user?.user_metadata?.first_name || ''
                const lastName = profile?.lastName || user?.user_metadata?.last_name || ''
                return firstName && lastName ? `${firstName} ${lastName}` : 
                       firstName || profile?.username || user?.email?.split('@')[0] || 'Athlete'
              })()}</h2>
              <p className="text-body opacity-90 mt-1">Ready to crush your goals?</p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center overflow-hidden">
              {profile?.avatarUrl ? (
                <img 
                  src={profile.avatarUrl} 
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-8 h-8 text-white" />
              )}
            </div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div variants={slideUp}>
          <h3 className="text-subheading font-semibold text-foreground mb-4">Quick Stats</h3>
          <QuickStats />
        </motion.div>

        {/* Daily Suggested Workout */}
        <motion.div variants={slideUp}>
          <DailySuggestionCard />
        </motion.div>

        {/* Groups Shortcut */}
        <motion.div variants={slideUp}>
          <GroupsShortcutCard />
        </motion.div>

        {/* Recent Workouts */}
        <motion.div variants={slideUp}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-subheading font-semibold text-foreground">Recent Workouts</h3>
            <Button variant="ghost" size="sm" onClick={handleSeeAllWorkouts} data-testid="see-all-workouts">
              <span className="text-primary">See All</span>
              <ChevronRight className="w-4 h-4 ml-1 text-primary" />
            </Button>
          </div>
          
          <div className="space-y-5">
            {recentWorkouts.length > 0 ? (
              recentWorkouts.slice(0, 3).map((workout) => {
                const workoutCategory = workout.request?.focus || workout.request?.category || workout.category
                const CategoryIcon = getCategoryIcon(workoutCategory)
                const exerciseCount = Array.isArray(workout.sets) ? workout.sets.length : 
                                    (workout.request?.blocks?.reduce((sum: number, block: any) => sum + (block.items?.length || 0), 0) || 0)
                return (
                  <div key={workout.id} className="relative">
                    <Link href={`/workout/${workout.id}`} className="block">
                      <Card className="active:scale-98 transition-transform" data-testid={`recent-workout-${workout.id}`}>
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
              })
            ) : (
              <Card className="text-center">
                <Dumbbell className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-body text-muted-foreground mb-2">No workouts yet</p>
                <p className="text-caption text-muted-foreground">Start your fitness journey by generating your first workout!</p>
              </Card>
            )}
          </div>
        </motion.div>

        {/* Health Insights */}
        <motion.div variants={slideUp}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-subheading font-semibold text-foreground">Health Insights</h3>
            <Button variant="ghost" size="sm" onClick={handleSeeAllHealth} data-testid="see-all-health">
              <span className="text-primary">See All</span>
              <ChevronRight className="w-4 h-4 ml-1 text-primary" />
            </Button>
          </div>
          <HealthInsights />
        </motion.div>
      </motion.div>

      {/* Workout Generation Sheet */}
      <Sheet 
        open={showWorkoutGenerator} 
        onOpenChange={setShowWorkoutGenerator}
        data-testid="workout-generator-sheet"
      >
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-subheading font-bold text-foreground">Generate Workout</h2>
            <p className="text-body text-muted-foreground">AI-powered personalized fitness</p>
          </div>

          <Button 
            variant="secondary"
            className="w-full"
            onClick={() => {
              setShowWorkoutGenerator(false)
              setLocation('/workout')
            }}
            data-testid="open-workout-generator"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Open Workout Generator
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
