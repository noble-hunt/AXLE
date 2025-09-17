import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Category, 
  Workout, 
  PR, 
  Achievement, 
  AchievementCategory,
  AchievementType,
  WearableConnection, 
  HealthReport,
  AppState,
  WorkoutSet,
  Movement,
  MovementCategory,
  PowerliftingMovement,
  OlympicWeightliftingMovement,
  GymnasticsMovement,
  AerobicMovement,
  RepMaxType,
  Unit,
  WorkoutFeedback
} from '../types';
import { computeAllAchievements, getNewlyUnlocked } from '../utils/achievementsEngine';

// Seed data
const generateId = () => Math.random().toString(36).substring(2, 15);

// Helper function to convert time string (mm:ss) to seconds
const timeToSeconds = (timeStr: string): number => {
  const [minutes, seconds] = timeStr.split(':').map(Number);
  return minutes * 60 + seconds;
};

const seedWorkouts: Workout[] = [
  {
    id: 'workout-fran',
    name: 'Fran',
    category: Category.CROSSFIT,
    description: 'The classic CrossFit benchmark workout',
    duration: 8,
    intensity: 9,
    sets: [
      { id: 'fran-1', exercise: 'Thrusters', weight: 95, reps: 21 },
      { id: 'fran-2', exercise: 'Pull-ups', reps: 21 },
      { id: 'fran-3', exercise: 'Thrusters', weight: 95, reps: 15 },
      { id: 'fran-4', exercise: 'Pull-ups', reps: 15 },
      { id: 'fran-5', exercise: 'Thrusters', weight: 95, reps: 9 },
      { id: 'fran-6', exercise: 'Pull-ups', reps: 9 },
    ],
    date: new Date('2024-01-15'),
    completed: true,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'workout-cindy',
    name: 'Cindy',
    category: Category.CROSSFIT,
    description: 'AMRAP 20 minutes',
    duration: 20,
    intensity: 7,
    sets: [
      { id: 'cindy-1', exercise: 'Pull-ups', reps: 5 },
      { id: 'cindy-2', exercise: 'Push-ups', reps: 10 },
      { id: 'cindy-3', exercise: 'Air Squats', reps: 15 },
    ],
    date: new Date('2024-01-20'),
    completed: true,
    notes: 'Completed 18 full rounds',
    createdAt: new Date('2024-01-20'),
  },
  {
    id: 'workout-helen',
    name: 'Helen',
    category: Category.CROSSFIT,
    description: 'Three rounds for time',
    duration: 12,
    intensity: 8,
    sets: [
      { id: 'helen-1', exercise: '400m Run', distance: 400, reps: 1 },
      { id: 'helen-2', exercise: 'Kettlebell Swings', weight: 53, reps: 21 },
      { id: 'helen-3', exercise: 'Pull-ups', reps: 12 },
    ],
    date: new Date('2024-01-25'),
    completed: true,
    createdAt: new Date('2024-01-25'),
  },
  {
    id: 'workout-hiit-1',
    name: 'HIIT Cardio Blast',
    category: Category.HIIT,
    description: 'High-intensity interval training',
    duration: 25,
    intensity: 8,
    sets: [
      { id: 'hiit-1', exercise: 'Burpees', duration: 30, reps: 1 },
      { id: 'hiit-2', exercise: 'Mountain Climbers', duration: 30, reps: 1 },
      { id: 'hiit-3', exercise: 'Jump Squats', duration: 30, reps: 1 },
      { id: 'hiit-4', exercise: 'High Knees', duration: 30, reps: 1 },
    ],
    date: new Date('2024-01-30'),
    completed: false,
    createdAt: new Date('2024-01-30'),
  },
];

