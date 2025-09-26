import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DailySuggestedCard } from '../DailySuggestedCard';

// Mock wouter's useLocation hook
const mockSetLocation = vi.fn();
vi.mock('wouter', () => ({
  useLocation: () => ['/current-path', mockSetLocation]
}));

// Mock toast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

// Mock httpJSON to simulate API calls
vi.mock('@/lib/http', () => ({
  httpJSON: vi.fn()
}));

describe('DailySuggestedCard - Start Now Flow', () => {
  const mockSuggestion = {
    focus: 'Strength',
    minutes: 30,
    intensity: 7,
    seed: { rngSeed: 'test-seed' },
    generatorVersion: 'v0.3.0'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Happy Path Navigation', () => {
    it('should call httpJSON with correct parameters and navigate on success', async () => {
      // Arrange
      const mockWorkoutId = 'workout-123abc';
      const { httpJSON } = await import('@/lib/http');
      vi.mocked(httpJSON).mockResolvedValue({ id: mockWorkoutId });

      // Act
      render(<DailySuggestedCard suggestion={mockSuggestion} />);
      const startButton = screen.getByTestId('button-start-now');
      fireEvent.click(startButton);

      // Assert
      await waitFor(() => {
        expect(httpJSON).toHaveBeenCalledWith('/api/workouts/start', {
          method: 'POST',
          body: JSON.stringify({
            focus: 'Strength',
            minutes: 30,
            intensity: 7,
            seed: { rngSeed: 'test-seed' },
            generatorVersion: 'v0.3.0',
            source: 'daily-suggestion'
          })
        });
        expect(mockSetLocation).toHaveBeenCalledWith('/workout/workout-123abc');
      });
    });

    it('should navigate with UUID format id', async () => {
      // Arrange
      const mockWorkoutId = '550e8400-e29b-41d4-a716-446655440000'; // UUID format
      const { httpJSON } = await import('@/lib/http');
      vi.mocked(httpJSON).mockResolvedValue({ id: mockWorkoutId });

      // Act
      render(<DailySuggestedCard suggestion={mockSuggestion} />);
      const startButton = screen.getByTestId('button-start-now');
      fireEvent.click(startButton);

      // Assert
      await waitFor(() => {
        expect(mockSetLocation).toHaveBeenCalledWith(`/workout/${mockWorkoutId}`);
      });
    });

    it('should handle minimal suggestion without optional fields', async () => {
      // Arrange
      const minimalSuggestion = {
        focus: 'Cardio',
        minutes: 20,
        intensity: 5
        // No seed or generatorVersion
      };
      const mockWorkoutId = 'workout-minimal';
      const { httpJSON } = await import('@/lib/http');
      vi.mocked(httpJSON).mockResolvedValue({ id: mockWorkoutId });

      // Act
      render(<DailySuggestedCard suggestion={minimalSuggestion} />);
      const startButton = screen.getByTestId('button-start-now');
      fireEvent.click(startButton);

      // Assert
      await waitFor(() => {
        expect(httpJSON).toHaveBeenCalledWith('/api/workouts/start', {
          method: 'POST',
          body: JSON.stringify({
            focus: 'Cardio',
            minutes: 20,
            intensity: 5,
            seed: {},  // defaults to empty object
            generatorVersion: 'v0.3.0',  // defaults to v0.3.0
            source: 'daily-suggestion'
          })
        });
        expect(mockSetLocation).toHaveBeenCalledWith('/workout/workout-minimal');
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error toast and navigate to generator on API failure', async () => {
      // Arrange
      const { httpJSON } = await import('@/lib/http');
      vi.mocked(httpJSON).mockRejectedValue(new Error('API Error'));

      // Act
      render(<DailySuggestedCard suggestion={mockSuggestion} />);
      const startButton = screen.getByTestId('button-start-now');
      fireEvent.click(startButton);

      // Assert
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Could not start workout',
          description: "We'll open the generator so you can build one quickly.",
          variant: 'destructive'
        });
        expect(mockSetLocation).toHaveBeenCalledWith('/workout-generate');
      });
    });

    it('should show error toast and navigate to generator on 404 error', async () => {
      // Arrange
      const { httpJSON } = await import('@/lib/http');
      const notFoundError = Object.assign(new Error('Not Found'), { 
        statusCode: 404, 
        detail: { error: 'not-found' } 
      });
      vi.mocked(httpJSON).mockRejectedValue(notFoundError);

      // Act
      render(<DailySuggestedCard suggestion={mockSuggestion} />);
      const startButton = screen.getByTestId('button-start-now');
      fireEvent.click(startButton);

      // Assert
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Could not start workout',
          description: "We'll open the generator so you can build one quickly.",
          variant: 'destructive'
        });
        expect(mockSetLocation).toHaveBeenCalledWith('/workout-generate');
      });
    });

    it('should navigate with undefined id when API response is malformed', async () => {
      // Arrange
      const { httpJSON } = await import('@/lib/http');
      vi.mocked(httpJSON).mockResolvedValue({ /* missing id field */ });

      // Act
      render(<DailySuggestedCard suggestion={mockSuggestion} />);
      const startButton = screen.getByTestId('button-start-now');
      fireEvent.click(startButton);

      // Assert
      await waitFor(() => {
        // Since the API function returns undefined for missing id, 
        // navigation will happen with undefined
        expect(mockSetLocation).toHaveBeenCalledWith('/workout/undefined');
      });
      
      // No toast should be called since there was no error thrown
      expect(mockToast).not.toHaveBeenCalled();
    });
  });

  describe('UI States', () => {
    it('should show loading state during API call', async () => {
      // Arrange
      const { httpJSON } = await import('@/lib/http');
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(httpJSON).mockReturnValue(pendingPromise);

      // Act
      render(<DailySuggestedCard suggestion={mockSuggestion} />);
      const startButton = screen.getByTestId('button-start-now');
      fireEvent.click(startButton);

      // Assert loading state
      expect(screen.getByText('Starting…')).toBeInTheDocument();
      expect(startButton).toBeDisabled();

      // Resolve promise and check final state
      resolvePromise!({ id: 'test-id' });
      await waitFor(() => {
        expect(screen.getByText('Start Now')).toBeInTheDocument();
        expect(startButton).not.toBeDisabled();
      });
    });

    it('should disable button during loading and re-enable after error', async () => {
      // Arrange
      const { httpJSON } = await import('@/lib/http');
      vi.mocked(httpJSON).mockRejectedValue(new Error('Test error'));

      // Act
      render(<DailySuggestedCard suggestion={mockSuggestion} />);
      const startButton = screen.getByTestId('button-start-now');
      
      // Initial state
      expect(startButton).not.toBeDisabled();
      
      fireEvent.click(startButton);

      // Assert final state after error
      await waitFor(() => {
        expect(startButton).not.toBeDisabled();
        expect(screen.getByText('Start Now')).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('should pass through all suggestion fields correctly', async () => {
      // Arrange
      const complexSuggestion = {
        focus: 'Olympic Lifting',
        minutes: 45,
        intensity: 9,
        seed: { 
          rngSeed: 'complex-seed-789',
          customField: 'test-value'
        },
        generatorVersion: 'v0.2.5'
      };
      const { httpJSON } = await import('@/lib/http');
      vi.mocked(httpJSON).mockResolvedValue({ id: 'complex-workout' });

      // Act
      render(<DailySuggestedCard suggestion={complexSuggestion} />);
      const startButton = screen.getByTestId('button-start-now');
      fireEvent.click(startButton);

      // Assert
      await waitFor(() => {
        expect(httpJSON).toHaveBeenCalledWith('/api/workouts/start', {
          method: 'POST',
          body: JSON.stringify({
            focus: 'Olympic Lifting',
            minutes: 45,
            intensity: 9,
            seed: { 
              rngSeed: 'complex-seed-789',
              customField: 'test-value'
            },
            generatorVersion: 'v0.2.5',
            source: 'daily-suggestion'
          })
        });
      });
    });
  });
});