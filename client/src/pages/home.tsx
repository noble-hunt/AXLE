import { Card } from "@/components/ui/card"
import { SectionTitle } from "@/components/ui/section-title"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useAppStore } from "@/store/useAppStore"
import { Flame, Target, Play, ChevronRight, BarChart3 } from "lucide-react"
import { Link } from "wouter"

export default function Home() {
  const { streak = 13, weeklyWorkouts = 4, workouts, prs: personalRecords } = useAppStore()

  // Debug readout
  console.log('Home Page State:', { 
    workouts: workouts.length, 
    personalRecords: personalRecords.length, 
    streak, 
    weeklyWorkouts 
  })

  return (
    <>
      <SectionTitle 
        title="Dashboard" 
        subtitle="Today"
      />

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 card-shadow border border-border" data-testid="streak-card">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-destructive" />
            <span className="text-sm font-medium text-muted-foreground">Streak</span>
          </div>
          <p className="text-2xl font-bold text-foreground" data-testid="streak-days">{streak}</p>
          <p className="text-xs text-muted-foreground">days active</p>
        </Card>

        <Card className="p-4 card-shadow border border-border" data-testid="weekly-workouts-card">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-chart-2" />
            <span className="text-sm font-medium text-muted-foreground">This Week</span>
          </div>
          <p className="text-2xl font-bold text-foreground" data-testid="weekly-count">{weeklyWorkouts}</p>
          <p className="text-xs text-muted-foreground">workouts</p>
        </Card>
      </div>

      {/* Start Workout Button */}
      <Link href="/workout">
        <PrimaryButton icon={<Play className="w-5 h-5" />}>
          Start Workout
        </PrimaryButton>
      </Link>

      {/* Recent Workouts Section */}
      <div className="space-y-4">
        <SectionTitle 
          title="Recent Workouts" 
          action={
            <Link href="/history">
              <button className="text-sm text-primary font-medium" data-testid="view-all-workouts">
                View All
              </button>
            </Link>
          }
        />

        <div className="space-y-3">
          {workouts.slice(0, 2).map((workout) => (
            <Link key={workout.id} href={`/workout/${workout.id}`}>
              <Card className="p-4 card-shadow border border-border hover:bg-accent/50 transition-colors cursor-pointer" data-testid={`workout-card-${workout.id}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">{workout.name}</h4>
                    <p className="text-sm text-muted-foreground">{workout.date.toLocaleDateString()}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-muted-foreground">
                        {workout.sets.length} exercises
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {workout.sets.length} sets
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Weekly Progress Chart */}
      <Card className="p-4 card-shadow border border-border">
        <SectionTitle title="Weekly Progress" className="mb-4" />
        
        <div className="chart-container h-48 flex items-center justify-center">
          <div className="text-center space-y-2">
            <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Weekly progress chart</p>
            <p className="text-xs text-muted-foreground">Recharts integration needed</p>
          </div>
        </div>
      </Card>

      {/* Personal Records Preview */}
      <Card className="p-4 card-shadow border border-border">
        <SectionTitle 
          title="Recent PRs" 
          action={
            <Link href="/prs">
              <button className="text-sm text-primary font-medium" data-testid="view-all-prs">
                View All
              </button>
            </Link>
          }
          className="mb-4"
        />

        <div className="space-y-3">
          {personalRecords.slice(0, 2).map((pr, index) => (
            <div key={pr.id} className="flex items-center justify-between py-2" data-testid={`pr-${pr.id}`}>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-chart-1' : 'bg-chart-2'}`} />
                <div>
                  <p className="font-medium text-foreground">{pr.exercise}</p>
                  <p className="text-xs text-muted-foreground">{pr.date.toLocaleDateString()}</p>
                </div>
              </div>
              <span className="font-semibold text-foreground">{pr.weight} lbs</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
