import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Session } from '@supabase/supabase-js';

interface AppState {
  theme: 'light' | 'dark' | 'system';
  activeWorkoutId: string | null;
  user: User | null;
  session: Session | null;
  authInitialized: boolean;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setActiveWorkout: (workoutId: string | null) => void;
  setAuth: (user: User | null, session: Session | null) => void;
  setAuthInitialized: (initialized: boolean) => void;
  clearAuth: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'system',
      activeWorkoutId: null,
      user: null,
      session: null,
      authInitialized: false,
      setTheme: (theme) => set({ theme }),
      setActiveWorkout: (workoutId) => set({ activeWorkoutId: workoutId }),
      setAuth: (user, session) => set({ user, session }),
      setAuthInitialized: (initialized) => set({ authInitialized: initialized }),
      clearAuth: () => set({ user: null, session: null }),
    }),
    {
      name: 'axle-app-storage',
      partialize: (state) => ({ 
        theme: state.theme,
        activeWorkoutId: state.activeWorkoutId,
        // Don't persist auth state for security
      }),
    }
  )
);
