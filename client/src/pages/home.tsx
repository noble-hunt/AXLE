import { useState } from "react"
import { useLocation } from "wouter"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAppStore } from "@/store/useAppStore"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { Sheet } from "@/components/swift/sheet"
import { fadeIn, slideUp } from "@/lib/motion-variants"
import { motion } from "framer-motion"
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
  User
} from "lucide-react"

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
    <div className="grid grid-cols-3 gap-3">
      <Card className="p-4 text-center">
        <Activity className="w-6 h-6 text-primary mx-auto mb-2" />
        <p className="text-heading font-bold text-foreground">{thisWeekWorkouts}</p>
        <p className="text-caption text-muted-foreground">Workouts This Week</p>
      </Card>
      <Card className="p-4 text-center">
        <Trophy className="w-6 h-6 text-accent mx-auto mb-2" />
        <p className="text-heading font-bold text-foreground">{totalPRs}</p>
        <p className="text-caption text-muted-foreground">Personal Records</p>
      </Card>
      <Card className="p-4 text-center">
        <Flame className="w-6 h-6 text-warning mx-auto mb-2" />
        <p className="text-heading font-bold text-foreground">{currentStreak}</p>
        <p className="text-caption text-muted-foreground">Day Streak</p>
      </Card>
    </div>
  )
}

// Health Insights Component  
function HealthInsights() {
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <Heart className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-body font-medium text-foreground">Resting Heart Rate</p>
              <p className="text-caption text-muted-foreground">↓ 3 bpm this week</p>
            </div>
          </div>
          <p className="text-subheading font-bold text-success">62 bpm</p>
        </div>
      </Card>
      
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-body font-medium text-foreground">Recovery Score</p>
              <p className="text-caption text-muted-foreground">Good recovery</p>
            </div>
          </div>
          <p className="text-subheading font-bold text-primary">85%</p>
        </div>
      </Card>
    </div>
  )
}

// Daily Suggestion Card Component for Home Page
function DailySuggestionCard({ setLocation }: { setLocation: (path: string) => void }) {
  const { data: suggestion, isLoading, error } = useQuery({
    queryKey: ['/api/suggestions/today'],
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
      <Card className="p-6" data-testid="daily-suggestion-loading">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-subheading font-semibold text-foreground mb-1">Daily Suggested Workout</h3>
              <p className="text-caption text-muted-foreground mb-4">Personalized for today</p>
            </div>
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  if (error || !suggestion) {
    return (
      <Card className="p-6" data-testid="daily-suggestion-error">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="text-subheading font-semibold text-foreground mb-1">Daily Suggested Workout</h3>
            <p className="text-caption text-muted-foreground mb-4">Personalized for today</p>
            <p className="text-body text-foreground mb-4">
              Unable to generate your personalized workout suggestion right now.
            </p>
            <Button 
              className="w-full"
              variant="secondary"
              onClick={() => setLocation('/generate-workout')}
              data-testid="fallback-generate-workout"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create Custom Workout
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6" data-testid="daily-suggestion-card">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1">
          <h3 className="text-subheading font-semibold text-foreground mb-1">Daily Suggested Workout</h3>
          <p className="text-caption text-muted-foreground mb-4">Personalized for today</p>
          
          <div className="mb-4">
            <p className="text-body font-medium text-foreground mb-2">{suggestion.name}</p>
            <p className="text-body text-foreground mb-2">
              {suggestion.category} • {suggestion.intensity}/10 intensity • {suggestion.duration} minutes
            </p>
            {suggestion.rationale && suggestion.rationale.length > 0 && (
              <p className="text-caption text-muted-foreground">
                {suggestion.rationale[0]}
              </p>
            )}
          </div>
          
          <Button 
            className="w-full"
            onClick={handleViewWorkout}
            data-testid="view-suggested-workout"
          >
            <Target className="w-4 h-4 mr-2" />
            View Workout
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default function Home() {
  const [showWorkoutGenerator, setShowWorkoutGenerator] = useState(false)
  const { workouts, user, profile } = useAppStore()
  const [, setLocation] = useLocation()

  // Get recent workouts (last 3) - avoid mutating store array
  const recentWorkouts = [...workouts]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3)

  const handleGenerateWorkout = () => {
    setShowWorkoutGenerator(true)
  }

  const handleSeeAllWorkouts = () => {
    setLocation('/history')
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
          className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-primary to-accent"
          variants={slideUp}
        >
          <div className="relative z-10 flex items-center justify-between text-white">
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
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center overflow-hidden">
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

        {/* Recent Workouts */}
        <motion.div variants={slideUp}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-subheading font-semibold text-foreground">Recent Workouts</h3>
            <Button variant="ghost" size="sm" onClick={handleSeeAllWorkouts} data-testid="see-all-workouts">
              <span className="text-primary">See All</span>
              <ChevronRight className="w-4 h-4 ml-1 text-primary" />
            </Button>
          </div>
          
          <div className="space-y-3">
            {recentWorkouts.map((workout) => (
              <Card key={workout.id} className="p-4" data-testid={`recent-workout-${workout.id}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Dumbbell className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-body font-medium text-foreground">{workout.name}</p>
                      <p className="text-caption text-muted-foreground">{workout.category}</p>
                    </div>
                  </div>
                  <p className="text-caption text-muted-foreground">{formatTimeAgo(new Date(workout.date))}</p>
                </div>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Daily Suggested Workout */}
        <motion.div variants={slideUp}>
          <DailySuggestionCard setLocation={setLocation} />
        </motion.div>

        {/* Health Insights */}
        <motion.div variants={slideUp}>
          <h3 className="text-subheading font-semibold text-foreground mb-4">Health Insights</h3>
          <HealthInsights />
        </motion.div>
      </motion.div>

      {/* Workout Generation Sheet */}
      <Sheet 
        open={showWorkoutGenerator} 
        onOpenChange={setShowWorkoutGenerator}
        data-testid="workout-generator-sheet"
      >
        <div className="p-6 space-y-6">
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
