import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  theme: 'light' | 'dark' | 'system';
  activeWorkoutId: string | null;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setActiveWorkout: (workoutId: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'system',
      activeWorkoutId: null,
      setTheme: (theme) => set({ theme }),
      setActiveWorkout: (workoutId) => set({ activeWorkoutId: workoutId }),
    }),
    {
      name: 'axle-app-storage',
    }
  )
);
