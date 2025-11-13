import { Card } from "@/components/swift/card"
import { BarChart, Bar, LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import type { Report } from "@shared/schema"
import { TrendingUp, TrendingDown, BarChart3, LineChart as LineChartIcon, Calendar, Activity, Flame, Target } from "lucide-react"
import { ErrorBoundary } from "./ErrorBoundary"
import { format } from "date-fns"
import { useMemo } from "react"

interface ReportChartsProps {
  report: Report
}

export function ReportCharts({ report }: ReportChartsProps) {
  const visualizations = report.metrics?.visualizations

  if (!visualizations) {
    return null
  }

  return (
    <div className="space-y-6" data-testid="report-charts">
      <ErrorBoundary>
        {visualizations.workoutVolume && <WorkoutVolumeChart data={visualizations.workoutVolume} frequency={report.frequency} />}
      </ErrorBoundary>
      <ErrorBoundary>
        {visualizations.prTimeline && <PRProgressionChart data={visualizations.prTimeline} />}
      </ErrorBoundary>
      <ErrorBoundary>
        {visualizations.consistencyHeatmap && <ConsistencyHeatmap data={visualizations.consistencyHeatmap} />}
      </ErrorBoundary>
    </div>
  )
}

interface WorkoutVolumeChartProps {
  data: Array<{ date: string; totalMinutes: number; totalWorkouts: number; label: string }>
  frequency: 'weekly' | 'monthly'
}

function WorkoutVolumeChart({ data, frequency }: WorkoutVolumeChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="p-4" data-testid="chart-workout-volume-empty">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="text-subheading font-semibold text-foreground">Workout Volume</h3>
        </div>
        <div className="h-48 flex items-center justify-center">
          <p className="text-body text-muted-foreground">No workout data available</p>
        </div>
      </Card>
    )
  }

  // Prepare chart data
  const chartData = data.map(item => ({
    name: item.label,
    minutes: item.totalMinutes,
    workouts: item.totalWorkouts
  }))

  // Calculate totals for summary
  const totalMinutes = data.reduce((sum, d) => sum + d.totalMinutes, 0)
  const totalWorkouts = data.reduce((sum, d) => sum + d.totalWorkouts, 0)

  return (
    <Card className="p-4" data-testid="chart-workout-volume">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-5 h-5 text-primary" />
        <h3 className="text-subheading font-semibold text-foreground">Workout Volume</h3>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="name"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                padding: '8px 12px'
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null
                const data = payload[0].payload
                return (
                  <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                    <p className="text-body font-semibold text-foreground mb-2">{data.name}</p>
                    <p className="text-body text-foreground">{data.minutes} minutes</p>
                    <p className="text-caption text-muted-foreground">{data.workouts} workout{data.workouts !== 1 ? 's' : ''}</p>
                  </div>
                )
              }}
            />
            <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-caption text-muted-foreground text-center mt-2">
        {frequency === 'weekly' ? 'Daily volume' : 'Weekly volume'} • {totalWorkouts} workout{totalWorkouts !== 1 ? 's' : ''} • {totalMinutes} total minutes
      </p>
    </Card>
  )
}

interface PRProgressionChartProps {
  data: Array<{ date: string; movement: string; value: number; unit: string; delta: number | null }>
}

