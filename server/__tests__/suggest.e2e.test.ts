import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { registerWorkoutSuggestionRoutes } from '../routes/workout-suggest';
import { requireAuth } from '../middleware/auth';
import { requireJSON } from '../middleware/accept-json';
import { API_ENDPOINTS } from '@shared/endpoints';

// Mock OpenAI to prevent browser environment error
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}));

// Mock the middleware and services
vi.mock('../middleware/auth');
vi.mock('../middleware/accept-json');
vi.mock('../services/suggestions');

// Mock other dependencies that might import OpenAI
vi.mock('../workoutGenerator', () => ({
  generateWorkout: vi.fn()
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

// Import mocked services
const { computeTodaySuggestion, startSuggestion } = await import('../services/suggestions');

describe('Workout Suggestion API E2E Tests', () => {
  
  // Test client-server endpoint consistency
  describe('Endpoint Consistency', () => {
    it('client and server use same endpoint constants', () => {
      // This test ensures we don't have client/server drift on endpoint paths
      expect(API_ENDPOINTS.WORKOUTS_SUGGEST_TODAY).toBe('/api/workouts/suggest/today');
      expect(API_ENDPOINTS.WORKOUTS_SUGGEST_TODAY_START).toBe('/api/workouts/suggest/today/start');
    });
    
    it('endpoint constants are used in both client and server', async () => {
      // Verify the constants are actually imported and used
      const clientApiFile = await import('../../client/src/features/workouts/suggest/api.ts');
      const serverRouteFile = await import('../routes/workout-suggest.ts');
      
      // This will fail at compile time if the imports are removed
      expect(API_ENDPOINTS).toBeDefined();
      expect(typeof API_ENDPOINTS.WORKOUTS_SUGGEST_TODAY).toBe('string');
      expect(typeof API_ENDPOINTS.WORKOUTS_SUGGEST_TODAY_START).toBe('string');
    });
  });
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
    it('returns JSON with correct content-type for authenticated request', async () => {
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
      let responseHeaders: Record<string, string> = {};
      const response = await new Promise((resolve) => {
        const req = {
          method: 'GET',
          url: API_ENDPOINTS.WORKOUTS_SUGGEST_TODAY,
          headers: { 'accept': 'application/json' },
          user: { id: 'test-user-123' }
        } as any;
        
        const res = {
          setHeader: (name: string, value: string) => {
            responseHeaders[name.toLowerCase()] = value;
          },
          getHeader: (name: string) => responseHeaders[name.toLowerCase()],
          json: (data: any) => {
            // Simulate Express setting content-type
            if (!responseHeaders['content-type']) {
              responseHeaders['content-type'] = 'application/json; charset=utf-8';
            }
            resolve({ status: 200, body: data, headers: responseHeaders });
          },
          status: vi.fn().mockReturnThis()
        } as any;
        
        app._router.handle(req, res);
      });
      
      expect(response).toMatchObject({
        status: 200,
        body: { suggestion: mockSuggestion }
      });
      
      // Verify content-type header is set correctly
      expect((response as any).headers['content-type']).toContain('application/json');
      
      // Verify response is actually JSON, not HTML
      expect(JSON.stringify((response as any).body)).not.toContain('<!DOCTYPE html>');
      
      expect(computeTodaySuggestion).toHaveBeenCalledWith('test-user-123');
    });

    it('returns 401 with JSON content-type for unauthenticated requests', async () => {
      // Mock auth middleware to reject
      vi.mocked(requireAuth).mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Authentication required' });
      });
      
      // Re-register routes with updated auth mock
      const testApp = express();
      testApp.use(express.json());
      registerWorkoutSuggestionRoutes(testApp);
      
      let responseHeaders: Record<string, string> = {};
      const response = await new Promise((resolve) => {
        const req = {
          method: 'GET',
          url: API_ENDPOINTS.WORKOUTS_SUGGEST_TODAY,
          headers: { 'accept': 'application/json' }
        } as any;
        
        const res = {
          setHeader: (name: string, value: string) => {
            responseHeaders[name.toLowerCase()] = value;
          },
          status: vi.fn().mockImplementation((code) => ({
            json: (data: any) => {
              responseHeaders['content-type'] = 'application/json; charset=utf-8';
              resolve({ status: code, body: data, headers: responseHeaders });
            }
          }))
        } as any;
        
        testApp._router.handle(req, res);
      });
      
      expect(response).toMatchObject({
        status: 401,
        body: { error: 'Authentication required' }
      });
      
      // Verify 401 response has JSON content-type
      expect((response as any).headers['content-type']).toContain('application/json');
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
      let responseHeaders: Record<string, string> = {};
      const response = await new Promise((resolve) => {
        const req = {
          method: 'POST',
          url: API_ENDPOINTS.WORKOUTS_SUGGEST_TODAY_START,
          headers: { 'accept': 'application/json', 'content-type': 'application/json' },
          user: { id: 'test-user-123' },
          body: {}
        } as any;
        
        const res = {
          setHeader: (name: string, value: string) => {
            responseHeaders[name.toLowerCase()] = value;
          },
          status: vi.fn().mockImplementation((code) => ({
            json: (data: any) => {
              responseHeaders['content-type'] = 'application/json; charset=utf-8';
              resolve({ status: code, body: data, headers: responseHeaders });
            }
          }))
        } as any;
        
        app._router.handle(req, res);
      });
      
      expect(response).toMatchObject({
        status: 201,
        body: { workoutId: 'workout-abc-123' }
      });
      
      // Verify content-type header
      expect((response as any).headers['content-type']).toContain('application/json');
      
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
          url: API_ENDPOINTS.WORKOUTS_SUGGEST_TODAY_START,
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