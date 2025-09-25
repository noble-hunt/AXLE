import { useState, useEffect } from "react"
import { useLocation, useSearch } from "wouter"
import { useMutation } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { httpJSON } from "@/lib/http"
import { useAppStore } from "@/store/useAppStore"
import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Progress } from "@/components/ui/progress"
import { ChevronLeft, ChevronRight } from "lucide-react"

// Import step components
import { ArchetypeStep } from "./steps/ArchetypeStep"
import { TimeStep } from "./steps/TimeStep"
import { EquipmentStep } from "./steps/EquipmentStep"
import { IntensityStep } from "./steps/IntensityStep"
import { WorkoutPreview } from "./components/WorkoutPreview"

export interface WizardState {
  archetype: 'strength' | 'conditioning' | 'mixed' | 'endurance';
  minutes: number;
  equipment: string[];
  intensity: number;
}

export interface GeneratedWorkout {
  id: string;
  name: string;
  description: string;
  totalMinutes: number;
  estimatedIntensity: number;
  blocks: Array<{
    id: string;
    name: string;
    type: string;
    exercises: Array<{
      id: string;
      name: string;
      sets: number;
      reps: string;
      notes?: string;
    }>;
  }>;
  coaching_notes: string;
  metadata: {
    template: string;
    patterns: string[];
    equipment: string[];
    progression: string;
  };
}

export interface WorkoutPreviewData {
  workout: GeneratedWorkout;
  choices: {
    templateId: string;
    movementPoolIds: string[];
    schemeId: string;
  };
  seed: string;
  cappedIntensity?: {
    original: number;
    capped: number;
    reason: string;
  };
}

const STEP_TITLES = [
  "Choose Your Focus",
  "Set Duration", 
  "Select Equipment",
  "Set Intensity",
  "Preview & Generate"
];

export function WorkoutWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardState, setWizardState] = useState<WizardState>({
    archetype: 'mixed',
    minutes: 30,
    equipment: [],
    intensity: 6,
  });
  const [previewData, setPreviewData] = useState<WorkoutPreviewData | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { profile } = useAppStore();

  // Get user's equipment from profile if available
  const userEquipment = profile?.equipment || [
    "dumbbells", "kettlebell", "barbell", "bands", "bodyweight", 
    "bike", "rower", "treadmill", "jump_rope"
  ];

  // Parse URL parameters and update state
  useEffect(() => {
    const params = new URLSearchParams(search);
    const archetype = params.get("archetype");
    const minutes = params.get("minutes");
    const intensity = params.get("intensity");
    const equipment = params.get("equipment");

    if (archetype || minutes || intensity || equipment) {
      setWizardState(prev => ({
        ...prev,
        ...(archetype ? { archetype: archetype as WizardState['archetype'] } : {}),
        ...(minutes ? { minutes: Math.max(10, Math.min(60, parseInt(minutes))) } : {}),
        ...(intensity ? { intensity: Math.max(1, Math.min(10, parseInt(intensity))) } : {}),
        ...(equipment ? { equipment: equipment.split(",").filter(e => e.trim()) } : {}),
      }));
    }
  }, [search]);

  // Update URL when state changes
  const updateURL = (newState: Partial<WizardState>) => {
    const finalState = { ...wizardState, ...newState };
    const params = new URLSearchParams();
    
    if (finalState.archetype !== 'mixed') params.set("archetype", finalState.archetype);
    if (finalState.minutes !== 30) params.set("minutes", finalState.minutes.toString());
    if (finalState.intensity !== 6) params.set("intensity", finalState.intensity.toString());
    if (finalState.equipment.length > 0) {
      params.set("equipment", finalState.equipment.join(","));
    }

    const newSearch = params.toString();
    const newUrl = `/workout/generate${newSearch ? `?${newSearch}` : ""}`;
    window.history.replaceState({}, "", newUrl);
    
    setWizardState(finalState);
  };

  // Simulate workout generation for preview
  const simulateWorkout = async (customSeed?: string) => {
    setIsSimulating(true);
    
    try {
      const requestData = {
        inputs: {
          archetype: wizardState.archetype,
          minutes: wizardState.minutes,
          targetIntensity: wizardState.intensity as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
          equipment: wizardState.equipment,
          constraints: [],
          location: 'gym'
        },
        rngSeed: customSeed || `preview-${Date.now()}`,
        generatorVersion: 'v0.3.0'
      };

      const response = await httpJSON('/api/workouts/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      setPreviewData(response);
    } catch (error: any) {
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to generate workout preview.",
        variant: "destructive",
      });
    } finally {
      setIsSimulating(false);
    }
  };

  // Generate and save workout
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!previewData) throw new Error("No preview data available");
      
      const requestData = {
        inputs: previewData.choices,
        rngSeed: previewData.seed,
        generatorVersion: 'v0.3.0'
      };

      const response = await httpJSON('/api/workouts/generate', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      return response;
    },
    onSuccess: (response) => {
      toast({
        title: "Workout Generated!",
        description: "Your workout has been saved and is ready to start.",
      });
      setLocation(`/workout/${response.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate workout.",
        variant: "destructive",
      });
    },
  });

  const handleStateChange = (newState: Partial<WizardState>) => {
    updateURL(newState);
    // Clear preview when state changes
    if (previewData) {
      setPreviewData(null);
    }
  };

  const nextStep = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
      // Auto-generate preview when reaching final step
      if (currentStep === 4) {
        simulateWorkout();
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return wizardState.archetype;
      case 2: return wizardState.minutes >= 10 && wizardState.minutes <= 60;
      case 3: return wizardState.equipment.length > 0;
      case 4: return wizardState.intensity >= 1 && wizardState.intensity <= 10;
      case 5: return previewData !== null;
      default: return false;
    }
  };

  const regeneratePreview = () => {
    simulateWorkout();
  };

  const useWorkout = () => {
    generateMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SectionTitle 
          title="Workout Generator" 
          subtitle="Create your perfect workout in 4 simple steps"
        />
        <div className="text-sm text-muted-foreground">
          Step {currentStep} of 4
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Progress value={(currentStep / 5) * 100} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          {STEP_TITLES.map((title, index) => (
            <span key={index} className={currentStep > index ? "text-primary" : ""}>
              {title}
            </span>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="p-6">
        {currentStep === 1 && (
          <ArchetypeStep
            value={wizardState.archetype}
            onChange={(archetype) => handleStateChange({ archetype })}
          />
        )}
        
        {currentStep === 2 && (
          <TimeStep
            value={wizardState.minutes}
            onChange={(minutes: number) => handleStateChange({ minutes })}
          />
        )}
        
        {currentStep === 3 && (
          <EquipmentStep
            value={wizardState.equipment}
            userEquipment={userEquipment}
            onChange={(equipment: string[]) => handleStateChange({ equipment })}
          />
        )}
        
        {currentStep === 4 && (
          <IntensityStep
            value={wizardState.intensity}
            onChange={(intensity: number) => handleStateChange({ intensity })}
          />
        )}
        
        {currentStep === 5 && (
          <WorkoutPreview
            wizardState={wizardState}
            previewData={previewData}
            isLoading={isSimulating}
            onRegenerate={regeneratePreview}
            onUse={useWorkout}
            isGenerating={generateMutation.isPending}
          />
        )}
      </Card>

      {/* Navigation */}
      {currentStep < 5 && (
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
            data-testid="prev-step-button"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          
          <Button
            onClick={nextStep}
            disabled={!canProceed()}
            data-testid="next-step-button"
          >
            {currentStep === 4 ? "Preview Workout" : "Next"}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}