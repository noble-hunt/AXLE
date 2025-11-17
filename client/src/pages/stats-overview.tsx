import { useState } from "react"
import { useAppStore } from "@/store/useAppStore"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { StatBadge } from "@/components/swift/stat-badge"
import { fadeIn } from "@/lib/motion-variants"
import { motion } from "framer-motion"
import {
  Calendar,
  Clock,
  Dumbbell,
  TrendingUp,
  TrendingDown,
  Activity,
  Award,
  Target,
  Zap,
  Heart,
  Flame,
  BarChart3,
  LineChart,
  PieChart,
  ArrowLeft,
  CheckCircle,
  Timer,
  Trophy,
  Star,
  Sparkles,
  Info
} from "lucide-react"
import { Category, type Workout, type PR } from "../types"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays, subDays, eachDayOfInterval, subWeeks, subMonths } from "date-fns"
import { Link } from "wouter"
import { 
  BarChart, 
  Bar, 
  LineChart as RechartsLineChart, 
  Line, 
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart
} from 'recharts'

const COLORS = {
  primary: 'hsl(var(--primary))',
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  destructive: 'hsl(var(--destructive))',
  accent: 'hsl(var(--accent))',
  muted: 'hsl(var(--muted-foreground))',
}

const CATEGORY_COLORS = {
  [Category.CROSSFIT]: '#ef4444',
  [Category.HIIT]: '#f97316',
  [Category.POWERLIFTING]: '#8b5cf6',
  [Category.OLYMPIC_LIFTING]: '#ec4899',
  [Category.GYMNASTICS]: '#06b6d4',
  [Category.CARDIO]: '#10b981',
  [Category.STRENGTH]: '#3b82f6',
  [Category.MOBILITY]: '#84cc16',
}

// Helper to safely parse dates
const parseSafeDate = (dateValue: any): Date | null => {
  if (!dateValue) return null
  const date = new Date(dateValue)
  return isNaN(date.getTime()) ? null : date
}

// Helper to safely get duration
const getSafeDuration = (workout: any): number => {
  // Try multiple possible field locations for duration
  const duration = workout.request?.availableMinutes || 
                   workout.request?.duration || 
                   workout.duration || 
                   0
  const parsed = Number(duration)
  return isNaN(parsed) ? 0 : parsed
}

