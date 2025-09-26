import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';

// Mock the DAL functions
vi.mock('../dal/workouts', () => ({
  getWorkout: vi.fn(),
  updateWorkout: vi.fn()
}));

describe('POST /api/workouts/:id/start endpoint', () => {
  let mockGetWorkout: ReturnType<typeof vi.fn>;
  let mockUpdateWorkout: ReturnType<typeof vi.fn>;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockStatus: ReturnType<typeof vi.fn>;
  let mockJson: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import mocked functions
    const { getWorkout, updateWorkout } = await import('../dal/workouts');
    mockGetWorkout = vi.mocked(getWorkout);
    mockUpdateWorkout = vi.mocked(updateWorkout);
    
    // Setup mock request and response objects
    mockStatus = vi.fn().mockReturnThis();
    mockJson = vi.fn().mockReturnThis();
    
    mockRes = {
      status: mockStatus,
      json: mockJson
    };

    mockReq = {
      user: { id: 'test-user-123' },
      params: { id: 'test-workout-id' }
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Happy Path', () => {
    it('should start workout successfully and return 200 with workout id', async () => {
      // Arrange
      const workoutId = 'workout-123';
      const mockWorkout = {
        id: workoutId,
        user_id: 'test-user-123',
        title: 'Test Workout',
        started_at: null, // Not yet started
        completed: false
      };
      
      const mockUpdatedWorkout = {
        ...mockWorkout,
        started_at: new Date().toISOString(),
        completed: false
      };
      
      mockGetWorkout.mockResolvedValue(mockWorkout);
      mockUpdateWorkout.mockResolvedValue(mockUpdatedWorkout);

      // Act
      const response = await request(app)
        .post(`/api/workouts/${workoutId}/start`)
        .expect(200);

      // Assert
      expect(response.body).toEqual({ id: workoutId });
      expect(mockGetWorkout).toHaveBeenCalledWith('test-user-123', workoutId);
      expect(mockUpdateWorkout).toHaveBeenCalledWith('test-user-123', workoutId, {
        started_at: expect.any(String),
        completed: false
      });
      
      // Verify started_at is a valid ISO timestamp
      const updateCall = mockUpdateWorkout.mock.calls[0][2];
      expect(updateCall.started_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should persist started_at timestamp in the database', async () => {
      // Arrange
      const workoutId = 'workout-456';
      const mockWorkout = {
        id: workoutId,
        user_id: 'test-user-123',
        title: 'Another Test Workout',
        started_at: null,
        completed: false
      };
      
      const startTime = new Date();
      const mockUpdatedWorkout = {
        ...mockWorkout,
        started_at: startTime.toISOString(),
        completed: false
      };
      
      mockGetWorkout.mockResolvedValue(mockWorkout);
      mockUpdateWorkout.mockResolvedValue(mockUpdatedWorkout);

      // Act
      await request(app)
        .post(`/api/workouts/${workoutId}/start`)
        .expect(200);

      // Assert that updateWorkout was called with started_at
      expect(mockUpdateWorkout).toHaveBeenCalledWith('test-user-123', workoutId, {
        started_at: expect.any(String),
        completed: false
      });
      
      const updateCall = mockUpdateWorkout.mock.calls[0][2];
      const persistedTime = new Date(updateCall.started_at);
      
      // Verify the timestamp is recent (within 1 second of test start)
      expect(persistedTime.getTime()).toBeGreaterThanOrEqual(startTime.getTime() - 1000);
      expect(persistedTime.getTime()).toBeLessThanOrEqual(startTime.getTime() + 1000);
    });
  });

  describe('Idempotency', () => {
    it('should return 200 with message when workout is already started (idempotent)', async () => {
      // Arrange
      const workoutId = 'workout-789';
      const alreadyStartedTime = '2023-01-01T10:00:00.000Z';
      const mockWorkout = {
        id: workoutId,
        user_id: 'test-user-123',
        title: 'Already Started Workout',
        started_at: alreadyStartedTime, // Already started
        completed: false
      };
      
      mockGetWorkout.mockResolvedValue(mockWorkout);

      // Act
      const response = await request(app)
        .post(`/api/workouts/${workoutId}/start`)
        .expect(200);

      // Assert
      expect(response.body).toEqual({ 
        id: workoutId, 
        message: "Workout already started" 
      });
      expect(mockGetWorkout).toHaveBeenCalledWith('test-user-123', workoutId);
      expect(mockUpdateWorkout).not.toHaveBeenCalled(); // Should not update if already started
    });

    it('should handle multiple calls to start the same workout', async () => {
      // Arrange
      const workoutId = 'workout-multiple';
      const mockWorkout = {
        id: workoutId,
        user_id: 'test-user-123',
        title: 'Multiple Start Test',
        started_at: null,
        completed: false
      };
      
      const mockUpdatedWorkout = {
        ...mockWorkout,
        started_at: '2023-01-01T10:00:00.000Z',
        completed: false
      };
      
      // First call: workout not started
      mockGetWorkout.mockResolvedValueOnce(mockWorkout);
      mockUpdateWorkout.mockResolvedValueOnce(mockUpdatedWorkout);
      
      // Second call: workout already started
      mockGetWorkout.mockResolvedValueOnce({
        ...mockWorkout,
        started_at: '2023-01-01T10:00:00.000Z'
      });

      // Act - First call
      const response1 = await request(app)
        .post(`/api/workouts/${workoutId}/start`)
        .expect(200);

      // Act - Second call
      const response2 = await request(app)
        .post(`/api/workouts/${workoutId}/start`)
        .expect(200);

      // Assert
      expect(response1.body).toEqual({ id: workoutId });
      expect(response2.body).toEqual({ 
        id: workoutId, 
        message: "Workout already started" 
      });
      expect(mockUpdateWorkout).toHaveBeenCalledTimes(1); // Only called once
    });
  });

  describe('Error Cases', () => {
    it('should return 404 when workout does not exist', async () => {
      // Arrange
      const workoutId = 'nonexistent-workout';
      mockGetWorkout.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .post(`/api/workouts/${workoutId}/start`)
        .expect(404);

      // Assert
      expect(response.body).toEqual({ message: "Workout not found" });
      expect(mockGetWorkout).toHaveBeenCalledWith('test-user-123', workoutId);
      expect(mockUpdateWorkout).not.toHaveBeenCalled();
    });

    it('should return 404 when workout belongs to different user', async () => {
      // Arrange
      const workoutId = 'other-user-workout';
      mockGetWorkout.mockResolvedValue(null); // DAL should return null for user-scoped query

      // Act
      const response = await request(app)
        .post(`/api/workouts/${workoutId}/start`)
        .expect(404);

      // Assert
      expect(response.body).toEqual({ message: "Workout not found" });
      expect(mockGetWorkout).toHaveBeenCalledWith('test-user-123', workoutId);
    });

    it('should return 404 when updateWorkout fails to find workout', async () => {
      // Arrange
      const workoutId = 'workout-update-fail';
      const mockWorkout = {
        id: workoutId,
        user_id: 'test-user-123',
        title: 'Update Fail Test',
        started_at: null,
        completed: false
      };
      
      mockGetWorkout.mockResolvedValue(mockWorkout);
      mockUpdateWorkout.mockResolvedValue(null); // Update fails (workout deleted between get and update)

      // Act
      const response = await request(app)
        .post(`/api/workouts/${workoutId}/start`)
        .expect(404);

      // Assert
      expect(response.body).toEqual({ message: "Workout not found" });
    });

    it('should return 500 when database error occurs', async () => {
      // Arrange
      const workoutId = 'workout-db-error';
      mockGetWorkout.mockRejectedValue(new Error('Database connection failed'));

      // Act
      const response = await request(app)
        .post(`/api/workouts/${workoutId}/start`)
        .expect(500);

      // Assert
      expect(response.body).toEqual({ message: "Failed to start workout" });
    });

    it('should return 500 when updateWorkout throws error', async () => {
      // Arrange
      const workoutId = 'workout-update-error';
      const mockWorkout = {
        id: workoutId,
        user_id: 'test-user-123',
        title: 'Update Error Test',
        started_at: null,
        completed: false
      };
      
      mockGetWorkout.mockResolvedValue(mockWorkout);
      mockUpdateWorkout.mockRejectedValue(new Error('Update operation failed'));

      // Act
      const response = await request(app)
        .post(`/api/workouts/${workoutId}/start`)
        .expect(500);

      // Assert
      expect(response.body).toEqual({ message: "Failed to start workout" });
    });
  });

  describe('User Scoping', () => {
    it('should only access workouts belonging to authenticated user', async () => {
      // Arrange
      const workoutId = 'user-scoped-workout';
      const mockWorkout = {
        id: workoutId,
        user_id: 'test-user-123',
        title: 'User Scoped Test',
        started_at: null,
        completed: false
      };
      
      const mockUpdatedWorkout = {
        ...mockWorkout,
        started_at: new Date().toISOString(),
        completed: false
      };
      
      mockGetWorkout.mockResolvedValue(mockWorkout);
      mockUpdateWorkout.mockResolvedValue(mockUpdatedWorkout);

      // Act
      await request(app)
        .post(`/api/workouts/${workoutId}/start`)
        .expect(200);

      // Assert that all DAL calls include the authenticated user ID
      expect(mockGetWorkout).toHaveBeenCalledWith('test-user-123', workoutId);
      expect(mockUpdateWorkout).toHaveBeenCalledWith('test-user-123', workoutId, expect.any(Object));
    });
  });
});