import { useState, useEffect } from 'react'
import { useToast } from "@/hooks/use-toast"
import { useAppStore } from "@/store/useAppStore"
import { MovementCategory, getMovementsByCategory, Movement } from '../types'
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { Chip } from "@/components/swift/chip"
import { SegmentedControl, Segment } from "@/components/swift/segmented-control"
import { StatBadge } from "@/components/swift/stat-badge"
import { Sheet } from "@/components/swift/sheet"
import { Field } from "@/components/swift/field"
import { fadeIn, slideUp } from "@/lib/motion-variants"
import { motion } from "framer-motion"
import { Trophy, TrendingUp, Calendar, Target, Dumbbell, Plus, Award, BarChart3 } from "lucide-react"

// Category tab options
const categoryOptions = [
  { value: MovementCategory.POWERLIFTING, label: "Power" },
  { value: MovementCategory.OLYMPIC_WEIGHTLIFTING, label: "Olympic" },
  { value: MovementCategory.GYMNASTICS, label: "Gym" },
  { value: MovementCategory.AEROBIC, label: "Cardio" },
  { value: MovementCategory.BODYBUILDING, label: "BB" }
]

// Unit options
const unitOptions = [
  { value: "lbs", label: "lbs" },
  { value: "kg", label: "kg" }
] as const