export default function StatsOverview() {
  const { user } = useAppStore()
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year' | 'all'>('month')

  // Fetch workouts
  const { data: workouts = [], isLoading, error: workoutsError } = useQuery<Workout[]>({
    queryKey: ['/api/workouts'],
    enabled: !!user,
  })

  // Fetch PRs
  const { data: prs = [], error: prsError } = useQuery<PR[]>({
    queryKey: ['/api/prs'],
    enabled: !!user,
  })

  // Calculate date range
  const now = new Date()
  const rangeStart = timeRange === 'week' 
    ? subWeeks(now, 1)
    : timeRange === 'month'
    ? subMonths(now, 1)
    : timeRange === 'year'
    ? subMonths(now, 12)
    : null // 'all' time - no start date limit

  // Type guard to ensure we're working with actual workout objects (not placeholder strings)
  const isWorkoutObject = (w: any): w is Workout => {
    return typeof w === 'object' && w !== null && 'id' in w
  }

  // Filter workouts by time range - only include valid dates
  const filteredWorkouts = workouts.filter(w => {
    if (!isWorkoutObject(w)) return false
    const dateValue = (w as any).created_at || w.createdAt || w.date
    const workoutDate = parseSafeDate(dateValue)
    // For 'all' time, include all workouts with valid dates
    if (timeRange === 'all') {
      return workoutDate !== null
    }
    // For specific time ranges, filter by date range
    return workoutDate && rangeStart && workoutDate >= rangeStart && workoutDate <= now
  })

  // Calculate comprehensive stats with safe parsing
  const totalWorkouts = filteredWorkouts.length
  const completedWorkouts = filteredWorkouts.filter(w => w.completed).length
  const completionRate = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0
  
  const totalMinutes = filteredWorkouts.reduce((sum, w) => {
    return sum + getSafeDuration(w)
  }, 0)
  
  const avgDuration = totalWorkouts > 0 ? Math.round(totalMinutes / totalWorkouts) : 0
  
  // Calculate workout frequency - only count valid dates
  const workoutDates = filteredWorkouts
    .map(w => {
      const dateValue = (w as any).created_at || w.createdAt || w.date
      const date = parseSafeDate(dateValue)
      return date ? format(date, 'yyyy-MM-dd') : null
    })
    .filter((d): d is string => d !== null)
  const daysWithWorkouts = new Set(workoutDates).size
  
  // For 'all' time, calculate period from first workout to now
  const periodDays = rangeStart 
    ? differenceInDays(now, rangeStart)
    : filteredWorkouts.length > 0
      ? (() => {
          const dates = filteredWorkouts
            .map(w => parseSafeDate((w as any).created_at || w.createdAt || w.date))
            .filter((d): d is Date => d !== null)
          const earliestDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : now
          return differenceInDays(now, earliestDate)
        })()
      : 0
  const workoutFrequency = periodDays > 0 ? (daysWithWorkouts / periodDays * 100) : 0

  // Category breakdown
  const categoryBreakdown = filteredWorkouts.reduce((acc, w) => {
    const category = (w as any).request?.focus || 
                     (w as any).request?.category || 
                     w.category || 
                     'Unknown'
    acc[category] = (acc[category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const categoryData = Object.entries(categoryBreakdown).map(([name, value]) => ({
    name,
    value: value as number,
    percentage: Math.round(((value as number) / totalWorkouts) * 100)
  }))

  // Daily workout trend
  // For 'all' time, use earliest workout date as start
  const effectiveRangeStart = rangeStart || (() => {
    const dates = filteredWorkouts
      .map(w => parseSafeDate((w as any).created_at || w.createdAt || w.date))
      .filter((d): d is Date => d !== null)
    return dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : now
  })()
  
  const dailyData = eachDayOfInterval({ start: effectiveRangeStart, end: now }).map(date => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayWorkouts = filteredWorkouts.filter(w => {
      const workoutDateValue = (w as any).created_at || w.createdAt || w.date
      const workoutDate = parseSafeDate(workoutDateValue)
      return workoutDate && format(workoutDate, 'yyyy-MM-dd') === dateStr
    })
    return {
      date: format(date, 'MMM d'),
      workouts: dayWorkouts.length,
      minutes: dayWorkouts.reduce((sum, w) => sum + getSafeDuration(w), 0),
      completed: dayWorkouts.filter(w => w.completed).length
    }
  })

  // Weekly aggregation for better visualization in month/year/all view
  const weeklyData = []
  if (timeRange === 'month' || timeRange === 'year' || timeRange === 'all') {
    const weeks = Math.ceil(periodDays / 7)
    for (let i = 0; i < weeks; i++) {
      const weekStart = subWeeks(now, weeks - i - 1)
      const weekEnd = endOfWeek(weekStart)
      const weekWorkouts = filteredWorkouts.filter(w => {
        const dateValue = (w as any).created_at || w.createdAt || w.date
        const date = parseSafeDate(dateValue)
        return date && date >= weekStart && date <= weekEnd
      })
      weeklyData.push({
        week: `Week ${i + 1}`,
        workouts: weekWorkouts.length,
        minutes: weekWorkouts.reduce((sum, w) => sum + getSafeDuration(w), 0),
        completed: weekWorkouts.filter(w => w.completed).length
      })
    }
  }

  // Intensity distribution
  const intensityData = [
    { range: '1-3 (Low)', count: 0 },
    { range: '4-6 (Med)', count: 0 },
    { range: '7-8 (High)', count: 0 },
    { range: '9-10 (Max)', count: 0 },
  ]

  filteredWorkouts.forEach(w => {
    const intensity = (w as any).request?.intensity || w.intensity || 5
    if (intensity <= 3) intensityData[0].count++
    else if (intensity <= 6) intensityData[1].count++
    else if (intensity <= 8) intensityData[2].count++
    else intensityData[3].count++
  })

  // Recent PRs in time range - with safe date parsing
  const recentPRs = prs.filter(pr => {
    const dateValue = pr.date || (pr as any).created_at || pr.createdAt
    const prDate = parseSafeDate(dateValue)
    // For 'all' time, include all PRs with valid dates
    if (timeRange === 'all') {
      return prDate !== null
    }
    // For specific time ranges, filter by date range
    return prDate && rangeStart && prDate >= rangeStart && prDate <= now
  })

  // Best performing day - only from valid dates
  const dayOfWeekMap = filteredWorkouts.reduce((acc, w) => {
    const dateValue = (w as any).created_at || w.createdAt || w.date
    const date = parseSafeDate(dateValue)
    if (date) {
      const day = format(date, 'EEEE')
      acc[day] = (acc[day] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)
  
  const bestDay = Object.entries(dayOfWeekMap).sort((a, b) => (b[1] as number) - (a[1] as number))[0] as [string, number] | undefined
  
  // Longest streak calculation - only from valid dates
  const workoutDateStrings = filteredWorkouts
    .map(w => {
      const dateValue = (w as any).created_at || w.createdAt || w.date
      const date = parseSafeDate(dateValue)
      return date ? format(date, 'yyyy-MM-dd') : null
    })
    .filter((d): d is string => d !== null)
    .sort()
  const sortedDates = Array.from(new Set(workoutDateStrings))
  
  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 1
  
  for (let i = 1; i < sortedDates.length; i++) {
    const diff = differenceInDays(new Date(sortedDates[i]), new Date(sortedDates[i - 1]))
    if (diff === 1) {
      tempStreak++
    } else {
      longestStreak = Math.max(longestStreak, tempStreak)
      tempStreak = 1
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak)

  // Calculate current streak
  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  
  if (sortedDates.includes(today) || sortedDates.includes(yesterday)) {
    currentStreak = 1
    for (let i = sortedDates.length - 2; i >= 0; i--) {
      const diff = differenceInDays(new Date(sortedDates[i + 1]), new Date(sortedDates[i]))
      if (diff === 1) currentStreak++
      else break
    }
  }

  if (isLoading) {
    return (
      <motion.div 
        className="space-y-6 pb-24"
        variants={fadeIn}
        initial="initial"
        animate="animate"
      >
        <div className="space-y-4">
          <div className="h-8 bg-muted rounded-2xl w-48 animate-pulse" />
          <div className="h-96 bg-muted rounded-2xl animate-pulse" />
        </div>
      </motion.div>
    )
  }

  if (workoutsError || prsError) {
    return (
      <motion.div 
        className="space-y-6 pb-24"
        variants={fadeIn}
        initial="initial"
        animate="animate"
      >
        <Card className="p-5">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto">
              <Activity className="w-6 h-6 text-destructive" />
            </div>
            <h3 className="text-subheading font-semibold text-foreground">Unable to load stats</h3>
            <p className="text-body text-muted-foreground">
              There was an error loading your workout data. Please try again later.
            </p>
            <Link href="/history">
              <Button variant="primary" className="mt-4">
                Back to History
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>
    )
  }

  // Empty state for filtered time range (has workouts, but none in selected period)
  // Count only actual workout objects, not placeholder values
  const actualWorkoutCount = workouts.filter(isWorkoutObject).length
  const hasWorkoutsButNoneInRange = actualWorkoutCount > 0 && filteredWorkouts.length === 0

  if (!user || (workouts.length === 0 && prs.length === 0)) {
    return (
      <motion.div 
        className="space-y-6 pb-24"
        variants={fadeIn}
        initial="initial"
        animate="animate"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/history">
              <Button variant="ghost" className="w-10 h-10 p-0 rounded-full" data-testid="back-button">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-heading font-bold text-foreground">Detailed Stats</h1>
          </div>
        </div>
        <Card className="p-5">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-subheading font-semibold text-foreground">No workout data yet</h3>
            <p className="text-body text-muted-foreground">
              Start tracking your workouts to see detailed stats and insights about your fitness journey.
            </p>
            <Link href="/workout/generate">
              <Button variant="primary" className="mt-4">
                Generate Workout
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div 
      className="space-y-6 pb-24"
      variants={fadeIn}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/history">
            <Button variant="ghost" className="w-10 h-10 p-0 rounded-full" data-testid="back-button">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-heading font-bold text-foreground">Detailed Stats</h1>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2">
        {(['week', 'month', 'year', 'all'] as const).map(range => (
          <Button
            key={range}
            variant={timeRange === range ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setTimeRange(range)}
            data-testid={`range-${range}`}
            className="flex-1"
          >
            {range === 'week' ? 'Last Week' : range === 'month' ? 'Last Month' : range === 'year' ? 'Last Year' : 'All Time'}
          </Button>
        ))}
      </div>

      {/* Empty State Alert - when workouts exist but none in selected range */}
      {hasWorkoutsButNoneInRange && (
        <Card className="p-5 border-warning/20 bg-warning/5" data-testid="empty-range-alert">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
              <Info className="w-5 h-5 text-warning" />
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-subheading font-semibold text-foreground">No workouts in this time range</h3>
              <p className="text-body text-muted-foreground">
                You have {actualWorkoutCount} workout{actualWorkoutCount === 1 ? '' : 's'} total, but none in the selected{' '}
                <span className="font-medium">
                  {timeRange === 'week' ? 'Last Week' : timeRange === 'month' ? 'Last Month' : timeRange === 'year' ? 'Last Year' : 'All Time'}
                </span> period.
                {timeRange !== 'all' && ' Try selecting a longer time range to see your workout history.'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5" data-testid="total-workouts-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-caption text-muted-foreground">Total Workouts</p>
              <p className="text-title font-bold text-foreground">{totalWorkouts}</p>
              <p className="text-caption text-muted-foreground">{completedWorkouts} completed</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-5" data-testid="total-time-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-caption text-muted-foreground">Total Time</p>
              <p className="text-title font-bold text-foreground">{totalMinutes}</p>
              <p className="text-caption text-muted-foreground">minutes</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-success" />
            </div>
          </div>
        </Card>

        <Card className="p-5" data-testid="completion-rate-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-caption text-muted-foreground">Completion Rate</p>
              <p className="text-title font-bold text-foreground">{completionRate}%</p>
              <p className="text-caption text-muted-foreground">of workouts</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-accent" />
            </div>
          </div>
        </Card>

        <Card className="p-5" data-testid="avg-duration-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-caption text-muted-foreground">Avg Duration</p>
              <p className="text-title font-bold text-foreground">{avgDuration}</p>
              <p className="text-caption text-muted-foreground">minutes</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <Timer className="w-5 h-5 text-warning" />
            </div>
          </div>
        </Card>
      </div>

      {/* Streak & Achievement Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4" data-testid="current-streak-card">
          <div className="text-center space-y-1">
            <Flame className="w-6 h-6 text-destructive mx-auto" />
            <p className="text-title font-bold text-foreground">{currentStreak}</p>
            <p className="text-caption text-muted-foreground">Day Streak</p>
          </div>
        </Card>

        <Card className="p-4" data-testid="longest-streak-card">
          <div className="text-center space-y-1">
            <Trophy className="w-6 h-6 text-warning mx-auto" />
            <p className="text-title font-bold text-foreground">{longestStreak}</p>
            <p className="text-caption text-muted-foreground">Best Streak</p>
          </div>
        </Card>

        <Card className="p-4" data-testid="recent-prs-card">
          <div className="text-center space-y-1">
            <Award className="w-6 h-6 text-primary mx-auto" />
            <p className="text-title font-bold text-foreground">{recentPRs.length}</p>
            <p className="text-caption text-muted-foreground">New PRs</p>
          </div>
        </Card>
      </div>

      {/* Workout Trend Chart */}
      <Card className="p-5" data-testid="workout-trend-chart">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-subheading font-semibold text-foreground">Workout Activity</h3>
            <LineChart className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeRange === 'week' ? dailyData : weeklyData}>
                <defs>
                  <linearGradient id="colorWorkouts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey={timeRange === 'week' ? 'date' : 'week'} 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="workouts" 
                  stroke={COLORS.primary}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorWorkouts)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Category Breakdown */}
      {categoryData.length > 0 && (
        <Card className="p-5" data-testid="category-breakdown-chart">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-subheading font-semibold text-foreground">Category Distribution</h3>
              <PieChart className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: any) => `${entry.name}: ${entry.percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CATEGORY_COLORS[entry.name as Category] || COLORS.muted} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px'
                    }}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      )}

      {/* Intensity Distribution */}
      <Card className="p-5" data-testid="intensity-distribution-chart">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-subheading font-semibold text-foreground">Intensity Levels</h3>
            <Zap className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={intensityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="range" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px'
                  }}
                />
                <Bar dataKey="count" fill={COLORS.accent} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Insights Cards */}
      <div className="space-y-3">
        <h3 className="text-subheading font-semibold text-foreground">Insights</h3>
        
        {bestDay && (
          <Card className="p-4" data-testid="best-day-insight">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-body font-medium text-foreground">
                  {bestDay[0]} is your most active day
                </p>
                <p className="text-caption text-muted-foreground">
                  {String(bestDay[1])} workouts completed on {bestDay[0]}s
                </p>
              </div>
            </div>
          </Card>
        )}

        {workoutFrequency > 0 && (
          <Card className="p-4" data-testid="frequency-insight">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                <Activity className="w-5 h-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-body font-medium text-foreground">
                  {Math.round(workoutFrequency)}% active days
                </p>
                <p className="text-caption text-muted-foreground">
                  You trained on {daysWithWorkouts} of {periodDays} days
                </p>
              </div>
            </div>
          </Card>
        )}

        {avgDuration > 0 && (
          <Card className="p-4" data-testid="consistency-insight">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1">
                <p className="text-body font-medium text-foreground">
                  Consistent workout duration
                </p>
                <p className="text-caption text-muted-foreground">
                  Your sessions average {avgDuration} minutes each
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Motivational Footer */}
      <Card className="p-5 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20" data-testid="motivation-card">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-primary" />
          <div className="flex-1">
            <p className="text-body font-semibold text-foreground">
              {totalWorkouts > 0 
                ? "You're making great progress!"
                : "Ready to start your fitness journey?"}
            </p>
            <p className="text-caption text-muted-foreground">
              {totalWorkouts > 0
                ? `Keep up the momentum with ${completedWorkouts} completed workouts!`
                : "Track your first workout to see detailed insights."}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
