import { useState } from "react"
import { motion } from "framer-motion"
import { fadeIn } from "@/lib/motion-variants"
import { ChevronLeft, ChevronRight, Dumbbell, Moon, Zap } from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths, isSameDay, parseISO } from "date-fns"
import { Link } from "wouter"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/swift/card"
import { useAppStore } from "@/store/useAppStore"
import { DayDetailContent } from "@/components/calendar/DayDetailContent"

// Day colors (cycling pastels matching screenshot)
const DAY_COLORS = [
  "bg-purple-200/50 dark:bg-purple-900/20",
  "bg-rose-200/50 dark:bg-rose-900/20",
  "bg-cyan-200/50 dark:bg-cyan-900/20",
  "bg-lime-200/50 dark:bg-lime-900/20",
]

interface DaySummary {
  date: string
  workoutCount: number
  totalDuration?: number
  sleepHours?: number
  vitalityScore?: number
  performancePotential?: number
}

interface DayDetail {
  date: string
  workouts: any[]
  healthMetrics: {
    sleepHours?: number
    sleepQuality?: number
    maxHeartRate?: number
    restingHeartRate?: number
    restingHeartRateTimeSeries?: Array<{ time: string; value: number }>
    fatigueScore?: number
    circadianAlignment?: number
    energySystemsBalance?: number
    vitalityScore?: number
    performancePotential?: number
  }
  insights?: {
    summary: string
    goalsProgress?: any
    recommendations?: string[]
    bedtimeRecommendation?: string
  }
}

export default function Calendar() {
  const { user } = useAppStore()
  const [selectedView, setSelectedView] = useState<'today' | 'calendar'>('today')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const today = new Date()

  // Fetch calendar data for the month
  const { data: monthData, isLoading, error } = useQuery<DaySummary[]>({
    queryKey: ['/api/calendar/month', format(currentMonth, 'yyyy-MM')],
    enabled: !!user && selectedView === 'calendar',
  })

  // Fetch today's data for the Today tab
  const todayStr = format(today, 'yyyy-MM-dd')
  const { data: todayData, isLoading: todayLoading, error: todayError } = useQuery<DayDetail>({
    queryKey: ['/api/calendar/day', todayStr],
    enabled: !!user && selectedView === 'today',
  })

  const goToPreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1))
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1))

  // Get all days in the current month
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Get day color by index
  const getDayColor = (index: number) => DAY_COLORS[index % DAY_COLORS.length]

  const getDayData = (date: Date): DaySummary | undefined => {
    return monthData?.find(d => isSameDay(parseISO(d.date), date))
  }

  return (
    <motion.div
      className="space-y-6 pb-24"
      variants={fadeIn}
      initial="initial"
      animate="animate"
    >
      {/* Today/Calendar Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setSelectedView('today')}
          className={`flex-1 px-4 py-2 rounded-full font-medium transition-all ${
            selectedView === 'today'
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
          data-testid="tab-today"
        >
          Today
        </button>
        <button
          onClick={() => setSelectedView('calendar')}
          className={`flex-1 px-4 py-2 rounded-full font-medium transition-all ${
            selectedView === 'calendar'
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
          data-testid="tab-calendar"
        >
          Calendar
        </button>
      </div>

      {/* Today View */}
      {selectedView === 'today' && (
        <div className="space-y-6">
          {/* Today's Date */}
          <div className="text-center space-y-1">
            <p className="text-body text-muted-foreground">
              {format(today, 'EEEE')}
            </p>
            <h1 className="text-[64px] leading-none font-bold">
              {format(today, 'dd.MM')}
            </h1>
            <p className="text-2xl font-bold tracking-wide">
              {format(today, 'MMM').toUpperCase()}
            </p>
          </div>

          {/* Today's Day Detail Content */}
          <DayDetailContent dayData={todayData} isLoading={todayLoading} error={todayError} />
        </div>
      )}

      {/* Calendar View */}
      {selectedView === 'calendar' && (
        <div className="space-y-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={goToPreviousMonth}
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="prev-month"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            
            <div className="flex items-center gap-4">
              <span className="text-2xl font-semibold text-muted-foreground">
                {format(subMonths(currentMonth, 1), 'MMM').toUpperCase()}
              </span>
              <span className="text-2xl font-bold">
                {format(currentMonth, 'MMM').toUpperCase()}
              </span>
              <span className="text-2xl font-semibold text-muted-foreground">
                {format(addMonths(currentMonth, 1), 'MMM').toUpperCase()}
              </span>
            </div>
            
            <button
              onClick={goToNextMonth}
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="next-month"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Day Cards */}
          <div className="flex flex-col gap-4">
            {isLoading ? (
              <div className="flex flex-col gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <Card className="p-8 text-center">
                <p className="text-body text-destructive">Failed to load calendar data</p>
                <p className="text-caption text-muted-foreground mt-2">
                  {error instanceof Error ? error.message : "An error occurred"}
                </p>
              </Card>
            ) : (
              daysInMonth.slice().reverse().map((date, index) => {
                const dayData = getDayData(date)
                const colorClass = getDayColor(index)
                const isPast = date < today
                
                return (
                  <Link key={date.toISOString()} href={`/calendar/${format(date, 'yyyy-MM-dd')}`}>
                    <Card 
                      className={`p-5 ${colorClass} border-none cursor-pointer hover:scale-[1.02] transition-transform`}
                      data-testid={`day-card-${format(date, 'yyyy-MM-dd')}`}
                    >
                      <div className="flex items-start gap-5">
                        {/* Date */}
                        <div className="flex-shrink-0">
                          <p className="text-xs text-foreground/70">
                            {format(date, 'EEEE')}
                          </p>
                          <p className="text-[48px] leading-none font-bold text-foreground/90">
                            {format(date, 'dd')}
                          </p>
                          <p className="text-lg font-bold tracking-wide text-foreground/90">
                            {format(date, 'MMM').toUpperCase()}
                          </p>
                        </div>

                        {/* Metrics */}
                        <div className="flex-1 pt-2">
                          {isPast && dayData ? (
                            <div className="space-y-3">
                              {/* Workout Count */}
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-foreground/10 flex items-center justify-center">
                                  <Dumbbell className="w-4 h-4 text-foreground/70" />
                                </div>
                                <p className="text-body font-medium text-foreground/90">
                                  {dayData.workoutCount > 0 
                                    ? `${dayData.workoutCount} workout${dayData.workoutCount > 1 ? 's' : ''}`
                                    : 'Rest day'
                                  }
                                </p>
                              </div>
                              
                              {/* Sleep Hours */}
                              {dayData.sleepHours && (
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-foreground/10 flex items-center justify-center">
                                    <Moon className="w-4 h-4 text-foreground/70" />
                                  </div>
                                  <p className="text-caption text-foreground/70">
                                    {Math.round(dayData.sleepHours * 10) / 10}h sleep
                                  </p>
                                </div>
                              )}
                              
                              {/* Vitality Score */}
                              {dayData.vitalityScore && (
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-foreground/10 flex items-center justify-center">
                                    <Zap className="w-4 h-4 text-foreground/70" />
                                  </div>
                                  <p className="text-caption text-foreground/70">
                                    Vitality: {Math.round(dayData.vitalityScore)}/100
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-body text-foreground/50">
                              {isSameDay(date, today) ? 'Today' : 'Upcoming'}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
