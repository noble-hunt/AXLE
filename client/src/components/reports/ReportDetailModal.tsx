import { useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card } from "@/components/swift/card"
import { TrendingUp, TrendingDown, Minus, Trophy, Dumbbell, Target, Award } from "lucide-react"
import { format } from "date-fns"
import type { Report } from "@shared/schema"
import { ReportCharts } from "./ReportCharts"

interface ReportDetailModalProps {
  report: Report | null
  isOpen: boolean
  onClose: () => void
  onReportViewed?: (reportId: string) => void
}

export function ReportDetailModal({ report, isOpen, onClose, onReportViewed }: ReportDetailModalProps) {
  // Mark as viewed when modal opens (useEffect to prevent re-renders)
  useEffect(() => {
    if (isOpen && report && !report.viewedAt && onReportViewed) {
      onReportViewed(report.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, report?.id, report?.viewedAt])

  if (!report) return null

  const { metrics, insights, frequency, timeframeStart, timeframeEnd } = report
  const periodStart = new Date(timeframeStart)
  const periodEnd = new Date(timeframeEnd)

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-success" />
      case 'down':
        return <TrendingDown className="w-4 h-4 text-destructive" />
      case 'stable':
        return <Minus className="w-4 h-4 text-muted-foreground" />
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-title font-bold text-foreground mb-2">
            {insights?.headline || `${frequency === 'weekly' ? 'Weekly' : 'Monthly'} Report`}
          </DialogTitle>
          <p className="text-caption text-muted-foreground">
            {format(periodStart, 'MMM d')} - {format(periodEnd, 'MMM d, yyyy')}
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 text-center" data-testid="kpi-workouts">
              <Dumbbell className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-heading font-bold text-foreground">
                {metrics?.workoutStats?.totalWorkouts || 0}
              </p>
              <p className="text-caption text-muted-foreground">Workouts</p>
            </Card>

            <Card className="p-4 text-center" data-testid="kpi-prs">
              <Trophy className="w-6 h-6 text-accent mx-auto mb-2" />
              <p className="text-heading font-bold text-foreground">
                {metrics?.prStats?.totalPRs || 0}
              </p>
              <p className="text-caption text-muted-foreground">PRs</p>
            </Card>

            <Card className="p-4 text-center" data-testid="kpi-minutes">
              <Target className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-heading font-bold text-foreground">
                {metrics?.workoutStats?.totalMinutes || 0}
              </p>
              <p className="text-caption text-muted-foreground">Minutes</p>
            </Card>

            <Card className="p-4 text-center" data-testid="kpi-consistency">
              <Award className="w-6 h-6 text-accent mx-auto mb-2" />
              <p className="text-heading font-bold text-foreground">
                {metrics?.workoutStats?.consistencyScore || 0}%
              </p>
              <p className="text-caption text-muted-foreground">Consistency</p>
            </Card>
          </div>

          {/* Visualizations */}
          <ReportCharts report={report} />

          {/* Trends */}
          {metrics?.trends && (
            <Card className="p-4">
              <h3 className="text-subheading font-semibold text-foreground mb-3">Trends</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-body text-muted-foreground">Workout Frequency</span>
                  {getTrendIcon(metrics.trends.workoutTrend)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-body text-muted-foreground">Volume</span>
                  {getTrendIcon(metrics.trends.volumeTrend)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-body text-muted-foreground">Intensity</span>
                  {getTrendIcon(metrics.trends.intensityTrend)}
                </div>
              </div>
            </Card>
          )}

          {/* Top PRs */}
          {metrics?.prStats?.topPRs && metrics.prStats.topPRs.length > 0 && (
            <Card className="p-4">
              <h3 className="text-subheading font-semibold text-foreground mb-3">Top PRs</h3>
              <div className="space-y-3">
                {metrics.prStats.topPRs.map((pr: { movement: string; value: string; improvement: string }, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                    data-testid={`top-pr-${index}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                        {index + 1}
                      </div>
                      <span className="text-body text-foreground">{pr.movement}</span>
                    </div>
                    <span className="text-body font-semibold text-accent">{pr.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Highlights */}
          {insights?.highlights && insights.highlights.length > 0 && (
            <Card className="p-4 bg-primary/5">
              <h3 className="text-subheading font-semibold text-foreground mb-3">Highlights</h3>
              <ul className="space-y-2">
                {insights.highlights.map((highlight: string, index: number) => (
                  <li
                    key={index}
                    className="text-body text-foreground flex items-start gap-2"
                    data-testid={`highlight-${index}`}
                  >
                    <span className="text-primary mt-1">•</span>
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Recommendations */}
          {insights?.recommendations && insights.recommendations.length > 0 && (
            <Card className="p-4">
              <h3 className="text-subheading font-semibold text-foreground mb-3">Recommendations</h3>
              <ul className="space-y-2">
                {insights.recommendations.map((rec: string, index: number) => (
                  <li
                    key={index}
                    className="text-body text-muted-foreground flex items-start gap-2"
                    data-testid={`recommendation-${index}`}
                  >
                    <span className="text-accent mt-1">→</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Fun Facts */}
          {insights?.funFacts && insights.funFacts.length > 0 && (
            <Card className="p-4 bg-accent/5">
              <h3 className="text-subheading font-semibold text-foreground mb-3">Fun Facts</h3>
              <ul className="space-y-2">
                {insights.funFacts.map((fact: string, index: number) => (
                  <li
                    key={index}
                    className="text-body text-foreground flex items-start gap-2"
                    data-testid={`fun-fact-${index}`}
                  >
                    <span className="text-accent mt-1">✨</span>
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Badges */}
          {insights?.badges && insights.badges.length > 0 && (
            <Card className="p-4">
              <h3 className="text-subheading font-semibold text-foreground mb-3">Badges Earned</h3>
              <div className="flex flex-wrap gap-2">
                {insights.badges.map((badge: string, index: number) => (
                  <div
                    key={index}
                    className="px-3 py-2 rounded-full bg-accent/10 text-accent text-caption font-semibold"
                    data-testid={`badge-${index}`}
                  >
                    🏆 {badge}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
