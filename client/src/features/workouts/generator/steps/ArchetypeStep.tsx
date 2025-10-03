import { useState } from "react"
import { OptionCard } from "@/components/ui/option-card"
import { Sheet } from "@/components/swift/sheet"
import { Dumbbell, Activity, Waves, HeartPulse, MoreHorizontal, Flame, Weight, Target, Sparkles, Bike, Wind, Accessibility } from "lucide-react"
import type { WorkoutFocus } from "@/types/workouts"

export interface ArchetypeStepProps {
  value: WorkoutFocus;
  onChange: (value: WorkoutFocus) => void;
}

const PRIMARY_OPTIONS = [
  {
    value: 'strength' as const,
    label: 'Strength',
    icon: Dumbbell,
    description: 'Heavy compounds, lower reps, longer rest.'
  },
  {
    value: 'conditioning' as const,
    label: 'Conditioning', 
    icon: Activity,
    description: 'Intervals, circuits, metabolic power.'
  },
  {
    value: 'mixed' as const,
    label: 'Mixed',
    icon: Waves,
    description: 'Blend of strength + conditioning.'
  },
  {
    value: 'endurance' as const,
    label: 'Endurance',
    icon: HeartPulse,
    description: 'Longer efforts, aerobic capacity.'
  }
];

const MORE_OPTIONS = [
  {
    value: 'crossfit' as const,
    label: 'CrossFit',
    icon: Flame,
    description: 'Classic CF: EMOM/AMRAP/For Time.'
  },
  {
    value: 'olympic_weightlifting' as const,
    label: 'Olympic Weightlifting',
    icon: Weight,
    description: 'Snatch & C&J, EMOM/E2:00 complexes.'
  },
  {
    value: 'powerlifting' as const,
    label: 'Powerlifting',
    icon: Target,
    description: 'Squat/Bench/Deadlift strength focus.'
  },
  {
    value: 'bb_full_body' as const,
    label: 'Bodybuilding — Full Body',
    icon: Sparkles,
    description: 'Hypertrophy across all patterns.'
  },
  {
    value: 'bb_upper' as const,
    label: 'Bodybuilding — Upper',
    icon: Sparkles,
    description: 'Chest/back/shoulders/arms volume.'
  },
  {
    value: 'bb_lower' as const,
    label: 'Bodybuilding — Lower',
    icon: Sparkles,
    description: 'Quads/hams/glutes volume.'
  },
  {
    value: 'aerobic' as const,
    label: 'Aerobic (Cardio)',
    icon: Bike,
    description: 'Z2–Z4 intervals or steady state.'
  },
  {
    value: 'gymnastics' as const,
    label: 'Gymnastics Work',
    icon: Wind,
    description: 'Skill EMOMs: TTB, MU, HS, strict pull.'
  },
  {
    value: 'mobility' as const,
    label: 'Mobility Session',
    icon: Accessibility,
    description: 'Quality mobility & tissue work.'
  }
];

export function ArchetypeStep({ value, onChange }: ArchetypeStepProps) {
  const [showMore, setShowMore] = useState(false);

  const handleSelectMore = (selectedValue: WorkoutFocus) => {
    onChange(selectedValue);
    setShowMore(false);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground leading-tight">Choose Your Training Focus</h2>
          <p className="text-muted-foreground">
            Select the type of workout that aligns with your current goals
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {PRIMARY_OPTIONS.map((option) => {
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
          
          <OptionCard
            icon={<MoreHorizontal className="w-6 h-6" />}
            title="More"
            description="CrossFit, Oly, PL, BB, Cardio, Gymnastics, Mobility"
            selected={false}
            onClick={() => setShowMore(true)}
            aria-label="More workout types"
            data-testid="archetype-more"
          />
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

      <Sheet open={showMore} onOpenChange={setShowMore} title="More Categories">
        <div className="grid grid-cols-1 gap-3 p-4">
          {MORE_OPTIONS.map((option) => {
            const Icon = option.icon;
            
            return (
              <OptionCard
                key={option.value}
                icon={<Icon className="w-6 h-6" />}
                title={option.label}
                description={option.description}
                selected={value === option.value}
                onClick={() => handleSelectMore(option.value)}
                aria-label={option.label}
                data-testid={`archetype-${option.value}`}
              />
            );
          })}
        </div>
      </Sheet>
    </>
  );
}