const seedPRs: PR[] = [
  // Legacy format PRs maintained for compatibility
  {
    id: 'pr-deadlift',
    exercise: 'Deadlift',
    category: Category.POWERLIFTING,
    weight: 405,
    reps: 1,
    date: new Date('2024-01-28'),
    previousPR: 385,
    createdAt: new Date('2024-01-28'),
    // Enhanced fields
    movement: PowerliftingMovement.CONVENTIONAL_DEADLIFT,
    movementCategory: MovementCategory.POWERLIFTING,
    repMax: RepMaxType.ONE_RM,
    value: 405,
    unit: Unit.LBS,
  },
  {
    id: 'pr-squat',
    exercise: 'Back Squat',
    category: Category.POWERLIFTING,
    weight: 315,
    reps: 1,
    date: new Date('2024-01-22'),
    previousPR: 295,
    createdAt: new Date('2024-01-22'),
    // Enhanced fields
    movement: PowerliftingMovement.HIGH_BAR_BACK_SQUAT,
    movementCategory: MovementCategory.POWERLIFTING,
    repMax: RepMaxType.ONE_RM,
    value: 315,
    unit: Unit.LBS,
  },
  {
    id: 'pr-bench',
    exercise: 'Bench Press',
    category: Category.POWERLIFTING,
    weight: 225,
    reps: 1,
    date: new Date('2024-01-18'),
    previousPR: 215,
    createdAt: new Date('2024-01-18'),
    // Enhanced fields
    movement: PowerliftingMovement.BENCH_PRESS,
    movementCategory: MovementCategory.POWERLIFTING,
    repMax: RepMaxType.ONE_RM,
    value: 225,
    unit: Unit.LBS,
  },
  {
    id: 'pr-clean',
    exercise: 'Clean & Jerk',
    category: Category.OLYMPIC_LIFTING,
    weight: 185,
    reps: 1,
    date: new Date('2024-01-26'),
    previousPR: 175,
    createdAt: new Date('2024-01-26'),
    // Enhanced fields
    movement: OlympicWeightliftingMovement.CLEAN_AND_JERK,
    movementCategory: MovementCategory.OLYMPIC_WEIGHTLIFTING,
    repMax: RepMaxType.ONE_RM,
    value: 185,
    unit: Unit.LBS,
  },
  {
    id: 'pr-snatch',
    exercise: 'Snatch',
    category: Category.OLYMPIC_LIFTING,
    weight: 155,
    reps: 1,
    date: new Date('2024-01-24'),
    previousPR: 145,
    createdAt: new Date('2024-01-24'),
    // Enhanced fields
    movement: OlympicWeightliftingMovement.SQUAT_SNATCH,
    movementCategory: MovementCategory.OLYMPIC_WEIGHTLIFTING,
    repMax: RepMaxType.ONE_RM,
    value: 155,
    unit: Unit.LBS,
  },
  // Additional enhanced PRs for demonstration
  {
    id: 'pr-squat-3rm',
    exercise: 'Back Squat',
    category: Category.POWERLIFTING,
    weight: 335,
    reps: 3,
    date: new Date('2024-01-15'),
    createdAt: new Date('2024-01-15'),
    // Enhanced fields
    movement: PowerliftingMovement.HIGH_BAR_BACK_SQUAT,
    movementCategory: MovementCategory.POWERLIFTING,
    repMax: RepMaxType.THREE_RM,
    value: 335,
    unit: Unit.LBS,
  },
  {
    id: 'pr-pullups',
    exercise: 'Pull-ups',
    category: Category.GYMNASTICS,
    weight: 0,
    reps: 25,
    date: new Date('2024-01-20'),
    createdAt: new Date('2024-01-20'),
    // Enhanced fields
    movement: GymnasticsMovement.PULL_UPS_MAX_SET,
    movementCategory: MovementCategory.GYMNASTICS,
    value: 25,
    unit: Unit.REPS,
  },
  {
    id: 'pr-5k-run',
    exercise: '5K Run',
    category: Category.CARDIO,
    weight: 0,
    date: new Date('2024-01-12'),
    createdAt: new Date('2024-01-12'),
    // Enhanced fields
    movement: AerobicMovement.FIVE_K,
    movementCategory: MovementCategory.AEROBIC,
    value: '22:45',
    unit: Unit.TIME,
  },
];

