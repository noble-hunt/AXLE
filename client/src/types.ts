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
  exercise: string;
  category: Category;
  weight: number; // in pounds
  reps?: number;
  date: Date;
  workoutId?: string;
  previousPR?: number; // previous weight for comparison
  createdAt: Date;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: string;
  target: number;
  progress: number;
  completed: boolean;
  unlockedAt?: Date;
  icon: string;
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
  addWorkout: (workout: Omit<Workout, 'id' | 'createdAt'>) => void;
  updateWorkout: (id: string, updates: Partial<Workout>) => void;
  deleteWorkout: (id: string) => void;
  getWorkout: (id: string) => Workout | undefined;
  setActiveWorkout: (workout: Workout | null) => void;
  completeWorkout: (id: string) => void;
}

export interface PRState {
  prs: PR[];
  addPR: (pr: Omit<PR, 'id' | 'createdAt'>) => void;
  updatePR: (id: string, updates: Partial<PR>) => void;
  deletePR: (id: string) => void;
  getPRsByExercise: (exercise: string) => PR[];
  getBestPR: (exercise: string) => PR | undefined;
}

export interface AchievementState {
  achievements: Achievement[];
  updateProgress: (id: string, progress: number) => void;
  unlockAchievement: (id: string) => void;
  getCompletedAchievements: () => Achievement[];
  getProgressAchievements: () => Achievement[];
}

export interface WearableState {
  wearables: WearableConnection[];
  addWearable: (wearable: Omit<WearableConnection, 'id' | 'createdAt'>) => void;
  updateWearable: (id: string, updates: Partial<WearableConnection>) => void;
  removeWearable: (id: string) => void;
  connectWearable: (id: string) => void;
  disconnectWearable: (id: string) => void;
  getConnectedWearables: () => WearableConnection[];
}

export interface ReportState {
  reports: HealthReport[];
  addReport: (report: Omit<HealthReport, 'id' | 'createdAt'>) => void;
  getRecentReports: (days: number) => HealthReport[];
  getLatestReport: () => HealthReport | undefined;
}

export interface AppState extends WorkoutState, PRState, AchievementState, WearableState, ReportState {
  // Global state
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}