import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useLocation, useSearch } from "wouter"
import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { httpJSON } from "@/lib/http"
import { useAppStore } from "@/store/useAppStore"
import { 
  Dumbbell, Clock, Target, Zap, Sparkles, Calendar, Users, Activity, Sun, Droplets, 
  ChevronDown, ChevronUp, Edit3, RotateCcw, Heart, Brain, Moon, Battery,
  ThumbsUp, ThumbsDown, HelpCircle, Settings, RefreshCcw
} from "lucide-react"

// V2 Workout Generation Schema  
const v2WorkoutRequestSchema = z.object({
  duration: z.number().min(5).max(120),
  intensity: z.number().min(1).max(10),
  equipment: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  goals: z.array(z.string()).optional(),
  metricsSnapshot: z.object({
    vitality: z.number().min(0).max(100).optional(),
    performancePotential: z.number().min(0).max(100).optional(),
    circadianAlignment: z.number().min(0).max(100).optional(),
    energySystemsBalance: z.number().min(0).max(100).optional(),
    fatigueScore: z.number().min(0).max(100).optional(),
    hrv: z.number().min(0).optional(),
    rhr: z.number().min(30).max(200).optional(),
    sleepScore: z.number().min(0).max(100).optional()
  }).optional()
});

type V2WorkoutRequest = z.infer<typeof v2WorkoutRequestSchema>;

