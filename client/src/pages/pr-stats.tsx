import { useState } from "react"
import { useAppStore } from "@/store/useAppStore"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { StatBadge } from "@/components/swift/stat-badge"
import { fadeIn } from "@/lib/motion-variants"
import { motion } from "framer-motion"
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Award,
  Target,
  Zap,
  Flame,
  BarChart3,
  ArrowLeft,
  Star,
  Sparkles,
  Activity,
  Calendar
} from "lucide-react"
import { Link } from "wouter"
import { 
  BarChart, 
  Bar, 
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  LineChart,
  Line
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
  POWERLIFTING: '#8b5cf6',
  'OLYMPIC_WEIGHTLIFTING': '#ec4899',
  GYMNASTICS: '#06b6d4',
  AEROBIC: '#10b981',
  BODYBUILDING: '#f97316',
  OTHER: '#64748b'
}

// Type definitions for API responses
interface PRStatsResponse {
  total: number
  recentCount: number
  previousPeriodCount: number
  momentum: number
  uniqueMovements: number
  categoryDistribution: Record<string, number>
  topImprovements: Array<{
    movement: string
    improvement: number
    from: number
    to: number
    count: number
  }>
  currentStreak: number
  longestStreak: number
  nextMilestone: number
  progressToMilestone: number
  prsByMonth: Record<string, number>
  last90Days: number
  lastYear: number
}

interface AchievementStatsResponse {
  total: number
  unlocked: number
  completionRate: number
  recentUnlocks: number
  inProgress: Array<{
    name: string
    description: string
    progress: number
  }>
  nextTargets: Array<{
    name: string
    description: string
    progress: number
    remaining: number
  }>
  avgDaysBetweenUnlocks: number
  categoryDistribution: Record<string, number>
  recentAchievements: Array<{
    name: string
    description: string
    unlockedAt: string | null
  }>
}

