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
    case Category.CROSSFIT:
      return MovementCategory.GYMNASTICS; // CrossFit often includes gymnastics movements
    case Category.HIIT:
      return MovementCategory.AEROBIC; // HIIT is primarily aerobic/conditioning
    case Category.STRENGTH:
      return MovementCategory.BODYBUILDING; // Strength training maps to bodybuilding category
    case Category.MOBILITY:
      return MovementCategory.GYMNASTICS; // Mobility work often aligns with gymnastics
    default:
      return null;
  }
};

// Helper function to convert time string (mm:ss) to seconds for comparison
const timeToSeconds = (timeStr: string): number => {
  if (typeof timeStr !== 'string' || !timeStr.includes(':')) return 0;
  const [minutes, seconds] = timeStr.split(':').map(Number);
  if (isNaN(minutes) || isNaN(seconds)) return 0;
  return minutes * 60 + seconds;
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
      if (movementPRs.length === 0) return 0;
      
      // Get the best PR for this movement
      const bestPR = movementPRs.reduce((best, current) => {
        if (!best) return current;
        
        // For weight-based PRs, higher is better
        if (achievement.unit === Unit.LBS || achievement.unit === Unit.KG) {
          const currentValue = convertToLbs(current.value || current.weight, current.unit);
          const bestValue = convertToLbs(best.value || best.weight, best.unit);
          return currentValue > bestValue ? current : best;
        }
        
        // For rep-based PRs, higher is better  
        if (achievement.unit === Unit.REPS) {
          const currentValue = typeof current.value === 'number' ? current.value : current.reps || 0;
          const bestValue = typeof best.value === 'number' ? best.value : best.reps || 0;
          return currentValue > bestValue ? current : best;
        }
        
        // For time-based PRs, lower is better
        if (achievement.unit === Unit.TIME) {
          if (typeof current.value === 'string' && typeof best.value === 'string') {
            return timeToSeconds(current.value) < timeToSeconds(best.value) ? current : best;
          }
        }
        
        return best;
      }, movementPRs[0]);
      
      if (!bestPR) return 0;
      
      // Return actual value achieved for threshold comparison
      if (achievement.unit === Unit.LBS || achievement.unit === Unit.KG) {
        return Math.round(convertToLbs(bestPR.value || bestPR.weight, bestPR.unit));
      }
      
      if (achievement.unit === Unit.REPS) {
        return typeof bestPR.value === 'number' ? bestPR.value : bestPR.reps || 0;
      }
      
      if (achievement.unit === Unit.TIME && typeof bestPR.value === 'string') {
        // For time achievements, return seconds for comparison with target
        return timeToSeconds(bestPR.value);
      }
      
      return 0;
    }

    case AchievementType.TIME_BASED: {
      // Find the best time for the specific movement/category
      if (achievement.movement) {
        const movementPRs = prs.filter(pr => 
          pr.movement === achievement.movement && pr.unit === Unit.TIME
        );
        
        if (movementPRs.length === 0) return 0;
        
        const bestTime = movementPRs.reduce((best, current) => {
          if (!best) return current;
          if (typeof current.value === 'string' && typeof best.value === 'string') {
            return timeToSeconds(current.value) < timeToSeconds(best.value) ? current : best;
          }
          return best;
        }, movementPRs[0]);
        
        if (bestTime && typeof bestTime.value === 'string') {
          return timeToSeconds(bestTime.value);
        }
      }
      
      // Fallback to existing progress
      return achievement.progress;
    }

    case AchievementType.COMPOUND: {
      // Complex achievements requiring multiple conditions
      // For now, use manual calculation based on achievement ID
      
      switch (achievement.id) {
        case 'achievement-heavy-hitter': {
          // "Lift 2,000+ lbs total in Powerlifting PRs"
          const powerliftingPRs = prs.filter(pr => pr.movementCategory === MovementCategory.POWERLIFTING);
          const totalWeight = powerliftingPRs.reduce((total, pr) => {
            return total + convertToLbs(pr.value || pr.weight, pr.unit);
          }, 0);
          return Math.round(totalWeight);
        }
        
        default:
          // Return existing progress for unknown compound achievements
          return achievement.progress;
      }
    }

    default:
      return achievement.progress;
  }
};

// Check if achievement should be unlocked
export const shouldUnlockAchievement = (achievement: Achievement, progress: number): boolean => {
  if (achievement.completed) return false;
  
  // For time-based achievements, lower is better (progress <= target)
  if (achievement.unit === Unit.TIME || achievement.type === AchievementType.TIME_BASED) {
    return progress > 0 && progress <= achievement.target;
  }
  
  // For all other achievements, higher is better (progress >= target)
  return progress >= achievement.target;
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