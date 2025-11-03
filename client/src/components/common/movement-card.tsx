import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Trophy, Calendar, ChevronDown, ChevronUp, TrendingUp, Star } from 'lucide-react'
import { Movement, RepMaxType, Unit, MovementCategory, PR, getDefaultUnitForMovement, shouldShowRepMaxForMovement } from '../../types'
import { PRProgressChart } from './pr-progress-chart'
import { useAppStore } from '@/store/useAppStore'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { apiRequest } from '@/lib/queryClient'
import { useToast } from '@/hooks/use-toast'

interface MovementCardProps {
  movement: Movement
  category: MovementCategory
  onAddPR: (movement: Movement, category: MovementCategory) => void
}

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
    default: return undefined
  }
}

export function MovementCard({ movement, category, onAddPR }: MovementCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { getPRsByMovement, getBestPRByMovement, profile, hydrateFromDb, user } = useAppStore()
  const { toast } = useToast()
  
  const isFavorite = profile?.favoriteMovements?.includes(movement) || false
  
  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    try {
      const newFavorites = isFavorite
        ? (profile?.favoriteMovements || []).filter(m => m !== movement)
        : [...(profile?.favoriteMovements || []), movement]
      
      const result = await apiRequest('POST', '/api/profiles', {
        action: 'update',
        favoriteMovements: newFavorites
      })
      const responseData = await result.json()
      
      if (responseData.profile) {
        // Refresh profile from database to ensure we have the latest data
        if (user?.id) {
          await hydrateFromDb(user.id)
        }
        
        toast({
          title: isFavorite ? "Removed from favorites" : "Added to favorites",
          description: `${movement} ${isFavorite ? 'removed from' : 'added to'} your favorites`
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update favorites",
        variant: "destructive"
      })
    }
  }
  
  const movementPRs = getPRsByMovement(movement)
  const defaultUnit = getDefaultUnitForMovement(movement)
  const showRepMax = shouldShowRepMaxForMovement(movement)
  
  // Get the most recent PR across all rep maxes
  const mostRecentPR = movementPRs.length > 0 
    ? movementPRs.reduce((latest, pr) => {
        const latestDate = latest.date instanceof Date ? latest.date : new Date(latest.date)
        const prDate = pr.date instanceof Date ? pr.date : new Date(pr.date)
        return prDate > latestDate ? pr : latest
      })
    : null

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
    <Card 
      className="w-full card-shadow border border-border hover:border-primary/50 transition-all duration-300 cursor-pointer" 
      data-testid={`movement-card-${movement.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
      onClick={() => hasPRs && setIsExpanded(!isExpanded)}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleFavorite}
              className="h-8 w-8 p-0 hover:bg-transparent -ml-1.5"
              data-testid={`button-favorite-${movement.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
            >
              <Star 
                className={`w-5 h-5 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} 
              />
            </Button>
            <span>{movement}</span>
            {hasPRs && (
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              onAddPR(movement, category)
            }}
            className="h-8 px-2"
            data-testid={`button-add-pr-${movement.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add PR
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 min-h-[64px]">
        {hasPRs ? (
          <>
            {/* Collapsed View - Show Most Recent PR */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <Trophy className="w-5 h-5 text-destructive" />
                  <div className="min-h-[48px] flex flex-col justify-center">
                    <p className="font-bold text-lg" data-testid={`text-latest-pr-value-${movement.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}>
                      {mostRecentPR && formatValue(mostRecentPR.value, (mostRecentPR.unit as Unit) || defaultUnit)}
                    </p>
                    {showRepMax && mostRecentPR?.repMax && (
                      <Badge variant="secondary" className="text-xs">
                        {mostRecentPR.repMax}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right min-h-[48px] flex flex-col justify-center">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span data-testid={`text-latest-pr-date-${movement.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}>
                      {mostRecentPR && format(
                        mostRecentPR.date instanceof Date ? mostRecentPR.date : new Date(mostRecentPR.date), 
                        'MMM d, yyyy'
                      )}
                    </span>
                  </div>
                  {movementPRs.length > 1 && !isExpanded && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <TrendingUp className="w-3 h-3" />
                      <span>{movementPRs.length} total PRs</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded View - Show Full History & Charts */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden space-y-4"
                >
                  {/* All PRs Section */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">All Personal Records</h4>
                    <div className="grid gap-2">
                      {Object.entries(bestPRs).map(([repMaxKey, pr]) => {
                        if (!pr) return null
                        
                        return (
                          <div
                            key={repMaxKey}
                            className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border border-border"
                            data-testid={`current-pr-${repMaxKey.toLowerCase()}`}
                          >
                            <div className="flex items-center gap-2">
                              <Trophy className="w-4 h-4 text-destructive" />
                              <div>
                                <p className="font-semibold text-sm">
                                  {formatValue(pr.value, (pr.unit as Unit) || defaultUnit)}
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
                                <span>{format(
                                  pr.date instanceof Date ? pr.date : new Date(pr.date), 
                                  'MMM dd, yyyy'
                                )}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Progress Chart - Single unified chart for all PR entries */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Progress Over Time
                    </h4>
                    <PRProgressChart
                      movement={movement}
                      prs={movementPRs}
                      unit={(movementPRs[0].unit as Unit) || defaultUnit}
                      showRepMaxVariants={showRepMax}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          // Empty state - min-height ensures consistent card size
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <Trophy className="w-5 h-5 text-muted-foreground opacity-30" />
                <div className="min-h-[48px] flex flex-col justify-center">
                  <p className="font-bold text-lg text-muted-foreground">No PRs recorded</p>
                </div>
              </div>
              <div className="text-right min-h-[48px] flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Add your first PR</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