function PRProgressionChart({ data }: PRProgressionChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="p-4" data-testid="chart-pr-progression-empty">
        <div className="flex items-center gap-2 mb-3">
          <LineChartIcon className="w-5 h-5 text-accent" />
          <h3 className="text-subheading font-semibold text-foreground">PR Progression</h3>
        </div>
        <div className="h-48 flex items-center justify-center">
          <p className="text-body text-muted-foreground">No PR data available</p>
        </div>
      </Card>
    )
  }

  // Format dates for x-axis display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  // Prepare chart data with actual dates on x-axis
  const chartData = data.map((pr) => ({
    dateLabel: formatDate(pr.date),
    dateValue: new Date(pr.date).getTime(), // For proper chronological sorting
    movement: pr.movement,
    value: pr.value,
    unit: pr.unit,
    delta: pr.delta,
    date: pr.date
  }))

  // Determine Y-axis label based on unit type
  const getAxisLabel = () => {
    const firstUnit = data[0]?.unit?.toLowerCase() || ''
    if (firstUnit.includes('kg') || firstUnit.includes('lb')) return 'Weight'
    if (firstUnit.includes('m') || firstUnit.includes('km')) return 'Distance'
    if (firstUnit.includes('sec') || firstUnit.includes('min')) return 'Time'
    return 'Value'
  }

  return (
    <Card className="p-4" data-testid="chart-pr-progression">
      <div className="flex items-center gap-2 mb-3">
        <LineChartIcon className="w-5 h-5 text-accent" />
        <h3 className="text-subheading font-semibold text-foreground">PR Progression</h3>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              label={{ value: getAxisLabel(), angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                padding: '8px 12px'
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null
                const data = payload[0].payload
                return (
                  <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                    <p className="text-caption text-muted-foreground mb-1">{data.date}</p>
                    <p className="text-body font-semibold text-foreground mb-1">{data.movement}</p>
                    <p className="text-body text-foreground">{data.value} {data.unit}</p>
                    {data.delta !== null && (
                      <p className={`text-caption flex items-center gap-1 mt-1 ${data.delta >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {data.delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {data.delta >= 0 ? '+' : ''}{data.delta} {data.unit}
                      </p>
                    )}
                  </div>
                )
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--accent))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--accent))', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-caption text-muted-foreground text-center mt-2">
        {data.length} PR{data.length !== 1 ? 's' : ''} recorded • Chronological timeline
      </p>
    </Card>
  )
}

interface ConsistencyHeatmapProps {
  data: Array<{ date: string; value: number; workoutCount: number }>
}

function ConsistencyHeatmap({ data }: ConsistencyHeatmapProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="p-4" data-testid="chart-consistency-heatmap-empty">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="text-subheading font-semibold text-foreground">Consistency Heatmap</h3>
        </div>
        <div className="h-48 flex items-center justify-center">
          <p className="text-body text-muted-foreground">No consistency data available</p>
        </div>
      </Card>
    )
  }

  // Calculate intensity colors (0 = none, 1 = max)
  const getIntensityColor = (value: number) => {
    if (value === 0) return 'bg-muted/30'
    if (value < 0.25) return 'bg-primary/20'
    if (value < 0.5) return 'bg-primary/40'
    if (value < 0.75) return 'bg-primary/60'
    return 'bg-primary/80'
  }

  // Group data by weeks (7 days per row)
  const weeks: Array<Array<{ date: string; value: number; workoutCount: number }>> = []
  let currentWeek: Array<{ date: string; value: number; workoutCount: number }> = []

  data.forEach((day, index) => {
    currentWeek.push(day)
    if (currentWeek.length === 7 || index === data.length - 1) {
      weeks.push([...currentWeek])
      currentWeek = []
    }
  })

  // Calculate stats
  const totalDays = data.length
  const activeDays = data.filter(d => d.value > 0).length
  const consistencyPercent = totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0

  return (
    <Card className="p-4" data-testid="chart-consistency-heatmap">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-5 h-5 text-primary" />
        <h3 className="text-subheading font-semibold text-foreground">Consistency Heatmap</h3>
      </div>

      {/* Heatmap Grid */}
      <div className="space-y-1 mb-4">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex gap-1" data-testid={`heatmap-week-${weekIndex}`}>
            {week.map((day, dayIndex) => (
              <div
                key={`${weekIndex}-${dayIndex}`}
                className={`flex-1 h-8 rounded ${getIntensityColor(day.value)} border border-border/50 hover:border-primary transition-colors cursor-pointer relative group`}
                data-testid={`heatmap-day-${day.date}`}
                title={`${day.date}: ${day.workoutCount} workout${day.workoutCount !== 1 ? 's' : ''}`}
              >
                {/* Tooltip on hover */}
                <div className="absolute hidden group-hover:block bg-popover text-popover-foreground border border-border rounded-lg p-2 shadow-lg z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-1 whitespace-nowrap text-caption">
                  <p className="font-semibold">{day.date}</p>
                  <p>{day.workoutCount} workout{day.workoutCount !== 1 ? 's' : ''}</p>
                  <p className="text-muted-foreground">{Math.round(day.value * 100)}% intensity</p>
                </div>
              </div>
            ))}
            {/* Fill remaining slots if last week is incomplete */}
            {week.length < 7 && Array.from({ length: 7 - week.length }).map((_, i) => (
              <div key={`empty-${i}`} className="flex-1 h-8" />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-caption text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded bg-muted/30 border border-border/50" />
            <div className="w-4 h-4 rounded bg-primary/20 border border-border/50" />
            <div className="w-4 h-4 rounded bg-primary/40 border border-border/50" />
            <div className="w-4 h-4 rounded bg-primary/60 border border-border/50" />
            <div className="w-4 h-4 rounded bg-primary/80 border border-border/50" />
          </div>
          <span>More</span>
        </div>
        <span>{activeDays} of {totalDays} days active ({consistencyPercent}%)</span>
      </div>
    </Card>
  )
}

// ============================================================================
// ADVANCED CHARTS - Gated behind "See More" section for performance
// ============================================================================

interface ReportAdvancedChartsProps {
  report: Report
}

export function ReportAdvancedCharts({ report }: ReportAdvancedChartsProps) {
  const visualizations = report.metrics?.visualizations

  if (!visualizations) {
    return null
  }

  return (
    <div className="space-y-4" data-testid="report-advanced-charts">
      <ErrorBoundary>
        {visualizations.trainingLoad && <TrainingLoadChart data={visualizations.trainingLoad} />}
      </ErrorBoundary>
      <ErrorBoundary>
        {visualizations.consistencyHeatmap && visualizations.streakData && (
          <EnhancedConsistencyCard 
            data={visualizations.consistencyHeatmap} 
            streakData={visualizations.streakData}
          />
        )}
      </ErrorBoundary>
      <ErrorBoundary>
        {visualizations.prSparklines && <PRSparklinesGrid data={visualizations.prSparklines} />}
      </ErrorBoundary>
      <ErrorBoundary>
        {visualizations.recoveryCorrelation && <RecoveryCorrelationChart data={visualizations.recoveryCorrelation} />}
      </ErrorBoundary>
    </div>
  )
}

// Color palette for workout categories (consistent across app)
const CATEGORY_COLORS: Record<string, string> = {
  'CrossFit': 'hsl(var(--chart-1))',
  'Strength': 'hsl(var(--chart-2))',
  'Olympic Weightlifting': 'hsl(var(--chart-3))',
  'Powerlifting': 'hsl(var(--chart-4))',
  'Conditioning': 'hsl(var(--chart-5))',
  'Bodybuilding': 'hsl(var(--accent))',
  'Gymnastics': 'hsl(var(--chart-1))',
  'Endurance': 'hsl(var(--chart-2))',
  'Mobility': 'hsl(var(--chart-3))'
}

// Deterministic fallback color generator for unknown categories
function getCategoryColor(category: string): string {
  if (CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category]
  }
  // Hash the category name to pick a consistent color
  const hash = category.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const colors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))']
  return colors[hash % colors.length]
}

// 1. Training Load Timeline - Stacked bar with intensity overlay
interface TrainingLoadChartProps {
  data: Array<{
    date: string
    categories: Record<string, number>
    totalMinutes: number
    avgIntensity: number | null
  }>
}

function TrainingLoadChart({ data }: TrainingLoadChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="p-4" data-testid="chart-training-load-empty">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-subheading font-semibold text-foreground">Training Load Timeline</h3>
        </div>
        <div className="h-48 flex items-center justify-center">
          <p className="text-body text-muted-foreground">No training load data available</p>
        </div>
      </Card>
    )
  }

  // Transform data for stacked bar chart
  const chartData = data.map(day => ({
    date: format(new Date(day.date), 'M/d'),
    avgIntensity: day.avgIntensity,
    ...day.categories
  }))

  // Get all unique categories
  const allCategories = Array.from(
    new Set(data.flatMap(d => Object.keys(d.categories)))
  )

  // Calculate total volume for summary
  const totalVolume = data.reduce((sum, d) => sum + d.totalMinutes, 0)

  return (
    <Card className="p-4" data-testid="chart-training-load">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-5 h-5 text-primary" />
        <h3 className="text-subheading font-semibold text-foreground">Training Load Timeline</h3>
      </div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 15, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="date" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis 
              yAxisId="left"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              domain={[0, 10]}
              label={{ value: 'Intensity', angle: 90, position: 'insideRight', style: { fill: 'hsl(var(--muted-foreground))' } }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: 11
              }}
              formatter={(value: any) => typeof value === 'number' ? Math.round(value) : value}
            />
            <Legend 
              wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
              iconSize={10}
            />
            
            {/* Stacked bars for each category */}
            {allCategories.map((category) => (
              <Bar
                key={category}
                dataKey={category}
                stackId="a"
                fill={getCategoryColor(category)}
                yAxisId="left"
                radius={[2, 2, 0, 0]}
              />
            ))}
            
            {/* Intensity line overlay */}
            {data.some(d => d.avgIntensity !== null) && (
              <Line
                type="monotone"
                dataKey="avgIntensity"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                dot={{ r: 3, fill: 'hsl(var(--accent))' }}
                yAxisId="right"
                name="Avg Intensity"
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-caption text-muted-foreground text-center mt-2">
        Daily volume by category • {totalVolume} total minutes • {allCategories.length} categories
      </p>
    </Card>
  )
}

// 2. Enhanced Consistency Card with Streak Stats
interface EnhancedConsistencyCardProps {
  data: Array<{ date: string; value: number; workoutCount: number }>
  streakData: {
    currentStreak: number
    longestStreak: number
    totalActiveDays: number
    totalRestDays: number
  }
}

function EnhancedConsistencyCard({ data, streakData }: EnhancedConsistencyCardProps) {
  if (!data || data.length === 0) {
    return null
  }

  // Properly structure weeks (7 days each, pad leading/trailing gaps)
  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  
  // Build a full week structure
  const weeks: Array<Array<{ date: string; value: number; workoutCount: number } | null>> = []
  let currentWeek: Array<{ date: string; value: number; workoutCount: number } | null> = []
  
  // Pad leading days of first week if it doesn't start on Sunday
  const firstDayOfWeek = new Date(sortedData[0].date).getDay()
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push(null)
  }
  
  // Group data into weeks
  sortedData.forEach((day) => {
    currentWeek.push(day)
    if (currentWeek.length === 7) {
      weeks.push([...currentWeek])
      currentWeek = []
    }
  })
  
  // Pad trailing days of last week if incomplete
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null)
    }
    weeks.push([...currentWeek])
  }

  const recentWeeks = weeks.slice(-5)

  const getIntensityColor = (value: number) => {
    if (value === 0) return 'bg-muted/30'
    if (value < 0.3) return 'bg-primary/20'
    if (value < 0.6) return 'bg-primary/40'
    if (value < 0.9) return 'bg-primary/60'
    return 'bg-primary/80'
  }

  return (
    <Card className="p-4" data-testid="card-enhanced-consistency">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          <h3 className="text-subheading font-semibold text-foreground">Consistency & Streaks</h3>
        </div>
        {streakData.currentStreak > 0 && (
          <div className="text-right" data-testid="badge-current-streak">
            <div className="text-xl font-bold text-orange-500">{streakData.currentStreak}</div>
            <div className="text-xs text-muted-foreground">day streak 🔥</div>
          </div>
        )}
      </div>

      {/* Mini heatmap - last 5 weeks */}
      <div className="space-y-1 mb-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
            <div key={idx} className="text-xs text-center text-muted-foreground font-medium">
              {day}
            </div>
          ))}
        </div>
        {recentWeeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 gap-1">
            {week.map((day, dayIdx) => {
              if (!day) {
                return <div key={`empty-${dayIdx}`} className="aspect-square" />
              }
              return (
                <div
                  key={dayIdx}
                  className={`aspect-square rounded ${getIntensityColor(day.value)} border border-border/50 transition-colors`}
                  title={`${format(new Date(day.date), 'MMM d')}: ${day.workoutCount} workout${day.workoutCount !== 1 ? 's' : ''}`}
                  data-testid={`enhanced-heatmap-day-${day.date}`}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Streak stats grid */}
      <div className="grid grid-cols-4 gap-2 pt-3 border-t">
        <div className="text-center">
          <div className="text-lg font-bold text-orange-500" data-testid="text-current-streak-stat">{streakData.currentStreak}</div>
          <div className="text-xs text-muted-foreground">Current</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold" data-testid="text-longest-streak-stat">{streakData.longestStreak}</div>
          <div className="text-xs text-muted-foreground">Longest</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-success" data-testid="text-active-days-stat">{streakData.totalActiveDays}</div>
          <div className="text-xs text-muted-foreground">Active</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-muted-foreground" data-testid="text-rest-days-stat">{streakData.totalRestDays}</div>
          <div className="text-xs text-muted-foreground">Rest</div>
        </div>
      </div>
    </Card>
  )
}

// 3. PR Sparklines Grid - Mini line charts for top movements
interface PRSparklinesGridProps {
  data: Array<{
    movement: string
    category: string
    timeline: Array<{ date: string; value: number; unit: string }>
    latestValue: number
    improvement: string
    improvementDelta: number
    improvementPercent: number
  }>
}

function PRSparklinesGrid({ data }: PRSparklinesGridProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="p-4" data-testid="card-pr-sparklines-empty">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-5 h-5 text-accent" />
          <h3 className="text-subheading font-semibold text-foreground">PR Progress</h3>
        </div>
        <div className="h-48 flex items-center justify-center">
          <p className="text-body text-muted-foreground">No PR progression data available</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4" data-testid="card-pr-sparklines">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-5 h-5 text-accent" />
        <h3 className="text-subheading font-semibold text-foreground">PR Progress Sparklines</h3>
      </div>
      
      <div className="space-y-3">
        {data.map((movement, idx) => (
          <div key={idx} className="space-y-1" data-testid={`sparkline-${idx}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate" data-testid={`text-movement-name-${idx}`}>
                  {movement.movement}
                </div>
                <div className="text-xs text-muted-foreground">{movement.category}</div>
              </div>
              <div className="text-right ml-2">
                <div className="font-semibold text-sm" data-testid={`text-latest-value-${idx}`}>
                  {movement.latestValue} {movement.timeline[0]?.unit}
                </div>
                <div 
                  className={`text-xs flex items-center gap-1 justify-end ${movement.improvementDelta >= 0 ? 'text-success' : 'text-destructive'}`} 
                  data-testid={`text-improvement-${idx}`}
                >
                  {movement.improvementDelta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {movement.improvement} ({movement.improvementPercent >= 0 ? '+' : ''}{movement.improvementPercent}%)
                </div>
              </div>
            </div>
            
            <div className="h-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={movement.timeline} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="hsl(var(--accent))" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: 10
                    }}
                    labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
                    formatter={(value: any) => [`${value} ${movement.timeline[0]?.unit}`, 'Value']}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// 4. Recovery Correlation - Scatter plot of sleep/HRV vs performance
interface RecoveryCorrelationChartProps {
  data: Array<{
    date: string
    sleepScore: number | null
    hrvScore: number | null
    workoutIntensity: number | null
    workoutCompletion: boolean
    workoutDuration: number | null
    restingHR: number | null
  }>
}

function RecoveryCorrelationChart({ data }: RecoveryCorrelationChartProps) {
  // Memoize filtered and throttled data to prevent re-allocations
  const scatterData = useMemo(() => {
    if (!data || data.length === 0) return []
    
    // Filter valid data points
    const validPoints = data
      .filter(d => d.sleepScore !== null && d.workoutIntensity !== null)
      .map(d => ({
        sleepScore: d.sleepScore!,
        intensity: d.workoutIntensity!,
        date: format(new Date(d.date), 'M/d'),
      }))
    
    // Throttle points for performance (max 50 points to prevent paint stutter)
    if (validPoints.length <= 50) {
      return validPoints
    }
    
    const step = Math.ceil(validPoints.length / 50)
    return validPoints.filter((_, idx) => idx % step === 0)
  }, [data])

  if (!data || data.length === 0) {
    return (
      <Card className="p-4" data-testid="card-recovery-correlation-empty">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-subheading font-semibold text-foreground">Recovery vs Performance</h3>
        </div>
        <div className="h-48 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-body text-muted-foreground">Recovery data not available</p>
            <p className="text-caption text-muted-foreground">
              Connect a wearable (Oura, Fitbit, Garmin, Whoop) to see correlations
            </p>
          </div>
        </div>
      </Card>
    )
  }

  if (scatterData.length === 0) {
    return (
      <Card className="p-4" data-testid="card-recovery-correlation-insufficient">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-subheading font-semibold text-foreground">Recovery vs Performance</h3>
        </div>
        <div className="h-48 flex items-center justify-center">
          <p className="text-body text-muted-foreground">Insufficient data for correlation analysis</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4" data-testid="card-recovery-correlation">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-5 h-5 text-primary" />
        <h3 className="text-subheading font-semibold text-foreground">Recovery vs Performance</h3>
      </div>
      
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 5, right: 15, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              type="number"
              dataKey="sleepScore" 
              name="Sleep Score"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              domain={[0, 100]}
              label={{ value: 'Sleep Score', position: 'insideBottom', offset: -5, fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              type="number"
              dataKey="intensity" 
              name="Intensity"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              domain={[0, 10]}
              label={{ value: 'Workout Intensity', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: 11
              }}
              formatter={(value: any, name: string) => [
                typeof value === 'number' ? value.toFixed(1) : value,
                name === 'sleepScore' ? 'Sleep' : 'Intensity'
              ]}
            />
            <Scatter 
              name="Workouts" 
              data={scatterData} 
              fill="hsl(var(--primary))"
              fillOpacity={scatterData.length > 20 ? 0.4 : 0.6}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <p className="text-caption text-muted-foreground text-center mt-2 pt-2 border-t">
        💡 Higher sleep scores often correlate with better workout intensity
      </p>
    </Card>
  )
}
