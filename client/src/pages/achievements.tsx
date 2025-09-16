import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Trophy, Star, Target, Flame, Award, Calendar } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"

export default function Achievements() {
  const { achievements } = useAppStore()
  
  // Debug readout
  console.log('Achievements Page State:', { 
    totalAchievements: achievements.length,
    completedAchievements: achievements.filter(a => a.completed).length,
    inProgressAchievements: achievements.filter(a => !a.completed && a.progress > 0).length,
    recentAchievements: achievements.slice(0, 3).map(a => ({ title: a.title, completed: a.completed, progress: a.progress }))
  })
  
  const completedCount = achievements.filter(a => a.completed).length
  const totalCount = achievements.length

  return (
    <>
      <SectionTitle title="Achievements" />

      {/* Achievement Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 card-shadow border border-border text-center" data-testid="completed-achievements">
          <Trophy className="w-6 h-6 text-destructive mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{completedCount}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </Card>
        
        <Card className="p-4 card-shadow border border-border text-center" data-testid="total-achievements">
          <Target className="w-6 h-6 text-chart-2 mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{totalCount}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </Card>
      </div>

      {/* Achievement List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">All Achievements</h3>
        
        {achievements.map((achievement) => {
          // Map string icon to React component
          const getIcon = (icon: string) => {
            switch (icon) {
              case '🏆': return Trophy
              case '💪': return Award  
              case '🏋️': return Target
              case '🥷': return Star
              case '🫁': return Flame
              case '🔥': return Award
              default: return Trophy
            }
          }
          const Icon = getIcon(achievement.icon)
          return (
            <Card 
              key={achievement.id} 
              className={`p-4 card-shadow border border-border ${
                achievement.completed ? 'bg-accent/30' : ''
              }`}
              data-testid={`achievement-${achievement.id}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  achievement.completed 
                    ? 'bg-destructive text-destructive-foreground' 
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
                        Completed {achievement.unlockedAt?.toLocaleDateString() || 'Recently'}
                      </span>
                    </div>
                  ) : achievement.progress !== undefined ? (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>{achievement.progress}/{achievement.target}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${Math.min((achievement.progress / achievement.target) * 100, 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </>
  )
}
