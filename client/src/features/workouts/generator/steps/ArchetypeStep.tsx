import { OptionCard } from "@/components/ui/option-card"
import { Dumbbell, Activity, Waves, HeartPulse } from "lucide-react"

export interface ArchetypeStepProps {
  value: 'strength' | 'conditioning' | 'mixed' | 'endurance';
  onChange: (value: 'strength' | 'conditioning' | 'mixed' | 'endurance') => void;
}

const ARCHETYPE_OPTIONS = [
  {
    value: 'strength' as const,
    label: 'Strength',
    icon: Dumbbell,
    description: 'Focus on progressive overload, lower reps, longer rest periods, and heavy compound movements.'
  },
  {
    value: 'conditioning' as const,
    label: 'Conditioning', 
    icon: Activity,
    description: 'High-intensity intervals, circuit pieces, and metabolic conditioning to improve work capacity.'
  },
  {
    value: 'mixed' as const,
    label: 'Mixed',
    icon: Waves,
    description: 'Balanced blend of strength and conditioning for general physical preparedness.'
  },
  {
    value: 'endurance' as const,
    label: 'Endurance',
    icon: HeartPulse,
    description: 'Longer efforts to build aerobic capacity and muscular endurance.'
  }
];

export function ArchetypeStep({ value, onChange }: ArchetypeStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground leading-tight">Choose Your Training Focus</h2>
        <p className="text-muted-foreground">
          Select the type of workout that aligns with your current goals
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {ARCHETYPE_OPTIONS.map((option) => {
          const Icon = option.icon;
          
          return (
            <OptionCard
              key={option.value}
              icon={<Icon className="w-6 h-6" />}
              title={option.label}
              description={option.description}
              selected={value === option.value}
              onClick={() => onChange(option.value)}
              aria-label={option.label}
              data-testid={`archetype-${option.value}`}
            />
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