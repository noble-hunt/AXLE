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
  Flame,
  Heart,
  Activity,
  Moon,
  Lightbulb
} from "lucide-react"

export default function Reports() {
  const { workouts, prs: personalRecords, streak, weeklyWorkouts, reports: healthReports, getRecentReports, getLatestReport } = useAppStore()

  // Debug readout
  console.log('Reports Page State:', { 
    totalWorkouts: workouts.length,
    totalPRs: personalRecords.length,
    streak,
    weeklyWorkouts,
    totalTime: workouts.reduce((sum, w) => sum + w.duration, 0),
    avgWorkoutTime: workouts.length > 0 ? Math.round(workouts.reduce((sum, w) => sum + w.duration, 0) / workouts.length) : 0,
    healthReports: healthReports.length
  })

  const totalTime = workouts.reduce((sum, w) => sum + w.duration, 0)
  const avgWorkoutTime = workouts.length > 0 ? Math.round(totalTime / workouts.length) : 0
  
  // Health data
  const recentReports = getRecentReports(7) // Last 7 days
  const latestReport = getLatestReport()
  const todaysReport = healthReports.find(r => {
    const today = new Date()
    const reportDate = new Date(r.date)
    return reportDate.toDateString() === today.toDateString()
  })
  
  // Simple health suggestions based on data
  const getHealthSuggestions = () => {
    const suggestions = []
    
    if (latestReport) {
      // Sleep suggestions
      if (latestReport.sleepScore < 70) {
        suggestions.push({
          type: 'sleep',
          icon: Moon,
          title: 'Improve Sleep Quality',
          message: `Your sleep score is ${latestReport.sleepScore}/100. Try going to bed 30min earlier.`,
          priority: 'high'
        })
      }
      
      // HRV suggestions  
      if (latestReport.hrv < 40) {
        suggestions.push({
          type: 'recovery',
          icon: Heart,
          title: 'Focus on Recovery',
          message: `Your HRV is ${latestReport.hrv}ms. Consider lighter workouts today.`,
          priority: 'medium'
        })
      }
      
      // Activity suggestions
      if (weeklyWorkouts < 3) {
        suggestions.push({
          type: 'activity',
          icon: Activity,
          title: 'Increase Activity',
          message: `Only ${weeklyWorkouts} workouts this week. Try to get 3-4 sessions per week.`,
          priority: 'medium'
        })
      }
    }
    
    return suggestions.slice(0, 3) // Show max 3 suggestions
  }
  
  const healthSuggestions = getHealthSuggestions()

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

      {/* Health Metrics */}
      {latestReport && (
        <Card className="p-4 card-shadow border border-border">
          <SectionTitle title={todaysReport ? "Today's Health Metrics" : "Latest Health Metrics"} className="mb-4" />
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center" data-testid="resting-hr-metric">
              <Heart className="w-6 h-6 text-chart-1 mx-auto mb-2" />
              <p className="text-lg font-bold text-foreground">{latestReport.restingHeartRate}</p>
              <p className="text-xs text-muted-foreground">Resting HR</p>
            </div>
            
            <div className="text-center" data-testid="hrv-metric">
              <Activity className="w-6 h-6 text-chart-2 mx-auto mb-2" />
              <p className="text-lg font-bold text-foreground">{latestReport.hrv}</p>
              <p className="text-xs text-muted-foreground">HRV (ms)</p>
            </div>
            
            <div className="text-center" data-testid="sleep-score-metric">
              <Moon className="w-6 h-6 text-chart-3 mx-auto mb-2" />
              <p className="text-lg font-bold text-foreground">{latestReport.sleepScore}</p>
              <p className="text-xs text-muted-foreground">Sleep Score</p>
            </div>
          </div>
          
          {(todaysReport || latestReport) && (
            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(todaysReport?.createdAt || latestReport.createdAt || new Date()).toLocaleTimeString()}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Health Suggestions */}
      {healthSuggestions.length > 0 && (
        <Card className="p-4 card-shadow border border-border">
          <div className="flex items-center gap-3 mb-4">
            <Lightbulb className="w-5 h-5 text-chart-2" />
            <SectionTitle title="Health Insights" />
          </div>
          
          <div className="space-y-3">
            {healthSuggestions.map((suggestion, index) => {
              const IconComponent = suggestion.icon
              return (
                <div 
                  key={`${suggestion.type}-${index}`}
                  className="flex items-start gap-3 p-3 rounded-xl bg-muted/50" 
                  data-testid={`suggestion-${suggestion.type}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    suggestion.priority === 'high' ? 'bg-destructive/10' :
                    suggestion.priority === 'medium' ? 'bg-chart-2/10' : 'bg-muted'
                  }`}>
                    <IconComponent className={`w-4 h-4 ${
                      suggestion.priority === 'high' ? 'text-destructive' :
                      suggestion.priority === 'medium' ? 'text-chart-2' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-foreground">{suggestion.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{suggestion.message}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

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
