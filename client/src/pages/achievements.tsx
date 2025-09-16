import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Trophy, Star, Target, Flame, Award, Calendar } from "lucide-react"

const achievements = [
  {
    id: '1',
    title: 'First Workout',
    description: 'Complete your first workout',
    icon: Star,
    completed: true,
    date: '2 weeks ago'
  },
  {
    id: '2',
    title: 'Streak Master',
    description: 'Maintain a 7-day workout streak',
    icon: Flame,
    completed: true,
    date: '1 week ago'
  },
  {
    id: '3',
    title: 'Century Club',
    description: 'Complete 100 total workouts',
    icon: Award,
    completed: false,
    progress: 45
  },
  {
    id: '4',
    title: 'PR Setter',
    description: 'Set 10 personal records',
    icon: Trophy,
    completed: false,
    progress: 2
  }
]

export default function Achievements() {
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
          const Icon = achievement.icon
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
                      <span className="text-xs text-muted-foreground">Completed {achievement.date}</span>
                    </div>
                  ) : achievement.progress !== undefined ? (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>{achievement.progress}/{achievement.id === '3' ? '100' : '10'}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${(achievement.progress / (achievement.id === '3' ? 100 : 10)) * 100}%` 
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
