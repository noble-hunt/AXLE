import { Card } from "@/components/ui/card"
import { Dumbbell, Zap, Activity, Target } from "lucide-react"

export interface ArchetypeStepProps {
  value: 'strength' | 'conditioning' | 'mixed' | 'endurance';
  onChange: (value: 'strength' | 'conditioning' | 'mixed' | 'endurance') => void;
}

const ARCHETYPE_OPTIONS = [
  {
    value: 'strength' as const,
    label: 'Strength',
    icon: Dumbbell,
    description: 'Build muscle strength with heavy compound movements',
    details: 'Focus on progressive overload, lower reps, and longer rest periods',
    color: 'text-blue-600 dark:text-blue-400'
  },
  {
    value: 'conditioning' as const,
    label: 'Conditioning', 
    icon: Zap,
    description: 'Improve cardiovascular fitness and work capacity',
    details: 'High-intensity intervals, circuit training, and metabolic conditioning',
    color: 'text-orange-600 dark:text-orange-400'
  },
  {
    value: 'mixed' as const,
    label: 'Mixed',
    icon: Target,
    description: 'Balanced approach combining strength and conditioning',
    details: 'Variety of movement patterns, intensities, and training modalities',
    color: 'text-purple-600 dark:text-purple-400'
  },
  {
    value: 'endurance' as const,
    label: 'Endurance',
    icon: Activity,
    description: 'Build aerobic capacity and muscular endurance',
    details: 'Sustained efforts, higher rep ranges, and steady-state work',
    color: 'text-green-600 dark:text-green-400'
  }
];

export function ArchetypeStep({ value, onChange }: ArchetypeStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Choose Your Training Focus</h2>
        <p className="text-muted-foreground">
          Select the type of workout that aligns with your current goals
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ARCHETYPE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;
          
          return (
            <Card
              key={option.value}
              className={`p-6 cursor-pointer transition-all duration-200 hover:shadow-md ${
                isSelected 
                  ? 'ring-2 ring-primary border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => onChange(option.value)}
              data-testid={`archetype-${option.value}`}
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg bg-background border flex items-center justify-center ${isSelected ? 'border-primary' : 'border-border'}`}>
                    <Icon className={`w-6 h-6 ${isSelected ? 'text-primary' : option.color}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{option.label}</h3>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground border-t border-border pt-3">
                  {option.details}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-xs font-medium text-primary">?</span>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Need help deciding?</p>
            <p className="text-xs text-muted-foreground">
              Choose <strong>Strength</strong> for building muscle and power, <strong>Conditioning</strong> for fat loss and cardio fitness, 
              <strong>Mixed</strong> for general fitness, or <strong>Endurance</strong> for longer, steady-state activities.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}