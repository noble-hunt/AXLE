import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/store/useAppStore"
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  Download, 
  Share, 
  Filter,
  Clock,
  Target,
  Flame
} from "lucide-react"

export default function Reports() {
  const { workouts, prs: personalRecords, streak, weeklyWorkouts } = useAppStore()

  // Debug readout
  console.log('Reports Page State:', { 
    totalWorkouts: workouts.length,
    totalPRs: personalRecords.length,
    streak,
    weeklyWorkouts,
    totalTime: workouts.reduce((sum, w) => sum + w.duration, 0),
    avgWorkoutTime: workouts.length > 0 ? Math.round(workouts.reduce((sum, w) => sum + w.duration, 0) / workouts.length) : 0
  })

  const totalTime = workouts.reduce((sum, w) => sum + w.duration, 0)
  const avgWorkoutTime = workouts.length > 0 ? Math.round(totalTime / workouts.length) : 0

  return (
    <>
      <SectionTitle 
        title="Reports & Analytics" 
        action={
          <Button variant="outline" size="sm" className="rounded-xl" data-testid="filter-reports">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        }
      />

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 card-shadow border border-border text-center" data-testid="total-workouts-metric">
          <Calendar className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{workouts.length}</p>
          <p className="text-xs text-muted-foreground">Total Workouts</p>
        </Card>
        
        <Card className="p-4 card-shadow border border-border text-center" data-testid="current-streak-metric">
          <Flame className="w-6 h-6 text-destructive mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{streak}</p>
          <p className="text-xs text-muted-foreground">Day Streak</p>
        </Card>
        
        <Card className="p-4 card-shadow border border-border text-center" data-testid="total-time-metric">
          <Clock className="w-6 h-6 text-chart-2 mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{totalTime}</p>
          <p className="text-xs text-muted-foreground">Total Minutes</p>
        </Card>
        
        <Card className="p-4 card-shadow border border-border text-center" data-testid="avg-time-metric">
          <Target className="w-6 h-6 text-chart-3 mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{avgWorkoutTime}</p>
          <p className="text-xs text-muted-foreground">Avg Minutes</p>
        </Card>
      </div>

      {/* Weekly Progress Chart */}
      <Card className="p-4 card-shadow border border-border">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle title="Weekly Progress" />
          <TrendingUp className="w-5 h-5 text-chart-2" />
        </div>
        
        <div className="chart-container h-48 flex items-center justify-center">
          <div className="text-center space-y-2">
            <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Weekly progress chart</p>
            <p className="text-xs text-muted-foreground">Recharts integration needed</p>
          </div>
        </div>
      </Card>

      {/* Workout Frequency */}
      <Card className="p-4 card-shadow border border-border">
        <SectionTitle title="Workout Frequency" className="mb-4" />
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">This Week</span>
            <span className="font-semibold text-foreground">{weeklyWorkouts} workouts</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Last Week</span>
            <span className="font-semibold text-foreground">3 workouts</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Monthly Average</span>
            <span className="font-semibold text-foreground">3.5 workouts</span>
          </div>
        </div>
      </Card>

      {/* Personal Records Trend */}
      <Card className="p-4 card-shadow border border-border">
        <SectionTitle title="Personal Records" className="mb-4" />
        
        <div className="space-y-3">
          {personalRecords.slice(0, 3).map((pr, index) => (
            <div key={pr.id} className="flex items-center justify-between" data-testid={`pr-trend-${pr.id}`}>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  index === 0 ? 'bg-chart-1' : 
                  index === 1 ? 'bg-chart-2' : 'bg-chart-3'
                }`} />
                <span className="text-sm text-muted-foreground">{pr.exercise}</span>
              </div>
              <span className="font-semibold text-foreground">{pr.weight} lbs</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Export Options */}
      <Card className="p-4 card-shadow border border-border">
        <SectionTitle title="Export Data" className="mb-4" />
        
        <div className="space-y-3">
          <Button variant="outline" className="w-full rounded-2xl justify-start" data-testid="export-pdf">
            <Download className="w-4 h-4 mr-2" />
            Export as PDF
          </Button>
          
          <Button variant="outline" className="w-full rounded-2xl justify-start" data-testid="export-csv">
            <Download className="w-4 h-4 mr-2" />
            Export as CSV
          </Button>
          
          <Button variant="outline" className="w-full rounded-2xl justify-start" data-testid="share-report">
            <Share className="w-4 h-4 mr-2" />
            Share Report
          </Button>
        </div>
      </Card>
    </>
  )
}
