import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { useAppStore } from "@/store/useAppStore"
import { Trophy, TrendingUp, Calendar } from "lucide-react"

export default function PRs() {
  const { prs: personalRecords } = useAppStore()

  // Debug readout
  console.log('PRs Page State:', { 
    totalPRs: personalRecords.length,
    exerciseTypes: Array.from(new Set(personalRecords.map(pr => pr.exercise))),
    recentPRs: personalRecords.slice(0, 3).map(pr => ({ exercise: pr.exercise, weight: pr.weight, date: pr.date }))
  })

  const groupedPRs = personalRecords.reduce((acc, pr) => {
    if (!acc[pr.exercise]) {
      acc[pr.exercise] = []
    }
    acc[pr.exercise].push(pr)
    return acc
  }, {} as Record<string, typeof personalRecords>)

  return (
    <>
      <SectionTitle title="Personal Records" />

      {/* PR Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 card-shadow border border-border text-center" data-testid="total-prs">
          <Trophy className="w-6 h-6 text-destructive mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{personalRecords.length}</p>
          <p className="text-xs text-muted-foreground">Total PRs</p>
        </Card>
        
        <Card className="p-4 card-shadow border border-border text-center" data-testid="recent-prs">
          <TrendingUp className="w-6 h-6 text-chart-2 mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">2</p>
          <p className="text-xs text-muted-foreground">This Month</p>
        </Card>
      </div>

      {/* PR Categories */}
      <div className="space-y-6">
        {Object.entries(groupedPRs).map(([exercise, prs]) => (
          <div key={exercise} className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">{exercise}</h3>
            
            {prs.map((pr, index) => (
              <Card key={pr.id} className="p-4 card-shadow border border-border" data-testid={`pr-${pr.id}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      index === 0 ? 'bg-chart-1' : 
                      index === 1 ? 'bg-chart-2' : 'bg-chart-3'
                    }`} />
                    <div>
                      <p className="font-semibold text-foreground">{pr.weight} lbs</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{pr.date.toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                  {index === 0 && (
                    <div className="bg-destructive text-destructive-foreground px-2 py-1 rounded-lg text-xs font-medium">
                      Current PR
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ))}
      </div>

      {personalRecords.length === 0 && (
        <div className="text-center space-y-4 py-12">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold text-foreground">No PRs yet</h3>
          <p className="text-muted-foreground">Complete workouts to set your first personal record!</p>
        </div>
      )}
    </>
  )
}
