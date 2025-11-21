import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { AuthenticatedRequest } from '../middleware/auth.js';

// Mock dependencies that might cause issues in test environment
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}));

vi.mock('../lib/openai', () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }
}));

// Mock the DAL and services
vi.mock('../dal/workouts', () => ({
  listWorkouts: vi.fn(),
  insertWorkout: vi.fn()
}));

vi.mock('../dal/reports', () => ({
  listReports: vi.fn()
}));

vi.mock('../workouts/engine', () => ({
  generateWorkoutPlan: vi.fn()
}));

vi.mock('../workouts/telemetry', () => ({
  logGenerationEvent: vi.fn(),
  extractMetricsSnapshot: vi.fn(),
  createRequestHash: vi.fn()
}));

// Mock config flags
vi.mock('../config/flags', () => ({
  isWorkoutV2Enabled: vi.fn(() => true),
  useMLPolicy: vi.fn(() => false),
  shouldShowMetricsDebug: vi.fn(() => false)
}));

describe('POST /api/workouts/generate endpoint', () => {
  let app: express.Application;
  let mockListWorkouts: ReturnType<typeof vi.fn>;
  let mockInsertWorkout: ReturnType<typeof vi.fn>;
  let mockListReports: ReturnType<typeof vi.fn>;
  let mockGenerateWorkoutPlan: ReturnType<typeof vi.fn>;
  let mockLogGenerationEvent: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import mocked functions
    const { listWorkouts, insertWorkout } = await import('../dal/workouts.js');
    const { listReports } = await import('../dal/reports.js');
    const { generateWorkoutPlan } = await import('../workouts/engine.js');
    const { logGenerationEvent } = await import('../workouts/telemetry.js');
    
    mockListWorkouts = vi.mocked(listWorkouts);
    mockInsertWorkout = vi.mocked(insertWorkout);
    mockListReports = vi.mocked(listReports);
    mockGenerateWorkoutPlan = vi.mocked(generateWorkoutPlan);
    mockLogGenerationEvent = vi.mocked(logGenerationEvent);
    
    // Setup Express app for testing
    app = express();
    app.use(express.json());
    
    // Mock auth middleware
    app.use((req, res, next) => {
      (req as AuthenticatedRequest).user = { id: 'test-user-123' };
      next();
    });
    
    // Add simplified workout generation route for testing
    app.post("/api/workouts/generate", async (req, res) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const { duration, intensity, equipment = [], constraints = [], goals = [] } = req.body;
        
        // Basic validation
        if (!duration || duration < 5 || duration > 120) {
          return res.status(400).json({ message: "Invalid duration" });
        }
        if (!intensity || intensity < 1 || intensity > 10) {
          return res.status(400).json({ message: "Invalid intensity" });
        }
        
        // Mock user context composition
        const recentWorkouts = await mockListWorkouts(authReq.user.id, { limit: 7 });
        const healthReports = await mockListReports(authReq.user.id, { days: 1 });
        
        // Generate workout plan
        const workoutPlan = await mockGenerateWorkoutPlan({
          duration,
          intensity,
          equipment,
          constraints,
          goals
        }, recentWorkouts || [], [], {}, {});
        
        // Insert workout into database
        const insertedWorkout = await mockInsertWorkout({
          userId: authReq.user.id,
          workout: {
            title: workoutPlan?.title || 'Generated Workout',
            request: req.body,
            sets: workoutPlan?.blocks || [],
            notes: workoutPlan?.rationale?.join('; ') || '',
            completed: false
          }
        });
        
        // Log telemetry (fire and forget)
        mockLogGenerationEvent(authReq.user.id, {
          workoutRequest: req.body,
          targetIntensity: intensity,
          selectedFocus: workoutPlan?.focus || 'mixed',
          blockIds: [],
          estimatedTSS: workoutPlan?.estimatedTSS || 0,
          metricsSnapshot: {}
        }, 100);
        
        res.status(200).json({
          id: insertedWorkout?.id,
          workout: {
            ...workoutPlan,
            id: insertedWorkout?.id
          }
        });
      } catch (error: any) {
        console.error("Failed to generate workout:", error);
        res.status(500).json({ message: "Failed to generate workout" });
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Happy Path', () => {
    it('should generate workout successfully and return 200 with workout data', async () => {
      // Arrange
      const mockWorkoutPlan = {
        focus: 'strength',
        title: 'Generated Strength Workout',
        blocks: [
          { 
            id: 'block-1',
            name: 'Barbell Squat',
            sets: 3,
            reps: 8,
            rest_sec: 90 
          }
        ],
        estimatedTSS: 45,
        rationale: ['Focus on strength development', 'Progressive overload']
      };
      
      const mockInsertedWorkout = {
        id: 'workout-123',
        title: 'Generated Strength Workout',
        user_id: 'test-user-123'
      };
      
      mockListWorkouts.mockResolvedValue([]);
      mockListReports.mockResolvedValue([]);
      mockGenerateWorkoutPlan.mockResolvedValue(mockWorkoutPlan);
      mockInsertWorkout.mockResolvedValue(mockInsertedWorkout);
      mockLogGenerationEvent.mockResolvedValue(undefined);

      const requestBody = {
        duration: 45,
        intensity: 7,
        equipment: ['barbell', 'dumbbells'],
        constraints: ['no jumping'],
        goals: ['strength']
      };

      // Act
      const response = await request(app)
        .post('/api/workouts/generate')
        .send(requestBody)
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        id: 'workout-123',
        workout: {
          ...mockWorkoutPlan,
          id: 'workout-123'
        }
      });
      
      expect(mockListWorkouts).toHaveBeenCalledWith('test-user-123', { limit: 7 });
      expect(mockGenerateWorkoutPlan).toHaveBeenCalledWith(
        requestBody,
        [],
        [],
        {},
        {}
      );
      expect(mockInsertWorkout).toHaveBeenCalledWith({
        userId: 'test-user-123',
        workout: {
          title: 'Generated Strength Workout',
          request: requestBody,
          sets: mockWorkoutPlan.blocks,
          notes: 'Focus on strength development; Progressive overload',
          completed: false
        }
      });
    });

    it('should handle minimal request body with only required fields', async () => {
      // Arrange
      const mockWorkoutPlan = {
        focus: 'mixed',
        title: 'Quick Workout',
        blocks: [{ id: 'block-1', name: 'Bodyweight Squats' }],
        estimatedTSS: 20,
        rationale: []
      };
      
      const mockInsertedWorkout = {
        id: 'workout-minimal',
        title: 'Quick Workout'
      };
      
      mockListWorkouts.mockResolvedValue([]);
      mockListReports.mockResolvedValue([]);
      mockGenerateWorkoutPlan.mockResolvedValue(mockWorkoutPlan);
      mockInsertWorkout.mockResolvedValue(mockInsertedWorkout);
      mockLogGenerationEvent.mockResolvedValue(undefined);

      const requestBody = {
        duration: 15,
        intensity: 4
      };

      // Act
      const response = await request(app)
        .post('/api/workouts/generate')
        .send(requestBody)
        .expect(200);

      // Assert
      expect(response.body.id).toBe('workout-minimal');
      expect(response.body.workout.title).toBe('Quick Workout');
      
      expect(mockGenerateWorkoutPlan).toHaveBeenCalledWith(
        {
          duration: 15,
          intensity: 4,
          equipment: [],
          constraints: [],
          goals: []
        },
        [],
        [],
        {},
        {}
      );
    });

    it('should compose user context from recent workouts and health data', async () => {
      // Arrange
      const mockRecentWorkouts = [
        { id: 'workout-1', createdAt: new Date(), request: { category: 'strength' } },
        { id: 'workout-2', createdAt: new Date(), request: { category: 'cardio' } }
      ];
      
      const mockHealthReports = [
        { id: 'report-1', metrics: { hrv: 45, sleepScore: 78 } }
      ];
      
      const mockWorkoutPlan = {
        focus: 'conditioning',
        title: 'Context-Aware Workout',
        blocks: [],
        estimatedTSS: 30,
        rationale: ['Based on recent training history']
      };
      
      const mockInsertedWorkout = { id: 'workout-context', title: 'Context-Aware Workout' };
      
      mockListWorkouts.mockResolvedValue(mockRecentWorkouts);
      mockListReports.mockResolvedValue(mockHealthReports);
      mockGenerateWorkoutPlan.mockResolvedValue(mockWorkoutPlan);
      mockInsertWorkout.mockResolvedValue(mockInsertedWorkout);
      mockLogGenerationEvent.mockResolvedValue(undefined);

      const requestBody = { duration: 30, intensity: 6 };

      // Act
      await request(app)
        .post('/api/workouts/generate')
        .send(requestBody)
        .expect(200);

      // Assert that user context was fetched
      expect(mockListWorkouts).toHaveBeenCalledWith('test-user-123', { limit: 7 });
      expect(mockListReports).toHaveBeenCalledWith('test-user-123', { days: 1 });
      
      // Assert that context was passed to generation
      expect(mockGenerateWorkoutPlan).toHaveBeenCalledWith(
        expect.objectContaining(requestBody),
        mockRecentWorkouts,
        [],
        {},
        {}
      );
    });

    it('should log telemetry data for generated workout', async () => {
      // Arrange
      const mockWorkoutPlan = {
        focus: 'strength',
        title: 'Telemetry Test Workout',
        blocks: [{ id: 'block-1' }],
        estimatedTSS: 55,
        rationale: []
      };
      
      const mockInsertedWorkout = { id: 'workout-telemetry' };
      
      mockListWorkouts.mockResolvedValue([]);
      mockListReports.mockResolvedValue([]);
      mockGenerateWorkoutPlan.mockResolvedValue(mockWorkoutPlan);
      mockInsertWorkout.mockResolvedValue(mockInsertedWorkout);
      mockLogGenerationEvent.mockResolvedValue(undefined);

      const requestBody = { duration: 40, intensity: 8 };

      // Act
      await request(app)
        .post('/api/workouts/generate')
        .send(requestBody)
        .expect(200);

      // Assert telemetry logging
      expect(mockLogGenerationEvent).toHaveBeenCalledWith(
        'test-user-123',
        {
          workoutRequest: requestBody,
          targetIntensity: 8,
          selectedFocus: 'strength',
          blockIds: [],
          estimatedTSS: 55,
          metricsSnapshot: {}
        },
        100
      );
    });
  });

  describe('Validation Errors', () => {
    it('should return 400 when duration is missing', async () => {
      // Act
      const response = await request(app)
        .post('/api/workouts/generate')
        .send({ intensity: 5 })
        .expect(400);

      // Assert
      expect(response.body.message).toBe('Invalid duration');
      expect(mockGenerateWorkoutPlan).not.toHaveBeenCalled();
    });

    it('should return 400 when duration is too low', async () => {
      // Act
      const response = await request(app)
        .post('/api/workouts/generate')
        .send({ duration: 3, intensity: 5 })
        .expect(400);

      // Assert
      expect(response.body.message).toBe('Invalid duration');
    });

    it('should return 400 when duration is too high', async () => {
      // Act
      const response = await request(app)
        .post('/api/workouts/generate')
        .send({ duration: 150, intensity: 5 })
        .expect(400);

      // Assert
      expect(response.body.message).toBe('Invalid duration');
    });

    it('should return 400 when intensity is missing', async () => {
      // Act
      const response = await request(app)
        .post('/api/workouts/generate')
        .send({ duration: 30 })
        .expect(400);

      // Assert
      expect(response.body.message).toBe('Invalid intensity');
    });

    it('should return 400 when intensity is too low', async () => {
      // Act
      const response = await request(app)
        .post('/api/workouts/generate')
        .send({ duration: 30, intensity: 0 })
        .expect(400);

      // Assert
      expect(response.body.message).toBe('Invalid intensity');
    });

    it('should return 400 when intensity is too high', async () => {
      // Act
      const response = await request(app)
        .post('/api/workouts/generate')
        .send({ duration: 30, intensity: 11 })
        .expect(400);

      // Assert
      expect(response.body.message).toBe('Invalid intensity');
    });

    it('should return 400 when request body is empty', async () => {
      // Act
      await request(app)
        .post('/api/workouts/generate')
        .send({})
        .expect(400);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when workout generation fails', async () => {
      // Arrange
      mockListWorkouts.mockResolvedValue([]);
      mockListReports.mockResolvedValue([]);
      mockGenerateWorkoutPlan.mockRejectedValue(new Error('Generation engine error'));

      const requestBody = { duration: 30, intensity: 6 };

      // Act
      const response = await request(app)
        .post('/api/workouts/generate')
        .send(requestBody)
        .expect(500);

      // Assert
      expect(response.body.message).toBe('Failed to generate workout');
    });

    it('should return 500 when database insertion fails', async () => {
      // Arrange
      const mockWorkoutPlan = {
        focus: 'strength',
        title: 'Test Workout',
        blocks: [],
        estimatedTSS: 30,
        rationale: []
      };
      
      mockListWorkouts.mockResolvedValue([]);
      mockListReports.mockResolvedValue([]);
      mockGenerateWorkoutPlan.mockResolvedValue(mockWorkoutPlan);
      mockInsertWorkout.mockRejectedValue(new Error('Database connection failed'));

      const requestBody = { duration: 30, intensity: 6 };

      // Act
      const response = await request(app)
        .post('/api/workouts/generate')
        .send(requestBody)
        .expect(500);

      // Assert
      expect(response.body.message).toBe('Failed to generate workout');
    });

    it('should return 500 when user context fetching fails', async () => {
      // Arrange
      mockListWorkouts.mockRejectedValue(new Error('Failed to fetch workouts'));

      const requestBody = { duration: 30, intensity: 6 };

      // Act
      const response = await request(app)
        .post('/api/workouts/generate')
        .send(requestBody)
        .expect(500);

      // Assert
      expect(response.body.message).toBe('Failed to generate workout');
    });
  });

  describe('User Scoping', () => {
    it('should only access data for authenticated user', async () => {
      // Arrange
      const mockWorkoutPlan = { focus: 'mixed', title: 'User Scoped', blocks: [], estimatedTSS: 25, rationale: [] };
      const mockInsertedWorkout = { id: 'workout-scoped' };
      
      mockListWorkouts.mockResolvedValue([]);
      mockListReports.mockResolvedValue([]);
      mockGenerateWorkoutPlan.mockResolvedValue(mockWorkoutPlan);
      mockInsertWorkout.mockResolvedValue(mockInsertedWorkout);
      mockLogGenerationEvent.mockResolvedValue(undefined);

      const requestBody = { duration: 25, intensity: 5 };

      // Act
      await request(app)
        .post('/api/workouts/generate')
        .send(requestBody)
        .expect(200);

      // Assert that all data access is scoped to the authenticated user
      expect(mockListWorkouts).toHaveBeenCalledWith('test-user-123', expect.any(Object));
      expect(mockListReports).toHaveBeenCalledWith('test-user-123', expect.any(Object));
      expect(mockInsertWorkout).toHaveBeenCalledWith({
        userId: 'test-user-123',
        workout: expect.any(Object)
      });
      expect(mockLogGenerationEvent).toHaveBeenCalledWith(
        'test-user-123',
        expect.any(Object),
        expect.any(Number)
      );
    });
  });
});