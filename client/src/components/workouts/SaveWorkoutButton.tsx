import { useState } from "react"
import { Bookmark, RefreshCw } from "lucide-react"
import { Button } from "@/components/swift/button"
import { useAppStore } from "@/store/useAppStore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface SaveWorkoutButtonProps {
  workoutId: string
  variant?: "primary" | "secondary" | "ghost" | "destructive"
  size?: "default" | "sm" | "lg"
  className?: string
  fullWidth?: boolean
}

export function SaveWorkoutButton({
  workoutId,
  variant = "secondary",
  size = "sm",
  className,
  fullWidth = false
}: SaveWorkoutButtonProps) {
  const { profile, patchProfile } = useAppStore()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const isSaved = profile?.savedWorkouts?.includes(workoutId) || false

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    console.log('🔍 [SaveWorkoutButton] Profile state:', profile);
    console.log('🔍 [SaveWorkoutButton] Profile exists?', !!profile);
    
    if (!profile) {
      toast({
        title: "Error",
        description: "Please sign in to save workouts",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)

    const newSavedWorkouts = isSaved
      ? (profile.savedWorkouts || []).filter((id: string) => id !== workoutId)
      : [...(profile.savedWorkouts || []), workoutId]

    try {
      // Optimistic update - UI responds instantly
      await patchProfile({ savedWorkouts: newSavedWorkouts })

      toast({
        title: isSaved ? "Workout removed" : "Workout saved",
        description: isSaved
          ? "Workout removed from your saved workouts"
          : "Workout saved! Find it in History > Saved filter"
      })
    } catch (error) {
      // Error is already handled by patchProfile (rollback)
      toast({
        title: "Error",
        description: "Failed to update saved workouts",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggleSave}
      disabled={isLoading}
      className={cn(fullWidth && "w-full", className)}
      data-testid={`save-workout-button-${workoutId}`}
    >
      {isLoading ? (
        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
      ) : isSaved ? (
        <>
          <RefreshCw className="w-4 h-4 mr-2" />
          Repeat Workout
        </>
      ) : (
        <>
          <Bookmark className="w-4 h-4 mr-2" />
          Save Workout
        </>
      )}
    </Button>
  )
}
