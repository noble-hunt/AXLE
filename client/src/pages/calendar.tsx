import { useState } from "react"
import { motion } from "framer-motion"
import { fadeIn } from "@/lib/motion-variants"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths, isSameDay, parseISO } from "date-fns"
import { Link } from "wouter"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { useAppStore } from "@/store/useAppStore"

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
      {/* Today/Calendar Tabs + Add Button */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
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
        
        <Button
          variant="ghost"
          className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 p-0"
          data-testid="button-add"
        >
          <Plus className="w-5 h-5" />
        </Button>
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

          {/* Today's Activities */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-subheading font-semibold">Today's tasks</h2>
              <Link href="/history">
                <button className="text-body text-muted-foreground hover:text-foreground transition-colors">
                  View all
                </button>
              </Link>
            </div>
            
            {/* Today's workout cards would go here */}
            <Card className="p-6 text-center text-muted-foreground">
              <p className="text-body">No workouts logged today</p>
              <Link href="/workout">
                <Button variant="primary" className="mt-4">
                  Log Workout
                </Button>
              </Link>
            </Card>
          </div>
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
          <div className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />
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
                      className={`p-6 ${colorClass} border-none cursor-pointer hover:scale-[1.02] transition-transform`}
                      data-testid={`day-card-${format(date, 'yyyy-MM-dd')}`}
                    >
                      <div className="flex items-start gap-6">
                        {/* Date */}
                        <div className="flex-shrink-0">
                          <p className="text-caption text-foreground/70">
                            {format(date, 'EEEE')}
                          </p>
                          <p className="text-[56px] leading-none font-bold text-foreground/90">
                            {format(date, 'dd')}
                          </p>
                          <p className="text-xl font-bold tracking-wide text-foreground/90">
                            {format(date, 'MMM').toUpperCase()}
                          </p>
                        </div>

                        {/* Summary */}
                        <div className="flex-1 pt-2">
                          {isPast && dayData ? (
                            <div className="space-y-2">
                              <p className="text-body font-medium text-foreground/90">
                                {dayData.workoutCount > 0 
                                  ? `${dayData.workoutCount} workout${dayData.workoutCount > 1 ? 's' : ''}`
                                  : 'Rest day'
                                }
                              </p>
                              {dayData.sleepHours && (
                                <p className="text-caption text-foreground/70">
                                  {dayData.sleepHours}h sleep
                                </p>
                              )}
                              {dayData.vitalityScore && (
                                <p className="text-caption text-foreground/70">
                                  Vitality: {dayData.vitalityScore}/100
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-body text-foreground/50">
                              {isSameDay(date, today) ? 'Today' : 'Upcoming'}
                            </p>
                          )}
                        </div>

                        {/* Plus icons for time slots (decorative) */}
                        <div className="flex gap-2">
                          {[1, 2, 3].map(slot => (
                            <div key={slot} className="w-8 h-8 rounded-lg bg-foreground/10 flex items-center justify-center">
                              <Plus className="w-4 h-4 text-foreground/30" />
                            </div>
                          ))}
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
