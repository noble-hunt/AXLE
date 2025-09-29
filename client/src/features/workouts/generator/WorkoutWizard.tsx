import { useState, useEffect } from "react"
import { useLocation, useSearch } from "wouter"
import { useMutation } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { fetchPreview } from "./api"
import { HttpError } from "@/lib/http"
import { useAppStore } from "@/store/useAppStore"
import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Progress } from "@/components/ui/progress"
import { ChevronLeft, ChevronRight } from "lucide-react"
// Removed dependency on shared types - using simpler local generation

// Import step components
import { ArchetypeStep } from "./steps/ArchetypeStep"
import { TimeStep } from "./steps/TimeStep"
import { EquipmentStep } from "./steps/EquipmentStep"
import { IntensityStep } from "./steps/IntensityStep"
import { WorkoutPreview, type WorkoutPreviewData } from "./components/WorkoutPreview"

export interface WizardState {
  archetype: 'strength' | 'conditioning' | 'mixed' | 'endurance';
  minutes: number;
  equipment: string[];
  intensity: number;
}

export interface GeneratedWorkout {
  id: string | null;
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


// Types for API responses
interface SimulateWorkoutResponse {
  ok: true;
  workout: {
    id: string | null;
    meta?: {
      title?: string;
    };
    estTimeMin: number;
    intensity: number;
    blocks: Array<{
      name: string;
      sets: number;
      reps: string;
      notes?: string;
    }>;
    seed?: string;
  };
}

interface GenerateWorkoutResponse {
  ok: true;
  workout: {
    id: string;
    meta?: {
      title?: string;
    };
    estTimeMin: number;
    intensity: number;
    blocks: Array<{
      name: string;
      sets: number;
      reps: string;
      notes?: string;
    }>;
    seed?: string;
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
  const [previewSeed, setPreviewSeed] = useState<any>(null);
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

  // Generate workout preview for the final step (read-only simulation)
  const simulateWorkout = async (customSeed?: string) => {
    setIsSimulating(true);
    
    try {
      // Create simple seed for preview
      let seedValue = customSeed;
      if (!seedValue && profile?.id) {
        // Create simple deterministic seed for preview
        seedValue = `${profile.id}-${wizardState.archetype}-${new Date().toISOString().split('T')[0]}`;
        setPreviewSeed(seedValue);
      }
      
      // Remove old requestBody - now using fetchPreview directly

      // Transform wizard state to fetchPreview format
      const previewInput = {
        focus: wizardState.archetype,
        durationMin: wizardState.minutes,
        equipment: wizardState.equipment,
        intensity: wizardState.intensity,
        ...(seedValue && { seed: seedValue })
      };

      const response = await fetchPreview(previewInput);

      // Response now contains a proper WorkoutPlan - pass it directly to preview component
      setPreviewData({
        preview: response.preview,
        seed: response.seed || ""
      });
    } catch (e: any) {
      console.error('Preview generation error:', e);
      
      // Improved error message extraction
      let msg = "Preview failed";
      if (e instanceof Error) {
        msg = e.message;
      } else if (e?.message) {
        msg = e.message;
      } else if (e?.status) {
        msg = `HTTP ${e.status}: ${e?.statusText || 'Request failed'}`;
      }
      
      toast({ 
        title: "Preview Failed", 
        description: msg, 
        variant: "destructive" 
      });
    } finally {
      setIsSimulating(false);
    }
  };

  // Generate and save workout
  const generateMutation = useMutation({
    mutationFn: async (customSeed?: string) => {
      // Create or use provided seed for generation 
      let seedValue = customSeed || previewSeed;
      if (!seedValue && profile?.id) {
        // Create simple deterministic seed
        seedValue = `${profile.id}-${wizardState.archetype}-${new Date().toISOString().split('T')[0]}`;
      }

      // Transform wizard state to server format
      const requestData = {
        archetype: wizardState.archetype,
        minutes: wizardState.minutes,
        intensity: wizardState.intensity,
        equipment: wizardState.equipment,
        ...(seedValue && { seed: seedValue })
      };

      // Use httpJSON directly for generation endpoint (keeping existing logic)
      const { httpJSON } = await import('@/lib/http');
      const response = await httpJSON('/workouts/generate', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error((response as any).error?.message || "Failed to generate workout");
      }

      return response.workout;
    },
    onSuccess: (workout) => {
      toast({
        title: "Workout Generated!",
        description: "Your workout has been saved and is ready to start.",
      });
      setLocation(`/workout/${workout.id}`);
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
      setPreviewSeed(null);
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

  const getValidationError = () => {
    switch (currentStep) {
      case 1: return !wizardState.archetype ? "Please select a workout focus" : null;
      case 2: return wizardState.minutes < 10 || wizardState.minutes > 60 ? "Duration must be between 10-60 minutes" : null;
      case 3: return wizardState.equipment.length === 0 ? "Please select at least one piece of equipment" : null;
      case 4: return wizardState.intensity < 1 || wizardState.intensity > 10 ? "Intensity must be between 1-10" : null;
      case 5: return !previewData ? "Please wait for workout preview to load" : null;
      default: return null;
    }
  };

  const regeneratePreview = () => {
    simulateWorkout();
  };

  const useWorkout = async (feedback: { perceivedIntensity: number; notes?: string }) => {
    // Validate preconditions
    if (!previewData || !previewData.seed) {
      throw new Error("Preview data not ready. Please try generating the preview again.");
    }
    
    try {
      // First, generate and save the workout using seed from preview data
      const requestData = {
        archetype: wizardState.archetype,
        minutes: wizardState.minutes,
        intensity: wizardState.intensity,
        equipment: wizardState.equipment,
        seed: previewData.seed
      };

      const { httpJSON } = await import('@/lib/http');
      const response = await httpJSON('/workouts/generate', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error((response as any).error?.message || "Failed to generate workout");
      }

      const workout = response.workout;
      
      // Save feedback to the generated workout
      const { apiRequest, queryClient } = await import('@/lib/queryClient');
      await apiRequest('POST', `/api/workouts/${workout.id}/feedback`, {
        perceivedIntensity: feedback.perceivedIntensity,
        notes: feedback.notes || ""
      });

      // Mark workout as completed
      const { useAppStore } = await import('@/store/useAppStore');
      const { completeWorkout } = useAppStore.getState();
      await completeWorkout(workout.id, {
        difficulty: feedback.perceivedIntensity,
        satisfaction: 8, // Default to high satisfaction
        completedAt: new Date(),
      });

      // Invalidate workout queries to refresh history
      queryClient.invalidateQueries({ queryKey: ['/api/workouts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/recent'] });

      toast({
        title: "Workout Completed! 🎉",
        description: "Your workout has been saved to your history.",
      });
      
      // Navigate to history page using constant
      const { ROUTES } = await import('@/lib/routes');
      setLocation(ROUTES.HISTORY);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save workout.",
        variant: "destructive",
      });
      throw error; // Re-throw so WorkoutPreview can handle it
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SectionTitle 
          title="Workout Generator" 
          subtitle="Create your perfect workout in 5 simple steps"
        />
        <div className="text-sm text-muted-foreground">
          Step {currentStep} of 5
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
      <Card className="p-4">
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
            isGenerating={isSimulating}
          />
        )}
      </Card>

      {/* Navigation */}
      {currentStep < 5 && (
        <div className="space-y-4">
          {/* Validation Error */}
          {getValidationError() && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
              {getValidationError()}
            </div>
          )}
          
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="secondary"
              onClick={prevStep}
              disabled={currentStep === 1}
              data-testid="button-prev-step"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            
            <Button
              onClick={nextStep}
              disabled={!canProceed() || (currentStep === 4 && isSimulating)}
              data-testid="button-next-step"
            >
              {currentStep === 4 ? (
                isSimulating ? (
                  <>
                    <LoadingSpinner className="w-4 h-4 mr-2" />
                    Generating Preview...
                  </>
                ) : (
                  "Preview Workout"
                )
              ) : (
                "Next"
              )}
              {!isSimulating && <ChevronRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}