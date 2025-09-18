import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation } from "@tanstack/react-query"
import { useLocation } from "wouter"
import { SectionTitle } from "@/components/ui/section-title"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useToast } from "@/hooks/use-toast"
import { Category, WorkoutRequest, workoutRequestSchema } from "@shared/schema"
import { useAppStore } from "@/store/useAppStore"
import { apiRequest } from "@/lib/queryClient"
import { Dumbbell, Clock, Target, Zap, Sparkles } from "lucide-react"

type WorkoutRequestForm = WorkoutRequest

export default function WorkoutGenerate() {
  const [generatedWorkout, setGeneratedWorkout] = useState<any>(null)
  const { addWorkout } = useAppStore()
  const [, setLocation] = useLocation()
  const { toast } = useToast()

  // Debug readout
  console.log('Workout Generate Page State:', { 
    generatedWorkout: !!generatedWorkout,
    categories: Object.values(Category)
  })

  const form = useForm<WorkoutRequestForm>({
    resolver: zodResolver(workoutRequestSchema),
    defaultValues: {
      category: Category.STRENGTH,
      duration: 30,
      intensity: 5,
    },
  })

  const generateMutation = useMutation({
    mutationFn: async (data: WorkoutRequestForm) => {
      console.log('Generating workout with:', data)
      const { authFetch } = await import('@/lib/authFetch');
      const response = await authFetch('/api/generate-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      return await response.json()
    },
    onSuccess: (data) => {
      console.log('Generated workout:', data)
      setGeneratedWorkout(data)
      toast({
        title: "Workout Generated!",
        description: `Generated a ${data.duration}-minute ${data.category} workout.`,
      })
    },
    onError: (error: any) => {
      console.error('Generate workout error:', error)
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate workout. Please try again.",
        variant: "destructive",
      })
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!generatedWorkout) return
      
      const { isAuthenticated, user, hydrateFromDb } = useAppStore.getState()
      
      // Add to store first
      addWorkout({
        name: generatedWorkout.name,
        category: generatedWorkout.category,
        description: generatedWorkout.description,
        duration: generatedWorkout.duration,
        intensity: generatedWorkout.intensity,
        sets: generatedWorkout.sets,
        date: new Date(),
        completed: false,
        notes: 'AI Generated Workout',
      })
      
      // If authenticated, persist to Supabase
      if (isAuthenticated && user) {
        try {
          const { supabase } = await import('@/lib/supabase');
          
          const workoutData = {
            title: generatedWorkout.name,
            notes: 'AI Generated Workout',
            sets: generatedWorkout.sets || [],
            completed: false,
            request: {
              category: generatedWorkout.category,
              duration: generatedWorkout.duration,
              intensity: generatedWorkout.intensity
            },
            feedback: null
          };
          
          const { error } = await supabase
            .from('workouts')
            .insert([workoutData]);
            
          if (error) {
            console.error('Failed to persist workout to database:', error);
            // Show a specific toast for sync failure
            const { toast } = await import('@/hooks/use-toast');
            toast({
              title: "Sync Warning",
              description: "Workout saved locally, but cloud sync failed. You can retry from History.",
              variant: "destructive"
            });
            return { workout: generatedWorkout, dbSynced: false }; // Return early without rehydrating
          }
          
          console.log('✅ Workout persisted to database');
          
          // Refresh data from database to sync
          await hydrateFromDb(user.id);
          
        } catch (error) {
          console.error('Database persistence error:', error);
          // Show a warning toast for other errors
          const { toast } = await import('@/hooks/use-toast');
          toast({
            title: "Sync Warning", 
            description: "Workout saved locally, but cloud sync failed. You can retry from History.",
            variant: "destructive"
          });
          return { workout: generatedWorkout, dbSynced: false };
        }
      }
      
      return { workout: generatedWorkout, dbSynced: isAuthenticated && user ? true : false }
    },
    onSuccess: (result) => {
      const { isAuthenticated } = useAppStore.getState()
      if (result) {
        toast({
          title: "Workout Saved!",
          description: isAuthenticated && result.dbSynced
            ? "Your workout has been saved and synced to your account."
            : isAuthenticated && !result.dbSynced
            ? "Workout saved locally. Cloud sync failed - you can retry from History."
            : "Your generated workout has been added to your workout history.",
        })
      }
      setLocation('/history')
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

  const onSubmit = (data: WorkoutRequestForm) => {
    generateMutation.mutate(data)
  }

  const handleSaveWorkout = () => {
    saveMutation.mutate()
  }

  const handleGenerateNew = () => {
    setGeneratedWorkout(null)
    form.reset()
  }

  if (generatedWorkout) {
    return (
      <>
        <SectionTitle title="Generated Workout" />

        <Card className="p-6 card-shadow border border-border">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{generatedWorkout.name}</h2>
                <p className="text-sm text-muted-foreground">{generatedWorkout.description}</p>
              </div>
            </div>

            {/* Workout Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <Clock className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{generatedWorkout.duration}</p>
                <p className="text-xs text-muted-foreground">minutes</p>
              </div>
              <div className="text-center">
                <Target className="w-5 h-5 text-chart-2 mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{generatedWorkout.intensity}</p>
                <p className="text-xs text-muted-foreground">intensity</p>
              </div>
              <div className="text-center">
                <Dumbbell className="w-5 h-5 text-chart-3 mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{generatedWorkout.sets?.length || 0}</p>
                <p className="text-xs text-muted-foreground">exercises</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Exercise List */}
        <div className="space-y-4">
          <SectionTitle title="Workout Structure" />
          
          {(() => {
            // Group exercises by type
            const warmupSets = generatedWorkout.sets?.filter((set: any) => 
              set.exercise.toLowerCase().includes('warm') || 
              set.exercise.toLowerCase().includes('dynamic')
            ) || []
            
            const metconSets = generatedWorkout.sets?.filter((set: any) => 
              set.exercise.toLowerCase().includes('metcon')
            ) || []
            
            const otherSets = generatedWorkout.sets?.filter((set: any) => 
              !set.exercise.toLowerCase().includes('warm') && 
              !set.exercise.toLowerCase().includes('dynamic') &&
              !set.exercise.toLowerCase().includes('metcon')
            ) || []

            const formatExerciseContent = (sets: any[]) => {
              if (sets.length === 0) return null;
              
              // For single set, use the notes which contain the full formatted content
              if (sets.length === 1 && sets[0].notes) {
                return sets[0].notes.split('\n').map((line: string, i: number) => (
                  <div key={i} className={line.trim() === '' ? 'h-3' : ''}>
                    {line.trim() === '' ? <br /> : line.trim()}
                  </div>
                ));
              }
              
              // For multiple sets, format each exercise
              return sets.map((set: any, index: number) => (
                <div key={index} className="space-y-1">
                  {set.exercise && (
                    <div className="font-medium text-foreground">{set.exercise}</div>
                  )}
                  {(set.reps || set.weight || set.duration || set.distance) && (
                    <div className="text-sm text-muted-foreground">
                      {set.reps && <div>{set.reps} reps</div>}
                      {set.weight && <div>{set.weight} lbs</div>}
                      {set.duration && <div>{set.duration} seconds</div>}
                      {set.distance && <div>{set.distance} meters</div>}
                    </div>
                  )}
                  {set.notes && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {set.notes.split('\n').map((line: string, i: number) => (
                        <div key={i} className={line.trim() === '' ? 'h-2' : ''}>
                          {line.trim() === '' ? <br /> : line.trim()}
                        </div>
                      ))}
                    </div>
                  )}
                  {index < sets.length - 1 && <div className="h-3" />}
                </div>
              ));
            };

            return (
              <>
                {/* Warm-up Section */}
                {warmupSets.length > 0 && (
                  <Card className="p-6 card-shadow border border-border" data-testid="warmup-section">
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-foreground">Warm-up</h3>
                      <div className="text-sm leading-relaxed">
                        {formatExerciseContent(warmupSets)}
                      </div>
                    </div>
                  </Card>
                )}

                {/* Metcon Section */}
                {metconSets.length > 0 && (
                  <Card className="p-6 card-shadow border border-border" data-testid="metcon-section">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-foreground">Metcon</h3>
                      <div className="text-sm leading-relaxed space-y-4">
                        {formatExerciseContent(metconSets)}
                      </div>
                    </div>
                  </Card>
                )}

                {/* Other Exercises */}
                {otherSets.length > 0 && (
                  <Card className="p-6 card-shadow border border-border" data-testid="other-exercises-section">
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-foreground">Exercises</h3>
                      <div className="text-sm leading-relaxed space-y-3">
                        {formatExerciseContent(otherSets)}
                      </div>
                    </div>
                  </Card>
                )}
              </>
            );
          })()}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1 rounded-2xl" 
            onClick={handleGenerateNew}
            data-testid="generate-new-workout"
          >
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
      </>
    )
  }

  return (
    <>
      <SectionTitle 
        title="Generate Workout" 
        subtitle="AI-powered workout generation"
      />

      {/* Introduction Card */}
      <Card className="p-6 card-shadow border border-border">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">AI Workout Generator</h3>
            <p className="text-sm text-muted-foreground">Get a personalized workout based on your preferences</p>
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground space-y-2">
          <p>• Choose your preferred workout category and style</p>
          <p>• Set your desired duration and intensity level</p>
          <p>• Get a complete workout with exercises, sets, and reps</p>
        </div>
      </Card>

      {/* Generation Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Category Selection */}
          <Card className="p-6 card-shadow border border-border">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Dumbbell className="w-4 h-4" />
                    Workout Category
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="rounded-xl" data-testid="category-select">
                        <SelectValue placeholder="Select a workout category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(Category).map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Card>

          {/* Duration Slider */}
          <Card className="p-6 card-shadow border border-border">
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
                    <div className="px-3">
                      <Slider
                        min={5}
                        max={120}
                        step={5}
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                        className="w-full"
                        data-testid="duration-slider"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>5 min</span>
                        <span>60 min</span>
                        <span>120 min</span>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Card>

          {/* Intensity Slider */}
          <Card className="p-6 card-shadow border border-border">
            <FormField
              control={form.control}
              name="intensity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Intensity: {field.value}/10
                  </FormLabel>
                  <FormControl>
                    <div className="px-3">
                      <Slider
                        min={1}
                        max={10}
                        step={1}
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                        className="w-full"
                        data-testid="intensity-slider"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>Low</span>
                        <span>Medium</span>
                        <span>High</span>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Card>

          {/* Generate Button */}
          <Button 
            type="submit" 
            className="w-full rounded-2xl bg-primary text-primary-foreground h-12 text-base"
            disabled={generateMutation.isPending}
            data-testid="generate-workout-button"
          >
            {generateMutation.isPending ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Workout
              </>
            )}
          </Button>
          
        </form>
      </Form>
    </>
  )
}