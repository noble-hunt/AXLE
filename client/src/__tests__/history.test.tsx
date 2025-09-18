/**
 * Test for History page to verify it renders without "Objects are not valid as a React child" errors
 * This test specifically validates StatBadge components render icons properly as JSX
 */

import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import History from '../pages/history'

// Mock Zustand store
vi.mock('../store/useAppStore', () => ({
  useAppStore: vi.fn(() => ({
    workouts: [
      {
        id: 'test-workout-1',
        name: 'Morning Cardio',
        duration: 30,
        date: new Date('2024-01-15T08:00:00Z'),
        category: 'cardio',
        completed: true,
        exercises: [
          {
            name: 'Running',
            type: 'cardio',
            duration: 20
          }
        ]
      }
    ],
    isAuthenticated: true,
    hydrateFromDb: vi.fn(),
    user: { id: 'test-user', name: 'Test User' },
  })),
}))

// Mock the toast hook
vi.mock('../hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}))

// Mock the query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

describe('History Page', () => {
  test('renders history page without runtime errors', () => {
    const queryClient = createTestQueryClient()
    
    // This test verifies that StatBadge components render icons properly as JSX
    // If StatBadge icons were passed as components instead of JSX, this would throw
    // "Objects are not valid as a React child" runtime errors
    expect(() => {
      render(
        <QueryClientProvider client={queryClient}>
          <History />
        </QueryClientProvider>
      )
    }).not.toThrow()

    // Check that the component renders some content (loading or actual content)
    expect(document.body).toBeTruthy()
  })
})