export enum Category {
  CROSSFIT = "CrossFit",
  HIIT = "HIIT", 
  POWERLIFTING = "Powerlifting",
  OLYMPIC_LIFTING = "Olympic Lifting",
  GYMNASTICS = "Gymnastics",
  CARDIO = "Cardio",
  STRENGTH = "Strength",
  MOBILITY = "Mobility"
}

// New movement tracking enums
export enum MovementCategory {
  POWERLIFTING = "Powerlifting",
  OLYMPIC_WEIGHTLIFTING = "Olympic Weightlifting",
  GYMNASTICS = "Gymnastics",
  AEROBIC = "Aerobic",
  BODYBUILDING = "Bodybuilding"
}

export enum PowerliftingMovement {
  HIGH_BAR_BACK_SQUAT = "High Bar Back Squat",
  LOW_BAR_BACK_SQUAT = "Low Bar Back Squat",
  BENCH_PRESS = "Bench Press",
  CLOSE_GRIP_BENCH = "Close Grip Bench",
  INCLINE_BENCH = "Incline Bench",
  CONVENTIONAL_DEADLIFT = "Conventional Deadlift",
  SUMO_DEADLIFT = "Sumo Deadlift",
  ROMANIAN_DEADLIFT = "Romanian Deadlift"
}

export enum OlympicWeightliftingMovement {
  CLEAN_AND_JERK = "Clean & Jerk",
  SQUAT_CLEAN = "Squat Clean",
  POWER_CLEAN = "Power Clean",
  STRICT_PRESS = "Strict Press",
  SEATED_STRICT_PRESS = "Seated Strict Press",
  PUSH_PRESS = "Push Press",
  PUSH_JERK = "Push Jerk",
  SPLIT_JERK = "Split Jerk",
  SQUAT_SNATCH = "Squat Snatch",
  POWER_SNATCH = "Power Snatch",
  OVERHEAD_SQUAT = "Overhead Squat",
  HANG_CLEAN = "Hang Clean",
  HANG_SNATCH = "Hang Snatch"
}

export enum GymnasticsMovement {
  PULL_UPS_MAX_SET = "Pull-ups (max set)",
  WEIGHTED_PULL_UP_MAX = "Weighted Pull-up (max)",
  CHIN_UPS_MAX_SET = "Chin-ups (max set)",
  WEIGHTED_CHIN_UP_MAX = "Weighted Chin-up (max)",
  PUSH_UPS_MAX_SET = "Push-ups (max set)",
  WEIGHTED_PUSH_UP_MAX = "Weighted Push-up (max)",
  RING_MU_MAX = "Ring MU (max)",
  BAR_MU_MAX = "Bar MU (max)",
  HSPU_MAX = "HSPU (max)",
  STANDING_BOX_JUMP_MAX_HEIGHT = "Standing Box Jump (max height)",
  SEATED_BOX_JUMP_MAX_HEIGHT = "Seated Box Jump (max height)"
}

export enum AerobicMovement {
  FOUR_HUNDRED_M = "400m",
  EIGHT_HUNDRED_M = "800m",
  ONE_MILE = "1 mile",
  FIVE_K = "5K",
  TEN_K = "10K",
  HALF_MARATHON = "Half Marathon",
  MARATHON = "Marathon",
  ROW_500M = "Row 500m",
  ROW_1K = "Row 1K",
  ROW_2K = "Row 2K",
  ROW_5K = "Row 5K",
  ROW_10K = "Row 10K",
  BIKE_10K = "Bike 10K",
  BIKE_20K = "Bike 20K",
  BIKE_50K = "Bike 50K",
  SKI_500M = "Ski 500m",
  SKI_1K = "Ski 1K",
  SKI_2K = "Ski 2K",
  SKI_5K = "Ski 5K",
  SKI_10K = "Ski 10K"
}

export enum BodybuildingMovement {
  // Common bodybuilding movements can be added here as needed
  BICEP_CURL = "Bicep Curl",
  TRICEP_EXTENSION = "Tricep Extension",
  LATERAL_RAISE = "Lateral Raise",
  LEG_CURL = "Leg Curl",
  LEG_EXTENSION = "Leg Extension",
  CALF_RAISE = "Calf Raise"
}

