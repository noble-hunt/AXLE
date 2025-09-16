import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Category, 
  Workout, 
  PR, 
  Achievement, 
  WearableConnection, 
  HealthReport,
  AppState,
  WorkoutSet
} from '../types';

// Seed data
const generateId = () => Math.random().toString(36).substring(2, 15);

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
  {
    id: 'pr-deadlift',
    exercise: 'Deadlift',
    category: Category.POWERLIFTING,
    weight: 405,
    reps: 1,
    date: new Date('2024-01-28'),
    previousPR: 385,
    createdAt: new Date('2024-01-28'),
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
  },
];

const seedAchievements: Achievement[] = [
  {
    id: 'achievement-completionist',
    title: 'Completionist',
    description: 'Complete 25 total workouts',
    category: 'workout_count',
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
    category: 'pr_count',
    target: 10,
    progress: 5,
    completed: false,
    icon: '💪',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-weight-master',
    title: 'Weight Master',
    description: 'Lift 10,000 total pounds in a single workout',
    category: 'volume',
    target: 10000,
    progress: 7500,
    completed: false,
    icon: '🏋️',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-bodyweight-ninja',
    title: 'Bodyweight Ninja',
    description: 'Complete 15 gymnastics movements in one workout',
    category: 'gymnastics',
    target: 15,
    progress: 12,
    completed: false,
    icon: '🥷',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-engine-builder',
    title: 'Engine Builder',
    description: 'Complete 10 aerobic workouts',
    category: 'cardio',
    target: 10,
    progress: 7,
    completed: false,
    icon: '🫁',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'achievement-bar-slayer',
    title: 'Bar Slayer',
    description: 'Complete 10 powerlifting workouts',
    category: 'powerlifting',
    target: 10,
    progress: 4,
    completed: false,
    icon: '🔥',
    createdAt: new Date('2024-01-01'),
  },
];

const seedWearables: WearableConnection[] = [
  {
    id: 'wearable-apple-watch',
    name: 'Apple Watch Series 9',
    type: 'smartwatch',
    brand: 'Apple',
    model: 'Series 9',
    connected: false,
    capabilities: ['heart_rate', 'gps', 'workout_tracking', 'sleep_tracking'],
    batteryLevel: 85,
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
    id: 'wearable-polar',
    name: 'Polar H10',
    type: 'heart_rate_monitor',
    brand: 'Polar',
    model: 'H10',
    connected: false,
    capabilities: ['heart_rate', 'hrv'],
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'wearable-iphone',
    name: 'iPhone 15 Pro',
    type: 'smartphone',
    brand: 'Apple',
    model: '15 Pro',
    connected: false,
    capabilities: ['step_counting', 'workout_tracking', 'gps'],
    batteryLevel: 73,
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
      
      completeWorkout: (id) => {
        set((state) => ({
          workouts: state.workouts.map((workout) =>
            workout.id === id ? { ...workout, completed: true } : workout
          ),
        }));
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
    }),
    {
      name: 'axle-app-storage',
    }
  )
);