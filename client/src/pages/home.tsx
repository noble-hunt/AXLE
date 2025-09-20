import { useState } from "react"
import { useLocation, Link } from "wouter"
import { useAppStore } from "@/store/useAppStore"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { Sheet } from "@/components/swift/sheet"
import { SuggestionCard } from "@/components/SuggestionCard"
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
              <Link key={workout.id} href={`/workout/${workout.id}`}>
                <Card className="p-4 active:scale-98 transition-transform" data-testid={`recent-workout-${workout.id}`}>
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
                    <div className="flex items-center gap-2">
                      <p className="text-caption text-muted-foreground">{formatTimeAgo(new Date(workout.date))}</p>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Daily Suggested Workout */}
        <motion.div variants={slideUp}>
          <SuggestionCard variant="home" />
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
