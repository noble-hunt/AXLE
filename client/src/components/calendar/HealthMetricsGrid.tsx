import { Card } from "@/components/swift/card"
import { Moon, Heart, Zap, Sun, Activity, TrendingUp, Battery, Target } from "lucide-react"

interface HealthMetrics {
  sleepHours?: number
  sleepQuality?: number
  maxHeartRate?: number
  restingHeartRate?: number
  fatigueScore?: number
  circadianAlignment?: number
  energySystemsBalance?: number
  vitalityScore?: number
  performancePotential?: number
}

interface HealthMetricsGridProps {
  metrics: HealthMetrics
}

export function HealthMetricsGrid({ metrics }: HealthMetricsGridProps) {
  const metricCards = [
    {
      icon: Moon,
      label: "Sleep",
      value: metrics.sleepHours ? `${metrics.sleepHours}h` : "—",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      icon: Heart,
      label: "Max HR",
      value: metrics.maxHeartRate ? `${Math.round(metrics.maxHeartRate)}` : "—",
      unit: "bpm",
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
    },
    {
      icon: Heart,
      label: "Resting HR",
      value: metrics.restingHeartRate ? `${Math.round(metrics.restingHeartRate)}` : "—",
      unit: "bpm",
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
    {
      icon: Zap,
      label: "Fatigue",
      value: metrics.fatigueScore !== undefined 
        ? `${Math.round(metrics.fatigueScore * 100)}%` 
        : "—",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      icon: Sun,
      label: "Circadian",
      value: metrics.circadianAlignment !== undefined
        ? `${Math.round(metrics.circadianAlignment)}/100`
        : "—",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      icon: Activity,
      label: "Energy Systems",
      value: metrics.energySystemsBalance !== undefined
        ? `${Math.round(metrics.energySystemsBalance)}/100`
        : "—",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      icon: Battery,
      label: "Vitality",
      value: metrics.vitalityScore !== undefined
        ? `${Math.round(metrics.vitalityScore)}/100`
        : "—",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: Target,
      label: "Performance",
      value: metrics.performancePotential !== undefined
        ? `${Math.round(metrics.performancePotential)}/100`
        : "—",
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4">
      {metricCards.map((metric) => (
        <Card key={metric.label} className="p-5" data-testid={`metric-${metric.label.toLowerCase().replace(/\s+/g, '-')}`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl ${metric.bgColor} flex items-center justify-center flex-shrink-0`}>
              <metric.icon className={`w-5 h-5 ${metric.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-caption text-muted-foreground mb-1">
                {metric.label}
              </p>
              <div className="flex items-baseline gap-1">
                <p className="text-title font-bold text-foreground truncate">
                  {metric.value}
                </p>
                {metric.unit && (
                  <p className="text-caption text-muted-foreground">
                    {metric.unit}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
