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
import { Profile } from '../../../shared/schema';
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
      // Location state
      location: null,
      setLocation: (location) => set({ 
        location: {
          ...location,
          lastUpdated: new Date()
        }
      }),
      
      // Persistent location consent state
      locationOptIn: false,
      timezone: null,
      lastLat: null,
      lastLon: null,
      
      // Hydrate location consent from server
      hydrateLocation: async () => {
        try {
          const { authFetch } = await import('@/lib/authFetch');
          const response = await authFetch("/api/me/location");
          
          if (response.ok) {
            const data = await response.json();
            set({
              locationOptIn: !!data.optIn,
              timezone: data.timezone ?? null,
              lastLat: data.lat ?? null,
              lastLon: data.lon ?? null,
            });
            
            // Cache to localStorage to avoid UI flicker
            localStorage.setItem("axle:locationOptIn", String(!!data.optIn));
          }
        } catch (error) {
          console.error("Failed to hydrate location consent:", error);
        }
      },
      
      // Update location consent with optional coordinate refresh
      setLocationOptIn: async (optIn: boolean) => {
        try {
          const { authFetch } = await import('@/lib/authFetch');
          
          if (optIn) {
            // Request geolocation once on opt-in
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            
            const success = await new Promise<boolean>((resolve) => {
              navigator.geolocation.getCurrentPosition(
                async (pos) => {
                  try {
                    const lat = parseFloat(pos.coords.latitude.toFixed(6));
                    const lon = parseFloat(pos.coords.longitude.toFixed(6));
                    
                    const response = await authFetch("/api/me/location", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ optIn: true, lat, lon, timezone: tz }),
                    });
                    
                    if (response.ok) {
                      set({ 
                        locationOptIn: true, 
                        lastLat: parseFloat(lat.toFixed(3)), // Use quantized value
                        lastLon: parseFloat(lon.toFixed(3)), // Use quantized value
                        timezone: tz 
                      });
                      localStorage.setItem("axle:locationOptIn", "true");
                      resolve(true);
                    } else {
                      resolve(false);
                    }
                  } catch (error) {
                    console.error("Error saving location with coords:", error);
                    resolve(false);
                  }
                },
                async () => {
                  // Permission denied - still persist consent, coords may come later
                  try {
                    const response = await authFetch("/api/me/location", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ optIn: true, timezone: tz }),
                    });
                    
                    if (response.ok) {
                      set({ locationOptIn: true, timezone: tz });
                      localStorage.setItem("axle:locationOptIn", "true");
                      resolve(true);
                    } else {
                      resolve(false);
                    }
                  } catch (error) {
                    console.error("Error saving location consent:", error);
                    resolve(false);
                  }
                },
                { enableHighAccuracy: false, timeout: 8000 }
              );
            });
            
            return success;
          } else {
            // Opt out - clear consent and cached coordinates
            const response = await authFetch("/api/me/location", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ optIn: false }),
            });
            
            if (response.ok) {
              set({ 
                locationOptIn: false, 
                lastLat: null, 
                lastLon: null,
                timezone: null 
              });
              localStorage.setItem("axle:locationOptIn", "false");
              return true;
            }
            return false;
          }
        } catch (error) {
          console.error("Failed to update location consent:", error);
          return false;
        }
      },
      
      // Optional: refresh cached location without changing consent
      refreshLocationNow: async () => {
        const { locationOptIn } = get();
        if (!locationOptIn) return false;
        
        try {
          const { authFetch } = await import('@/lib/authFetch');
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          
          const success = await new Promise<boolean>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                try {
                  const lat = parseFloat(pos.coords.latitude.toFixed(6));
                  const lon = parseFloat(pos.coords.longitude.toFixed(6));
                  
                  const response = await authFetch("/api/me/location", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ optIn: true, lat, lon, timezone: tz }),
                  });
                  
                  if (response.ok) {
                    set({ 
                      lastLat: parseFloat(lat.toFixed(3)), // Use quantized value
                      lastLon: parseFloat(lon.toFixed(3)), // Use quantized value
                      timezone: tz 
                    });
                    resolve(true);
                  } else {
                    resolve(false);
                  }
                } catch (error) {
                  console.error("Error refreshing location:", error);
                  resolve(false);
                }
              },
              (error) => {
                console.error("Geolocation failed:", error);
                resolve(false);
              },
              { enableHighAccuracy: false, timeout: 8000 }
            );
          });
          
          return success;
        } catch (error) {
          console.error("Failed to refresh location:", error);
          return false;
        }
      },
      
      // Legacy location methods (kept for compatibility)
      requestAndSaveLocation: async () => {
        try {
          const { requestAndSaveLocation } = await import('@/lib/geo');
          
          // Get and save quantized location
          const quantizedLocation = await requestAndSaveLocation();
          
          if (quantizedLocation) {
            // Update local store with quantized coordinates from server
            set({ 
              location: {
                latitude: quantizedLocation.lat,
                longitude: quantizedLocation.lon,
                timezone: quantizedLocation.timezone,
                lastUpdated: new Date()
              }
            });
            return true;
          } else {
            return false;
          }
        } catch (error) {
          console.error('Failed to request and save location:', error);
          return false;
        }
      },
      clearLocation: () => set({ location: null }),
      
      // Theme
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      
      // Profile state
      profile: null,
      setProfile: (profile) => set({ profile }),
      upsertProfile: async (userId: string, email: string, username?: string, firstName?: string, lastName?: string) => {
        try {
          const { apiRequest } = await import('@/lib/queryClient');
          
          // Create username from email if not provided
          const finalUsername = username || email.split('@')[0];
          
          const profileData = {
            username: finalUsername,
            firstName: firstName,
            lastName: lastName
          };
          
          // Upsert profile via server API
          const result = await apiRequest('POST', '/api/profiles', { action: 'upsert', ...profileData });
          const responseData = await result.json();
            
          if (!result.ok) {
            console.error('Failed to upsert profile:', responseData.message);
            return;
          }
          
          // Update local store with response data (backend now returns camelCase)
          set({ 
            profile: {
              userId: responseData.profile.userId || responseData.profile.user_id,
              username: responseData.profile.username,
              firstName: responseData.profile.firstName || responseData.profile.first_name,
              lastName: responseData.profile.lastName || responseData.profile.last_name,
              avatarUrl: responseData.profile.avatarUrl || responseData.profile.avatar_url,
              dateOfBirth: responseData.profile.dateOfBirth || responseData.profile.date_of_birth,
              providers: responseData.profile.providers || ['email'],
              createdAt: responseData.profile.createdAt ? new Date(responseData.profile.createdAt) : (responseData.profile.created_at ? new Date(responseData.profile.created_at) : new Date())
            }
          });
          
          console.log('✅ Profile upserted successfully');
          
        } catch (error) {
          console.error('Profile upsert error:', error);
        }
      },
      clearProfile: () => set({ profile: null }),
      
      // Authentication state
      isAuthenticated: false,
      user: null,
      session: null,
      authInitialized: false,
      
      setAuth: (user, session) => set({ 
        user, 
        session, 
        isAuthenticated: !!user 
      }),
      
      clearAuth: () => set({ 
        user: null, 
        session: null, 
        isAuthenticated: false,
        profile: null,
        authInitialized: true  // Keep authInitialized as true so components know auth check is complete
      }),

      // Hydrate from database using backend API endpoints
      hydrateFromDb: async (userId: string) => {
        try {
          console.log('💧 Hydrating from database for user:', userId);
          
          // For now, skip data hydration since we're using in-memory storage
          // TODO: Implement proper API endpoints for data fetching when needed
          console.log('✅ Database hydration complete');
          
          // Don't update store with empty data - keep existing seed data
        } catch (error) {
          console.error('❌ Database hydration failed:', error);
          throw error;
        }
      },

      // Clear store for guest mode
      clearStoreForGuest: () => {
        console.log('🧹 Clearing store for guest mode');
        set({
          workouts: seedWorkouts,
          prs: seedPRs,
          achievements: seedAchievements,
          reports: seedReports,
          wearables: seedWearables,
          profile: null
        });
      },
      
      setAuthInitialized: (initialized) => set({ 
        authInitialized: initialized 
      }),

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
      
      addWorkout: async (workoutData) => {
        const workout: Workout = {
          ...workoutData,
          id: generateId(),
          createdAt: new Date(),
        };
        
        // Optimistic update
        set((state) => ({ workouts: [workout, ...state.workouts] }));
        
        // If authenticated, sync to database
        const { isAuthenticated } = get();
        if (isAuthenticated) {
          try {
            const { apiRequest } = await import('@/lib/queryClient');
            const response = await apiRequest('POST', '/api/workouts', {
              title: workout.name,
              category: workout.category,
              description: workout.description,
              duration: workout.duration,
              intensity: workout.intensity,
              sets: workout.sets,
              date: workout.date,
              completed: workout.completed,
              notes: workout.notes
            });
            
            const dbWorkout = await response.json();
            
            // Replace optimistic workout with server workout to reconcile IDs
            set((state) => ({
              workouts: state.workouts.map(w => 
                w.id === workout.id ? {
                  id: dbWorkout.id, // Use server ID
                  name: dbWorkout.title || workout.name,
                  category: workout.category, // Keep original category
                  description: workout.description, // Keep original description
                  duration: workout.duration, // Keep original duration
                  intensity: workout.intensity, // Keep original intensity
                  sets: dbWorkout.sets || workout.sets,
                  date: workout.date, // Keep original date
                  completed: dbWorkout.completed || false,
                  notes: dbWorkout.notes || workout.notes,
                  createdAt: new Date(dbWorkout.created_at),
                  feedback: dbWorkout.feedback || undefined
                } : w
              )
            }));
            
            console.log(`✅ Workout synced with server ID: ${dbWorkout.id}`);
          } catch (error) {
            console.error('Failed to sync workout to database:', error);
            
            // Check if it's a network error (offline) or server error
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isNetworkError = error instanceof TypeError || 
                                 errorMessage.includes('Failed to fetch') ||
                                 errorMessage.includes('NetworkError') ||
                                 errorMessage.includes('fetch');
            
            if (isNetworkError) {
              // Add to offline queue for retry later
              get().addToOfflineQueue(
                'Add Workout',
                '/api/workouts',
                'POST',
                {
                  localId: workout.id, // Store local ID for reconciliation later
                  title: workout.name,
                  category: workout.category,
                  description: workout.description,
                  duration: workout.duration,
                  intensity: workout.intensity,
                  sets: workout.sets,
                  date: workout.date,
                  completed: workout.completed,
                  notes: workout.notes
                }
              );
              console.log('📝 Workout queued for sync when online');
              return; // Keep optimistic update
            } else {
              // Rollback optimistic update on non-network errors
              set((state) => ({
                workouts: state.workouts.filter(w => w.id !== workout.id)
              }));
              throw error;
            }
          }
        }
      },
      
      updateWorkout: async (id, updates) => {
        // Store previous state for rollback
        const previousWorkout = get().workouts.find(w => w.id === id);
        
        // Optimistic update
        set((state) => ({
          workouts: state.workouts.map((workout) =>
            workout.id === id ? { ...workout, ...updates } : workout
          ),
        }));
        
        // If authenticated, sync to database
        const { isAuthenticated } = get();
        if (isAuthenticated) {
          try {
            const { apiRequest } = await import('@/lib/queryClient');
            await apiRequest('PUT', `/api/workouts/${id}`, updates);
          } catch (error) {
            console.error('Failed to update workout in database:', error);
            // Rollback optimistic update on error
            if (previousWorkout) {
              set((state) => ({
                workouts: state.workouts.map((workout) =>
                  workout.id === id ? previousWorkout : workout
                ),
              }));
            }
            throw error;
          }
        }
      },
      
      deleteWorkout: async (id) => {
        // Store deleted workout for rollback
        const deletedWorkout = get().workouts.find(w => w.id === id);
        
        // Optimistic update
        set((state) => ({
          workouts: state.workouts.filter((workout) => workout.id !== id),
        }));
        
        // If authenticated, sync to database
        const { isAuthenticated } = get();
        if (isAuthenticated) {
          try {
            const { apiRequest } = await import('@/lib/queryClient');
            await apiRequest('DELETE', `/api/workouts/${id}`);
          } catch (error) {
            console.error('Failed to delete workout from database:', error);
            // Rollback optimistic update on error
            if (deletedWorkout) {
              set((state) => ({
                workouts: [deletedWorkout, ...state.workouts]
              }));
            }
            throw error;
          }
        }
      },
      
      getWorkout: (id) => {
        return get().workouts.find((workout) => workout.id === id);
      },
      
      setActiveWorkout: (workout) => {
        set({ activeWorkout: workout });
      },
      
      completeWorkout: async (id: string, feedback: WorkoutFeedback) => {
        // Store previous state for rollback
        const previousWorkout = get().workouts.find(w => w.id === id);
        
        // Optimistic update
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
        
        // If authenticated, sync to database
        const { isAuthenticated } = get();
        if (isAuthenticated) {
          try {
            const { apiRequest } = await import('@/lib/queryClient');
            
            // Add timeout to prevent hanging API calls
            await Promise.race([
              apiRequest('PUT', `/api/workouts/${id}`, {
                completed: true,
                feedback: feedback
              }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('API call timeout')), 10000)
              )
            ]);
            
          } catch (error) {
            console.error('Failed to complete workout in database:', error);
            // Rollback optimistic update on error
            if (previousWorkout) {
              set((state) => ({
                workouts: state.workouts.map((workout) =>
                  workout.id === id ? previousWorkout : workout
                ),
              }));
            }
            throw error;
          }
        }
        
        // Recompute achievements after workout completion (non-blocking)
        get().recomputeAchievements().catch(error => {
          console.error('Failed to recompute achievements:', error);
          // Don't throw - achievements are non-critical for completion
        });
      },

      // PRs
      prs: seedPRs,
      
      addPR: async (prData) => {
        const pr: PR = {
          ...prData,
          id: generateId(),
          createdAt: new Date(),
        };
        
        // Optimistic update
        set((state) => ({ prs: [pr, ...state.prs] }));
        
        // If authenticated, sync to database
        const { isAuthenticated } = get();
        if (isAuthenticated) {
          try {
            const { apiRequest } = await import('@/lib/queryClient');
            await apiRequest('POST', '/api/prs', {
              action: 'create',
              exercise: pr.exercise,
              movement: pr.movement,
              movementCategory: pr.movementCategory,
              weight: pr.weight,
              reps: pr.reps,
              repMax: pr.repMax,
              value: pr.value,
              unit: pr.unit,
              date: pr.date,
              notes: pr.notes
            });
          } catch (error) {
            console.error('Failed to sync PR to database:', error);
            // Rollback optimistic update on error
            set((state) => ({
              prs: state.prs.filter(p => p.id !== pr.id)
            }));
            throw error;
          }
        }
        
        // Recompute achievements after adding PR
        get().recomputeAchievements();
      },
      
      updatePR: async (id, updates) => {
        // Store previous state for rollback
        const previousPR = get().prs.find(p => p.id === id);
        
        // Optimistic update
        set((state) => ({
          prs: state.prs.map((pr) => (pr.id === id ? { ...pr, ...updates } : pr)),
        }));
        
        // If authenticated, sync to database
        const { isAuthenticated } = get();
        if (isAuthenticated) {
          try {
            const { apiRequest } = await import('@/lib/queryClient');
            await apiRequest('POST', '/api/prs', { action: 'update', id, ...updates });
          } catch (error) {
            console.error('Failed to update PR in database:', error);
            // Rollback optimistic update on error
            if (previousPR) {
              set((state) => ({
                prs: state.prs.map((pr) =>
                  pr.id === id ? previousPR : pr
                ),
              }));
            }
            throw error;
          }
        }
      },
      
      deletePR: async (id) => {
        // Store deleted PR for rollback
        const deletedPR = get().prs.find(p => p.id === id);
        
        // Optimistic update
        set((state) => ({
          prs: state.prs.filter((pr) => pr.id !== id),
        }));
        
        // If authenticated, sync to database
        const { isAuthenticated } = get();
        if (isAuthenticated) {
          try {
            const { apiRequest } = await import('@/lib/queryClient');
            await apiRequest('POST', '/api/prs', { action: 'delete', id });
          } catch (error) {
            console.error('Failed to delete PR from database:', error);
            // Rollback optimistic update on error
            if (deletedPR) {
              set((state) => ({
                prs: [deletedPR, ...state.prs]
              }));
            }
            throw error;
          }
        }
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
      
      unlockAchievement: async (id) => {
        // Store previous state for rollback
        const previousAchievement = get().achievements.find(a => a.id === id);
        
        // Optimistic update
        set((state) => ({
          achievements: state.achievements.map((achievement) =>
            achievement.id === id
              ? { ...achievement, completed: true, unlockedAt: new Date() }
              : achievement
          ),
        }));
        
        // If authenticated, sync to database
        const { isAuthenticated } = get();
        if (isAuthenticated) {
          try {
            const { apiRequest } = await import('@/lib/queryClient');
            await apiRequest('POST', '/api/achievements', {
              action: 'update',
              id,
              progress: 100,
              unlocked: true
            });
          } catch (error) {
            console.error('Failed to unlock achievement in database:', error);
            // Rollback optimistic update on error
            if (previousAchievement) {
              set((state) => ({
                achievements: state.achievements.map((achievement) =>
                  achievement.id === id ? previousAchievement : achievement
                ),
              }));
            }
            throw error;
          }
        }
      },
      
      getCompletedAchievements: () => {
        return get().achievements.filter((achievement) => achievement.completed);
      },
      
      getProgressAchievements: () => {
        return get().achievements.filter((achievement) => !achievement.completed);
      },

      recomputeAchievements: async () => {
        const state = get();
        const oldAchievements = state.achievements;
        const newAchievements = computeAllAchievements(oldAchievements, state.workouts, state.prs);
        const newlyUnlocked = getNewlyUnlocked(oldAchievements, newAchievements);
        
        // Update local state
        set({ achievements: newAchievements });
        
        // If authenticated and there are newly unlocked achievements, sync to database
        const { isAuthenticated } = get();
        if (isAuthenticated && newlyUnlocked.length > 0) {
          try {
            const { apiRequest } = await import('@/lib/queryClient');
            // Batch update newly unlocked achievements
            await apiRequest('POST', '/api/achievements', {
              action: 'batch',
              achievements: newlyUnlocked.map(a => ({
                id: a.id,
                completed: true,
                unlockedAt: a.unlockedAt,
                progress: a.progress
              }))
            });
          } catch (error) {
            console.error('Failed to sync achievements to database:', error);
            // Note: Not rolling back here as achievement computation is client-side
            // The next load will fix any inconsistencies
          }
        }
        
        return newlyUnlocked;
      },

      // Wearables - Health Provider System
      wearables: seedWearables,
      
      // Health Provider Connections
      providers: [],
      connections: [],
      loadingProviders: false,
      loadingConnections: false,
      
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
      
      connectWearable: async (id) => {
        // Store previous state for rollback
        const previousWearable = get().wearables.find(w => w.id === id);
        
        // Optimistic update
        set((state) => ({
          wearables: state.wearables.map((wearable) =>
            wearable.id === id
              ? { ...wearable, connected: true, lastSync: new Date() }
              : wearable
          ),
        }));
        
        // If authenticated, sync to database
        const { isAuthenticated } = get();
        if (isAuthenticated) {
          try {
            const { apiRequest } = await import('@/lib/queryClient');
            await apiRequest('PUT', `/api/wearables/${id}`, {
              connected: true,
              lastSync: new Date()
            });
          } catch (error) {
            console.error('Failed to connect wearable in database:', error);
            // Rollback optimistic update on error
            if (previousWearable) {
              set((state) => ({
                wearables: state.wearables.map((wearable) =>
                  wearable.id === id ? previousWearable : wearable
                ),
              }));
            }
            throw error;
          }
        }
      },
      
      disconnectWearable: async (id) => {
        // Store previous state for rollback
        const previousWearable = get().wearables.find(w => w.id === id);
        
        // Optimistic update
        set((state) => ({
          wearables: state.wearables.map((wearable) =>
            wearable.id === id ? { ...wearable, connected: false } : wearable
          ),
        }));
        
        // If authenticated, sync to database
        const { isAuthenticated } = get();
        if (isAuthenticated) {
          try {
            const { apiRequest } = await import('@/lib/queryClient');
            await apiRequest('PUT', `/api/wearables/${id}`, {
              connected: false
            });
          } catch (error) {
            console.error('Failed to disconnect wearable in database:', error);
            // Rollback optimistic update on error
            if (previousWearable) {
              set((state) => ({
                wearables: state.wearables.map((wearable) =>
                  wearable.id === id ? previousWearable : wearable
                ),
              }));
            }
            throw error;
          }
        }
      },
      
      getConnectedWearables: () => {
        return get().wearables.filter((wearable) => wearable.connected);
      },

      // New Health Provider Actions
      fetchProviders: async () => {
        set({ loadingProviders: true });
        try {
          const { apiRequest } = await import('@/lib/queryClient');
          const response = await apiRequest('GET', '/api/connect/providers');
          const data = await response.json();
          set({ providers: data.providers, loadingProviders: false });
        } catch (error) {
          console.error('Failed to fetch providers:', error);
          set({ loadingProviders: false });
          throw error;
        }
      },
      
      fetchConnections: async () => {
        set({ loadingConnections: true });
        try {
          const { apiRequest } = await import('@/lib/queryClient');
          const response = await apiRequest('GET', '/api/connect/providers');
          const data = await response.json();
          set({ connections: data.connections || [], loadingConnections: false });
        } catch (error) {
          console.error('Failed to fetch connections:', error);
          set({ loadingConnections: false });
          throw error;
        }
      },
      
      connectProvider: async (providerId: string) => {
        try {
          const { apiRequest } = await import('@/lib/queryClient');
          const response = await apiRequest('POST', `/api/connect/${providerId}/start`);
          const data = await response.json();
          
          if (data.redirectUrl) {
            window.location.href = data.redirectUrl;
          } else if (data.connected) {
            // For Mock provider, immediately update connection status
            await get().fetchConnections();
          }
        } catch (error) {
          console.error('Failed to connect provider:', error);
          throw error;
        }
      },
      
      disconnectProvider: async (providerId: string) => {
        try {
          // TODO: Implement disconnect endpoint when added to backend
          console.log('Disconnect provider:', providerId);
          // For now, just refresh connections to get updated status
          await get().fetchConnections();
        } catch (error) {
          console.error('Failed to disconnect provider:', error);
          throw error;
        }
      },
      
      syncProviderNow: async (providerId: string, params?: Record<string, any>) => {
        try {
          const { apiRequest } = await import('@/lib/queryClient');
          
          const response = await apiRequest('POST', '/api/health', {
            action: 'sync',
            ...params
          });
          const data = await response.json();
          
          if (data.report) {
            // Update reports with new data
            set((state) => ({
              reports: [data.report, ...state.reports.filter(r => r.id !== data.report.id)]
            }));
          }
          
          // Refresh connections to update last sync time
          await get().fetchConnections();
          
          return data;
        } catch (error) {
          console.error('Failed to sync provider:', error);
          throw error;
        }
      },
      
      fetchReports: async () => {
        try {
          const { apiRequest } = await import('@/lib/queryClient');
          const response = await apiRequest('POST', '/api/health', { action: 'reports' });
          const data = await response.json();
          
          const transformedReports = data.map((report: any) => ({
            id: report.id,
            date: new Date(report.date),
            metrics: report.metrics,
            workoutsCompleted: report.metrics?.workoutsCompleted || 0,
            totalWorkoutTime: report.metrics?.totalWorkoutTime || 0,
            avgIntensity: report.metrics?.avgIntensity || 0,
            newPRs: report.metrics?.newPRs || 0,
            streakDays: report.metrics?.streakDays || 0,
            weeklyGoalProgress: report.metrics?.weeklyGoalProgress || 0,
            insights: report.suggestions || [],
            createdAt: new Date(report.created_at || report.date),
            restingHeartRate: report.metrics?.heartRate?.resting,
            hrv: report.metrics?.recovery?.hrv,
            sleepScore: report.metrics?.sleep?.quality === 'excellent' ? 100 : 
                        report.metrics?.sleep?.quality === 'good' ? 80 :
                        report.metrics?.sleep?.quality === 'fair' ? 60 : 40
          }));
          
          set({ reports: transformedReports });
        } catch (error) {
          console.error('Failed to fetch health reports:', error);
          throw error;
        }
      },

      syncWearableData: async (id: string) => {
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
        
        // If authenticated, sync with server
        const { isAuthenticated } = get();
        if (isAuthenticated) {
          try {
            const { apiRequest } = await import('@/lib/queryClient');
            const response = await apiRequest('POST', `/api/wearables/${id}/sync`, {});
            const data = await response.json();
            
            // Update wearable sync time in database
            await apiRequest('PUT', `/api/wearables/${id}`, {
              lastSync: new Date()
            });
            
            // If the server returned a health report, add it to state
            if (data.report) {
              set((state) => ({
                reports: [data.report, ...state.reports.filter(r => r.id !== data.report.id)]
              }));
            }
            
            return;
          } catch (error) {
            console.error('Failed to sync wearable data with server:', error);
            // Fall through to local mock data generation
          }
        }
        
        // Generate realistic mock metrics locally (fallback for guest mode or sync errors)
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
      
      // Charts state
      charts: {} as Record<any, { date: string; value: number | null }[]>,
      
      addReport: (reportData) => {
        const report: HealthReport = {
          ...reportData,
          id: generateId(),
          createdAt: new Date(),
        };
        set((state) => ({ reports: [report, ...state.reports] }));
      },
      
      getRecentReports: (days = 14) => {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        return get().reports.filter((report) => report.date >= cutoffDate)
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, days); // Limit to last N days
      },
      
      getLatestReport: () => {
        const reports = get().reports;
        return reports.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
      },

      loadHealthCharts: async (days = 14) => {
        try {
          const { apiRequest } = await import('@/lib/queryClient');
          const r = await apiRequest('POST', '/api/health', { action: 'metrics', days });
          const rawData = await r.json();
          const points = rawData;
          const keys = ["axle_health_score","vitality_score","performance_potential","circadian_alignment","energy_systems_balance","hrv","resting_hr","sleep_score","fatigue_score"];
          const charts: any = {};
          for (const k of keys) charts[k] = points.map((p: any) => ({ date: p.date, value: (p[k] ?? null) }));
          set({ charts });
        } catch (error) {
          console.error('Failed to load health charts:', error);
        }
      },

      // Server data loading methods
      loadServerData: async (authToken: string) => {
        try {
          const { authFetch } = await import('@/lib/authFetch');
          const response = await authFetch('/api/user/data');
          
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
          
          const transformedReports = (data.healthReports || []).map((report: any) => ({
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
          reports: seedReports,
          offlineQueue: [] // Clear offline queue on logout
        });
      },

      // Offline handling
      offlineQueue: [] as Array<{
        id: string;
        operation: string;
        url: string;
        method: string;
        data?: any;
        timestamp: Date;
        retryCount: number;
      }>,

      addToOfflineQueue: (operation: string, url: string, method: string, data?: any) => {
        const queueItem = {
          id: generateId(),
          operation,
          url,
          method,
          data,
          timestamp: new Date(),
          retryCount: 0
        };
        set((state) => ({
          offlineQueue: [...state.offlineQueue, queueItem]
        }));
      },

      processOfflineQueue: async () => {
        const { offlineQueue } = get();
        if (offlineQueue.length === 0) return;

        const { apiRequest } = await import('@/lib/queryClient');
        const processedItems: string[] = [];

        for (const item of offlineQueue) {
          try {
            const response = await apiRequest(item.method, item.url, item.data);
            
            // Handle ID reconciliation for workout creation
            if (item.operation === 'Add Workout' && item.method === 'POST' && item.data.localId) {
              const dbWorkout = await response.json();
              
              // Replace local workout with server workout to reconcile IDs
              set((state) => ({
                workouts: state.workouts.map(w => 
                  w.id === item.data.localId ? {
                    id: dbWorkout.id, // Use server ID
                    name: dbWorkout.title || item.data.title,
                    category: item.data.category, // Keep original category
                    description: item.data.description, // Keep original description
                    duration: item.data.duration, // Keep original duration
                    intensity: item.data.intensity, // Keep original intensity
                    sets: dbWorkout.sets || item.data.sets,
                    date: new Date(item.data.date), // Keep original date
                    completed: dbWorkout.completed || false,
                    notes: dbWorkout.notes || item.data.notes,
                    createdAt: new Date(dbWorkout.created_at),
                    feedback: dbWorkout.feedback || undefined
                  } : w
                )
              }));
              
              console.log(`✅ Offline workout synced with server ID: ${dbWorkout.id}`);
            }
            
            processedItems.push(item.id);
            console.log(`✅ Offline operation processed: ${item.operation}`);
          } catch (error) {
            item.retryCount++;
            // Remove items that have failed too many times (max 3 retries)
            if (item.retryCount >= 3) {
              processedItems.push(item.id);
              console.error(`❌ Offline operation failed permanently: ${item.operation}`, error);
            } else {
              console.log(`🔄 Retrying offline operation: ${item.operation} (${item.retryCount}/3)`);
            }
          }
        }

        // Remove processed items from queue
        if (processedItems.length > 0) {
          set((state) => ({
            offlineQueue: state.offlineQueue.filter(item => !processedItems.includes(item.id))
          }));
        }
      },

      // Type validation helper
      validatePayload: (schema: any, data: any): boolean => {
        try {
          schema.parse(data);
          return true;
        } catch (error) {
          console.error('Payload validation failed:', error);
          return false;
        }
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
          
          // Rehydrate location data with proper Date object
          if (state.location) {
            state.location = {
              ...state.location,
              lastUpdated: new Date(state.location.lastUpdated),
            };
          }
        }
      },
    }
  )
);