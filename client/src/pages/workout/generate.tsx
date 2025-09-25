import { useState, useEffect } from "react"
import { useLocation, useSearch } from "wouter"
import { useMutation } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { httpJSON } from "@/lib/http"
import { useAppStore } from "@/store/useAppStore"
import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  Dumbbell, Clock, Target, Zap, Play, RotateCcw, Save, 
  Sparkles, Timer, Activity, Heart, Move, HelpCircle,
  CheckCircle2, ChevronRight, Settings, X
} from "lucide-react"

// Goal options with descriptions
const GOAL_OPTIONS = [
  { 
    value: "Strength", 
    label: "Strength", 
    icon: Dumbbell,
    description: "Build muscle strength with heavy compound movements"
  },
  { 
    value: "Conditioning", 
    label: "Conditioning", 
    icon: Zap,
    description: "Improve cardiovascular fitness and endurance"
  },
  { 
    value: "Hypertrophy", 
    label: "Hypertrophy", 
    icon: Activity,
    description: "Gain muscle size with moderate weights and higher volume"
  },
  { 
    value: "Mobility", 
    label: "Mobility", 
    icon: Move,
    description: "Enhance flexibility and movement quality"
  },
  { 
    value: "Mixed", 
    label: "Mixed", 
    icon: Sparkles,
    description: "Balanced approach combining multiple fitness aspects"
  }
];

// Default equipment options
const DEFAULT_EQUIPMENT = [
  "Dumbbells", "Kettlebell", "Barbell", "Bands", "Bodyweight", 
  "Bike/Erg", "Rower", "Treadmill", "Jump Rope"
];

interface WizardState {
  goal: string;
  durationMin: number;
  intensity: number;
  equipment: string[];
}

interface GeneratedWorkout {
  title: string;
  est_duration_min: number;
  intensity: number | string;
  seed?: string;
  exercises: Array<{
    name: string;
    sets?: number;
    reps?: number | string;
    rest_sec?: number;
    notes?: string;
  }>;
}

