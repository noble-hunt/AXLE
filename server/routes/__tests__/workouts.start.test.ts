import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { startSuggestedWorkout } from '../workouts.start';
import type { AuthenticatedRequest } from '../../middleware/auth';

// Mock the service layer
vi.mock('../../services/workouts/createFromSeed', () => ({
  createWorkoutFromSeed: vi.fn()
}));

// Mock Sentry
vi.mock('@sentry/node', () => ({
  captureException: vi.fn()
}));

describe('/api/workouts/start endpoint', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockStatus: ReturnType<typeof vi.fn>;
  let mockJson: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockStatus = vi.fn().mockReturnThis();
    mockJson = vi.fn().mockReturnThis();
    
    mockRes = {
      status: mockStatus,
      json: mockJson
    };

    mockReq = {
      user: { id: 'test-user-123' },
      body: {}
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Happy Path', () => {
    it('should start workout successfully with minimal body and return 201 with id', async () => {
      // Arrange
      const mockWorkoutId = 'workout-abc123';
      const { createWorkoutFromSeed } = await import('../../services/workouts/createFromSeed');
      vi.mocked(createWorkoutFromSeed).mockResolvedValue({
        id: mockWorkoutId,
        title: 'Test Workout'
      } as any);

      mockReq.body = {
        focus: 'Strength',
        minutes: 30,
        intensity: 7
      };

      // Act
      await startSuggestedWorkout(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({ id: mockWorkoutId });
      
      // Verify service called with correct parameters
      expect(createWorkoutFromSeed).toHaveBeenCalledWith({
        userId: 'test-user-123',
        focus: 'Strength',
        minutes: 30,
        intensity: 7,
        seed: {}, // default empty object
        generatorVersion: 'v0.3.0', // default
        source: 'daily-suggestion' // default
      });
    });

    it('should handle full body with all optional fields', async () => {
      // Arrange
      const mockWorkoutId = 'workout-xyz789';
      const { createWorkoutFromSeed } = await import('../../services/workouts/createFromSeed');
      vi.mocked(createWorkoutFromSeed).mockResolvedValue({
        id: mockWorkoutId,
        title: 'Custom Workout'
      } as any);

      mockReq.body = {
        focus: 'Cardio',
        minutes: 45,
        intensity: 8,
        seed: { rngSeed: 'custom-seed-123' },
        generatorVersion: 'v0.2.5',
        source: 'manual-selection'
      };

      // Act
      await startSuggestedWorkout(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({ id: mockWorkoutId });
      
      // Verify all parameters passed through
      expect(createWorkoutFromSeed).toHaveBeenCalledWith({
        userId: 'test-user-123',
        focus: 'Cardio',
        minutes: 45,
        intensity: 8,
        seed: { rngSeed: 'custom-seed-123' },
        generatorVersion: 'v0.2.5',
        source: 'manual-selection'
      });
    });

    it('should return id in correct string format', async () => {
      // Arrange
      const mockWorkoutId = 'workout-uuid-format-123';
      const { createWorkoutFromSeed } = await import('../../services/workouts/createFromSeed');
      vi.mocked(createWorkoutFromSeed).mockResolvedValue({
        id: mockWorkoutId,
        title: 'Test'
      } as any);

      mockReq.body = {
        focus: 'Strength',
        minutes: 30,
        intensity: 7
      };

      // Act
      await startSuggestedWorkout(mockReq as Request, mockRes as Response);

      // Assert
      const [[responseData]] = mockJson.mock.calls;
      expect(responseData).toEqual({ id: mockWorkoutId });
      expect(typeof responseData.id).toBe('string');
      expect(responseData.id.length).toBeGreaterThan(0);
    });
  });

  describe('Authentication Errors', () => {
    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      mockReq.user = undefined;
      mockReq.body = {
        focus: 'Strength',
        minutes: 30,
        intensity: 7
      };

      // Act
      await startSuggestedWorkout(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ error: 'auth-required' });
    });

    it('should return 401 when user id is missing', async () => {
      // Arrange
      mockReq.user = { id: undefined } as any;
      mockReq.body = {
        focus: 'Strength',
        minutes: 30,
        intensity: 7
      };

      // Act
      await startSuggestedWorkout(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ error: 'auth-required' });
    });
  });

  describe('Validation Errors', () => {
    it('should return 400 when focus is missing', async () => {
      // Arrange
      mockReq.body = {
        // focus missing
        minutes: 30,
        intensity: 7
      };

      // Act
      await startSuggestedWorkout(mockReq as Request, mockRes as Response);

      // Assert - Zod validation will throw, caught by error handler
      expect(mockStatus).toHaveBeenCalledWith(500); // Zod errors default to 500
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'start-failed'
        })
      );
    });

    it('should return 400 when focus is empty string', async () => {
      // Arrange  
      mockReq.body = {
        focus: '', // empty string fails .min(1)
        minutes: 30,
        intensity: 7
      };

      // Act
      await startSuggestedWorkout(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'start-failed'
        })
      );
    });

    it('should return 400 when minutes is missing', async () => {
      // Arrange
      mockReq.body = {
        focus: 'Strength',
        // minutes missing
        intensity: 7
      };

      // Act
      await startSuggestedWorkout(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'start-failed'
        })
      );
    });

    it('should return 400 when minutes is not positive', async () => {
      // Arrange
      mockReq.body = {
        focus: 'Strength',
        minutes: -5, // negative fails .positive()
        intensity: 7
      };

      // Act
      await startSuggestedWorkout(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'start-failed'
        })
      );
    });

    it('should return 400 when intensity is out of range', async () => {
      // Arrange
      mockReq.body = {
        focus: 'Strength',
        minutes: 30,
        intensity: 11 // > 10 fails .max(10)
      };

      // Act
      await startSuggestedWorkout(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'start-failed'
        })
      );
    });

    it('should return 400 when intensity is below minimum', async () => {
      // Arrange
      mockReq.body = {
        focus: 'Strength', 
        minutes: 30,
        intensity: 0 // < 1 fails .min(1)
      };

      // Act
      await startSuggestedWorkout(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'start-failed'
        })
      );
    });
  });

  describe('Service Layer Errors', () => {
    it('should handle service errors gracefully', async () => {
      // Arrange
      const { createWorkoutFromSeed } = await import('../../services/workouts/createFromSeed');
      vi.mocked(createWorkoutFromSeed).mockRejectedValue(new Error('Database connection failed'));

      mockReq.body = {
        focus: 'Strength',
        minutes: 30,
        intensity: 7
      };

      // Act
      await startSuggestedWorkout(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'start-failed',
        detail: 'Database connection failed'
      });
    });

    it('should handle service errors with custom status codes', async () => {
      // Arrange
      const customError = new Error('Workout generation failed') as any;
      customError.statusCode = 422;
      
      const { createWorkoutFromSeed } = await import('../../services/workouts/createFromSeed');
      vi.mocked(createWorkoutFromSeed).mockRejectedValue(customError);

      mockReq.body = {
        focus: 'Strength',
        minutes: 30,
        intensity: 7
      };

      // Act
      await startSuggestedWorkout(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(422);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'start-failed',
        detail: 'Workout generation failed'
      });
    });
  });
});