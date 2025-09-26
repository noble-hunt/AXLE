import { authFetch } from "@/lib/authFetch";
import { toast } from "@/hooks/use-toast";

// UUID v4 validation regex
const UUIDv4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CreateWorkoutPayload {
  title: string;
  request?: Record<string, any>;
  sets?: Record<string, any>;
  notes?: string;
  completed?: boolean;
  feedback?: Record<string, any>;
}

/**
 * Create a workout with robust authentication and UUID validation
 * Returns the workout ID if successful, throws error if failed
 * Only navigates after successful creation with valid UUID
 */
export async function createWorkout(payload: CreateWorkoutPayload): Promise<string> {
  try {
    // Make authenticated request to create workout
    const response = await authFetch("/workouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorMessage = `Server error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // Ignore JSON parsing errors for non-JSON responses
      }
      throw new Error(errorMessage);
    }

    const json = await response.json().catch(() => ({}));
    
    // Validate that we received a valid UUID
    if (!json?.id || !UUIDv4.test(json.id)) {
      console.error('[createWorkout] Invalid or missing ID:', json?.id);
      throw new Error("Server returned invalid workout ID");
    }

    console.log(`✅ Workout created with ID: ${json.id}`);
    return json.id as string;
    
  } catch (error: any) {
    console.error('[createWorkout] Failed to create workout:', error);
    throw error;
  }
}

/**
 * Create workout with integrated navigation and toast notifications
 * Returns true if successful and navigated, false if failed
 */
export async function createWorkoutAndNavigate(
  payload: CreateWorkoutPayload,
  navigate: (path: string) => void
): Promise<boolean> {
  try {
    const workoutId = await createWorkout(payload);
    
    // Navigate to workout detail page
    navigate(`/workout/${workoutId}`);
    
    toast({
      title: "Workout Created",
      description: "Your workout has been created successfully!",
    });
    
    return true;
  } catch (error: any) {
    console.error('[createWorkoutAndNavigate] Creation failed:', error);
    
    toast({
      title: "Workout Creation Failed", 
      description: error.message || "We couldn't create your workout. Please try again.",
      variant: "destructive",
    });
    
    return false;
  }
}