import { SectionTitle } from "@/components/ui/section-title"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Card } from "@/components/ui/card"
import { Play, Plus, Timer, Dumbbell } from "lucide-react"
import { useLocation } from "wouter"
import { useAppStore } from "@/store/useAppStore"

export default function Workout() {
  const [, setLocation] = useLocation()
  const { addWorkout } = useAppStore()

  const handleCreateWorkout = () => {
    setLocation('/generate-workout')
  }

  const handleStartTemplate = () => {
    // Create a template workout
    addWorkout({
      name: 'Upper Body Strength',
      category: 'Strength' as any,
      description: 'Upper body strength training template',
      duration: 45,
      intensity: 7,
      sets: [
        { id: 'template-1', exercise: 'Bench Press', weight: 185, reps: 10 },
        { id: 'template-2', exercise: 'Bent-Over Rows', weight: 155, reps: 10 },
        { id: 'template-3', exercise: 'Overhead Press', weight: 115, reps: 8 },
        { id: 'template-4', exercise: 'Lat Pulldowns', weight: 135, reps: 12 },
        { id: 'template-5', exercise: 'Incline Dumbbell Press', weight: 65, reps: 10 },
        { id: 'template-6', exercise: 'Barbell Curls', weight: 85, reps: 12 },
      ],
      date: new Date(),
      completed: false,
      notes: 'Template workout - Upper body strength',
    })
    setLocation('/history')
  }
  return (
    <>
      <SectionTitle title="Workouts" />

      {/* Quick Start Options */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Quick Start</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 card-shadow border border-border" data-testid="quick-start-push">
            <div className="text-center space-y-2">
              <Dumbbell className="w-8 h-8 text-primary mx-auto" />
              <h4 className="font-semibold text-foreground">Push Day</h4>
              <p className="text-xs text-muted-foreground">Chest, Shoulders, Triceps</p>
            </div>
          </Card>
          
          <Card className="p-4 card-shadow border border-border" data-testid="quick-start-pull">
            <div className="text-center space-y-2">
              <Dumbbell className="w-8 h-8 text-chart-2 mx-auto" />
              <h4 className="font-semibold text-foreground">Pull Day</h4>
              <p className="text-xs text-muted-foreground">Back, Biceps</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Create New Workout */}
      <PrimaryButton 
        icon={<Plus className="w-5 h-5" />}
        onClick={handleCreateWorkout}
        data-testid="primary-button"
      >
        Create New Workout
      </PrimaryButton>

      {/* Recent Templates */}
      <div className="space-y-4">
        <SectionTitle title="Recent Templates" />
        
        <Card className="p-4 card-shadow border border-border" data-testid="template-card">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-foreground">Upper Body Strength</h4>
              <p className="text-sm text-muted-foreground">Last used 3 days ago</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs text-muted-foreground">
                  <Timer className="w-3 h-3 inline mr-1" />
                  45 min
                </span>
                <span className="text-xs text-muted-foreground">
                  6 exercises
                </span>
              </div>
            </div>
            <button 
              className="bg-primary text-primary-foreground p-2 rounded-xl" 
              data-testid="start-template"
              onClick={handleStartTemplate}
            >
              <Play className="w-4 h-4" />
            </button>
          </div>
        </Card>
      </div>
    </>
  )
}
