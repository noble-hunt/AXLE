import { Link } from "wouter"
import { Dumbbell } from "lucide-react"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { HealthMetricsGrid } from "./HealthMetricsGrid"
import { InsightsCard } from "./InsightsCard"
import { HeartRateChart } from "./HeartRateChart"

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

interface DayDetailContentProps {
  dayData: DayDetail | undefined
  isLoading: boolean
  error: Error | null
}

export function DayDetailContent({ dayData, isLoading, error }: DayDetailContentProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-muted rounded-2xl animate-pulse" />
        <div className="h-64 bg-muted rounded-2xl animate-pulse" />
        <div className="h-48 bg-muted rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-body text-destructive">Failed to load day details</p>
        <p className="text-caption text-muted-foreground mt-2">
          {error instanceof Error ? error.message : "An error occurred"}
        </p>
      </Card>
    )
  }

  if (!dayData) {
    return (
      <Card className="p-8 text-center">
        <p className="text-body text-muted-foreground">No data available for this day</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Workouts Section */}
      {dayData.workouts && dayData.workouts.length > 0 && (
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
      {dayData.workouts && dayData.workouts.length === 0 && (
        <Card className="p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
            <Dumbbell className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-body font-semibold text-foreground mb-2">Rest Day</h3>
          <p className="text-caption text-muted-foreground">No workouts logged this day</p>
          <Link href="/workout">
            <Button variant="primary" className="mt-4">
              Log Workout
            </Button>
          </Link>
        </Card>
      )}

      {/* Health Metrics */}
      {dayData.healthMetrics && (
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
      {dayData.insights && (
        <div className="space-y-4">
          <h2 className="text-subheading font-semibold">Insights</h2>
          <InsightsCard insights={dayData.insights} />
        </div>
      )}
    </div>
  )
}
