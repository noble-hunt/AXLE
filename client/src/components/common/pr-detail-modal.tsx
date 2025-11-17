import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, TrendingUp, Calculator } from 'lucide-react'
import { Movement, RepMaxType, Unit, MovementCategory, PR, isWeightBasedMovement } from '../../types'
import { PRProgressChart } from './pr-progress-chart'

// Helper to convert numeric rep max to RepMaxType enum
const mapRepMaxToEnum = (repMax: number | string | undefined): RepMaxType | undefined => {
  if (!repMax) return undefined
  
  // If it's already a RepMaxType string enum, return it
  if (Object.values(RepMaxType).includes(repMax as RepMaxType)) {
    return repMax as RepMaxType
  }
  
  // Otherwise, try to parse it as a number and map to enum
  const num = typeof repMax === 'number' ? repMax : parseInt(String(repMax))
  switch (num) {
    case 1: return RepMaxType.ONE_RM
    case 3: return RepMaxType.THREE_RM
    case 5: return RepMaxType.FIVE_RM
    case 10: return RepMaxType.TEN_RM
    case 20: return RepMaxType.TWENTY_RM
    default: return undefined
  }
}

interface PRDetailModalProps {
  movement: Movement
  category: MovementCategory
  prs: PR[]
  unit: Unit
  showRepMax: boolean
  isOpen: boolean
  onClose: () => void
}

// Epley Formula: Weight × (1 + Reps/30)
// This calculates theoretical 1RM from a known rep max
const calculateEpley = (weight: number, reps: number): number => {
  return weight * (1 + reps / 30)
}

// Reverse Epley: Calculate weight for target reps from 1RM
// TargetRepWeight = 1RM / (1 + TargetReps/30)
const calculateReverseEpley = (oneRM: number, targetReps: number): number => {
  return oneRM / (1 + targetReps / 30)
}

// Get the rep count from RepMaxType
const getRepCountFromType = (repMaxType: RepMaxType): number => {
  switch (repMaxType) {
    case RepMaxType.ONE_RM: return 1
    case RepMaxType.THREE_RM: return 3
    case RepMaxType.FIVE_RM: return 5
    case RepMaxType.TEN_RM: return 10
    case RepMaxType.TWENTY_RM: return 20
    default: return 1
  }
}

export function PRDetailModal({ movement, category, prs, unit, showRepMax, isOpen, onClose }: PRDetailModalProps) {
  const isWeightBased = isWeightBasedMovement(movement)

  // Debug logging
  console.log('🔍 PR Detail Modal Debug:', {
    movement,
    isWeightBased,
    showRepMax,
    prsCount: prs.length,
    prs: prs.map(pr => ({
      value: pr.value,
      repMax: pr.repMax,
      repMaxType: typeof pr.repMax,
      date: pr.date
    }))
  })

  // Get current PRs for each rep max type
  const currentPRs: Map<RepMaxType, PR> = new Map()
  
  if (showRepMax && isWeightBased) {
    prs.forEach(pr => {
      const repMaxType = mapRepMaxToEnum(pr.repMax)
      console.log('  🔄 Mapping PR:', {
        original: pr.repMax,
        type: typeof pr.repMax,
        mapped: repMaxType,
        value: pr.value
      })
      if (repMaxType) {
        // Get the best (highest) PR for each rep max type
        const existing = currentPRs.get(repMaxType)
        if (!existing || (typeof pr.value === 'number' && typeof existing.value === 'number' && pr.value > existing.value)) {
          currentPRs.set(repMaxType, pr)
        }
      }
    })
  }

  console.log('  📊 Current PRs Map:', Array.from(currentPRs.entries()).map(([type, pr]) => ({
    type,
    value: pr.value
  })))

  // Calculate theoretical 1RM from all available PRs
  const calculate1RM = (): number | null => {
    if (currentPRs.size === 0) return null
    
    const oneRMPR = currentPRs.get(RepMaxType.ONE_RM)
    if (oneRMPR && typeof oneRMPR.value === 'number') {
      return oneRMPR.value
    }
    
    // Calculate from other rep maxes and take the highest
    let highest1RM = 0
    currentPRs.forEach((pr, repMaxType) => {
      if (typeof pr.value === 'number') {
        const reps = getRepCountFromType(repMaxType)
        const calculated1RM = calculateEpley(pr.value, reps)
        if (calculated1RM > highest1RM) {
          highest1RM = calculated1RM
        }
      }
    })
    
    return highest1RM > 0 ? highest1RM : null
  }

  const theoretical1RM = calculate1RM()

  // Generate projections for all rep max types
  const repMaxTypes = [
    RepMaxType.ONE_RM,
    RepMaxType.THREE_RM,
    RepMaxType.FIVE_RM,
    RepMaxType.TEN_RM,
    RepMaxType.TWENTY_RM
  ]

  const projections = repMaxTypes.map(repMaxType => {
    const actualPR = currentPRs.get(repMaxType)
    const reps = getRepCountFromType(repMaxType)
    
    let projectedValue: number | null = null
    let isActual = false
    
    if (actualPR && typeof actualPR.value === 'number') {
      // Use actual PR
      projectedValue = actualPR.value
      isActual = true
    } else if (theoretical1RM) {
      // Calculate from theoretical 1RM
      if (repMaxType === RepMaxType.ONE_RM) {
        projectedValue = theoretical1RM
      } else {
        projectedValue = calculateReverseEpley(theoretical1RM, reps)
      }
    }
    
    return {
      repMaxType,
      reps,
      value: projectedValue,
      isActual,
      label: repMaxType.replace('_', '')
    }
  })

  const formatValue = (value: number | null): string => {
    if (value === null) return 'N/A'
    return Math.round(value).toString()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-destructive" />
            {movement}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Larger Progress Chart */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Progress Over Time
            </h4>
            {/* Larger chart - 300px height instead of 150px */}
            <PRProgressChart
              movement={movement}
              prs={prs}
              unit={unit}
              showRepMaxVariants={showRepMax}
              height={300}
              showCard={false}
            />
          </div>

          {/* PR Projections - Only for weight-based movements */}
          {isWeightBased && showRepMax && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  PR Projections
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Based on Epley Formula
                  {theoretical1RM && ` (Est. 1RM: ${Math.round(theoretical1RM)} ${unit})`}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {projections.map(({ repMaxType, reps, value, isActual, label }) => (
                  <div
                    key={repMaxType}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isActual ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border'
                    }`}
                    data-testid={`projection-${label.toLowerCase()}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-background border border-border">
                        <span className="font-bold text-sm">{label}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{reps} Rep Max</p>
                        {isActual && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            Current PR
                          </Badge>
                        )}
                        {!isActual && value && (
                          <Badge variant="outline" className="text-xs mt-1">
                            Projected
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${isActual ? 'text-primary' : 'text-muted-foreground'}`}>
                        {formatValue(value)}
                        <span className="text-sm font-normal ml-1">{unit}</span>
                      </p>
                    </div>
                  </div>
                ))}
                
                {theoretical1RM === null && (
                  <div className="text-center text-sm text-muted-foreground py-4">
                    <p>Add a PR to see projections</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