const seedAchievements: Achievement[] = [
  {
    id: 'achievement-completionist',
    title: 'Completionist',
    description: 'Complete 25 total workouts',
    category: AchievementCategory.GENERAL,
    type: AchievementType.WORKOUT_COUNT,
    target: 25,
    progress: 18,
    completed: false,
    icon: '🏆',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-pr-machine',
    title: 'PR Machine',
    description: 'Set 10 personal records',
    category: AchievementCategory.GENERAL,
    type: AchievementType.PR_COUNT,
    target: 10,
    progress: 5,
    completed: false,
    icon: '💪',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-weight-master',
    title: 'Weight Master',
    description: 'Lift 10,000 total pounds across all PRs',
    category: AchievementCategory.GENERAL,
    type: AchievementType.TOTAL_WEIGHT,
    target: 10000,
    progress: 7500,
    completed: false,
    icon: '🏋️',
    unit: Unit.LBS,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-bodyweight-ninja',
    title: 'Bodyweight Ninja',
    description: 'Complete 15 Gymnastics workouts',
    category: AchievementCategory.GYMNASTICS,
    type: AchievementType.CATEGORY_WORKOUTS,
    target: 15,
    progress: 12,
    completed: false,
    icon: '🥷',
    movementCategory: MovementCategory.GYMNASTICS,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-engine-builder',
    title: 'Engine Builder',
    description: 'Complete 10 Aerobic workouts',
    category: AchievementCategory.AEROBIC,
    type: AchievementType.CATEGORY_WORKOUTS,
    target: 10,
    progress: 7,
    completed: false,
    icon: '🫁',
    movementCategory: MovementCategory.AEROBIC,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-bar-slayer',
    title: 'Bar Slayer',
    description: 'Complete 10 Powerlifting workouts',
    category: AchievementCategory.POWERLIFTING,
    type: AchievementType.CATEGORY_WORKOUTS,
    target: 10,
    progress: 4,
    completed: false,
    icon: '🔥',
    movementCategory: MovementCategory.POWERLIFTING,
    createdAt: new Date('2024-01-01'),
  },
  // Additional Powerlifting Achievements
  {
    id: 'achievement-iron-warrior',
    title: 'Iron Warrior',
    description: 'Log 50 Powerlifting PRs',
    category: AchievementCategory.POWERLIFTING,
    type: AchievementType.CATEGORY_PRS,
    target: 50,
    progress: 3,
    completed: false,
    icon: '⚔️',
    movementCategory: MovementCategory.POWERLIFTING,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-heavy-hitter',
    title: 'Heavy Hitter',
    description: 'Lift 2,000+ lbs total in Powerlifting PRs',
    category: AchievementCategory.POWERLIFTING,
    type: AchievementType.COMPOUND,
    target: 2000,
    progress: 945,
    completed: false,
    icon: '💥',
    movementCategory: MovementCategory.POWERLIFTING,
    unit: Unit.LBS,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-triple-digit-club',
    title: 'Triple Digit Club',
    description: 'Bench press 315 lbs (3 plates)',
    category: AchievementCategory.POWERLIFTING,
    type: AchievementType.MOVEMENT_SPECIFIC,
    target: 315,
    progress: 225,
    completed: false,
    icon: '🏋️‍♂️',
    movement: PowerliftingMovement.BENCH_PRESS,
    unit: Unit.LBS,
    createdAt: new Date('2024-01-01'),
  },
  // Olympic Weightlifting Achievements
  {
    id: 'achievement-olympic-lifter',
    title: 'Olympic Lifter',
    description: 'Complete 10 Olympic Weightlifting workouts',
    category: AchievementCategory.OLYMPIC_WEIGHTLIFTING,
    type: AchievementType.CATEGORY_WORKOUTS,
    target: 10,
    progress: 2,
    completed: false,
    icon: '🥇',
    movementCategory: MovementCategory.OLYMPIC_WEIGHTLIFTING,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-clean-slate',
    title: 'Clean Slate',
    description: 'Log 25 Olympic Weightlifting PRs',
    category: AchievementCategory.OLYMPIC_WEIGHTLIFTING,
    type: AchievementType.CATEGORY_PRS,
    target: 25,
    progress: 2,
    completed: false,
    icon: '🧹',
    movementCategory: MovementCategory.OLYMPIC_WEIGHTLIFTING,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-snatch-specialist',
    title: 'Snatch Specialist',
    description: 'Total snatch weight exceeds 1,000 lbs',
    category: AchievementCategory.OLYMPIC_WEIGHTLIFTING,
    type: AchievementType.TOTAL_WEIGHT,
    target: 1000,
    progress: 155,
    completed: false,
    icon: '⚡',
    movementCategory: MovementCategory.OLYMPIC_WEIGHTLIFTING,
    unit: Unit.LBS,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-jerk-champion',
    title: 'Jerk Champion',
    description: 'Clean & Jerk 275+ lbs',
    category: AchievementCategory.OLYMPIC_WEIGHTLIFTING,
    type: AchievementType.MOVEMENT_SPECIFIC,
    target: 275,
    progress: 185,
    completed: false,
    icon: '👑',
    movement: OlympicWeightliftingMovement.CLEAN_AND_JERK,
    unit: Unit.LBS,
    createdAt: new Date('2024-01-01'),
  },
  // Additional Gymnastics Achievements
  {
    id: 'achievement-calisthenics-king',
    title: 'Calisthenics King',
    description: 'Log 30 Gymnastics PRs',
    category: AchievementCategory.GYMNASTICS,
    type: AchievementType.CATEGORY_PRS,
    target: 30,
    progress: 1,
    completed: false,
    icon: '👑',
    movementCategory: MovementCategory.GYMNASTICS,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-pullup-pro',
    title: 'Pull-Up Pro',
    description: 'Achieve 20+ pull-ups in single set',
    category: AchievementCategory.GYMNASTICS,
    type: AchievementType.MOVEMENT_SPECIFIC,
    target: 20,
    progress: 25,
    completed: true,
    unlockedAt: new Date('2024-01-20'),
    icon: '💪',
    movement: GymnasticsMovement.PULL_UPS_MAX_SET,
    unit: Unit.REPS,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-muscle-up-master',
    title: 'Muscle-Up Master',
    description: 'Complete 5+ muscle-ups in single set',
    category: AchievementCategory.GYMNASTICS,
    type: AchievementType.MOVEMENT_SPECIFIC,
    target: 5,
    progress: 0,
    completed: false,
    icon: '🚀',
    movement: GymnasticsMovement.RING_MU_MAX,
    unit: Unit.REPS,
    createdAt: new Date('2024-01-01'),
  },
  // Additional Aerobic Achievements
  {
    id: 'achievement-cardio-crusher',
    title: 'Cardio Crusher',
    description: 'Log 25 Aerobic PRs',
    category: AchievementCategory.AEROBIC,
    type: AchievementType.CATEGORY_PRS,
    target: 25,
    progress: 1,
    completed: false,
    icon: '💨',
    movementCategory: MovementCategory.AEROBIC,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-speed-demon',
    title: 'Speed Demon',
    description: 'Run 5K under 25:00',
    category: AchievementCategory.AEROBIC,
    type: AchievementType.MOVEMENT_SPECIFIC,
    target: 1500, // 25:00 in seconds
    progress: 1365, // 22:45 in seconds  
    completed: true,
    unlockedAt: new Date('2024-01-12'),
    icon: '⚡',
    movement: AerobicMovement.FIVE_K,
    unit: Unit.TIME,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-distance-demon',
    title: 'Distance Demon',
    description: 'Complete a marathon distance (26.2 miles)',
    category: AchievementCategory.AEROBIC,
    type: AchievementType.MOVEMENT_SPECIFIC,
    target: 1, // Just completion
    progress: 0,
    completed: false,
    icon: '🏃‍♂️',
    movement: AerobicMovement.MARATHON,
    createdAt: new Date('2024-01-01'),
  },
  // Bodybuilding Achievements
  {
    id: 'achievement-muscle-builder',
    title: 'Muscle Builder',
    description: 'Complete 20 Bodybuilding workouts',
    category: AchievementCategory.BODYBUILDING,
    type: AchievementType.CATEGORY_WORKOUTS,
    target: 20,
    progress: 0,
    completed: false,
    icon: '💪',
    movementCategory: MovementCategory.BODYBUILDING,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-pump-chaser',
    title: 'Pump Chaser',
    description: 'Log 40 Bodybuilding PRs',
    category: AchievementCategory.BODYBUILDING,
    type: AchievementType.CATEGORY_PRS,
    target: 40,
    progress: 0,
    completed: false,
    icon: '🔥',
    movementCategory: MovementCategory.BODYBUILDING,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-hypertrophy-hero',
    title: 'Hypertrophy Hero',
    description: 'Log PRs in 6+ different Bodybuilding movements',
    category: AchievementCategory.BODYBUILDING,
    type: AchievementType.COMPOUND,
    target: 6,
    progress: 0,
    completed: false,
    icon: '🦾',
    movementCategory: MovementCategory.BODYBUILDING,
    createdAt: new Date('2024-01-01'),
  },
];

