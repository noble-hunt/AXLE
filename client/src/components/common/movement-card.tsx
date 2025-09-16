import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Trophy, Calendar } from 'lucide-react'
import { Movement, RepMaxType, Unit, MovementCategory, PR, getDefaultUnitForMovement, shouldShowRepMaxForMovement } from '../../types'
import { PRProgressChart } from './pr-progress-chart'
import { useAppStore } from '@/store/useAppStore'
import { format } from 'date-fns'

interface MovementCardProps {
  movement: Movement
  category: MovementCategory
  onAddPR: (movement: Movement, category: MovementCategory) => void
}

export function MovementCard({ movement, category, onAddPR }: MovementCardProps) {
  const { getPRsByMovement, getBestPRByMovement } = useAppStore()
  
  const movementPRs = getPRsByMovement(movement)
  const defaultUnit = getDefaultUnitForMovement(movement)
  const showRepMax = shouldShowRepMaxForMovement(movement)
  
  // Get best PRs for different rep maxes if applicable
  const bestPRs = showRepMax 
    ? Object.values(RepMaxType).reduce((acc, repMax) => {
        const pr = getBestPRByMovement(movement, repMax)
        if (pr) acc[repMax] = pr
        return acc
      }, {} as Record<RepMaxType, PR>)
    : { 'BEST': getBestPRByMovement(movement) }

  const formatValue = (value: number | string | undefined, unit: Unit) => {
    if (value === undefined || value === null) return 'N/A'
    
    if (unit === Unit.TIME && typeof value === 'string') {
      return value
    }
    
    if (typeof value === 'number') {
      if (unit === Unit.HEIGHT_INCHES || unit === Unit.HEIGHT_CM) {
        return `${value}" ${unit === Unit.HEIGHT_INCHES ? 'inches' : 'cm'}`
      }
      return `${value} ${unit}`
    }
    
    return `${value} ${unit}`
  }

  const hasPRs = movementPRs.length > 0

  return (
    <Card className="w-full card-shadow border border-border" data-testid={`movement-card-${movement.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{movement}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddPR(movement, category)}
            className="h-8 px-2"
            data-testid={`button-add-pr-${movement.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add PR
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {hasPRs ? (
          <>
            {/* Current PRs Section */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Current PRs</h4>
              <div className="grid gap-2">
                {Object.entries(bestPRs).map(([repMaxKey, pr]) => {
                  if (!pr) return null
                  
                  return (
                    <div
                      key={repMaxKey}
                      className="flex items-center justify-between p-2 bg-muted rounded-lg"
                      data-testid={`current-pr-${repMaxKey.toLowerCase()}`}
                    >
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-destructive" />
                        <div>
                          <p className="font-semibold text-sm">
                            {formatValue(pr.value, pr.unit || defaultUnit)}
                          </p>
                          {showRepMax && pr.repMax && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              {pr.repMax}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>{format(pr.date, 'MMM dd')}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Progress Charts */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Progress</h4>
              {showRepMax ? (
                // Show charts for each rep max type that has data
                Object.values(RepMaxType).map((repMax) => {
                  const repMaxPRs = movementPRs.filter(pr => pr.repMax === repMax)
                  if (repMaxPRs.length === 0) return null
                  
                  return (
                    <PRProgressChart
                      key={`${movement}-${repMax}`}
                      movement={movement}
                      prs={movementPRs}
                      repMax={repMax}
                      unit={repMaxPRs[0].unit || defaultUnit}
                    />
                  )
                })
              ) : (
                // Show single chart for non-weight based movements
                <PRProgressChart
                  movement={movement}
                  prs={movementPRs}
                  unit={movementPRs[0].unit || defaultUnit}
                />
              )}
            </div>
          </>
        ) : (
          // Empty state
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <h4 className="text-sm font-medium mb-1">No PRs recorded</h4>
            <p className="text-xs">Set your first personal record for this movement!</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}