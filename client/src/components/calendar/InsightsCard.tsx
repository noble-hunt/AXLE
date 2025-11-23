import { Card } from "@/components/swift/card"
import { Sparkles, Target, Lightbulb, Moon } from "lucide-react"

interface DayInsights {
  summary: string
  goalsProgress?: any
  recommendations?: string[]
  bedtimeRecommendation?: string
}

interface InsightsCardProps {
  insights: DayInsights
}

export function InsightsCard({ insights }: InsightsCardProps) {
  return (
    <Card className="p-6" data-testid="insights-card">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-body font-semibold text-foreground">Daily Summary</h3>
        </div>
      </div>
      
      <div className="space-y-4">
        {/* AI Summary */}
        <p className="text-body text-foreground/90 leading-relaxed">
          {insights.summary}
        </p>

        {/* Goals Progress */}
        {insights.goalsProgress && Object.keys(insights.goalsProgress).length > 0 && (
          <div className="pt-3 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-accent" />
              <p className="text-caption font-semibold text-foreground">Goals Progress</p>
            </div>
            <div className="space-y-2">
              {Object.entries(insights.goalsProgress).map(([key, value]: [string, any]) => (
                <div key={key} className="flex items-center justify-between">
                  <p className="text-caption text-muted-foreground">{key}</p>
                  <p className="text-caption font-medium text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {insights.recommendations && insights.recommendations.length > 0 && (
          <div className="pt-3 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-warning" />
              <p className="text-caption font-semibold text-foreground">Recommendations</p>
            </div>
            <ul className="space-y-2">
              {insights.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-caption text-primary mt-0.5">•</span>
                  <p className="text-caption text-muted-foreground flex-1">{rec}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Bedtime Recommendation */}
        {insights.bedtimeRecommendation && (
          <div className="pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-purple-500" />
              <p className="text-caption text-muted-foreground">
                <span className="font-semibold text-foreground">Bedtime:</span> {insights.bedtimeRecommendation}
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
