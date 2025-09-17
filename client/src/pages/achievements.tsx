import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Trophy, Star, Target, Flame, Award, Calendar, Medal, Crown, Zap, Users } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"
import { AchievementCategory, Achievement, Unit } from "@/types"
import { useEffect, useState } from "react"

export default function Achievements() {
  const { achievements, recomputeAchievements } = useAppStore()
  const [showConfetti, setShowConfetti] = useState<string[]>([])
  
  // Trigger achievements recomputation on page load
  useEffect(() => {
    const newlyUnlocked = recomputeAchievements()
    if (newlyUnlocked.length > 0) {
      setShowConfetti(newlyUnlocked.map(a => a.id))
      // Clear confetti after animation
      setTimeout(() => setShowConfetti([]), 3000)
    }
  }, [recomputeAchievements])
  
  // Debug readout
  console.log('Achievements Page State:', { 
    totalAchievements: achievements.length,
    completedAchievements: achievements.filter(a => a.completed).length,
    inProgressAchievements: achievements.filter(a => !a.completed && a.progress > 0).length,
    recentAchievements: achievements.slice(0, 3).map(a => ({ title: a.title, completed: a.completed, progress: a.progress }))
  })
  
  const completedCount = achievements.filter(a => a.completed).length
  const totalCount = achievements.length
  
  // Group achievements by category
  const generalAchievements = achievements.filter(a => a.category === AchievementCategory.GENERAL)
  const categoryAchievements = achievements.filter(a => a.category !== AchievementCategory.GENERAL)
  
  // Group category achievements
  const achievementsByCategory = {
    [AchievementCategory.POWERLIFTING]: achievements.filter(a => a.category === AchievementCategory.POWERLIFTING),
    [AchievementCategory.OLYMPIC_WEIGHTLIFTING]: achievements.filter(a => a.category === AchievementCategory.OLYMPIC_WEIGHTLIFTING),
    [AchievementCategory.GYMNASTICS]: achievements.filter(a => a.category === AchievementCategory.GYMNASTICS),
    [AchievementCategory.AEROBIC]: achievements.filter(a => a.category === AchievementCategory.AEROBIC),
    [AchievementCategory.BODYBUILDING]: achievements.filter(a => a.category === AchievementCategory.BODYBUILDING),
  }

  // Enhanced icon mapping
  const getIcon = (icon: string) => {
    switch (icon) {
      case '🏆': return Trophy
      case '💪': return Award  
      case '🏋️': return Target
      case '🏋️‍♂️': return Target
      case '🥷': return Star
      case '🫁': return Flame
      case '🔥': return Flame
      case '⚔️': return Zap
      case '💥': return Target
      case '🥇': return Medal
      case '🧹': return Award
      case '⚡': return Zap
      case '👑': return Crown
      case '🚀': return Star
      case '💨': return Flame
      case '🏃‍♂️': return Users
      case '🦾': return Award
      default: return Trophy
    }
  }

  // Get category icon
  const getCategoryIcon = (category: AchievementCategory) => {
    switch (category) {
      case AchievementCategory.POWERLIFTING: return Target
      case AchievementCategory.OLYMPIC_WEIGHTLIFTING: return Medal
      case AchievementCategory.GYMNASTICS: return Star
      case AchievementCategory.AEROBIC: return Flame
      case AchievementCategory.BODYBUILDING: return Award
      default: return Trophy
    }
  }

  // Helper function to safely format dates
  const formatDate = (date: Date | string | undefined): string => {
    if (!date) return 'Recently'
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date
      if (isNaN(dateObj.getTime())) return 'Recently'
      return dateObj.toLocaleDateString()
    } catch {
      return 'Recently'
    }
  }

  // Helper function to safely calculate progress percentage
  const getProgressPercentage = (progress: number, target: number, unit?: Unit): number => {
    if (!progress || !target || target === 0) return 0
    
    // For time-based achievements, lower is better - invert calculation
    if (unit === Unit.TIME) {
      // If progress <= target, we've achieved the goal (100%)
      if (progress <= target) return 100;
      // Otherwise, show partial progress: target/progress * 100
      const percentage = Math.round((target / progress) * 100)
      return isNaN(percentage) ? 0 : Math.min(percentage, 100)
    }
    
    // For all other achievements, higher is better
    const percentage = Math.round((progress / target) * 100)
    return isNaN(percentage) ? 0 : Math.min(percentage, 100)
  }

  // Helper function to safely format progress values
  const formatProgressValue = (value: number | undefined): string => {
    if (value === undefined || value === null || isNaN(value)) return '0'
    return value.toString()
  }

  // Helper function to safely format target values based on unit
  const formatTargetValue = (value: number, unit?: Unit): string => {
    if (value === undefined || value === null || isNaN(value)) return '0'
    
    // For time-based achievements, convert seconds back to mm:ss format
    if (unit === Unit.TIME) {
      const minutes = Math.floor(value / 60)
      const seconds = value % 60
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }
    
    return value.toString()
  }

  // Render individual achievement
  const renderAchievement = (achievement: Achievement) => {
    const Icon = getIcon(achievement.icon)
    const isConfetti = showConfetti.includes(achievement.id)
    
    // Safely get progress values
    const progress = achievement.progress || 0
    const target = achievement.target || 1
    const progressPercentage = getProgressPercentage(progress, target, achievement.unit)
    
    return (
      <Card 
        key={achievement.id} 
        className={`p-4 card-shadow border border-border transition-all duration-300 relative overflow-hidden ${
          achievement.completed ? 'bg-accent/20 border-primary/30' : ''
        } ${isConfetti ? 'animate-pulse shadow-lg shadow-primary/25' : ''}`}
        data-testid={`achievement-${achievement.id}`}
      >
        {/* Confetti effect for newly unlocked */}
        {isConfetti && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-2 left-2 w-2 h-2 bg-primary rounded-full animate-ping" />
            <div className="absolute top-4 right-4 w-1 h-1 bg-yellow-400 rounded-full animate-ping" />
            <div className="absolute bottom-3 left-8 w-1.5 h-1.5 bg-green-400 rounded-full animate-ping" />
            <div className="absolute bottom-6 right-6 w-1 h-1 bg-blue-400 rounded-full animate-ping" />
          </div>
        )}
        
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
            achievement.completed 
              ? 'bg-primary text-primary-foreground shadow-lg' 
              : 'bg-muted text-muted-foreground'
          }`}>
            <Icon className="w-6 h-6" />
          </div>
          
          <div className="flex-1">
            <h4 className="font-semibold text-foreground">{achievement.title}</h4>
            <p className="text-sm text-muted-foreground">{achievement.description}</p>
            
            {achievement.completed ? (
              <div className="flex items-center gap-1 mt-2">
                <Calendar className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Completed {formatDate(achievement.unlockedAt)}
                </span>
              </div>
            ) : progress >= 0 ? (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>
                    {formatProgressValue(progress)}/{formatTargetValue(target, achievement.unit)}
                    {achievement.unit && achievement.unit !== Unit.REPS && (
                      <span className="ml-1 opacity-70">{achievement.unit}</span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-500 relative overflow-hidden"
                    style={{ 
                      width: `${progressPercentage}%` 
                    }}
                  >
                    {/* Animated progress bar shimmer */}
                    <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                  </div>
                </div>
                {/* Progress percentage text */}
                <div className="text-xs text-muted-foreground mt-1">
                  {progressPercentage}% complete
                  {achievement.unit === Unit.TIME && progress > 0 && (
                    <span className="ml-2 opacity-70">
                      Best: {formatTargetValue(progress, Unit.TIME)}
                    </span>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    )
  }

  // Render achievement category section
  const renderCategorySection = (category: AchievementCategory, categoryAchievements: Achievement[]) => {
    if (categoryAchievements.length === 0) return null
    
    const CategoryIcon = getCategoryIcon(category)
    const completedInCategory = categoryAchievements.filter(a => a.completed).length
    
    return (
      <div key={category} className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <CategoryIcon className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{category}</h3>
            <p className="text-sm text-muted-foreground">
              {completedInCategory}/{categoryAchievements.length} completed
            </p>
          </div>
        </div>
        
        <div className="space-y-3">
          {categoryAchievements.map(renderAchievement)}
        </div>
      </div>
    )
  }

  return (
    <>
      <SectionTitle title="Achievements" />

      {/* Achievement Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 card-shadow border border-border text-center" data-testid="completed-achievements">
          <Trophy className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{completedCount}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </Card>
        
        <Card className="p-4 card-shadow border border-border text-center" data-testid="total-achievements">
          <Target className="w-6 h-6 text-chart-2 mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{totalCount}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </Card>
      </div>

      {/* General Achievements */}
      {generalAchievements.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Trophy className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">General</h3>
              <p className="text-sm text-muted-foreground">
                {generalAchievements.filter(a => a.completed).length}/{generalAchievements.length} completed
              </p>
            </div>
          </div>
          
          <div className="space-y-3" data-testid="general-achievements">
            {generalAchievements.map(renderAchievement)}
          </div>
        </div>
      )}

      {/* Category Achievements */}
      {categoryAchievements.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Medal className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">By Category</h3>
              <p className="text-sm text-muted-foreground">
                Movement-specific achievements
              </p>
            </div>
          </div>
          
          <div className="space-y-8" data-testid="category-achievements">
            {Object.entries(achievementsByCategory).map(([category, achievements]) => 
              renderCategorySection(category as AchievementCategory, achievements)
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {achievements.length === 0 && (
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No Achievements Yet</h3>
          <p className="text-muted-foreground">
            Complete workouts and log PRs to unlock achievements!
          </p>
        </div>
      )}
    </>
  )
}
