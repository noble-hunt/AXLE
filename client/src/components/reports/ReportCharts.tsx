import { Card } from "@/components/swift/card"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import type { Report } from "@shared/schema"
import { TrendingUp, TrendingDown, BarChart3, LineChart as LineChartIcon, Calendar } from "lucide-react"
import { ErrorBoundary } from "./ErrorBoundary"

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
