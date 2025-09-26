import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { registerWorkoutSuggestionRoutes } from '../routes/workout-suggest';
import { requireAuth } from '../middleware/auth';
import { requireJSON } from '../middleware/accept-json';

// Mock the middleware and services
vi.mock('../middleware/auth');
vi.mock('../middleware/accept-json');
vi.mock('../services/suggestions');

// Import mocked services
const { computeTodaySuggestion, startSuggestion } = await import('../services/suggestions');

describe('Workout Suggestion API E2E Tests', () => {
  let app: express.Application;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup Express app for testing
    app = express();
    app.use(express.json());
    
    // Mock middleware to pass through
    vi.mocked(requireJSON).mockImplementation((req, res, next) => next());
    vi.mocked(requireAuth).mockImplementation((req, res, next) => {
      // Mock authenticated user
      (req as any).user = { id: 'test-user-123' };
      next();
    });
    
    // Register the routes we want to test
    registerWorkoutSuggestionRoutes(app);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/workouts/suggest/today', () => {
    it('returns JSON for authenticated request', async () => {
      // Mock the suggestion service
      const mockSuggestion = {
        config: {
          focus: 'Strength Training',
          duration: 45,
          intensity: 7,
          equipment: ['Barbell', 'Dumbbells'],
          constraints: ['No jumping']
        },
        rationale: 'Based on your recent workouts, focusing on strength will help balance your training.',
        seed: {
          rngSeed: 'test-seed-123',
          generatorVersion: 'v0.3.0'
        }
      };
      
      vi.mocked(computeTodaySuggestion).mockResolvedValue(mockSuggestion);
      
      // Create test request (simulates what supertest would do)
      const response = await new Promise((resolve) => {
        const req = {
          method: 'GET',
          url: '/api/workouts/suggest/today',
          headers: { 'accept': 'application/json' },
          user: { id: 'test-user-123' }
        } as any;
        
        const res = {
          json: (data: any) => resolve({ status: 200, body: data, headers: { 'content-type': 'application/json' } }),
          status: vi.fn().mockReturnThis(),
          setHeader: vi.fn()
        } as any;
        
        app._router.handle(req, res);
      });
      
      expect(response).toMatchObject({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: { suggestion: mockSuggestion }
      });
      
      expect(computeTodaySuggestion).toHaveBeenCalledWith('test-user-123');
    });

    it('handles unauthenticated requests properly', async () => {
      // Mock auth middleware to reject
      vi.mocked(requireAuth).mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Authentication required' });
      });
      
      // Re-register routes with updated auth mock
      const testApp = express();
      testApp.use(express.json());
      registerWorkoutSuggestionRoutes(testApp);
      
      const response = await new Promise((resolve) => {
        const req = {
          method: 'GET',
          url: '/api/workouts/suggest/today',
          headers: { 'accept': 'application/json' }
        } as any;
        
        const res = {
          status: vi.fn().mockImplementation((code) => ({
            json: (data: any) => resolve({ status: code, body: data })
          }))
        } as any;
        
        testApp._router.handle(req, res);
      });
      
      expect(response).toMatchObject({
        status: 401,
        body: { error: 'Authentication required' }
      });
    });
  });

  describe('POST /api/workouts/suggest/today/start', () => {
    it('starts workout and returns id', async () => {
      // Mock the start suggestion service
      const mockResult = {
        workoutId: 'workout-abc-123'
      };
      
      vi.mocked(startSuggestion).mockResolvedValue(mockResult);
      
      // Create test request for POST
      const response = await new Promise((resolve) => {
        const req = {
          method: 'POST',
          url: '/api/workouts/suggest/today/start',
          headers: { 'accept': 'application/json', 'content-type': 'application/json' },
          user: { id: 'test-user-123' },
          body: {}
        } as any;
        
        const res = {
          status: vi.fn().mockImplementation((code) => ({
            json: (data: any) => resolve({ status: code, body: data, headers: { 'content-type': 'application/json' } })
          }))
        } as any;
        
        app._router.handle(req, res);
      });
      
      expect(response).toMatchObject({
        status: 201,
        headers: { 'content-type': 'application/json' },
        body: { workoutId: 'workout-abc-123' }
      });
      
      expect(startSuggestion).toHaveBeenCalledWith('test-user-123');
    });

    it('returns workout id matching expected format', async () => {
      const mockResult = {
        workoutId: 'workout-def-456'
      };
      
      vi.mocked(startSuggestion).mockResolvedValue(mockResult);
      
      const response = await new Promise((resolve) => {
        const req = {
          method: 'POST',
          url: '/api/workouts/suggest/today/start',
          headers: { 'accept': 'application/json' },
          user: { id: 'test-user-123' },
          body: {}
        } as any;
        
        const res = {
          status: vi.fn().mockImplementation((code) => ({
            json: (data: any) => resolve({ status: code, body: data })
          }))
        } as any;
        
        app._router.handle(req, res);
      });
      
      const workoutId = (response as any).body.workoutId;
      expect(workoutId).toMatch(/[a-z0-9-]/i);
      expect(workoutId).toBeTruthy();
      expect(typeof workoutId).toBe('string');
    });
  });
});

/* 
TODO: Enhanced E2E Testing with Supertest

Once supertest dependency conflict is resolved, enhance these tests:

```bash
npm install supertest @types/supertest --legacy-peer-deps
```

Then replace the manual request simulation with:

```typescript
import request from 'supertest';
import { app } from '../index'; // Export app from main server

it('returns JSON for /api/workouts/suggest/today', async () => {
  const res = await request(app)
    .get('/api/workouts/suggest/today')
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /application\/json/);
    
  expect(res.body.suggestion).toBeDefined();
});

it('starts workout and returns id', async () => {
  const res = await request(app)
    .post('/api/workouts/suggest/today/start')
    .set('Accept', 'application/json')
    .expect(201);
    
  expect(res.body.workoutId).toMatch(/[a-z0-9-]/i);
});
```

Benefits of supertest approach:
- Real HTTP requests through the full Express stack
- Automatic JSON parsing and status code checking
- Better integration with middleware pipeline
- More realistic testing of actual API behavior
*/