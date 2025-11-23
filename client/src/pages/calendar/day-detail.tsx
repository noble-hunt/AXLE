import { useRoute, Link } from "wouter"
import { motion } from "framer-motion"
import { fadeIn } from "@/lib/motion-variants"
import { ArrowLeft, Dumbbell, Activity } from "lucide-react"
import { format, parseISO } from "date-fns"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { useAppStore } from "@/store/useAppStore"
import { HealthMetricsGrid } from "@/components/calendar/HealthMetricsGrid"
import { InsightsCard } from "@/components/calendar/InsightsCard"
import { HeartRateChart } from "@/components/calendar/HeartRateChart"

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

export default function DayDetail() {
  const { user } = useAppStore()
  const [, params] = useRoute("/calendar/:date")
  const date = params?.date
  
  const { data: dayData, isLoading, error } = useQuery<DayDetail>({
    queryKey: ['/api/calendar/day', date],
    enabled: !!user && !!date,
  })

  if (!date) {
    return (
      <div className="text-center py-12">
        <p className="text-body text-muted-foreground">Invalid date</p>
      </div>
    )
  }

  const dateObj = parseISO(date)

  if (isLoading) {
    return (
      <motion.div 
        className="space-y-6 pb-24"
        variants={fadeIn}
        initial="initial"
        animate="animate"
      >
        <div className="h-8 bg-muted rounded-2xl w-32 animate-pulse" />
        <div className="h-64 bg-muted rounded-2xl animate-pulse" />
        <div className="h-48 bg-muted rounded-2xl animate-pulse" />
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.div
        className="space-y-6 pb-24"
        variants={fadeIn}
        initial="initial"
        animate="animate"
      >
        <Card className="p-8 text-center">
          <p className="text-body text-destructive">Failed to load day details</p>
          <p className="text-caption text-muted-foreground mt-2">
            {error instanceof Error ? error.message : "An error occurred"}
          </p>
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
          <Link href="/calendar">
            <Button variant="ghost" className="w-10 h-10 p-0 rounded-full" data-testid="back-button">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <p className="text-caption text-muted-foreground">
              {format(dateObj, 'EEEE')}
            </p>
            <h1 className="text-heading font-bold">
              {format(dateObj, 'MMMM dd, yyyy')}
            </h1>
          </div>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <Activity className="w-5 h-5 text-primary" />
        </div>
      </div>

      {/* Workouts Section */}
      {dayData?.workouts && dayData.workouts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-subheading font-semibold">Workouts</h2>
          {dayData.workouts.map((workout) => (
            <Link key={workout.id} href={`/workout/${workout.id}`}>
              <Card className="p-6 cursor-pointer hover:scale-[1.01] transition-transform">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Dumbbell className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-body font-semibold text-foreground">{workout.title}</h3>
                    {workout.completed && (
                      <p className="text-caption text-success mt-1">✓ Completed</p>
                    )}
                    {workout.request?.duration && (
                      <p className="text-caption text-muted-foreground mt-1">
                        {workout.request.duration} min
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* No Workouts */}
      {dayData?.workouts && dayData.workouts.length === 0 && (
        <Card className="p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
            <Dumbbell className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-body font-semibold text-foreground mb-2">Rest Day</h3>
          <p className="text-caption text-muted-foreground">No workouts logged this day</p>
        </Card>
      )}

      {/* Health Metrics */}
      {dayData?.healthMetrics && (
        <div className="space-y-4">
          <h2 className="text-subheading font-semibold">Health Metrics</h2>
          <HealthMetricsGrid metrics={dayData.healthMetrics} />
          
          {/* Resting Heart Rate Graph */}
          {dayData.healthMetrics.restingHeartRateTimeSeries && 
           dayData.healthMetrics.restingHeartRateTimeSeries.length > 0 && (
            <HeartRateChart data={dayData.healthMetrics.restingHeartRateTimeSeries} />
          )}
        </div>
      )}

      {/* AI Insights */}
      {dayData?.insights && (
        <div className="space-y-4">
          <h2 className="text-subheading font-semibold">Insights</h2>
          <InsightsCard insights={dayData.insights} />
        </div>
      )}

      {/* No data message */}
      {!dayData && !isLoading && (
        <Card className="p-8 text-center">
          <p className="text-body text-muted-foreground">No data available for this day</p>
        </Card>
      )}
    </motion.div>
  )
}