export enum RepMaxType {
  ONE_RM = "1RM",
  THREE_RM = "3RM",
  FIVE_RM = "5RM",
  TEN_RM = "10RM"
}

export enum Unit {
  KG = "kg",
  LBS = "lbs",
  REPS = "reps",
  TIME = "time", // Format: mm:ss
  HEIGHT_INCHES = "inches",
  HEIGHT_CM = "cm"
}

// Union type for all movement types
export type Movement = PowerliftingMovement | OlympicWeightliftingMovement | GymnasticsMovement | AerobicMovement | BodybuildingMovement;

// Helper type to get movements by category
export type MovementsByCategory = {
  [MovementCategory.POWERLIFTING]: PowerliftingMovement;
  [MovementCategory.OLYMPIC_WEIGHTLIFTING]: OlympicWeightliftingMovement;
  [MovementCategory.GYMNASTICS]: GymnasticsMovement;
  [MovementCategory.AEROBIC]: AerobicMovement;
  [MovementCategory.BODYBUILDING]: BodybuildingMovement;
};

// Helper functions for movement categorization
export const getMovementsByCategory = (category: MovementCategory): Movement[] => {
  switch (category) {
    case MovementCategory.POWERLIFTING:
      return Object.values(PowerliftingMovement);
    case MovementCategory.OLYMPIC_WEIGHTLIFTING:
      return Object.values(OlympicWeightliftingMovement);
    case MovementCategory.GYMNASTICS:
      return Object.values(GymnasticsMovement);
    case MovementCategory.AEROBIC:
      return Object.values(AerobicMovement);
    case MovementCategory.BODYBUILDING:
      return Object.values(BodybuildingMovement);
    default:
      return [];
  }
};

export const getMovementCategory = (movement: Movement): MovementCategory => {
  if (Object.values(PowerliftingMovement).includes(movement as PowerliftingMovement)) {
    return MovementCategory.POWERLIFTING;
  }
  if (Object.values(OlympicWeightliftingMovement).includes(movement as OlympicWeightliftingMovement)) {
    return MovementCategory.OLYMPIC_WEIGHTLIFTING;
  }
  if (Object.values(GymnasticsMovement).includes(movement as GymnasticsMovement)) {
    return MovementCategory.GYMNASTICS;
  }
  if (Object.values(AerobicMovement).includes(movement as AerobicMovement)) {
    return MovementCategory.AEROBIC;
  }
  if (Object.values(BodybuildingMovement).includes(movement as BodybuildingMovement)) {
    return MovementCategory.BODYBUILDING;
  }
  throw new Error(`Unknown movement: ${movement}`);
};

export const isWeightBasedMovement = (movement: Movement): boolean => {
  const category = getMovementCategory(movement);
  return category === MovementCategory.POWERLIFTING || 
         category === MovementCategory.OLYMPIC_WEIGHTLIFTING ||
         movement.includes('Weighted');
};

export const getDefaultUnitForMovement = (movement: Movement): Unit => {
  if (isWeightBasedMovement(movement)) {
    return Unit.LBS;
  }
  if (movement.includes('time') || movement.includes('m') || movement.includes('K') || movement.includes('Marathon')) {
    return Unit.TIME;
  }
  if (movement.includes('height') || movement.includes('Jump')) {
    return Unit.HEIGHT_INCHES;
  }
  return Unit.REPS;
};

export const shouldShowRepMaxForMovement = (movement: Movement): boolean => {
  return isWeightBasedMovement(movement);
};

export interface WorkoutSet {
  id: string;
  exercise: string;
  weight?: number;
  reps?: number;
  duration?: number; // in seconds
  distance?: number; // in meters
  restTime?: number; // in seconds
  notes?: string;
}

export interface WorkoutFeedback {
  difficulty: number; // 1-10 scale: how hard was that?
  satisfaction: number; // 1-10 scale: was this what you were looking for?
  completedAt: Date;
}

