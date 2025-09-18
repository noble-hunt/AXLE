import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation } from "@tanstack/react-query"
import { useLocation } from "wouter"
import { useToast } from "@/hooks/use-toast"
import { Category, WorkoutRequest, workoutRequestSchema } from "@shared/schema"
import { useAppStore } from "@/store/useAppStore"
import { Card } from "@/components/swift/card"
import { Button } from "@/components/swift/button"
import { SegmentedControl, Segment } from "@/components/swift/segmented-control"
import { Chip } from "@/components/swift/chip"
import { Field } from "@/components/swift/field"
import { fadeIn, slideUp } from "@/lib/motion-variants"
import { motion } from "framer-motion"
import { Dumbbell, Clock, Target, Zap, Sparkles, Play } from "lucide-react"

type WorkoutRequestForm = WorkoutRequest

const categoryLabels = {
  [Category.CROSSFIT]: "CrossFit",
  [Category.STRENGTH]: "Strength", 
  [Category.HIIT]: "HIIT",
  [Category.CARDIO]: "Cardio",
  [Category.POWERLIFTING]: "Powerlifting"
}

const intensityLabels = {
  1: "Light",
  2: "Easy", 
  3: "Moderate",
  4: "Moderate+",
  5: "Medium",
  6: "Medium+",
  7: "Hard",
  8: "Very Hard",
  9: "Intense",
  10: "Max"
}

export default function Home() {
  const [generatedWorkout, setGeneratedWorkout] = useState<any>(null)
  const { addWorkout } = useAppStore()
  const [, setLocation] = useLocation()
  const { toast } = useToast()

  const form = useForm<WorkoutRequestForm>({
    resolver: zodResolver(workoutRequestSchema),
    defaultValues: {
      category: Category.STRENGTH,
      duration: 30,
      intensity: 5,
    },
  })

  const category = form.watch("category")
  const duration = form.watch("duration")
  const intensity = form.watch("intensity")

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
      
      const { isAuthenticated, user, hydrateFromDb, addWorkout, workouts } = useAppStore.getState()
      
      // Create the workout data with generated ID
      const workoutToSave = {
        name: generatedWorkout.name,
        category: generatedWorkout.category,
        description: generatedWorkout.description,
        duration: generatedWorkout.duration,
        intensity: generatedWorkout.intensity,
        sets: generatedWorkout.sets,
        date: new Date(),
        completed: false,
        notes: 'AI Generated Workout',
      }
      
      // Add to local store (this will generate an ID and add to workouts array)
      await addWorkout(workoutToSave)
      
      // Get the newly added workout from the store (should be first in array)
      const updatedWorkouts = useAppStore.getState().workouts
      const savedWorkout = updatedWorkouts[0] // Most recent workout should be first
      
      return { workout: savedWorkout, dbSynced: isAuthenticated && user ? true : false }
    },
    onSuccess: (result) => {
      const { isAuthenticated } = useAppStore.getState()
      if (result) {
        toast({
          title: "Workout Saved!",
          description: isAuthenticated && result.dbSynced
            ? "Your workout has been saved and synced to your account."
            : "Your generated workout has been added to your workout history.",
        })
      }
      setLocation(`/workout/${result?.workout?.id || 'generated'}`)
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
      <div className="min-h-screen pb-safe-area-inset-bottom">
        <motion.div 
          className="space-y-6 pb-[calc(theme(spacing.20)+env(safe-area-inset-bottom))]"
          variants={fadeIn}
          initial="initial"
          animate="animate"
        >
          {/* Header */}
          <div className="text-center space-y-2">
            <motion.div 
              className="mx-auto w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center"
              variants={slideUp}
            >
              <Sparkles className="w-8 h-8 text-primary" />
            </motion.div>
            <h1 className="text-heading font-bold text-foreground">Workout Generated!</h1>
            <p className="text-body text-muted-foreground">{generatedWorkout.name}</p>
          </div>

          {/* Workout Summary */}
          <Card className="p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <Clock className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{generatedWorkout.duration}</p>
                <p className="text-caption text-muted-foreground">minutes</p>
              </div>
              <div>
                <Target className="w-5 h-5 text-accent mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{generatedWorkout.intensity}/10</p>
                <p className="text-caption text-muted-foreground">intensity</p>
              </div>
              <div>
                <Dumbbell className="w-5 h-5 text-secondary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{generatedWorkout.sets?.length || 0}</p>
                <p className="text-caption text-muted-foreground">exercises</p>
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="secondary" 
              onClick={handleGenerateNew}
              data-testid="generate-new-workout"
            >
              Generate New
            </Button>
            <Button 
              onClick={handleSaveWorkout}
              disabled={saveMutation.isPending}
              data-testid="save-workout"
            >
              {saveMutation.isPending ? 'Saving...' : 'Save & Start'}
            </Button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-safe-area-inset-bottom">
      <motion.div 
        className="space-y-6 pb-[calc(theme(spacing.20)+env(safe-area-inset-bottom))]"
        variants={fadeIn}
        initial="initial"
        animate="animate"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <motion.div 
            className="mx-auto w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center"
            variants={slideUp}
          >
            <Sparkles className="w-8 h-8 text-primary" />
          </motion.div>
          <h1 className="text-heading font-bold text-foreground">Generate Workout</h1>
          <p className="text-body text-muted-foreground">AI-powered personalized fitness</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Category Selection */}
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Dumbbell className="w-5 h-5 text-primary" />
                <h3 className="text-subheading font-semibold text-foreground">Workout Type</h3>
              </div>

              <SegmentedControl
                value={category}
                onValueChange={(value) => form.setValue("category", value as Category)}
                data-testid="category-selector"
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <Segment key={value} value={value}>
                    {label}
                  </Segment>
                ))}
              </SegmentedControl>
            </div>
          </Card>

          {/* Duration Slider */}
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <h3 className="text-subheading font-semibold text-foreground">Duration</h3>
                </div>
                <span className="text-subheading font-bold text-primary">{duration} min</span>
              </div>

              <div className="space-y-4">
                <input
                  type="range"
                  min="15"
                  max="120"
                  step="15"
                  value={duration}
                  onChange={(e) => form.setValue("duration", parseInt(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  data-testid="duration-slider"
                />
                <div className="flex justify-between text-caption text-muted-foreground">
                  <span>15 min</span>
                  <span>60 min</span>
                  <span>120 min</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Intensity Slider */}
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  <h3 className="text-subheading font-semibold text-foreground">Intensity</h3>
                </div>
                <div className="text-right">
                  <span className="text-subheading font-bold text-primary">{intensity}/10</span>
                  <p className="text-caption text-muted-foreground">{intensityLabels[intensity as keyof typeof intensityLabels]}</p>
                </div>
              </div>

              <div className="space-y-4">
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={intensity}
                  onChange={(e) => form.setValue("intensity", parseInt(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  data-testid="intensity-slider"
                />
                <div className="flex justify-between text-caption text-muted-foreground">
                  <span>Light</span>
                  <span>Medium</span>
                  <span>Intense</span>
                </div>
              </div>
            </div>
          </Card>

        </form>

        {/* Fixed Bottom Generate Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border">
          <div className="max-w-md mx-auto">
            <Button 
              onClick={form.handleSubmit(onSubmit)}
              className="w-full h-14 text-subheading font-semibold"
              disabled={generateMutation.isPending}
              data-testid="generate-workout-button"
            >
              {generateMutation.isPending ? (
                'Generating...'
              ) : (
                <>
                  <Sparkles className="w-6 h-6 mr-2" />
                  Generate Workout
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