export default function WorkoutGenerateWizard() {
  const [step, setStep] = useState(1);
  const [wizardState, setWizardState] = useState<WizardState>({
    goal: "Mixed",
    durationMin: 30,
    intensity: 6,
    equipment: ["Dumbbells", "Kettlebell"]
  });
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { profile } = useAppStore();

  // Get user's equipment from profile if available
  const userEquipment = profile?.equipment || DEFAULT_EQUIPMENT;

  // Parse URL parameters and update state
  useEffect(() => {
    const params = new URLSearchParams(search);
    const goal = params.get("goal");
    const duration = params.get("t");
    const intensity = params.get("i");
    const equipment = params.get("equipment");

    if (goal || duration || intensity || equipment) {
      setWizardState(prev => ({
        ...prev,
        ...(goal && GOAL_OPTIONS.find(g => g.value === goal) ? { goal } : {}),
        ...(duration ? { durationMin: Math.max(10, Math.min(60, parseInt(duration))) } : {}),
        ...(intensity ? { intensity: Math.max(1, Math.min(10, parseInt(intensity))) } : {}),
        ...(equipment ? { equipment: equipment.split(",").filter(e => e.trim()) } : {})
      }));
    }
  }, [search]);

  // Update URL when state changes
  const updateURL = (newState: Partial<WizardState>) => {
    const finalState = { ...wizardState, ...newState };
    const params = new URLSearchParams();
    
    if (finalState.goal !== "Mixed") params.set("goal", finalState.goal);
    if (finalState.durationMin !== 30) params.set("t", finalState.durationMin.toString());
    if (finalState.intensity !== 6) params.set("i", finalState.intensity.toString());
    if (finalState.equipment.length > 0 && JSON.stringify(finalState.equipment) !== JSON.stringify(["Dumbbells", "Kettlebell"])) {
      params.set("equipment", finalState.equipment.join(","));
    }

    const newSearch = params.toString();
    const newUrl = `/workout/generate${newSearch ? `?${newSearch}` : ""}`;
    window.history.replaceState({}, "", newUrl);
    
    setWizardState(finalState);
  };

  // Generate workout mutation
  const generateMutation = useMutation({
    mutationFn: async (data: WizardState & { seed?: number | string }) => {
      const requestData = {
        goal: data.goal,
        durationMin: data.durationMin,
        intensity: data.intensity,
        equipment: data.equipment,
        ...(data.seed && { seed: data.seed })
      };

      const response = await httpJSON('/api/workouts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      return response.workout as GeneratedWorkout;
    },
    onSuccess: (workout) => {
      setGeneratedWorkout(workout);
      toast({
        title: "Workout Generated!",
        description: `Created a ${workout.intensity}-intensity ${wizardState.goal.toLowerCase()} workout.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate workout. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Save workout mutation  
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!generatedWorkout) throw new Error("No workout to save");
      
      const workoutData = {
        name: generatedWorkout.title,
        category: wizardState.goal,
        description: `${wizardState.goal} workout - ${wizardState.durationMin} minutes`,
        duration: generatedWorkout.est_duration_min,
        intensity: generatedWorkout.intensity,
        sets: generatedWorkout.exercises.map((exercise, index) => ({
          id: `ex-${index}`,
          exercise: exercise.name,
          reps: exercise.reps,
          sets: exercise.sets,
          notes: exercise.notes
        })),
        date: new Date(),
        completed: false,
        notes: `Generated with: ${wizardState.equipment.join(", ")}`,
        seed: generatedWorkout.seed // Include seed for deterministic regeneration
      };

      const response = await httpJSON('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workoutData)
      });

      return response;
    },
    onSuccess: (response) => {
      toast({
        title: "Workout Saved!",
        description: "Your workout has been saved successfully!",
      });
      setLocation(`/workout/${response.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save workout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate(wizardState);
  };

  const handleRegenerate = () => {
    generateMutation.mutate({ ...wizardState, seed: Date.now() });
  };

  const handleSaveAndStart = () => {
    saveMutation.mutate();
  };

  const toggleEquipment = (item: string) => {
    const newEquipment = wizardState.equipment.includes(item)
      ? wizardState.equipment.filter(e => e !== item)
      : [...wizardState.equipment, item];
    updateURL({ equipment: newEquipment });
  };

  const selectAllEquipment = () => {
    updateURL({ equipment: [...userEquipment] });
  };

  const clearAllEquipment = () => {
    updateURL({ equipment: [] });
  };

  const nextStep = () => {
    if (step < 3) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  // Reset to wizard if no workout generated
  const backToWizard = () => {
    setGeneratedWorkout(null);
    setStep(1);
  };

  // Show preview if workout is generated
  if (generatedWorkout) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <SectionTitle title="Workout Preview" />
          <Button variant="outline" size="sm" onClick={backToWizard}>
            <Settings className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </div>

        {/* Workout Preview Card */}
        <Card className="p-6 card-shadow border border-border">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{generatedWorkout.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {wizardState.goal} • {generatedWorkout.est_duration_min} min • Intensity {generatedWorkout.intensity}/10
                  </p>
                  {generatedWorkout.seed && (
                    <p className="text-xs text-muted-foreground/60 font-mono">
                      Seed: {generatedWorkout.seed}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Workout Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <Clock className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{generatedWorkout.est_duration_min}</p>
                <p className="text-xs text-muted-foreground">minutes</p>
              </div>
              <div className="text-center">
                <Target className="w-5 h-5 text-chart-2 mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{generatedWorkout.intensity}</p>
                <p className="text-xs text-muted-foreground">intensity</p>
              </div>
              <div className="text-center">
                <Dumbbell className="w-5 h-5 text-chart-3 mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{generatedWorkout.exercises.length}</p>
                <p className="text-xs text-muted-foreground">exercises</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Exercise List */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">Exercises</h3>
          {generatedWorkout.exercises.map((exercise, index) => (
            <Card key={index} className="p-4">
              <div className="space-y-2">
                <h4 className="font-medium text-foreground">{exercise.name}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                  {exercise.sets && <div>Sets: {exercise.sets}</div>}
                  {exercise.reps && <div>Reps: {exercise.reps}</div>}
                  {exercise.rest_sec && <div>Rest: {exercise.rest_sec}s</div>}
                </div>
                {exercise.notes && (
                  <p className="text-sm text-muted-foreground">{exercise.notes}</p>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            onClick={handleSaveAndStart}
            disabled={saveMutation.isPending}
            className="w-full"
            data-testid="save-and-start-button"
          >
            {saveMutation.isPending ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save & Start
              </>
            )}
          </Button>
          
          <Button 
            variant="outline"
            onClick={handleRegenerate}
            disabled={generateMutation.isPending}
            className="w-full"
            data-testid="regenerate-button"
          >
            {generateMutation.isPending ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Generating...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                Regenerate
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Wizard Steps
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle title="Workout Generator" subtitle="AI-powered workout generation" />
        <div className="text-sm text-muted-foreground">
          Step {step} of 3
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div 
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      {/* Step 1: Goal Selection */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">What's your goal?</h2>
            <p className="text-muted-foreground">Choose your primary training focus</p>
          </div>
          
          <TooltipProvider>
            <div className="grid grid-cols-1 gap-3">
              {GOAL_OPTIONS.map((goal) => {
                const Icon = goal.icon;
                const isSelected = wizardState.goal === goal.value;
                
                return (
                  <Tooltip key={goal.value}>
                    <TooltipTrigger asChild>
                      <Card 
                        className={`p-4 cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-primary bg-primary/5 shadow-md' 
                            : 'hover:bg-muted/50 border-border'
                        }`}
                        onClick={() => updateURL({ goal: goal.value })}
                        data-testid={`goal-${goal.value.toLowerCase()}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          }`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-foreground">{goal.label}</h3>
                            <p className="text-sm text-muted-foreground">{goal.description}</p>
                          </div>
                          {isSelected && <CheckCircle2 className="w-5 h-5 text-primary" />}
                        </div>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{goal.description}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </div>
      )}

      {/* Step 2: Duration & Intensity */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Duration & Intensity</h2>
            <p className="text-muted-foreground">Set your workout parameters</p>
          </div>
          
          {/* Duration Slider */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-lg font-medium text-foreground flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Duration
              </label>
              <span className="text-xl font-bold text-primary">{wizardState.durationMin} min</span>
            </div>
            
            <Slider
              value={[wizardState.durationMin]}
              onValueChange={([value]) => updateURL({ durationMin: value })}
              min={10}
              max={60}
              step={5}
              className="w-full"
              data-testid="duration-slider"
            />
            
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>10 min</span>
              <span>60 min</span>
            </div>
          </div>

          {/* Intensity Slider */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-lg font-medium text-foreground flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Intensity
              </label>
              <span className="text-xl font-bold text-primary">{wizardState.intensity}/10</span>
            </div>
            
            <Slider
              value={[wizardState.intensity]}
              onValueChange={([value]) => updateURL({ intensity: value })}
              min={1}
              max={10}
              step={1}
              className="w-full"
              data-testid="intensity-slider"
            />
            
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>1 (Light)</span>
              <span>10 (Max)</span>
            </div>
            
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Intensity Scale:</strong> 1-3 (Light recovery), 4-6 (Moderate), 7-8 (Hard), 9-10 (Maximum effort)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Equipment */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Available Equipment</h2>
            <p className="text-muted-foreground">Select what you have access to</p>
          </div>
          
          {/* Select All / Clear All */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllEquipment}
              data-testid="select-all-equipment"
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllEquipment}
              data-testid="clear-all-equipment"
            >
              Clear All
            </Button>
          </div>

          {/* Equipment Chips */}
          <div className="flex flex-wrap gap-2">
            {userEquipment.map((item: string) => {
              const isSelected = wizardState.equipment.includes(item);
              
              return (
                <Badge
                  key={item}
                  variant={isSelected ? "default" : "secondary"}
                  className={`cursor-pointer px-3 py-2 text-sm transition-all ${
                    isSelected 
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => toggleEquipment(item)}
                  data-testid={`equipment-${item.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                >
                  {item}
                  {isSelected && <X className="w-3 h-3 ml-1" />}
                </Badge>
              );
            })}
          </div>

          {wizardState.equipment.length === 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Select at least one piece of equipment to generate a workout
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        {step > 1 && (
          <Button
            variant="outline"
            onClick={prevStep}
            className="flex-1"
            data-testid="prev-step-button"
          >
            Back
          </Button>
        )}
        
        {step < 3 ? (
          <Button
            onClick={nextStep}
            className="flex-1"
            data-testid="next-step-button"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || wizardState.equipment.length === 0}
            className="flex-1"
            data-testid="generate-workout-button"
          >
            {generateMutation.isPending ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Generate Workout
              </>
            )}
          </Button>
        )}
      </div>

      {/* Error Message */}
      {generateMutation.isError && (
        <Card className="p-4 border-destructive bg-destructive/5">
          <div className="flex items-center gap-2">
            <X className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">
                Generation failed
              </p>
              <p className="text-sm text-muted-foreground">
                {(generateMutation.error as any)?.message || "Please try again"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateMutation.reset()}
              className="ml-auto"
            >
              Try Again
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}