export interface Workout {
  id: string;
  name: string;
  category: Category;
  description?: string;
  duration: number; // in minutes
  intensity: number; // 1-10 scale
  sets: WorkoutSet[];
  date: Date;
  completed: boolean;
  feedback?: WorkoutFeedback;
  notes?: string;
  createdAt: Date;
}

export interface WorkoutRequest {
  category: Category;
  duration: number; // 5-120 minutes
  intensity: number; // 1-10 scale
}

export interface PR {
  id: string;
  // Legacy fields for backwards compatibility
  exercise: string;
  category: Category;
  weight: number; // in pounds
  reps?: number;
  
  // New comprehensive movement tracking fields
  movement?: Movement; // Specific movement from movement enums
  movementCategory?: MovementCategory; // Powerlifting, Olympic Weightlifting, etc.
  repMax?: RepMaxType; // 1RM, 3RM, 5RM, 10RM - optional for non-weight based
  value?: number | string; // number for weight/reps/height, string for time (mm:ss)
  unit?: Unit; // kg, lbs, reps, time, inches, cm
  notes?: string; // Additional notes for the PR
  
  // Common fields
  date: Date;
  workoutId?: string;
  previousPR?: number; // previous weight for comparison
  createdAt: Date;
}

// Enhanced PR interface for new movement tracking system
export interface EnhancedPR {
  id: string;
  movement: Movement;
  movementCategory: MovementCategory;
  repMax?: RepMaxType; // Optional for movements that don't use rep maxes
  value: number | string; // number for weight/reps/height, string for time
  unit: Unit;
  date: Date;
  workoutId?: string;
  previousValue?: number | string; // previous value for comparison
  notes?: string;
  createdAt: Date;
}

// Achievement categories for organization
export enum AchievementCategory {
  GENERAL = "General",
  POWERLIFTING = "Powerlifting",
  OLYMPIC_WEIGHTLIFTING = "Olympic Weightlifting",
  GYMNASTICS = "Gymnastics",
  AEROBIC = "Aerobic",
  BODYBUILDING = "Bodybuilding"
}

// Achievement types for different calculation methods
export enum AchievementType {
  WORKOUT_COUNT = "workout_count", // Count of completed workouts
  PR_COUNT = "pr_count", // Count of personal records logged
  TOTAL_WEIGHT = "total_weight", // Total weight lifted across PRs
  CATEGORY_WORKOUTS = "category_workouts", // Workouts in specific category
  CATEGORY_PRS = "category_prs", // PRs in specific movement category
  STREAK = "streak", // Consecutive workout days
  VOLUME_SESSION = "volume_session", // Weight lifted in single session
  TIME_BASED = "time_based", // Time-based achievements (duration, pace)
  MOVEMENT_SPECIFIC = "movement_specific", // Specific movement achievements
  COMPOUND = "compound" // Complex achievements requiring multiple conditions
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  type: AchievementType;
  target: number;
  progress: number;
  completed: boolean;
  unlockedAt?: Date;
  icon: string;
  // Optional configuration for different achievement types
  movementCategory?: MovementCategory; // For category-specific achievements
  movement?: Movement; // For movement-specific achievements
  unit?: Unit; // For weight/time/distance achievements
  createdAt: Date;
}

export interface WearableConnection {
  id: string;
  name: string;
  type: 'smartwatch' | 'fitness_tracker' | 'heart_rate_monitor' | 'smartphone';
  brand: string;
  model?: string;
  connected: boolean;
  lastSync?: Date;
  capabilities: string[];
  batteryLevel?: number;
  createdAt: Date;
}

export interface HealthMetrics {
  heartRate?: {
    resting: number;
    max: number;
    zones: { zone1: number; zone2: number; zone3: number; zone4: number; zone5: number };
  };
  steps?: number;
  calories?: number;
  sleep?: {
    duration: number; // in hours
    quality: 'poor' | 'fair' | 'good' | 'excellent';
    deepSleep: number; // in hours
  };
  recovery?: {
    score: number; // 1-100
    hrv: number; // heart rate variability
  };
}

