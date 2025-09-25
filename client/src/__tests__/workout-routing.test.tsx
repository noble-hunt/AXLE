import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Router, Route } from 'wouter'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { Toaster } from '@/components/ui/toaster'
import Workout from '@/pages/workout'
import WorkoutDetail from '@/pages/workout-detail'
import WorkoutGenerate from '@/pages/workout/generate'
import { useAppStore } from '@/store/useAppStore'

// Mock the store
vi.mock('@/store/useAppStore')

// Mock fetch to prevent actual API calls
global.fetch = vi.fn()

// Create a test wrapper with router
function createRouterWrapper(initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <Router base={initialRoute}>
          {children}
        </Router>
        <Toaster />
      </QueryClientProvider>
    )
  }
}

// Setup default store state
beforeEach(() => {
  vi.mocked(useAppStore).mockReturnValue({
    workouts: [],
    addWorkout: vi.fn(),
    getWorkout: vi.fn().mockReturnValue(undefined),
    completeWorkout: vi.fn(),
    updateWorkout: vi.fn(),
    deleteWorkout: vi.fn(),
  })
})

describe('Workout Routing', () => {
  it('should navigate to generator when clicking "Create New Workout"', async () => {
    const mockNavigate = vi.fn()
    
    // Mock wouter's useLocation hook
    const useLocationMock = vi.fn(() => ['/', mockNavigate])
    vi.doMock('wouter', async () => {
      const actual = await vi.importActual('wouter')
      return {
        ...actual,
        useLocation: useLocationMock,
      }
    })

    const Wrapper = createRouterWrapper('/')
    
    render(
      <Wrapper>
        <Route path="/" component={Workout} />
      </Wrapper>
    )

    // Find and click the "Create New Workout" button
    const createButton = screen.getByTestId('primary-button')
    expect(createButton).toHaveTextContent('Create New Workout')
    
    fireEvent.click(createButton)
    
    // Verify navigation was called with the correct route
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/workout/generate')
    })
  })

  it('should redirect from /workout/ (no ID) to generator with reason=missing', async () => {
    const mockNavigate = vi.fn()
    
    // Mock wouter hooks for detail page
    vi.doMock('wouter', async () => {
      const actual = await vi.importActual('wouter')
      return {
        ...actual,
        useParams: () => ({ id: undefined }),
        useLocation: () => ['/', mockNavigate],
      }
    })

    const Wrapper = createRouterWrapper('/workout/')
    
    render(
      <Wrapper>
        <Route path="/workout/:id?" component={WorkoutDetail} />
      </Wrapper>
    )

    // Should redirect immediately due to missing ID
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/workout/generate?reason=missing', { replace: true })
    })
  })

  it('should redirect from /workout/invalid-id to generator with reason=missing', async () => {
    const mockNavigate = vi.fn()
    
    // Mock wouter hooks for invalid UUID
    vi.doMock('wouter', async () => {
      const actual = await vi.importActual('wouter')
      return {
        ...actual,
        useParams: () => ({ id: 'invalid-id' }),
        useLocation: () => ['/workout/invalid-id', mockNavigate],
      }
    })

    const Wrapper = createRouterWrapper('/workout/invalid-id')
    
    render(
      <Wrapper>
        <Route path="/workout/:id" component={WorkoutDetail} />
      </Wrapper>
    )

    // Should redirect due to invalid UUID format
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/workout/generate?reason=missing', { replace: true })
    })
  })

  it('should redirect when API returns 404 for valid UUID', async () => {
    const mockNavigate = vi.fn()
    const validUuid = '123e4567-e89b-12d3-a456-426614174000'
    
    // Mock API to return 404
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    } as Response)

    // Mock wouter hooks
    vi.doMock('wouter', async () => {
      const actual = await vi.importActual('wouter')
      return {
        ...actual,
        useParams: () => ({ id: validUuid }),
        useLocation: () => [`/workout/${validUuid}`, mockNavigate],
      }
    })

    const Wrapper = createRouterWrapper(`/workout/${validUuid}`)
    
    render(
      <Wrapper>
        <Route path="/workout/:id" component={WorkoutDetail} />
      </Wrapper>
    )

    // Should eventually redirect due to 404 from API
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/workout/generate?reason=missing', { replace: true })
    }, { timeout: 3000 })
  })

  it('should render generator page correctly', () => {
    const Wrapper = createRouterWrapper('/workout/generate')
    
    render(
      <Wrapper>
        <Route path="/workout/generate" component={WorkoutGenerate} />
      </Wrapper>
    )

    // Verify the generator page renders
    expect(screen.getByText('Workout Goal')).toBeInTheDocument()
    expect(screen.getByText('Strength')).toBeInTheDocument()
    expect(screen.getByText('Conditioning')).toBeInTheDocument()
  })
})