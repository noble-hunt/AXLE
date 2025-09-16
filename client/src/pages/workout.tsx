import { SectionTitle } from "@/components/ui/section-title"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Card } from "@/components/ui/card"
import { Play, Plus, Timer, Dumbbell } from "lucide-react"

export default function Workout() {
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
      <PrimaryButton icon={<Plus className="w-5 h-5" />}>
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
            <button className="bg-primary text-primary-foreground p-2 rounded-xl" data-testid="start-template">
              <Play className="w-4 h-4" />
            </button>
          </div>
        </Card>
      </div>
    </>
  )
}