export interface HealthReport {
  id: string;
  date: Date;
  metrics: HealthMetrics;
  workoutsCompleted: number;
  totalWorkoutTime: number; // in minutes
  avgIntensity: number; // 1-10 scale
  newPRs: number;
  streakDays: number;
  weeklyGoalProgress: number; // percentage
  insights: string[];
  createdAt: Date;
}

// Store state interfaces
export interface WorkoutState {
  workouts: Workout[];
  activeWorkout: Workout | null;
  addWorkout: (workout: Omit<Workout, 'id' | 'createdAt'>) => Promise<void>;
  updateWorkout: (id: string, updates: Partial<Workout>) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  getWorkout: (id: string) => Workout | undefined;
  setActiveWorkout: (workout: Workout | null) => void;
  completeWorkout: (id: string, feedback: WorkoutFeedback) => Promise<void>;
}

export interface PRState {
  prs: PR[];
  addPR: (pr: Omit<PR, 'id' | 'createdAt'>) => Promise<void>;
  updatePR: (id: string, updates: Partial<PR>) => Promise<void>;
  deletePR: (id: string) => Promise<void>;
  // Legacy methods for backwards compatibility
  getPRsByExercise: (exercise: string) => PR[];
  getBestPR: (exercise: string) => PR | undefined;
  // New methods for enhanced movement tracking
  getPRsByMovement: (movement: Movement) => PR[];
  getPRsByCategory: (category: MovementCategory) => PR[];
  getBestPRByMovement: (movement: Movement, repMax?: RepMaxType) => PR | undefined;
  getProgressHistory: (movement: Movement, repMax?: RepMaxType) => PR[];
}

export interface AchievementState {
  achievements: Achievement[];
  updateProgress: (id: string, progress: number) => void;
  unlockAchievement: (id: string) => Promise<void>;
  getCompletedAchievements: () => Achievement[];
  getProgressAchievements: () => Achievement[];
  recomputeAchievements: () => Promise<Achievement[]>; // Returns newly unlocked achievements
}

export interface WearableState {
  wearables: WearableConnection[];
  addWearable: (wearable: Omit<WearableConnection, 'id' | 'createdAt'>) => void;
  updateWearable: (id: string, updates: Partial<WearableConnection>) => void;
  removeWearable: (id: string) => void;
  connectWearable: (id: string) => Promise<void>;
  disconnectWearable: (id: string) => Promise<void>;
  getConnectedWearables: () => WearableConnection[];
  syncWearableData: (id: string) => Promise<void>;
}

export interface ReportState {
  reports: HealthReport[];
  addReport: (report: Omit<HealthReport, 'id' | 'createdAt'>) => void;
  getRecentReports: (days: number) => HealthReport[];
  getLatestReport: () => HealthReport | undefined;
}

export interface Profile {
  user_id: string;
  username: string;
  email: string;
  avatar_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProfileState {
  profile: Profile | null;
  setProfile: (profile: Profile) => void;
  upsertProfile: (userId: string, email: string, username?: string) => Promise<void>;
  clearProfile: () => void;
}

export interface AppState extends WorkoutState, PRState, AchievementState, WearableState, ReportState, ProfileState {
  // Global state
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  
  // Authentication state
  isAuthenticated: boolean;
  user: any;
  session: any;
  setAuth: (user: any, session: any) => void;
  clearAuth: () => void;
  authInitialized: boolean;
  setAuthInitialized: (initialized: boolean) => void;
  hydrateFromDb: (userId: string) => Promise<void>;
  clearStoreForGuest: () => void;
  
  // Server data loading
  loadServerData: (authToken: string) => Promise<void>;
  clearUserData: () => void;
  
  // Offline handling
  offlineQueue: Array<{
    id: string;
    operation: string;
    url: string;
    method: string;
    data?: any;
    timestamp: Date;
    retryCount: number;
  }>;
  addToOfflineQueue: (operation: string, url: string, method: string, data?: any) => void;
  processOfflineQueue: () => Promise<void>;
  
  // Type validation
  validatePayload: (schema: any, data: any) => boolean;
  
  // Computed properties for compatibility
  streak: number;
  weeklyWorkouts: number;
}