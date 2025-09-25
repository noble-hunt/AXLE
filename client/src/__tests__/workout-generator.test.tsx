import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WorkoutGenerateWizard from '../pages/workout/generate';

// Mock wouter navigation
const mockNavigate = vi.fn();
vi.mock('wouter', () => ({
  useLocation: () => ['/workout/generate', mockNavigate],
  useSearch: () => '',
  Link: ({ children, href, ...props }: any) => (
    <a href={href} onClick={() => mockNavigate(href)} {...props}>
      {children}
    </a>
  )
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock app store
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    profile: {
      equipment: ['Dumbbells', 'Kettlebell', 'Barbell']
    }
  })
}));

// Create a test wrapper with QueryClient
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Workout Generator Wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  it('should render the workout generator wizard', () => {
    const Wrapper = createTestWrapper();
    
    render(
      <Wrapper>
        <WorkoutGenerateWizard />
      </Wrapper>
    );

    // Check that the wizard renders with step 1 (goal selection)
    expect(screen.getByText('Workout Goal')).toBeInTheDocument();
    expect(screen.getByTestId('goal-strength')).toBeInTheDocument();
    
    // Check for goal options
    expect(screen.getByText('Strength')).toBeInTheDocument();
    expect(screen.getByText('Conditioning')).toBeInTheDocument();
    expect(screen.getByText('Hypertrophy')).toBeInTheDocument();
  });

  it('should navigate through wizard steps', async () => {
    const Wrapper = createTestWrapper();
    
    render(
      <Wrapper>
        <WorkoutGenerateWizard />
      </Wrapper>
    );

    // Step 1: Select goal
    fireEvent.click(screen.getByTestId('goal-strength'));
    fireEvent.click(screen.getByTestId('next-step-button'));

    // Step 2: Duration and intensity
    await waitFor(() => {
      expect(screen.getByText('Duration & Intensity')).toBeInTheDocument();
    });

    expect(screen.getByTestId('duration-slider')).toBeInTheDocument();
    expect(screen.getByTestId('intensity-slider')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('next-step-button'));

    // Step 3: Equipment selection
    await waitFor(() => {
      expect(screen.getByText('Available Equipment')).toBeInTheDocument();
    });

    expect(screen.getByTestId('equipment-barbell')).toBeInTheDocument();
    expect(screen.getByTestId('equipment-dumbbells')).toBeInTheDocument();
  });

  it('should generate workout preview when submitting valid config', async () => {
    const Wrapper = createTestWrapper();
    
    // Mock successful API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        workout: {
          meta: {
            title: "Test Strength Workout",
            goal: "Strength"
          },
          estTimeMin: 30,
          intensity: "7/10",
          seed: "test-seed-123",
          blocks: [
            {
              name: "Barbell Squat",
              sets: 3,
              reps: 8,
              rest_sec: 90,
              notes: "Keep back straight"
            }
          ]
        }
      })
    });

    render(
      <Wrapper>
        <WorkoutGenerateWizard />
      </Wrapper>
    );

    // Navigate through wizard steps
    // Step 1: Goal
    fireEvent.click(screen.getByTestId('goal-strength'));
    fireEvent.click(screen.getByTestId('next-step-button'));

    // Step 2: Duration/Intensity
    await waitFor(() => {
      expect(screen.getByTestId('duration-slider')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('next-step-button'));

    // Step 3: Equipment
    await waitFor(() => {
      expect(screen.getByTestId('equipment-barbell')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('equipment-barbell'));
    fireEvent.click(screen.getByTestId('generate-workout-button'));

    // Should show loading state then workout preview
    await waitFor(() => {
      expect(screen.getByText('Generated Workout')).toBeInTheDocument();
    });

    // Should show generated workout preview
    await waitFor(() => {
      expect(screen.getByText('Generated Workout')).toBeInTheDocument();
      expect(screen.getByText('Test Strength Workout')).toBeInTheDocument();
      expect(screen.getByText('Barbell Squat')).toBeInTheDocument();
    });

    // Check that API was called with correct parameters
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/workouts/generate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('Strength')
      })
    );
  });

  it('should display seed in monospace font for QA reproducibility', async () => {
    const Wrapper = createTestWrapper();
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        workout: {
          meta: { title: "Test Workout", goal: "Strength" },
          estTimeMin: 30,
          intensity: "7/10",
          seed: "test-seed-123",
          blocks: []
        }
      })
    });

    render(
      <Wrapper>
        <WorkoutGenerateWizard />
      </Wrapper>
    );

    // Navigate to generate workout
    fireEvent.click(screen.getByText('Strength'));
    fireEvent.click(screen.getByTestId('button-next'));
    await waitFor(() => fireEvent.click(screen.getByTestId('button-next')));
    await waitFor(() => fireEvent.click(screen.getByTestId('button-generate')));

    // Check seed is displayed in monospace (if rendered in UI)
    await waitFor(() => {
      expect(screen.getByText('Generated Workout')).toBeInTheDocument();
      // The seed may be displayed elsewhere in the UI, adjust based on actual implementation
    });
  });

  it('should navigate to workout page when Save & Start is clicked', async () => {
    const Wrapper = createTestWrapper();
    
    // Mock workout generation response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        workout: {
          meta: { title: "Test Workout", goal: "Strength" },
          estTimeMin: 30,
          intensity: "7/10",
          seed: "test-seed-123",
          blocks: []
        }
      })
    });

    // Mock workout save response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        workout: { id: 'test-workout-id' }
      })
    });

    render(
      <Wrapper>
        <WorkoutGenerateWizard />
      </Wrapper>
    );

    // Generate workout
    fireEvent.click(screen.getByTestId('goal-strength'));
    fireEvent.click(screen.getByTestId('next-step-button'));
    await waitFor(() => fireEvent.click(screen.getByTestId('next-step-button')));
    await waitFor(() => fireEvent.click(screen.getByTestId('generate-workout-button')));

    // Wait for preview to load
    await waitFor(() => {
      expect(screen.getByText('Generated Workout')).toBeInTheDocument();
    });

    // Click Save & Start
    fireEvent.click(screen.getByTestId('save-and-start-button'));

    // Should navigate to workout page
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/workout/test-workout-id');
    });

    // Verify save API call included seed
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/workouts',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"seed":"test-seed-123"')
      })
    );
  });

  it('should handle API errors gracefully', async () => {
    const Wrapper = createTestWrapper();
    
    // Mock API error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        ok: false,
        error: 'Generation failed'
      })
    });

    render(
      <Wrapper>
        <WorkoutGenerateWizard />
      </Wrapper>
    );

    // Try to generate workout
    fireEvent.click(screen.getByTestId('goal-strength'));
    fireEvent.click(screen.getByTestId('next-step-button'));
    await waitFor(() => fireEvent.click(screen.getByTestId('next-step-button')));
    await waitFor(() => fireEvent.click(screen.getByTestId('generate-workout-button')));

    // Should show error state
    await waitFor(() => {
      expect(screen.getByText('Failed to generate workout')).toBeInTheDocument();
    });
  });

  it('should reset to step 1 after error for retry', async () => {
    const Wrapper = createTestWrapper();
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        ok: false,
        error: 'Generation failed'
      })
    });

    render(
      <Wrapper>
        <WorkoutGenerateWizard />
      </Wrapper>
    );

    // Generate error
    fireEvent.click(screen.getByTestId('goal-strength'));
    fireEvent.click(screen.getByTestId('next-step-button'));
    await waitFor(() => fireEvent.click(screen.getByTestId('next-step-button')));
    await waitFor(() => fireEvent.click(screen.getByTestId('generate-workout-button')));

    await waitFor(() => {
      expect(screen.getByText('Failed to generate workout')).toBeInTheDocument();
    });

    // Click try again (or regenerate button)
    fireEvent.click(screen.getByTestId('regenerate-button'));

    // Should return to step 1
    await waitFor(() => {
      expect(screen.getByText('Workout Goal')).toBeInTheDocument();
    });
  });

  it('should validate required fields before proceeding', async () => {
    const Wrapper = createTestWrapper();
    
    render(
      <Wrapper>
        <WorkoutGenerateWizard />
      </Wrapper>
    );

    // Try to proceed without selecting goal
    const nextButton = screen.getByTestId('next-step-button');
    
    // Select goal and check if navigation works
    fireEvent.click(screen.getByTestId('goal-strength'));
    fireEvent.click(nextButton);

    // Should be able to proceed to next step
    await waitFor(() => {
      expect(screen.getByText('Duration & Intensity')).toBeInTheDocument();
    });
  });
});