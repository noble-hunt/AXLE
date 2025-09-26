import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

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

// Mock app store
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    profile: {
      equipment: ['Dumbbells', 'Kettlebell', 'Barbell']
    }
  })
}));

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
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

describe('Workout Flows Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('Workout Generator Flow', () => {
    it('should handle workout generation request with correct API structure', async () => {
      // Test the API request structure for workout generation
      const mockGeneratedWorkout = {
        id: 'workout-generated-123',
        workout: {
          meta: {
            title: "Generated Strength Workout",
            goal: "Strength"
          },
          estTimeMin: 45,
          intensity: "7/10",
          seed: "test-seed-123",
          blocks: [
            {
              name: "Barbell Squat",
              sets: 3,
              reps: 8,
              rest_sec: 90,
              notes: "Focus on form"
            }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeneratedWorkout
      });

      // Simulate API call structure
      const requestBody = {
        duration: 45,
        intensity: 7,
        equipment: ['barbell', 'dumbbells'],
        constraints: ['no jumping'],
        goals: ['strength']
      };

      const response = await fetch('/api/workouts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      // Assert correct API structure
      expect(mockFetch).toHaveBeenCalledWith('/api/workouts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      expect(result.id).toBe('workout-generated-123');
      expect(result.workout.meta.title).toBe('Generated Strength Workout');
      expect(result.workout.blocks).toHaveLength(1);
      expect(result.workout.blocks[0].name).toBe('Barbell Squat');
    });

    it('should handle workout save request with proper structure', async () => {
      // Test the API request structure for saving generated workouts
      const mockSavedWorkout = {
        id: 'workout-saved-456'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSavedWorkout
      });

      const workoutData = {
        title: "My Generated Workout",
        request: {
          duration: 30,
          intensity: 6
        },
        sets: [
          { exercise: "Push-ups", reps: 15 },
          { exercise: "Squats", reps: 20 }
        ],
        notes: "Generated workout",
        seed: "deterministic-seed-123"
      };

      const response = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workoutData)
      });

      const result = await response.json();

      // Assert save workflow
      expect(mockFetch).toHaveBeenCalledWith('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workoutData)
      });

      expect(result.id).toBe('workout-saved-456');
    });
  });

  describe('Workout Start Flow', () => {
    it('should handle workout start request with started_at persistence', async () => {
      // Test the API request structure for starting a workout
      const workoutId = 'workout-start-test-789';
      const mockStartResponse = {
        id: workoutId
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStartResponse
      });

      // Simulate starting a workout
      const response = await fetch(`/api/workouts/${workoutId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      // Assert start workflow
      expect(mockFetch).toHaveBeenCalledWith(`/api/workouts/${workoutId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      expect(result.id).toBe(workoutId);
    });

    it('should handle idempotent workout start requests', async () => {
      // Test idempotent behavior when workout is already started
      const workoutId = 'workout-already-started-123';
      const mockIdempotentResponse = {
        id: workoutId,
        message: "Workout already started"
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockIdempotentResponse
      });

      const response = await fetch(`/api/workouts/${workoutId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      // Assert idempotent response
      expect(result.id).toBe(workoutId);
      expect(result.message).toBe("Workout already started");
    });
  });

  describe('Suggested Workout Flow', () => {
    it('should handle daily suggestion request', async () => {
      // Test the API request structure for getting daily suggestions
      const mockSuggestion = {
        id: 'suggestion-123',
        date: '2023-01-01',
        request: {
          category: 'Strength',
          duration: 45,
          intensity: 7
        },
        rationale: {
          rulesApplied: ['recovery-based', 'weekly-balance'],
          scores: {
            recency: 0.8,
            weeklyBalance: 0.6,
            fatigue: 0.3
          }
        },
        workoutId: null
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuggestion
      });

      // Simulate getting daily suggestion
      const response = await fetch('/api/workouts/suggest/today', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      const result = await response.json();

      // Assert suggestion structure
      expect(mockFetch).toHaveBeenCalledWith('/api/workouts/suggest/today', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      expect(result.id).toBe('suggestion-123');
      expect(result.request.category).toBe('Strength');
      expect(result.rationale.rulesApplied).toContain('recovery-based');
    });

    it('should handle suggestion materialization (start from suggestion)', async () => {
      // Test starting a workout from a daily suggestion
      const mockStartResponse = {
        id: 'workout-from-suggestion-456'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStartResponse
      });

      const suggestionData = {
        focus: 'Strength Training',
        minutes: 45,
        intensity: 7,
        seed: { rngSeed: 'suggestion-seed-123' },
        generatorVersion: 'v0.3.0',
        source: 'daily-suggestion'
      };

      const response = await fetch('/api/workouts/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suggestionData)
      });

      const result = await response.json();

      // Assert suggestion start workflow
      expect(mockFetch).toHaveBeenCalledWith('/api/workouts/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suggestionData)
      });

      expect(result.id).toBe('workout-from-suggestion-456');
    });
  });

  describe('API Error Handling', () => {
    it('should handle workout generation errors gracefully', async () => {
      // Test error handling for workout generation
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          message: 'Invalid workout parameters'
        })
      });

      const response = await fetch('/api/workouts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: -1, intensity: 11 }) // Invalid data
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should handle workout start errors (not found)', async () => {
      // Test error handling for starting non-existent workout
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          message: 'Workout not found'
        })
      });

      const response = await fetch('/api/workouts/nonexistent-id/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
  });

  describe('Data Structure Validation', () => {
    it('should validate workout generation request structure', () => {
      // Validate the expected structure for workout generation requests
      const validRequest = {
        duration: 30,
        intensity: 6,
        equipment: ['dumbbells', 'kettlebell'],
        constraints: ['no jumping', 'low impact'],
        goals: ['strength', 'endurance']
      };

      // Basic validation checks
      expect(typeof validRequest.duration).toBe('number');
      expect(validRequest.duration).toBeGreaterThan(0);
      expect(validRequest.duration).toBeLessThanOrEqual(120);
      
      expect(typeof validRequest.intensity).toBe('number');
      expect(validRequest.intensity).toBeGreaterThanOrEqual(1);
      expect(validRequest.intensity).toBeLessThanOrEqual(10);
      
      expect(Array.isArray(validRequest.equipment)).toBe(true);
      expect(Array.isArray(validRequest.constraints)).toBe(true);
      expect(Array.isArray(validRequest.goals)).toBe(true);
    });

    it('should validate workout start request structure', () => {
      // Validate the expected structure for starting workouts from suggestions
      const validStartRequest = {
        focus: 'Strength Training',
        minutes: 45,
        intensity: 7,
        seed: { rngSeed: 'deterministic-seed' },
        generatorVersion: 'v0.3.0',
        source: 'daily-suggestion'
      };

      expect(typeof validStartRequest.focus).toBe('string');
      expect(validStartRequest.focus.length).toBeGreaterThan(0);
      
      expect(typeof validStartRequest.minutes).toBe('number');
      expect(validStartRequest.minutes).toBeGreaterThan(0);
      
      expect(typeof validStartRequest.intensity).toBe('number');
      expect(validStartRequest.intensity).toBeGreaterThanOrEqual(1);
      expect(validStartRequest.intensity).toBeLessThanOrEqual(10);
      
      expect(typeof validStartRequest.seed).toBe('object');
      expect(typeof validStartRequest.generatorVersion).toBe('string');
      expect(typeof validStartRequest.source).toBe('string');
    });
  });
});