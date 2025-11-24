import { useRoute } from "wouter"
import { motion } from "framer-motion"
import { fadeIn } from "@/lib/motion-variants"
import { Activity } from "lucide-react"
import { format, parseISO } from "date-fns"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/swift/card"
import { useAppStore } from "@/store/useAppStore"
import { DayDetailContent } from "@/components/calendar/DayDetailContent"

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

      {/* Day Detail Content */}
      <DayDetailContent dayData={dayData} isLoading={isLoading} error={error} />
    </motion.div>
  )
}
