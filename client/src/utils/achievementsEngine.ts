import { 
  Achievement, 
  AchievementType, 
  AchievementCategory,
  Workout, 
  PR, 
  MovementCategory,
  Unit,
  Category 
} from '../types';

// Helper function to convert weight values to lbs for consistent calculation
const convertToLbs = (value: number | string, unit?: Unit): number => {
  if (typeof value === 'string') return 0; // Time-based values don't contribute to weight
  if (!unit || unit === Unit.LBS) return value;
  if (unit === Unit.KG) return value * 2.20462; // Convert kg to lbs
  return 0; // Other units don't contribute to weight calculations
};

// Helper function to map old Category enum to MovementCategory enum
const mapCategoryToMovementCategory = (category: Category): MovementCategory | null => {
  switch (category) {
    case Category.POWERLIFTING:
      return MovementCategory.POWERLIFTING;
    case Category.OLYMPIC_LIFTING:
      return MovementCategory.OLYMPIC_WEIGHTLIFTING;
    case Category.GYMNASTICS:
      return MovementCategory.GYMNASTICS;
    case Category.CARDIO:
      return MovementCategory.AEROBIC;
    default:
      return null;
  }
};

// Calculate progress for a specific achievement
export const calculateAchievementProgress = (
  achievement: Achievement,
  workouts: Workout[],
  prs: PR[]
): number => {
  switch (achievement.type) {
    case AchievementType.WORKOUT_COUNT: {
      const completedWorkouts = workouts.filter(w => w.completed);
      return completedWorkouts.length;
    }

    case AchievementType.PR_COUNT: {
      return prs.length;
    }

    case AchievementType.TOTAL_WEIGHT: {
      const totalWeight = prs.reduce((total, pr) => {
        const weightInLbs = convertToLbs(pr.value || pr.weight, pr.unit);
        return total + weightInLbs;
      }, 0);
      return Math.round(totalWeight);
    }

    case AchievementType.CATEGORY_WORKOUTS: {
      if (!achievement.movementCategory) return 0;
      
      const categoryWorkouts = workouts.filter(w => {
        const mappedCategory = mapCategoryToMovementCategory(w.category);
        return w.completed && mappedCategory === achievement.movementCategory;
      });
      return categoryWorkouts.length;
    }

    case AchievementType.CATEGORY_PRS: {
      if (!achievement.movementCategory) return 0;
      
      const categoryPRs = prs.filter(pr => pr.movementCategory === achievement.movementCategory);
      return categoryPRs.length;
    }

    case AchievementType.STREAK: {
      const completedWorkouts = workouts.filter(w => w.completed);
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
      return streak;
    }

    case AchievementType.VOLUME_SESSION: {
      // Find the session with highest total weight lifted
      const sessionVolumes = workouts.map(workout => {
        if (!workout.completed || !workout.sets) return 0;
        return workout.sets.reduce((total, set) => {
          const weight = set.weight || 0;
          const reps = set.reps || 1;
          return total + (weight * reps);
        }, 0);
      });
      return Math.max(0, ...sessionVolumes);
    }

    case AchievementType.MOVEMENT_SPECIFIC: {
      if (!achievement.movement) return 0;
      
      const movementPRs = prs.filter(pr => pr.movement === achievement.movement);
      return movementPRs.length;
    }

    case AchievementType.TIME_BASED:
    case AchievementType.COMPOUND:
      // These require custom logic per achievement - return current progress for now
      return achievement.progress;

    default:
      return achievement.progress;
  }
};

// Check if achievement should be unlocked
export const shouldUnlockAchievement = (achievement: Achievement, progress: number): boolean => {
  return !achievement.completed && progress >= achievement.target;
};

// Compute all achievement progress
export const computeAllAchievements = (
  achievements: Achievement[],
  workouts: Workout[],
  prs: PR[]
): Achievement[] => {
  return achievements.map(achievement => {
    const newProgress = calculateAchievementProgress(achievement, workouts, prs);
    const shouldUnlock = shouldUnlockAchievement(achievement, newProgress);
    
    return {
      ...achievement,
      progress: newProgress,
      completed: shouldUnlock || achievement.completed,
      unlockedAt: shouldUnlock && !achievement.completed ? new Date() : achievement.unlockedAt,
    };
  });
};

// Get newly unlocked achievements (for triggering confetti/notifications)
export const getNewlyUnlocked = (
  oldAchievements: Achievement[],
  newAchievements: Achievement[]
): Achievement[] => {
  const oldCompleted = new Set(oldAchievements.filter(a => a.completed).map(a => a.id));
  return newAchievements.filter(achievement => 
    achievement.completed && !oldCompleted.has(achievement.id)
  );
};