const seedWearables: WearableConnection[] = [
  {
    id: 'wearable-apple-health',
    name: 'Apple Health',
    type: 'smartphone',
    brand: 'Apple',
    model: 'Health App',
    connected: false,
    capabilities: ['heart_rate', 'steps', 'sleep_tracking', 'workout_tracking', 'health_records'],
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'wearable-apple-watch',
    name: 'Apple Watch Series 9',
    type: 'smartwatch',
    brand: 'Apple',
    model: 'Series 9',
    connected: false,
    capabilities: ['heart_rate', 'gps', 'workout_tracking', 'sleep_tracking', 'ecg'],
    batteryLevel: 85,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'wearable-garmin',
    name: 'Garmin Fenix 7',
    type: 'smartwatch',
    brand: 'Garmin',
    model: 'Fenix 7',
    connected: false,
    capabilities: ['heart_rate', 'gps', 'workout_tracking', 'sleep_tracking', 'body_battery'],
    batteryLevel: 92,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'wearable-whoop',
    name: 'WHOOP 4.0',
    type: 'fitness_tracker',
    brand: 'WHOOP',
    model: '4.0',
    connected: false,
    capabilities: ['heart_rate', 'hrv', 'recovery', 'sleep_tracking', 'strain'],
    batteryLevel: 62,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'wearable-fitbit',
    name: 'Fitbit Charge 6',
    type: 'fitness_tracker',
    brand: 'Fitbit',
    model: 'Charge 6',
    connected: false,
    capabilities: ['heart_rate', 'steps', 'sleep_tracking', 'workout_tracking', 'stress'],
    batteryLevel: 78,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'wearable-oura',
    name: 'Oura Ring Gen3',
    type: 'fitness_tracker',
    brand: 'Oura',
    model: 'Gen3',
    connected: false,
    capabilities: ['heart_rate', 'hrv', 'recovery', 'sleep_tracking', 'temperature'],
    batteryLevel: 45,
    createdAt: new Date('2024-01-01'),
  },
];

