import { useState, useCallback } from "react";
import confetti from "canvas-confetti";
import { useToast } from "@/hooks/use-toast";

export interface GroupAchievement {
  id: string;
  groupId: string;
  name: string;
  description: string;
  progress: number;
  unlocked: boolean;
  updatedAt: string;
}

export function useGroupAchievements() {
  const { toast } = useToast();
  const [achievements, setAchievements] = useState<GroupAchievement[]>([]);

  // Trigger confetti effect for achievement unlock
  const triggerConfetti = useCallback(() => {
    confetti({
      particleCount: 150,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']
    });
  }, []);

  // Show achievement unlock toast with confetti
  const celebrateAchievement = useCallback((achievement: GroupAchievement) => {
    // Trigger confetti
    triggerConfetti();
    
    // Show toast notification
    toast({
      title: `🎉 Achievement Unlocked!`,
      description: `Your group earned "${achievement.name}" - ${achievement.description}`,
      duration: 5000,
    });

    // Additional confetti bursts
    setTimeout(() => triggerConfetti(), 300);
    setTimeout(() => triggerConfetti(), 600);
  }, [triggerConfetti, toast]);

  // Check for newly unlocked achievements
  const checkForNewUnlocks = useCallback((newAchievements: GroupAchievement[]) => {
    const currentUnlocked = new Set(achievements.filter(a => a.unlocked).map(a => a.id));
    const newlyUnlocked = newAchievements.filter(
      a => a.unlocked && !currentUnlocked.has(a.id)
    );

    // Celebrate each newly unlocked achievement
    newlyUnlocked.forEach((achievement, index) => {
      setTimeout(() => {
        celebrateAchievement(achievement);
      }, index * 1000); // Stagger celebrations by 1 second
    });

    setAchievements(newAchievements);
    return newlyUnlocked;
  }, [achievements, celebrateAchievement]);

  return {
    achievements,
    setAchievements,
    checkForNewUnlocks,
    celebrateAchievement,
    triggerConfetti
  };
}