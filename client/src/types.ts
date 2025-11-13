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
  BODYBUILDING = "Bodybuilding",
  OTHER = "Other"
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
  FOUR_HUNDRED_M = "400m Run",
  EIGHT_HUNDRED_M = "800m Run",
  ONE_MILE = "1 mile Run",
  FIVE_K = "5K Run",
  TEN_K = "10K Run",
  HALF_MARATHON = "Half Marathon Run",
  MARATHON = "Marathon Run",
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
  HEIGHT_INCHES = "in",
  HEIGHT_CM = "cm",
  METERS = "m"
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
    case MovementCategory.OTHER:
      return []; // Other movements are custom and don't have a predefined list
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
  // Custom movements go into "Other" category
  return MovementCategory.OTHER;
};

export const isWeightBasedMovement = (movement: Movement): boolean => {
  const category = getMovementCategory(movement);
  return category === MovementCategory.POWERLIFTING || 
         category === MovementCategory.OLYMPIC_WEIGHTLIFTING ||
         category === MovementCategory.OTHER || // Custom movements default to weight-based
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
  repScheme?: string; // e.g., "3x10", "EMOM 12", "AMRAP 20"
  timeCapMinutes?: number; // time cap for timed workouts
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
  // Core fields (matching database schema)
  movement: string | Movement; // Movement name or enum
  category: string | MovementCategory; // Category as string or enum
  value: number; // The PR value (weight, time, distance, reps, etc.)
  unit: string; // Unit: lbs, kg, seconds, meters, reps, calories, etc.
  
  // Optional fields
  repMax?: number; // Optional: 1,3,5,10 for strength PRs
  weightKg?: number; // Optional: weight in kg for backward compatibility
  notes?: string; // Additional notes for the PR
  workoutId?: string; // Link to workout where PR was achieved
  date: Date | string;
  createdAt: Date | string;
  
  // Legacy fields for backwards compatibility (deprecated)
  exercise?: string;
  weight?: number; // in pounds
  reps?: number;
  movementCategory?: MovementCategory;
  previousPR?: number; // previous weight for comparison
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
  
  // Health Provider System
  providers: any[];
  connections: any[];
  loadingProviders: boolean;
  loadingConnections: boolean;
  fetchProviders: () => Promise<void>;
  fetchConnections: () => Promise<void>;
  connectProvider: (providerId: string) => Promise<void>;
  disconnectProvider: (providerId: string) => Promise<void>;
  syncProviderNow: (providerId: string, params?: Record<string, any>) => Promise<any>;
  fetchReports: () => Promise<void>;
}

// Health metrics types
type MetricPoint = { date: string; value: number | null };
type HealthCharts = {
  series: MetricPoint[];
  last?: MetricPoint;
};
type MetricKey =
  | "axle_health_score" | "vitality_score" | "performance_potential" | "circadian_alignment" | "energy_systems_balance"
  | "hrv" | "resting_hr" | "sleep_score" | "fatigue_score";

export interface ReportState {
  reports: HealthReport[];
  charts: Record<MetricKey, { date: string; value: number | null }[]>;
  addReport: (report: Omit<HealthReport, 'id' | 'createdAt'>) => void;
  getRecentReports: (days: number) => HealthReport[];
  getLatestReport: () => HealthReport | undefined;
  loadHealthCharts: (days?: number) => Promise<void>;
}



// Freeform workout parsing types
export type WorkoutFormat = "EMOM" | "AMRAP" | "For Time" | "Strength" | "Skill" | "Intervals" | "Circuit" | "Other";

export interface FreeformParsed {
  request: WorkoutRequest;        // { category, durationMinutes, intensity }
  format: WorkoutFormat;
  sets: WorkoutSet[];             // reuse existing shape
  title: string;                  // e.g., "AMRAP 20 - Pull/Push/Squat"
  notes?: string;
  confidence: number;             // 0..1 from AI
}

// Location data types
export interface LocationData {
  latitude: number;
  longitude: number;
  timezone: string;
  lastUpdated: Date;
}

export interface LocationState {
  location: LocationData | null;
  setLocation: (location: LocationData) => void;
  requestAndSaveLocation: () => Promise<boolean>;
  clearLocation: () => void;
  
  // Persistent location consent state
  locationOptIn: boolean;
  timezone: string | null;
  lastLat: number | null;
  lastLon: number | null;
  
  // Location consent management methods
  hydrateLocation: () => Promise<void>;
  setLocationOptIn: (optIn: boolean) => Promise<boolean>;
  refreshLocationNow: () => Promise<boolean>;
}

export interface AppState extends WorkoutState, PRState, AchievementState, WearableState, ReportState, LocationState {
  // Profile state
  profile: any; // Will be typed properly when imported from @shared/schema
  setProfile: (profile: any) => void;
  upsertProfile: (userId: string, email: string, username?: string, firstName?: string, lastName?: string) => Promise<void>;
  patchProfile: (updates: Partial<any>) => Promise<void>;
  clearProfile: () => void;
  
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