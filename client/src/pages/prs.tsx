import { useState, useEffect } from 'react'
import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoadingState, LoadingSkeleton } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import { useToast } from "@/hooks/use-toast"
import { Trophy, TrendingUp, Calendar, Target, Dumbbell, Plus } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"
import { MovementCategory, getMovementsByCategory, Movement } from '../types'
import { MovementCard } from '@/components/common/movement-card'
import { AddPRModal } from '@/components/common/add-pr-modal'

export default function PRs() {
  const { prs: personalRecords, getPRsByCategory } = useAppStore()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<MovementCategory>(MovementCategory.POWERLIFTING)
  const [isAddPRModalOpen, setIsAddPRModalOpen] = useState(false)
  const [selectedMovement, setSelectedMovement] = useState<Movement | undefined>()
  const [selectedCategory, setSelectedCategory] = useState<MovementCategory | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  
  // Simulate loading state for better UX
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 700)
    return () => clearTimeout(timer)
  }, [])

  // Calculate stats
  const totalPRs = personalRecords.length
  const thisMonth = new Date()
  thisMonth.setDate(1)
  const recentPRs = personalRecords.filter(pr => pr.date >= thisMonth).length

  // Debug readout
  console.log('Enhanced PRs Page State:', { 
    totalPRs: personalRecords.length,
    byCategory: Object.values(MovementCategory).map(cat => ({
      category: cat,
      count: getPRsByCategory(cat).length
    })),
    recentPRs: personalRecords.slice(0, 3).map(pr => ({ 
      movement: pr.movement || pr.exercise, 
      value: pr.value || pr.weight, 
      unit: pr.unit || 'lbs',
      date: pr.date 
    }))
  })

  const handleAddPR = (movement: Movement, category: MovementCategory) => {
    setSelectedMovement(movement)
    setSelectedCategory(category)
    setIsAddPRModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsAddPRModalOpen(false)
    setSelectedMovement(undefined)
    setSelectedCategory(undefined)
  }

  const renderMovementsForCategory = (category: MovementCategory) => {
    if (isLoading) {
      return (
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 card-shadow border border-border">
              <LoadingSkeleton rows={3} />
            </Card>
          ))}
        </div>
      )
    }
    
    const movements = getMovementsByCategory(category)
    
    if (movements.length === 0) {
      return (
        <EmptyState
          icon={Target}
          title="No movements available"
          description={`This ${category} category doesn't have movements defined yet. Check back soon for updates!`}
          actionLabel="Add Custom PR"
          onAction={() => {
            setSelectedMovement(undefined)
            setSelectedCategory(category)
            setIsAddPRModalOpen(true)
          }}
        />
      )
    }

    return (
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {movements.map((movement) => (
          <MovementCard
            key={movement}
            movement={movement}
            category={category}
            onAddPR={handleAddPR}
          />
        ))}
      </div>
    )
  }

  return (
    <>
      <SectionTitle title="Personal Records" />

      {/* PR Stats Overview */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4 card-shadow border border-border text-center card-gradient" data-testid="total-prs">
          {isLoading ? (
            <LoadingSkeleton rows={1} />
          ) : (
            <>
              <Trophy className="w-6 h-6 text-destructive mx-auto mb-2" />
              <p className="text-lg font-bold text-foreground">{totalPRs}</p>
              <p className="text-xs text-muted-foreground">Total PRs</p>
            </>
          )}
        </Card>
        
        <Card className="p-4 card-shadow border border-border text-center card-gradient" data-testid="recent-prs">
          {isLoading ? (
            <LoadingSkeleton rows={1} />
          ) : (
            <>
              <TrendingUp className="w-6 h-6 text-chart-2 mx-auto mb-2" />
              <p className="text-lg font-bold text-foreground">{recentPRs}</p>
              <p className="text-xs text-muted-foreground">This Month</p>
            </>
          )}
        </Card>

        <Card className="p-4 card-shadow border border-border text-center card-gradient" data-testid="category-prs">
          {isLoading ? (
            <LoadingSkeleton rows={1} />
          ) : (
            <>
              <Dumbbell className="w-6 h-6 text-chart-3 mx-auto mb-2" />
              <p className="text-lg font-bold text-foreground">{getPRsByCategory(activeTab).length}</p>
              <p className="text-xs text-muted-foreground">{activeTab} PRs</p>
            </>
          )}
        </Card>
      </div>

      {/* Tabbed Movement Categories */}
      <Tabs value={activeTab} onValueChange={(value) => {
        try {
          setActiveTab(value as MovementCategory)
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to switch category. Please try again.",
            variant: "destructive"
          })
        }
      }}>
        <TabsList className="grid w-full grid-cols-5" data-testid="tabs-movement-categories">
          <TabsTrigger value={MovementCategory.POWERLIFTING} data-testid="tab-powerlifting">
            Powerlifting
          </TabsTrigger>
          <TabsTrigger value={MovementCategory.OLYMPIC_WEIGHTLIFTING} data-testid="tab-olympic">
            Olympic
          </TabsTrigger>
          <TabsTrigger value={MovementCategory.GYMNASTICS} data-testid="tab-gymnastics">
            Gymnastics
          </TabsTrigger>
          <TabsTrigger value={MovementCategory.AEROBIC} data-testid="tab-aerobic">
            Aerobic
          </TabsTrigger>
          <TabsTrigger value={MovementCategory.BODYBUILDING} data-testid="tab-bodybuilding">
            Bodybuilding
          </TabsTrigger>
        </TabsList>

        <TabsContent value={MovementCategory.POWERLIFTING} className="mt-6" data-testid="content-powerlifting">
          {renderMovementsForCategory(MovementCategory.POWERLIFTING)}
        </TabsContent>

        <TabsContent value={MovementCategory.OLYMPIC_WEIGHTLIFTING} className="mt-6" data-testid="content-olympic">
          {renderMovementsForCategory(MovementCategory.OLYMPIC_WEIGHTLIFTING)}
        </TabsContent>

        <TabsContent value={MovementCategory.GYMNASTICS} className="mt-6" data-testid="content-gymnastics">
          {renderMovementsForCategory(MovementCategory.GYMNASTICS)}
        </TabsContent>

        <TabsContent value={MovementCategory.AEROBIC} className="mt-6" data-testid="content-aerobic">
          {renderMovementsForCategory(MovementCategory.AEROBIC)}
        </TabsContent>

        <TabsContent value={MovementCategory.BODYBUILDING} className="mt-6" data-testid="content-bodybuilding">
          {renderMovementsForCategory(MovementCategory.BODYBUILDING)}
        </TabsContent>
      </Tabs>

      {/* Add PR Modal */}
      <AddPRModal
        isOpen={isAddPRModalOpen}
        onClose={handleCloseModal}
        preselectedMovement={selectedMovement}
        preselectedCategory={selectedCategory}
      />

      {/* Empty State (shown when no PRs at all) */}
      {!isLoading && totalPRs === 0 && (
        <EmptyState
          icon={Trophy}
          title="No personal records yet"
          description="Start tracking your personal records to monitor your strength gains and celebrate your achievements!"
          actionLabel="Add First PR"
          onAction={() => {
            setSelectedMovement(undefined)
            setSelectedCategory(MovementCategory.POWERLIFTING)
            setIsAddPRModalOpen(true)
          }}
          className="my-12"
        />
      )}
    </>
  )
}
