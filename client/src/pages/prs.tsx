import { useState } from 'react'
import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trophy, TrendingUp, Calendar, Target, Dumbbell } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"
import { MovementCategory, getMovementsByCategory, Movement } from '../types'
import { MovementCard } from '@/components/common/movement-card'
import { AddPRModal } from '@/components/common/add-pr-modal'

export default function PRs() {
  const { prs: personalRecords, getPRsByCategory } = useAppStore()
  const [activeTab, setActiveTab] = useState<MovementCategory>(MovementCategory.POWERLIFTING)
  const [isAddPRModalOpen, setIsAddPRModalOpen] = useState(false)
  const [selectedMovement, setSelectedMovement] = useState<Movement | undefined>()
  const [selectedCategory, setSelectedCategory] = useState<MovementCategory | undefined>()

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
    const movements = getMovementsByCategory(category)
    
    if (movements.length === 0) {
      return (
        <div className="text-center py-12">
          <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No movements available</h3>
          <p className="text-muted-foreground">This category doesn't have movements defined yet.</p>
        </div>
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
        <Card className="p-4 card-shadow border border-border text-center" data-testid="total-prs">
          <Trophy className="w-6 h-6 text-destructive mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{totalPRs}</p>
          <p className="text-xs text-muted-foreground">Total PRs</p>
        </Card>
        
        <Card className="p-4 card-shadow border border-border text-center" data-testid="recent-prs">
          <TrendingUp className="w-6 h-6 text-chart-2 mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{recentPRs}</p>
          <p className="text-xs text-muted-foreground">This Month</p>
        </Card>

        <Card className="p-4 card-shadow border border-border text-center" data-testid="category-prs">
          <Dumbbell className="w-6 h-6 text-chart-3 mx-auto mb-2" />
          <p className="text-lg font-bold text-foreground">{getPRsByCategory(activeTab).length}</p>
          <p className="text-xs text-muted-foreground">{activeTab} PRs</p>
        </Card>
      </div>

      {/* Tabbed Movement Categories */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MovementCategory)}>
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
      {totalPRs === 0 && (
        <div className="text-center space-y-4 py-12">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold text-foreground">No PRs yet</h3>
          <p className="text-muted-foreground">
            Start tracking your personal records by selecting a movement and adding your first PR!
          </p>
        </div>
      )}
    </>
  )
}