// Equipment options
const EQUIPMENT_OPTIONS = [
  { value: "barbell", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbells" },
  { value: "kettlebell", label: "Kettlebells" },
  { value: "resistance_bands", label: "Resistance Bands" },
  { value: "pull_up_bar", label: "Pull-up Bar" },
  { value: "bodyweight", label: "Bodyweight Only" },
  { value: "cardio_machine", label: "Cardio Machine" },
  { value: "yoga_mat", label: "Yoga Mat" }
];

// Focus options for editing
const FOCUS_OPTIONS = [
  { value: "strength", label: "Strength" },
  { value: "cardio", label: "Cardiovascular" },
  { value: "hybrid", label: "Hybrid Training" },
  { value: "recovery", label: "Recovery" },
  { value: "mobility", label: "Mobility" }
];

export default function WorkoutGenerate() {
  const [generatedWorkout, setGeneratedWorkout] = useState<any>(null)
  const [showRationale, setShowRationale] = useState(false)
  const [showEditControls, setShowEditControls] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [lastFeedback, setLastFeedback] = useState<{ type: 'easy' | 'hard'; intensity: number } | null>(null)
  const { addWorkout } = useAppStore()
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const search = useSearch()
  
  // Parse URL parameters for group mode
  const urlParams = new URLSearchParams(search)
  const groupId = urlParams.get("groupId")
  const mode = urlParams.get("mode")
  const isGroupMode = mode === "group" && groupId

  // Fetch health metrics for AXLE display
  const { data: healthReports } = useQuery({
    queryKey: ['/api/health/reports', { days: 1 }],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const todayMetrics = (healthReports as any)?.[0]?.metrics;
  const axleMetrics = {
    vitality: todayMetrics?.vitality || 65,
    performancePotential: todayMetrics?.performancePotentialScore || 70,
    circadianAlignment: todayMetrics?.circadianAlignment || 75,
    energySystemsBalance: todayMetrics?.energySystemsBalance || 70
  };

  // Form for workout generation
  const form = useForm<V2WorkoutRequest>({
    resolver: zodResolver(v2WorkoutRequestSchema),
    defaultValues: {
      duration: 30,
      intensity: 5,
      equipment: ["bodyweight"],
    },
  })

  // Helper function to get metric color and description
  const getMetricInfo = (value: number, type: string) => {
    let color = "bg-gray-100 text-gray-700";
    let description = "";
    
    if (value >= 80) {
      color = "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300";
      description = type === "vitality" ? "Excellent energy levels" :
                   type === "performancePotential" ? "Ready for high intensity" :
                   type === "circadianAlignment" ? "Perfect timing" : "Balanced systems";
    } else if (value >= 65) {
      color = "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
      description = type === "vitality" ? "Good energy levels" :
                   type === "performancePotential" ? "Good for moderate work" :
                   type === "circadianAlignment" ? "Good timing" : "Well balanced";
    } else if (value >= 50) {
      color = "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300";
      description = type === "vitality" ? "Moderate energy" :
                   type === "performancePotential" ? "Light work recommended" :
                   type === "circadianAlignment" ? "Suboptimal timing" : "Slightly imbalanced";
    } else {
      color = "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
      description = type === "vitality" ? "Low energy, rest focus" :
                   type === "performancePotential" ? "Recovery recommended" :
                   type === "circadianAlignment" ? "Poor timing" : "Needs balancing";
    }
    
    return { color, description };
  };

  // V2 Workout Generation Mutation
  const generateMutation = useMutation({
    mutationFn: async (data: V2WorkoutRequest) => {
      setIsRegenerating(true)
      
      // Prepare request with AXLE metrics and feedback
      const requestData = {
        ...data,
        metricsSnapshot: {
          vitality: axleMetrics.vitality,
          performancePotential: axleMetrics.performancePotential,
          circadianAlignment: axleMetrics.circadianAlignment,
          energySystemsBalance: axleMetrics.energySystemsBalance,
          ...data.metricsSnapshot
        }
      };

      // Apply feedback adjustments if we have recent feedback
      if (lastFeedback && lastFeedback.type === 'hard') {
        requestData.intensity = Math.max(1, requestData.intensity - 1);
        toast({
          title: "Intensity Adjusted",
          description: "Lowered intensity based on your 'too hard' feedback.",
        });
      } else if (lastFeedback && lastFeedback.type === 'easy') {
        requestData.intensity = Math.min(10, requestData.intensity + 1);
        toast({
          title: "Intensity Adjusted", 
          description: "Increased intensity based on your 'too easy' feedback.",
        });
      }

      const response = await httpJSON('/api/generate/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      return response;
    },
    onSuccess: (data) => {
      setGeneratedWorkout(data)
      setIsRegenerating(false)
      setLastFeedback(null) // Clear feedback after successful generation
      toast({
        title: "Workout Generated!",
        description: `Created a ${data.plan?.targetIntensity || 'custom'}-intensity workout plan.`,
      })
    },
    onError: (error: any) => {
      setIsRegenerating(false)
      console.error('Generate workout error:', error)
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate workout. Please try again.",
        variant: "destructive",
      })
    },
  })

  // Feedback submission mutation
  const feedbackMutation = useMutation({
    mutationFn: async ({ type, workoutId }: { type: 'easy' | 'hard'; workoutId: string }) => {
      const intensityFeedback = type === 'easy' ? 3 : 8; // Map to 1-10 scale
      
      await httpJSON('/api/workouts/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutId, intensityFeedback })
      });

      return { type, intensity: intensityFeedback };
    },
    onSuccess: (data) => {
      setLastFeedback({ type: data.type, intensity: data.intensity });
      toast({
        title: "Feedback Saved",
        description: `We'll adjust future workouts based on your feedback.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Feedback Failed",
        description: error.message || "Failed to save feedback.",
        variant: "destructive",
      });
    }
  });

  // Save workout mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!generatedWorkout) throw new Error("No workout to save");
      
      const { createWorkout } = await import('@/lib/workoutAPI');
      
      const workoutData = {
        title: generatedWorkout.plan?.focus || 'AI Generated Workout',
        notes: generatedWorkout.plan?.rationale?.join('\n') || 'AI Generated Workout',
        sets: generatedWorkout.plan?.blocks || [],
        completed: false,
        request: {
          duration: form.getValues('duration'),
          intensity: form.getValues('intensity'),
          equipment: form.getValues('equipment')
        },
        feedback: {
          source: 'ai_generation_v2',
          generated_at: new Date().toISOString(),
          axle_metrics: axleMetrics
        }
      };
      
      const workoutId = await createWorkout(workoutData);
      
      // Also add to local store for immediate UI updates
      addWorkout({
        name: generatedWorkout.plan?.focus || 'AI Generated Workout',
        category: 'AI Generated' as any,
        description: generatedWorkout.plan?.rationale?.[0] || '',
        duration: form.getValues('duration'),
        intensity: generatedWorkout.plan?.targetIntensity || form.getValues('intensity'),
        sets: generatedWorkout.plan?.blocks || [],
        date: new Date(),
        completed: false,
        notes: generatedWorkout.plan?.rationale?.join('\n') || '',
      });
      
      return { workoutId, workout: generatedWorkout };
    },
    onSuccess: (result) => {
      if (result) {
        toast({
          title: "Workout Saved!",
          description: "Your workout has been saved successfully!",
        });
        setLocation(`/workout/${result.workoutId}`);
      }
    },
    onError: (error: any) => {
      console.error('Save workout error:', error)
      toast({
        title: "Save Failed",
        description: "Failed to save workout. Please try again.",
        variant: "destructive",
      })
    },
  })

  const onSubmit = (data: V2WorkoutRequest) => {
    generateMutation.mutate(data)
  }

  const handleSaveWorkout = () => {
    saveMutation.mutate()
  }

  const handleGenerateNew = () => {
    setGeneratedWorkout(null)
    setShowRationale(false)
    setShowEditControls(false)
    setLastFeedback(null)
  }

  const handleEditAndRegenerate = (data: V2WorkoutRequest) => {
    form.reset(data);
    generateMutation.mutate(data);
    setShowEditControls(false);
  }

  const handleFeedback = (type: 'easy' | 'hard') => {
    // For demo purposes, we'll use a mock workout ID
    // In a real app, this would be the actual saved workout ID
    const mockWorkoutId = 'demo-workout-id';
    feedbackMutation.mutate({ type, workoutId: mockWorkoutId });
  }

  if (generatedWorkout) {
    return (
      <div className="space-y-6">
        <SectionTitle title="Generated Workout" />

        {/* AXLE Metrics Chips */}
        <TooltipProvider>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`p-3 rounded-xl ${getMetricInfo(axleMetrics.vitality, 'vitality').color} cursor-help transition-colors`}>
                  <div className="flex items-center gap-2">
                    <Battery className="w-4 h-4" />
                    <div>
                      <div className="font-semibold">Vitality</div>
                      <div className="text-lg font-bold">{axleMetrics.vitality}</div>
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{getMetricInfo(axleMetrics.vitality, 'vitality').description}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`p-3 rounded-xl ${getMetricInfo(axleMetrics.performancePotential, 'performancePotential').color} cursor-help transition-colors`}>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    <div>
                      <div className="font-semibold">Performance</div>
                      <div className="text-lg font-bold">{axleMetrics.performancePotential}</div>
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{getMetricInfo(axleMetrics.performancePotential, 'performancePotential').description}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`p-3 rounded-xl ${getMetricInfo(axleMetrics.circadianAlignment, 'circadianAlignment').color} cursor-help transition-colors`}>
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4" />
                    <div>
                      <div className="font-semibold">Circadian</div>
                      <div className="text-lg font-bold">{axleMetrics.circadianAlignment}</div>
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{getMetricInfo(axleMetrics.circadianAlignment, 'circadianAlignment').description}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`p-3 rounded-xl ${getMetricInfo(axleMetrics.energySystemsBalance, 'energySystemsBalance').color} cursor-help transition-colors`}>
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    <div>
                      <div className="font-semibold">Balance</div>
                      <div className="text-lg font-bold">{axleMetrics.energySystemsBalance}</div>
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{getMetricInfo(axleMetrics.energySystemsBalance, 'energySystemsBalance').description}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        {/* Workout Plan Card */}
        <Card className="p-6 card-shadow border border-border">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{generatedWorkout.plan?.focus}</h2>
                  <p className="text-sm text-muted-foreground">Intensity: {generatedWorkout.plan?.targetIntensity}/10</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditControls(!showEditControls)}
                  data-testid="edit-workout"
                >
                  <Edit3 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              </div>
            </div>

            {/* Workout Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <Clock className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{form.getValues('duration')}</p>
                <p className="text-xs text-muted-foreground">minutes</p>
              </div>
              <div className="text-center">
                <Target className="w-5 h-5 text-chart-2 mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{generatedWorkout.plan?.targetIntensity}</p>
                <p className="text-xs text-muted-foreground">intensity</p>
              </div>
              <div className="text-center">
                <Dumbbell className="w-5 h-5 text-chart-3 mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{generatedWorkout.plan?.blocks?.length || 0}</p>
                <p className="text-xs text-muted-foreground">blocks</p>
              </div>
              <div className="text-center">
                <Activity className="w-5 h-5 text-chart-4 mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{generatedWorkout.plan?.estimatedTSS || 0}</p>
                <p className="text-xs text-muted-foreground">TSS</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Edit Controls */}
        {showEditControls && (
          <Card className="p-6 border-2 border-primary/20 bg-primary/5">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Edit & Regenerate
            </h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleEditAndRegenerate)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (minutes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={5}
                            max={120}
                            {...field}
                            onChange={e => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="intensity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Intensity (1-10)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            {...field}
                            onChange={e => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="equipment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Available Equipment</FormLabel>
                        <FormControl>
                          <Select onValueChange={(value) => field.onChange([value])} defaultValue={field.value?.[0]}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select equipment" />
                            </SelectTrigger>
                            <SelectContent>
                              {EQUIPMENT_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={generateMutation.isPending}
                    className="flex-1"
                  >
                    {generateMutation.isPending ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <RefreshCcw className="w-4 h-4 mr-2" />
                        Regenerate
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditControls(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </Card>
        )}

        {/* Why This Plan? Expandable */}
        <Collapsible open={showRationale} onOpenChange={setShowRationale}>
          <CollapsibleTrigger asChild>
            <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <HelpCircle className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Why this plan?</span>
                </div>
                {showRationale ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </Card>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="p-6 mt-2 bg-muted/30">
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  AI Rationale & AXLE Metrics
                </h3>
                
                {/* Display AXLE scores used */}
                <div className="bg-background p-4 rounded-lg">
                  <h4 className="font-medium mb-2">AXLE Scores Used:</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Vitality: <span className="font-mono">{axleMetrics.vitality}</span></div>
                    <div>Performance Potential: <span className="font-mono">{axleMetrics.performancePotential}</span></div>
                    <div>Circadian Alignment: <span className="font-mono">{axleMetrics.circadianAlignment}</span></div>
                    <div>Energy Balance: <span className="font-mono">{axleMetrics.energySystemsBalance}</span></div>
                  </div>
                </div>

                {/* Display rationale */}
                <div className="space-y-3">
                  <h4 className="font-medium">Decision Rules:</h4>
                  {generatedWorkout.plan?.rationale?.map((reason: string, index: number) => (
                    <div key={index} className="flex items-start gap-3 text-sm">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-primary">{index + 1}</span>
                      </div>
                      <p className="text-muted-foreground">{reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Workout Structure */}
        <div className="space-y-4">
          <SectionTitle title="Workout Structure" />
          
          {generatedWorkout.plan?.blocks?.map((block: any, index: number) => (
            <Card key={index} className="p-6 card-shadow border border-border">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground capitalize">{block.type}</h3>
                  <Badge variant="outline">{block.prescription?.time ? `${Math.round(block.prescription.time / 60)} min` : 'Flexible'}</Badge>
                </div>
                
                <div className="space-y-3">
                  {block.movements?.map((movement: any, moveIndex: number) => (
                    <div key={moveIndex} className="bg-muted/30 p-3 rounded-lg">
                      <div className="font-medium text-foreground mb-1">{movement.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Category: {movement.category} | Complexity: {movement.complexity}
                      </div>
                    </div>
                  ))}
                </div>

                {block.prescription && (
                  <div className="text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Target RPE: {block.prescription.load?.value}/10</span>
                      <span>Rest: {block.rest?.betweenSets}s between sets</span>
                    </div>
                  </div>
                )}

                {block.notes && (
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg text-sm">
                    <strong>Notes:</strong> {block.notes}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Feedback & Action Buttons */}
        <div className="space-y-4">
          {/* Difficulty Feedback */}
          <Card className="p-4 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-100">How was this workout?</h3>
                <p className="text-sm text-amber-800 dark:text-amber-200">Your feedback helps us improve future recommendations</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFeedback('easy')}
                  disabled={feedbackMutation.isPending}
                  className="border-green-200 text-green-700 hover:bg-green-50"
                  data-testid="feedback-easy"
                >
                  <ThumbsUp className="w-4 h-4 mr-1" />
                  Too Easy
                </Button>
                <Button
                  variant="outline" 
                  size="sm"
                  onClick={() => handleFeedback('hard')}
                  disabled={feedbackMutation.isPending}
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  data-testid="feedback-hard"
                >
                  <ThumbsDown className="w-4 h-4 mr-1" />
                  Too Hard
                </Button>
              </div>
            </div>
          </Card>

          {/* Main Action Buttons */}
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 rounded-2xl" 
              onClick={handleGenerateNew}
              data-testid="generate-new-workout"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Generate New
            </Button>
            <Button 
              className="flex-1 rounded-2xl bg-primary text-primary-foreground" 
              onClick={handleSaveWorkout}
              disabled={saveMutation.isPending}
              data-testid="save-workout"
            >
              {saveMutation.isPending ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                'Save Workout'
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionTitle 
        title="Generate Workout" 
        subtitle="AI-powered workout generation with AXLE metrics"
      />

      {/* AXLE Metrics Display */}
      <TooltipProvider>
        <Card className="p-6 card-shadow border border-border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Current AXLE Metrics
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`p-4 rounded-xl ${getMetricInfo(axleMetrics.vitality, 'vitality').color} cursor-help transition-colors`}>
                  <div className="flex items-center gap-3">
                    <Battery className="w-5 h-5" />
                    <div>
                      <div className="font-semibold">Vitality</div>
                      <div className="text-2xl font-bold">{axleMetrics.vitality}</div>
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{getMetricInfo(axleMetrics.vitality, 'vitality').description}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`p-4 rounded-xl ${getMetricInfo(axleMetrics.performancePotential, 'performancePotential').color} cursor-help transition-colors`}>
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5" />
                    <div>
                      <div className="font-semibold">Performance</div>
                      <div className="text-2xl font-bold">{axleMetrics.performancePotential}</div>
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{getMetricInfo(axleMetrics.performancePotential, 'performancePotential').description}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`p-4 rounded-xl ${getMetricInfo(axleMetrics.circadianAlignment, 'circadianAlignment').color} cursor-help transition-colors`}>
                  <div className="flex items-center gap-3">
                    <Moon className="w-5 h-5" />
                    <div>
                      <div className="font-semibold">Circadian</div>
                      <div className="text-2xl font-bold">{axleMetrics.circadianAlignment}</div>
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{getMetricInfo(axleMetrics.circadianAlignment, 'circadianAlignment').description}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`p-4 rounded-xl ${getMetricInfo(axleMetrics.energySystemsBalance, 'energySystemsBalance').color} cursor-help transition-colors`}>
                  <div className="flex items-center gap-3">
                    <Brain className="w-5 h-5" />
                    <div>
                      <div className="font-semibold">Balance</div>
                      <div className="text-2xl font-bold">{axleMetrics.energySystemsBalance}</div>
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{getMetricInfo(axleMetrics.energySystemsBalance, 'energySystemsBalance').description}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </Card>
      </TooltipProvider>

      {/* Generation Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Duration & Intensity */}
          <Card className="p-6 card-shadow border border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Duration: {field.value} minutes
                    </FormLabel>
                    <FormControl>
                      <Slider
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                        max={120}
                        min={5}
                        step={5}
                        className="mt-4"
                        data-testid="duration-slider"
                      />
                    </FormControl>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>5 min</span>
                      <span>120 min</span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="intensity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Intensity: {field.value}/10
                    </FormLabel>
                    <FormControl>
                      <Slider
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                        max={10}
                        min={1}
                        step={1}
                        className="mt-4"
                        data-testid="intensity-slider"
                      />
                    </FormControl>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>Light</span>
                      <span>Max</span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>

          {/* Equipment Selection */}
          <Card className="p-6 card-shadow border border-border">
            <FormField
              control={form.control}
              name="equipment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Dumbbell className="w-4 h-4" />
                    Available Equipment
                  </FormLabel>
                  <FormControl>
                    <Select onValueChange={(value) => field.onChange([value])} defaultValue={field.value?.[0]}>
                      <SelectTrigger className="rounded-xl mt-4" data-testid="equipment-select">
                        <SelectValue placeholder="Select available equipment" />
                      </SelectTrigger>
                      <SelectContent>
                        {EQUIPMENT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Card>

          {/* Generate Button */}
          <Button 
            type="submit" 
            className="w-full h-14 text-lg rounded-2xl bg-primary text-primary-foreground"
            disabled={generateMutation.isPending}
            data-testid="generate-workout-button"
          >
            {generateMutation.isPending ? (
              <>
                <LoadingSpinner size="sm" className="mr-3" />
                Generating Your Perfect Workout...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-3" />
                Generate AI Workout
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}