export default function PRStats() {
  const { user } = useAppStore()
  const [timeRange, setTimeRange] = useState<'month' | 'year' | 'all'>('all')
  
  // Fetch PR analytics
  const { data: prStats, isLoading: prLoading, error: prError } = useQuery<PRStatsResponse>({
    queryKey: ['/api/pr-stats'],
    enabled: !!user,
  })

  // Fetch achievement analytics
  const { data: achievementStats, isLoading: achievementLoading, error: achievementError } = useQuery<AchievementStatsResponse>({
    queryKey: ['/api/achievement-stats'],
    enabled: !!user,
  })

  const isLoading = prLoading || achievementLoading
  const hasError = prError || achievementError

  if (isLoading) {
    return (
      <motion.div 
        className="space-y-6 pb-24"
        variants={fadeIn}
        initial="initial"
        animate="animate"
      >
        <div className="h-8 bg-muted rounded-2xl w-48 animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-muted rounded-2xl animate-pulse" />
      </motion.div>
    )
  }

  if (hasError || !prStats || !achievementStats) {
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
              There was an error loading your PR and achievement data.
            </p>
            <Link href="/prs">
              <Button variant="primary" className="mt-4">
                Back to PRs
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>
    )
  }

  // Filter data based on time range
  const getFilteredMonthlyData = () => {
    const now = new Date()
    const entries = Object.entries(prStats.prsByMonth || {})
      .sort((a, b) => a[0].localeCompare(b[0]))
    
    let filteredEntries = entries
    if (timeRange === 'month') {
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      filteredEntries = entries.filter(([month]) => month >= currentMonth)
    } else if (timeRange === 'year') {
      const yearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
      const yearAgoStr = `${yearAgo.getFullYear()}-${String(yearAgo.getMonth() + 1).padStart(2, '0')}`
      filteredEntries = entries.filter(([month]) => month >= yearAgoStr)
    }
    
    return filteredEntries.map(([month, count]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      prs: count
    }))
  }

  // Prepare category distribution data for pie chart
  const categoryData = Object.entries(prStats.categoryDistribution || {}).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value: value as number,
    percentage: Math.round(((value as number) / prStats.total) * 100)
  }))

  // Prepare monthly PR trend data
  const monthlyData = getFilteredMonthlyData()

  // Format momentum for display
  const momentumSign = prStats.momentum > 0 ? '+' : ''
  const momentumColor = prStats.momentum > 0 ? 'text-success' : prStats.momentum < 0 ? 'text-destructive' : 'text-muted-foreground'

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
          <Link href="/prs">
            <Button variant="ghost" className="w-10 h-10 p-0 rounded-full" data-testid="back-button">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-heading font-bold text-foreground">PR & Achievement Analytics</h1>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
          <Trophy className="w-5 h-5 text-primary" />
        </div>
      </div>

      {/* Time Range Filter */}
      <div className="flex gap-2">
        <Button
          variant={timeRange === 'month' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setTimeRange('month')}
          data-testid="filter-month"
          className="flex-1"
        >
          This Month
        </Button>
        <Button
          variant={timeRange === 'year' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setTimeRange('year')}
          data-testid="filter-year"
          className="flex-1"
        >
          This Year
        </Button>
        <Button
          variant={timeRange === 'all' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setTimeRange('all')}
          data-testid="filter-all"
          className="flex-1"
        >
          All Time
        </Button>
      </div>

      {/* PR Stats Section */}
      <div className="space-y-4">
        <h2 className="text-subheading font-semibold text-foreground">Personal Records</h2>
        
        {/* Key PR Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-5" data-testid="total-prs-card">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-caption text-muted-foreground">Total PRs</p>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-title font-bold text-foreground">{prStats.total}</p>
                <p className="text-caption text-muted-foreground">{prStats.uniqueMovements} movements</p>
              </div>
            </div>
          </Card>

          <Card className="p-5" data-testid="recent-prs-card">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-caption text-muted-foreground">Last 30 Days</p>
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                  {prStats.momentum > 0 ? (
                    <TrendingUp className="w-5 h-5 text-success" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-destructive" />
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-title font-bold text-foreground">{prStats.recentCount}</p>
                <p className={`text-caption font-medium ${momentumColor}`}>
                  {momentumSign}{Math.round(prStats.momentum)}% vs prev
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5" data-testid="pr-streak-card">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-caption text-muted-foreground">Current Streak</p>
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
                  <Flame className="w-5 h-5 text-warning" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-title font-bold text-foreground">{prStats.currentStreak}</p>
                <p className="text-caption text-muted-foreground">Best: {prStats.longestStreak} months</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Milestone Progress */}
        <Card className="p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-body font-semibold text-foreground">Milestone Progress</h3>
              <span className="text-caption text-muted-foreground">
                {prStats.total} / {prStats.nextMilestone}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-primary to-accent h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(prStats.progressToMilestone, 100)}%` }}
              />
            </div>
            <p className="text-caption text-muted-foreground">
              {prStats.nextMilestone - prStats.total} more PRs to reach {prStats.nextMilestone}!
            </p>
          </div>
        </Card>

        {/* PR Velocity Chart */}
        {monthlyData.length > 0 && (
          <Card className="p-5">
            <h3 className="text-body font-semibold text-foreground mb-4">
              PR Velocity {timeRange === 'month' ? '(This Month)' : timeRange === 'year' ? '(This Year)' : '(All Time)'}
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                <XAxis 
                  dataKey="month" 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="prs" 
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  dot={{ fill: "#8b5cf6", r: 5, strokeWidth: 2, stroke: "#ffffff" }}
                  activeDot={{ r: 7 }}
                  name="PRs Set"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Category Distribution */}
        {categoryData.length > 0 && (
          <Card className="p-5">
            <h3 className="text-body font-semibold text-foreground mb-4">PR Distribution by Category</h3>
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={CATEGORY_COLORS[entry.name.toUpperCase().replace(' ', '_') as keyof typeof CATEGORY_COLORS] || COLORS.muted} 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
              </RechartsPieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Top Improvements */}
        {prStats.topImprovements && prStats.topImprovements.length > 0 && (
          <Card className="p-5">
            <h3 className="text-body font-semibold text-foreground mb-4">Top Improvements</h3>
            <div className="space-y-3">
              {prStats.topImprovements.slice(0, 5).map((improvement: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                  <div className="flex-1">
                    <p className="text-body font-medium text-foreground">{improvement.movement}</p>
                    <p className="text-caption text-muted-foreground">
                      {improvement.from.toFixed(1)} → {improvement.to.toFixed(1)} ({improvement.count} PRs)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-body font-bold text-success">+{improvement.improvement.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Achievement Stats Section */}
      <div className="space-y-4">
        <h2 className="text-subheading font-semibold text-foreground">Achievements</h2>
        
        {/* Key Achievement Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-5 min-w-0" data-testid="total-achievements-card">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-caption text-muted-foreground">Unlocked</p>
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
                  <Award className="w-5 h-5 text-warning" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-title font-bold text-foreground">{achievementStats.unlocked}</p>
                <p className="text-caption text-muted-foreground">of {achievementStats.total}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 min-w-0" data-testid="completion-rate-card">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-caption text-muted-foreground">Completion</p>
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Target className="w-5 h-5 text-accent" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-title font-bold text-foreground">{Math.round(achievementStats.completionRate)}%</p>
                <p className="text-caption text-muted-foreground">achieved</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 min-w-0" data-testid="recent-unlocks-card">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-caption text-muted-foreground">Last 30 Days</p>
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-success" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-title font-bold text-foreground">{achievementStats.recentUnlocks}</p>
                <p className="text-caption text-muted-foreground">unlocked</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Next Targets */}
        {achievementStats.nextTargets && achievementStats.nextTargets.length > 0 && (
          <Card className="p-5">
            <h3 className="text-body font-semibold text-foreground mb-4">Next Achievements to Unlock</h3>
            <div className="space-y-3">
              {achievementStats.nextTargets.map((target: any, index: number) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-body font-medium text-foreground">{target.name}</p>
                      <p className="text-caption text-muted-foreground">{target.description}</p>
                    </div>
                    <Star className="w-5 h-5 text-warning ml-2 flex-shrink-0" />
                  </div>
                  <div className="space-y-1">
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-warning h-2 rounded-full transition-all"
                        style={{ width: `${target.progress}%` }}
                      />
                    </div>
                    <p className="text-caption text-muted-foreground">{target.progress}% complete</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Recent Achievements */}
        {achievementStats.recentAchievements && achievementStats.recentAchievements.length > 0 && (
          <Card className="p-5">
            <h3 className="text-body font-semibold text-foreground mb-4">Recently Unlocked</h3>
            <div className="space-y-3">
              {achievementStats.recentAchievements.map((achievement: any, index: number) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-success/5 border border-success/20 rounded-xl">
                  <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-5 h-5 text-success" />
                  </div>
                  <div className="flex-1">
                    <p className="text-body font-medium text-foreground">{achievement.name}</p>
                    <p className="text-caption text-muted-foreground">{achievement.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </motion.div>
  )
}