export default function PRs() {
  const { prs: personalRecords, getPRsByCategory, addPR } = useAppStore()
  const { toast } = useToast()
  const [activeCategory, setActiveCategory] = useState<MovementCategory>(MovementCategory.POWERLIFTING)
  const [showAddPRSheet, setShowAddPRSheet] = useState(false)
  const [selectedMovement, setSelectedMovement] = useState<Movement | undefined>()
  const [customMovement, setCustomMovement] = useState("")
  const [unit, setUnit] = useState<"lbs" | "kg">("lbs")
  const [value, setValue] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  
  // Simulate loading state for better UX
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  // Calculate stats
  const totalPRs = personalRecords.length
  const thisMonth = new Date()
  thisMonth.setDate(1)
  const recentPRs = personalRecords.filter(pr => {
    const prDate = pr.date instanceof Date ? pr.date : new Date(pr.date)
    return prDate >= thisMonth
  }).length
  const categoryPRs = getPRsByCategory(activeCategory).length

  const handleAddPR = (movement?: Movement) => {
    setSelectedMovement(movement)
    setCustomMovement("")
    setValue("")
    setShowAddPRSheet(true)
  }

  const handleSubmitPR = async () => {
    const movementName = selectedMovement || customMovement
    if (!movementName || !value) {
      toast({
        title: "Missing Information",
        description: "Please select or enter a movement and value.",
        variant: "destructive"
      })
      return
    }

    try {
      await addPR({
        movement: movementName as Movement,
        category: activeCategory,
        value: parseFloat(value),
        unit,
        date: new Date()
      })

      toast({
        title: "PR Added! 🎉",
        description: `New ${movementName} PR: ${value}${unit}`,
      })

      setShowAddPRSheet(false)
      setSelectedMovement(undefined)
      setCustomMovement("")
      setValue("")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add PR. Please try again.",
        variant: "destructive"
      })
    }
  }

  // Get movements and PRs for current category
  const movements = getMovementsByCategory(activeCategory)
  const categoryPersonalRecords = getPRsByCategory(activeCategory)

  if (isLoading) {
    return (
      <motion.div 
        className="space-y-6"
        variants={fadeIn}
        initial="initial"
        animate="animate"
      >
        <div className="space-y-4">
          <div className="h-8 bg-muted rounded-2xl w-48 animate-pulse" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-10 bg-muted rounded-2xl animate-pulse" />
          <div className="grid gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div 
      className="space-y-6"
      variants={fadeIn}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-heading font-bold text-foreground">Personal Records</h1>
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-primary" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatBadge
          icon={<Trophy className="w-4 h-4" />}
          value={totalPRs.toString()}
          label="Total PRs"
          data-testid="total-prs"
        />
        <StatBadge
          icon={<TrendingUp className="w-4 h-4" />}
          value={recentPRs.toString()}
          label="This Month"
          data-testid="recent-prs"
        />
        <StatBadge
          icon={<BarChart3 className="w-4 h-4" />}
          value={categoryPRs.toString()}
          label={categoryOptions.find(c => c.value === activeCategory)?.label || "Current"}
          data-testid="category-prs"
        />
      </div>

      {/* Filter Controls */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-body font-medium text-foreground">Category</label>
          <SegmentedControl
            value={activeCategory}
            onValueChange={(value) => setActiveCategory(value as MovementCategory)}
            data-testid="category-tabs"
          >
            {categoryOptions.map((option) => (
              <Segment key={option.value} value={option.value}>
                {option.label}
              </Segment>
            ))}
          </SegmentedControl>
        </div>

        <div className="space-y-2">
          <label className="text-body font-medium text-foreground">Units</label>
          <SegmentedControl
            value={unit}
            onValueChange={(value) => setUnit(value as "lbs" | "kg")}
            data-testid="unit-switch"
          >
            {unitOptions.map((option) => (
              <Segment key={option.value} value={option.value}>
                {option.label}
              </Segment>
            ))}
          </SegmentedControl>
        </div>
      </div>

      {/* Movements Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-subheading font-semibold text-foreground">
            {activeCategory} Movements
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleAddPR()}
            data-testid="add-custom-pr"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add PR
          </Button>
        </div>

        {movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
              <Target className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-subheading font-bold text-foreground">No movements available</h3>
              <p className="text-body text-muted-foreground max-w-sm">
                This category doesn't have movements defined yet
              </p>
            </div>
            <Button onClick={() => handleAddPR()} data-testid="add-first-movement">
              Add Custom PR
            </Button>
          </div>
        ) : (
          <div className="grid gap-4" data-testid="movements-grid">
            {movements.map((movement) => {
              const currentPR = categoryPersonalRecords.find(pr => 
                (pr.movement || pr.exercise) === movement
              )
              
              return (
                <Card 
                  key={movement} 
                  className="p-5"
                  data-testid={`movement-${movement.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-body font-semibold text-foreground">{movement}</h3>
                      {currentPR ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Chip variant="success" size="sm">
                            <Award className="w-3 h-3 mr-1" />
                            {currentPR.value || currentPR.weight} {currentPR.unit || 'lbs'}
                          </Chip>
                          <span className="text-caption text-muted-foreground">
                            {new Date(currentPR.date).toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <p className="text-caption text-muted-foreground mt-1">No PR set</p>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleAddPR(movement)}
                      data-testid={`add-pr-${movement.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Empty State */}
      {totalPRs === 0 && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
            <Trophy className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-subheading font-bold text-foreground">No personal records yet</h3>
            <p className="text-body text-muted-foreground max-w-sm">
              Start tracking your PRs to monitor your strength gains
            </p>
          </div>
          <Button onClick={() => handleAddPR()} data-testid="add-first-pr">
            Add First PR
          </Button>
        </div>
      )}

      {/* Add PR Sheet */}
      <Sheet 
        open={showAddPRSheet} 
        onOpenChange={setShowAddPRSheet}
        data-testid="add-pr-sheet"
      >
        <div className="p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-subheading font-bold text-foreground">Add Personal Record</h2>
            <p className="text-body text-muted-foreground">Set a new PR for your training</p>
          </div>

          <div className="space-y-4">
            {/* Movement Picker */}
            <div className="space-y-2">
              <label className="text-body font-medium text-foreground">Movement</label>
              <div className="space-y-2">
                {selectedMovement ? (
                  <div className="space-y-2">
                    <Chip variant="default">
                      {selectedMovement}
                    </Chip>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => setSelectedMovement(undefined)}
                    >
                      Change Movement
                    </Button>
                  </div>
                ) : customMovement ? (
                  <div className="space-y-2">
                    <Chip variant="default">
                      {customMovement}
                    </Chip>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => setCustomMovement("")}
                    >
                      Change Movement
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {movements.length > 0 && (
                      <div className="grid gap-2 max-h-32 overflow-y-auto">
                        {movements.map((movement) => (
                          <Chip
                            key={movement}
                            variant="default"
                            onClick={() => setSelectedMovement(movement)}
                            data-testid={`select-movement-${movement.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            {movement}
                          </Chip>
                        ))}
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Field
                        label="Or enter custom movement"
                        value={customMovement}
                        onChange={setCustomMovement}
                        placeholder="Enter movement name"
                        data-testid="custom-movement-input"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Value Input */}
            <Field
              label="Value"
              value={value}
              onChange={setValue}
              placeholder="Enter weight or time"
              type="number"
              data-testid="pr-value-input"
            />

            {/* Unit Selection */}
            <div className="space-y-2">
              <label className="text-body font-medium text-foreground">Unit</label>
              <SegmentedControl
                value={unit}
                onValueChange={(value) => setUnit(value as "lbs" | "kg")}
                data-testid="pr-unit-selector"
              >
                {unitOptions.map((option) => (
                  <Segment key={option.value} value={option.value}>
                    {option.label}
                  </Segment>
                ))}
              </SegmentedControl>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={handleSubmitPR}
              disabled={(!selectedMovement && !customMovement) || !value}
              data-testid="submit-pr-button"
            >
              Add PR
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setShowAddPRSheet(false)}
              data-testid="cancel-pr-button"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Sheet>
    </motion.div>
  )
}