const seedReports: HealthReport[] = [
  {
    id: 'report-yesterday',
    date: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
    metrics: {
      heartRate: {
        resting: 58,
        max: 185,
        zones: { zone1: 125, zone2: 145, zone3: 165, zone4: 175, zone5: 185 },
      },
      steps: 12450,
      calories: 2850,
      sleep: {
        duration: 7.5,
        quality: 'good',
        deepSleep: 2.1,
      },
      recovery: {
        score: 78,
        hrv: 45,
      },
    },
    workoutsCompleted: 1,
    totalWorkoutTime: 45,
    avgIntensity: 8,
    newPRs: 1,
    streakDays: 12,
    weeklyGoalProgress: 80,
    insights: [
      'Great workout intensity today',
      'Sleep quality could be improved',
      'Heart rate recovery is excellent',
    ],
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: 'report-today',
    date: new Date(),
    metrics: {
      heartRate: {
        resting: 60,
        max: 188,
        zones: { zone1: 127, zone2: 147, zone3: 167, zone4: 177, zone5: 188 },
      },
      steps: 8750,
      calories: 2650,
      sleep: {
        duration: 8.0,
        quality: 'excellent',
        deepSleep: 2.4,
      },
      recovery: {
        score: 85,
        hrv: 48,
      },
    },
    workoutsCompleted: 0,
    totalWorkoutTime: 0,
    avgIntensity: 0,
    newPRs: 0,
    streakDays: 13,
    weeklyGoalProgress: 85,
    insights: [
      'Excellent sleep quality',
      'Recovery score is high',
      'Consider a light workout today',
    ],
    createdAt: new Date(),
  },
];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Theme
      theme: 'light',
      setTheme: (theme) => set({ theme }),

      // Computed properties for compatibility
      get streak() {
        // Calculate streak based on consecutive workout days
        const completedWorkouts = get().workouts.filter(w => w.completed);
        if (completedWorkouts.length === 0) return 0;
        
        const sortedWorkouts = completedWorkouts.sort((a, b) => b.date.getTime() - a.date.getTime());
        let streak = 0;
        const today = new Date();
        
        for (const workout of sortedWorkouts) {
          const daysDiff = Math.floor((today.getTime() - workout.date.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff === streak || (streak === 0 && daysDiff <= 1)) {
            streak++;
          } else {
            break;
          }
        }
        return streak || 13; // Default fallback
      },
      
      get weeklyWorkouts() {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const weeklyCount = get().workouts.filter(w => 
          w.completed && w.date >= oneWeekAgo
        ).length;
        return weeklyCount || 4; // Default fallback
      },

      // Workouts
      workouts: seedWorkouts,
      activeWorkout: null,
      
      addWorkout: (workoutData) => {
        const workout: Workout = {
          ...workoutData,
          id: generateId(),
          createdAt: new Date(),
        };
        set((state) => ({ workouts: [workout, ...state.workouts] }));
      },
      
      updateWorkout: (id, updates) => {
        set((state) => ({
          workouts: state.workouts.map((workout) =>
            workout.id === id ? { ...workout, ...updates } : workout
          ),
        }));
      },
      
      deleteWorkout: (id) => {
        set((state) => ({
          workouts: state.workouts.filter((workout) => workout.id !== id),
        }));
      },
      
      getWorkout: (id) => {
        return get().workouts.find((workout) => workout.id === id);
      },
      
      setActiveWorkout: (workout) => {
        set({ activeWorkout: workout });
      },
      
      completeWorkout: async (id: string, feedback: WorkoutFeedback) => {
        try {
          // Update on server first
          const response = await fetch(`/api/workouts/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              completed: true,
              feedback: feedback
            })
          });

          if (!response.ok) {
            throw new Error('Failed to update workout on server');
          }

          // Update local state
          set((state) => ({
            workouts: state.workouts.map((workout) =>
              workout.id === id 
                ? { 
                    ...workout, 
                    completed: true, 
                    feedback: feedback 
                  } 
                : workout
            ),
          }));
          
          // Recompute achievements after workout completion
          get().recomputeAchievements();
        } catch (error) {
          console.error('Failed to complete workout:', error);
          throw error; // Re-throw so the UI can handle it
        }
      },

      // PRs
      prs: seedPRs,
      
      addPR: (prData) => {
        const pr: PR = {
          ...prData,
          id: generateId(),
          createdAt: new Date(),
        };
        set((state) => ({ prs: [pr, ...state.prs] }));
        // Recompute achievements after adding PR
        get().recomputeAchievements();
      },
      
      updatePR: (id, updates) => {
        set((state) => ({
          prs: state.prs.map((pr) => (pr.id === id ? { ...pr, ...updates } : pr)),
        }));
      },
      
      deletePR: (id) => {
        set((state) => ({
          prs: state.prs.filter((pr) => pr.id !== id),
        }));
      },
      
      getPRsByExercise: (exercise) => {
        return get().prs.filter((pr) => pr.exercise === exercise);
      },
      
      getBestPR: (exercise) => {
        const exercisePRs = get().prs.filter((pr) => pr.exercise === exercise);
        return exercisePRs.reduce((best, current) => 
          current.weight > (best?.weight || 0) ? current : best, 
          exercisePRs[0]
        );
      },

      // New methods for enhanced movement tracking
      getPRsByMovement: (movement) => {
        return get().prs.filter((pr) => pr.movement === movement);
      },

      getPRsByCategory: (category) => {
        return get().prs.filter((pr) => pr.movementCategory === category);
      },

      getBestPRByMovement: (movement, repMax) => {
        const movementPRs = get().prs.filter((pr) => 
          pr.movement === movement && (!repMax || pr.repMax === repMax)
        );
        return movementPRs.reduce((best, current) => {
          if (!best) return current;
          // For numeric values, compare directly
          if (typeof current.value === 'number' && typeof best.value === 'number') {
            return current.value > best.value ? current : best;
          }
          // For time values (string format mm:ss), convert to seconds for comparison
          if (typeof current.value === 'string' && typeof best.value === 'string') {
            const currentSeconds = timeToSeconds(current.value);
            const bestSeconds = timeToSeconds(best.value);
            return currentSeconds < bestSeconds ? current : best; // Lower time is better
          }
          return best;
        }, movementPRs[0]);
      },

      getProgressHistory: (movement, repMax) => {
        return get().prs
          .filter((pr) => pr.movement === movement && (!repMax || pr.repMax === repMax))
          .sort((a, b) => a.date.getTime() - b.date.getTime());
      },

      // Achievements
      achievements: seedAchievements,
      
      updateProgress: (id, progress) => {
        set((state) => ({
          achievements: state.achievements.map((achievement) =>
            achievement.id === id ? { ...achievement, progress } : achievement
          ),
        }));
      },
      
      unlockAchievement: (id) => {
        set((state) => ({
          achievements: state.achievements.map((achievement) =>
            achievement.id === id
              ? { ...achievement, completed: true, unlockedAt: new Date() }
              : achievement
          ),
        }));
      },
      
      getCompletedAchievements: () => {
        return get().achievements.filter((achievement) => achievement.completed);
      },
      
      getProgressAchievements: () => {
        return get().achievements.filter((achievement) => !achievement.completed);
      },

      recomputeAchievements: () => {
        const state = get();
        const oldAchievements = state.achievements;
        const newAchievements = computeAllAchievements(oldAchievements, state.workouts, state.prs);
        const newlyUnlocked = getNewlyUnlocked(oldAchievements, newAchievements);
        
        set({ achievements: newAchievements });
        
        return newlyUnlocked;
      },

      // Wearables
      wearables: seedWearables,
      
      addWearable: (wearableData) => {
        const wearable: WearableConnection = {
          ...wearableData,
          id: generateId(),
          createdAt: new Date(),
        };
        set((state) => ({ wearables: [...state.wearables, wearable] }));
      },
      
      updateWearable: (id, updates) => {
        set((state) => ({
          wearables: state.wearables.map((wearable) =>
            wearable.id === id ? { ...wearable, ...updates } : wearable
          ),
        }));
      },
      
      removeWearable: (id) => {
        set((state) => ({
          wearables: state.wearables.filter((wearable) => wearable.id !== id),
        }));
      },
      
      connectWearable: (id) => {
        set((state) => ({
          wearables: state.wearables.map((wearable) =>
            wearable.id === id
              ? { ...wearable, connected: true, lastSync: new Date() }
              : wearable
          ),
        }));
      },
      
      disconnectWearable: (id) => {
        set((state) => ({
          wearables: state.wearables.map((wearable) =>
            wearable.id === id ? { ...wearable, connected: false } : wearable
          ),
        }));
      },
      
      getConnectedWearables: () => {
        return get().wearables.filter((wearable) => wearable.connected);
      },

      syncWearableData: (id: string) => {
        const state = get();
        
        // Update wearable lastSync timestamp
        set({
          wearables: state.wearables.map((wearable) =>
            wearable.id === id ? { ...wearable, lastSync: new Date() } : wearable
          ),
        });
        
        // Generate mock health data based on wearable type
        const wearable = state.wearables.find((w) => w.id === id);
        if (!wearable || !wearable.connected) return;
        
        // Generate realistic mock metrics based on device capabilities
        const mockMetrics = {
          heartRate: {
            resting: Math.floor(Math.random() * 20) + 50, // 50-70
            max: Math.floor(Math.random() * 30) + 180, // 180-210
            zones: { 
              zone1: Math.floor(Math.random() * 15) + 120,
              zone2: Math.floor(Math.random() * 15) + 140,
              zone3: Math.floor(Math.random() * 15) + 160,
              zone4: Math.floor(Math.random() * 15) + 175,
              zone5: Math.floor(Math.random() * 15) + 190
            },
          },
          steps: Math.floor(Math.random() * 5000) + 7000, // 7000-12000
          calories: Math.floor(Math.random() * 1000) + 2200, // 2200-3200
          sleep: {
            duration: Math.round((Math.random() * 3 + 6) * 10) / 10, // 6.0-9.0 hours
            quality: ['poor', 'fair', 'good', 'excellent'][Math.floor(Math.random() * 4)] as 'poor' | 'fair' | 'good' | 'excellent',
            deepSleep: Math.round((Math.random() * 1.5 + 1.0) * 10) / 10, // 1.0-2.5 hours
          },
          recovery: {
            score: Math.floor(Math.random() * 40) + 60, // 60-100
            hrv: Math.floor(Math.random() * 20) + 35, // 35-55
          },
        };
        
        // Update or create today's health report with new metrics
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const existingReportIndex = state.reports.findIndex(
          (report) => {
            const reportDate = new Date(report.date);
            reportDate.setHours(0, 0, 0, 0);
            return reportDate.getTime() === today.getTime();
          }
        );
        
        if (existingReportIndex >= 0) {
          // Update existing report
          set({
            reports: state.reports.map((report, index) =>
              index === existingReportIndex
                ? { ...report, metrics: mockMetrics }
                : report
            ),
          });
        } else {
          // Create new report for today
          const newReport: HealthReport = {
            id: generateId(),
            date: today,
            metrics: mockMetrics,
            workoutsCompleted: Math.floor(Math.random() * 2), // 0-1
            totalWorkoutTime: Math.floor(Math.random() * 60), // 0-60 minutes
            avgIntensity: Math.floor(Math.random() * 5) + 5, // 5-10
            newPRs: Math.floor(Math.random() * 2), // 0-1
            streakDays: state.streak || 0,
            weeklyGoalProgress: Math.floor(Math.random() * 30) + 70, // 70-100%
            insights: [
              `Data synced from ${wearable.name}`,
              'Your metrics look good today',
              'Keep up the great work!',
            ],
            createdAt: new Date(),
          };
          set({ reports: [newReport, ...state.reports] });
        }
      },

      // Reports
      reports: seedReports,
      
      addReport: (reportData) => {
        const report: HealthReport = {
          ...reportData,
          id: generateId(),
          createdAt: new Date(),
        };
        set((state) => ({ reports: [report, ...state.reports] }));
      },
      
      getRecentReports: (days) => {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        return get().reports.filter((report) => report.date >= cutoffDate);
      },
      
      getLatestReport: () => {
        const reports = get().reports;
        return reports.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
      },

      // Server data loading methods
      loadServerData: async (authToken: string) => {
        try {
          const response = await fetch('/api/user/data', {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) {
            throw new Error('Failed to fetch user data');
          }
          
          const data = await response.json();
          
          // Transform server data to client format and replace seed data
          const transformedWorkouts = data.workouts.map((w: any) => ({
            id: w.id,
            name: w.title,
            category: w.request?.category || Category.CROSSFIT,
            description: w.notes || '',
            duration: w.request?.duration || 30,
            intensity: w.request?.intensity || 5,
            sets: Array.isArray(w.sets) ? w.sets : [],
            date: new Date(w.created_at),
            completed: w.completed || false,
            notes: w.notes,
            createdAt: new Date(w.created_at),
            feedback: w.feedback
          }));
          
          const transformedPRs = data.prs.map((pr: any) => ({
            id: pr.id,
            exercise: pr.movement,
            category: pr.category,
            weight: pr.weight_kg * 2.20462, // Convert kg to lbs
            reps: pr.rep_max,
            date: new Date(pr.date),
            createdAt: new Date(pr.date),
            movement: pr.movement,
            movementCategory: pr.category,
            repMax: pr.rep_max,
            value: pr.weight_kg * 2.20462,
            unit: Unit.LBS
          }));
          
          const transformedAchievements = data.achievements.map((ach: any) => ({
            id: ach.id,
            name: ach.name,
            description: ach.description,
            progress: ach.progress,
            target: 100,
            unlocked: ach.unlocked,
            category: AchievementCategory.GENERAL,
            type: AchievementType.WORKOUT_COUNT,
            createdAt: new Date(ach.updated_at),
            unlockedAt: ach.unlocked ? new Date(ach.updated_at) : undefined
          }));
          
          const transformedReports = data.healthReports.map((report: any) => ({
            id: report.id,
            date: new Date(report.date),
            metrics: report.metrics,
            workoutsCompleted: report.metrics.workoutsCompleted || 0,
            totalWorkoutTime: report.metrics.totalWorkoutTime || 0,
            avgIntensity: report.metrics.avgIntensity || 0,
            newPRs: report.metrics.newPRs || 0,
            streakDays: report.metrics.streakDays || 0,
            weeklyGoalProgress: report.metrics.weeklyGoalProgress || 0,
            insights: report.suggestions || [],
            createdAt: new Date(report.date),
            restingHeartRate: report.metrics.restingHeartRate,
            hrv: report.metrics.hrv,
            sleepScore: report.metrics.sleepScore
          }));
          
          const transformedWearables = data.wearables.map((w: any) => ({
            id: w.id,
            name: w.provider,
            brand: w.provider.split(' ')[0],
            type: w.provider.toLowerCase().replace(/\s+/g, '_'),
            connected: w.connected,
            batteryLevel: Math.floor(Math.random() * 30) + 70, // Mock battery
            lastSync: w.last_sync ? new Date(w.last_sync) : undefined,
            createdAt: new Date()
          }));
          
          // Replace seed data with server data
          set({
            workouts: transformedWorkouts,
            prs: transformedPRs,
            achievements: transformedAchievements,
            reports: transformedReports,
            wearables: transformedWearables
          });
          
          console.log('✅ Server data loaded successfully');
        } catch (error) {
          console.error('❌ Failed to load server data:', error);
          // Keep using seed data on error
        }
      },

      // Clear data (for logout)
      clearUserData: () => {
        set({
          workouts: seedWorkouts,
          prs: seedPRs,
          achievements: seedAchievements,
          wearables: seedWearables,
          reports: seedReports
        });
      },
    }),
    {
      name: 'axle-app-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Hydrate all Date fields across the entire state
          state.workouts = state.workouts.map(workout => ({
            ...workout,
            date: new Date(workout.date),
            createdAt: new Date(workout.createdAt),
          }));
          
          state.prs = state.prs.map(pr => ({
            ...pr,
            date: new Date(pr.date),
            createdAt: new Date(pr.createdAt),
          }));
          
          state.achievements = state.achievements.map(achievement => ({
            ...achievement,
            createdAt: new Date(achievement.createdAt),
            unlockedAt: achievement.unlockedAt ? new Date(achievement.unlockedAt) : undefined,
          }));
          
          state.wearables = state.wearables.map(wearable => ({
            ...wearable,
            createdAt: new Date(wearable.createdAt),
            lastSync: wearable.lastSync ? new Date(wearable.lastSync) : undefined,
          }));
          
          state.reports = state.reports.map(report => ({
            ...report,
            date: new Date(report.date),
            createdAt: new Date(report.createdAt),
          }));
        }
      },
    }
  )
);