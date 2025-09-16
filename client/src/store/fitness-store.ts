import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Workout {
  id: string
  name: string
  date: string
  duration: number
  exercises: number
  sets: number
}

interface PersonalRecord {
  id: string
  exercise: string
  weight: number
  date: string
}

interface FitnessState {
  // Stats
  streak: number
  weeklyWorkouts: number
  
  // Data
  workouts: Workout[]
  personalRecords: PersonalRecord[]
  
  // Actions
  addWorkout: (workout: Omit<Workout, 'id'>) => void
  addPersonalRecord: (pr: Omit<PersonalRecord, 'id'>) => void
  updateStreak: (days: number) => void
  setWeeklyWorkouts: (count: number) => void
}

export const useFitnessStore = create<FitnessState>()(
  persist(
    (set, get) => ({
      // Initial state
      streak: 12,
      weeklyWorkouts: 4,
      workouts: [
        {
          id: '1',
          name: 'Push Day',
          date: 'Yesterday • 45 min',
          duration: 45,
          exercises: 8,
          sets: 24
        },
        {
          id: '2',
          name: 'Pull Day',
          date: 'Monday • 52 min',
          duration: 52,
          exercises: 6,
          sets: 18
        }
      ],
      personalRecords: [
        {
          id: '1',
          exercise: 'Bench Press',
          weight: 225,
          date: '3 days ago'
        },
        {
          id: '2',
          exercise: 'Deadlift',
          weight: 315,
          date: '1 week ago'
        }
      ],

      // Actions
      addWorkout: (workout) => {
        const newWorkout = {
          ...workout,
          id: Date.now().toString()
        }
        set((state) => ({
          workouts: [newWorkout, ...state.workouts]
        }))
      },

      addPersonalRecord: (pr) => {
        const newPR = {
          ...pr,
          id: Date.now().toString()
        }
        set((state) => ({
          personalRecords: [newPR, ...state.personalRecords]
        }))
      },

      updateStreak: (days) => {
        set({ streak: days })
      },

      setWeeklyWorkouts: (count) => {
        set({ weeklyWorkouts: count })
      }
    }),
    {
      name: 'fitness-storage'
    }
  )
)
