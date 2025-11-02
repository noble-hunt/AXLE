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
import { Trophy, TrendingUp, Calendar as CalendarIcon, Target, Dumbbell, Plus, Award, BarChart3, Star } from "lucide-react"
import { MovementCard } from "@/components/common/movement-card"
import { celebratePR, celebrateFirstPR } from "@/lib/confetti"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

// Special category type for "All" and "Favorites"
type CategoryType = 'ALL' | 'FAVORITES' | MovementCategory

// Category tab options with All and Favorites
const categoryOptions: { value: CategoryType; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'FAVORITES', label: 'Favorites' },
  { value: MovementCategory.POWERLIFTING, label: 'Powerlifting' },
  { value: MovementCategory.OLYMPIC_WEIGHTLIFTING, label: 'Olympic Lifting' },
  { value: MovementCategory.GYMNASTICS, label: 'Gymnastics' },
  { value: MovementCategory.AEROBIC, label: 'Cardio' },
  { value: MovementCategory.BODYBUILDING, label: 'Bodybuilding' },
  { value: MovementCategory.OTHER, label: 'Other' }
]

// Unit options
const unitOptions = [
  { value: "lbs", label: "lbs" },
  { value: "kg", label: "kg" }
] as const

export default function PRs() {
  const { prs: personalRecords, getPRsByCategory, addPR, profile } = useAppStore()
  const { toast } = useToast()
  const [activeCategory, setActiveCategory] = useState<CategoryType>('ALL')
  const [showAddPRSheet, setShowAddPRSheet] = useState(false)
  const [selectedMovement, setSelectedMovement] = useState<Movement | undefined>()
  const [customMovement, setCustomMovement] = useState("")
  const [value, setValue] = useState("")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [isLoading, setIsLoading] = useState(true)
  
  // Get user's preferred unit from profile (default to 'lbs' if not set)
  const unit = profile?.preferredUnit || 'lbs'
  
  // Get favorite movements from profile
  const favoriteMovements = profile?.favoriteMovements || []
  
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
  
  // Calculate category PRs based on activeCategory
  const categoryPRs = activeCategory === 'ALL' 
    ? totalPRs 
    : activeCategory === 'FAVORITES'
    ? favoriteMovements.length
    : getPRsByCategory(activeCategory).length

  const handleAddPR = (movement?: Movement, category?: MovementCategory) => {
    setSelectedMovement(movement)
    setCustomMovement("")
    setValue("")
    setSelectedDate(new Date())
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
      // Check if this is the first PR for this movement
      const existingPRsForMovement = personalRecords.filter(
        pr => pr.movement === movementName
      )
      const isFirstPR = existingPRsForMovement.length === 0

      // Determine category - if on Favorites or All, try to infer from movement, otherwise use active category
      const prCategory = activeCategory !== 'ALL' && activeCategory !== 'FAVORITES'
        ? activeCategory
        : MovementCategory.OTHER // Default to Other for custom movements
      
      await addPR({
        movement: movementName as Movement,
        category: prCategory,
        value: parseFloat(value),
        unit,
        date: selectedDate
      })

      // Trigger confetti animation!
      if (isFirstPR) {
        celebrateFirstPR()
      } else {
        celebratePR()
      }

      // Show congratulatory toast
      const messages = [
        "Crushing it! 💪",
        "Beast mode activated! 🔥",
        "New record unlocked! 🏆",
        "Strength gains! 💯",
        "You're unstoppable! ⚡"
      ]
      const randomMessage = messages[Math.floor(Math.random() * messages.length)]

      toast({
        title: randomMessage,
        description: isFirstPR 
          ? `First ${movementName} PR recorded: ${value}${unit}!`
          : `New ${movementName} PR: ${value}${unit}`,
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

  // Get all predefined movements
  const allPredefinedMovements = [
    ...Object.values(MovementCategory)
      .filter(cat => cat !== MovementCategory.OTHER) // Exclude "Other" category
      .flatMap(cat => getMovementsByCategory(cat))
  ]
  
  // Get custom movements (movements that exist in PRs but aren't in predefined lists)
  const customMovements = personalRecords
    .map(pr => pr.movement)
    .filter(movement => !allPredefinedMovements.includes(movement as Movement))
    .filter((movement, index, self) => self.indexOf(movement) === index) as Movement[] // Remove duplicates
  
  // Get movements and PRs for current category
  const movements = activeCategory === 'ALL'
    ? [...allPredefinedMovements, ...customMovements]
    : activeCategory === 'FAVORITES'
    ? favoriteMovements as Movement[]
    : activeCategory === MovementCategory.OTHER
    ? customMovements
    : getMovementsByCategory(activeCategory)
  
  const categoryPersonalRecords = activeCategory === 'ALL'
    ? personalRecords
    : activeCategory === 'FAVORITES'
    ? personalRecords.filter(pr => favoriteMovements.includes(pr.movement as string))
    : activeCategory === MovementCategory.OTHER
    ? personalRecords.filter(pr => customMovements.includes(pr.movement as Movement))
    : getPRsByCategory(activeCategory)

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

      {/* Filter Controls - Multi-row Pills */}
      <div className="space-y-2">
        <label className="text-body font-medium text-foreground">Category</label>
        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setActiveCategory(option.value)}
              className={cn(
                "px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200",
                activeCategory === option.value
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              data-testid={`category-${option.value.toLowerCase()}`}
            >
              {option.value === 'FAVORITES' && (
                <Star className="w-4 h-4 inline-block mr-1 -mt-0.5" />
              )}
              {option.label}
            </button>
          ))}
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
            {movements.map((movement) => (
              <MovementCard
                key={movement}
                movement={movement}
                category={activeCategory}
                onAddPR={handleAddPR}
              />
            ))}
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
                        onChange={(e) => setCustomMovement(e.target.value)}
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
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter weight or time"
              type="number"
              data-testid="pr-value-input"
            />

            {/* Date Picker */}
            <div className="space-y-2">
              <label className="text-body font-medium text-foreground">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="secondary"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                    data-testid="date-picker-trigger"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    data-testid="date-picker-calendar"
                  />
                </PopoverContent>
              </Popover>
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
