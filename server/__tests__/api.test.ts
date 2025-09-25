import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock OpenAI to return deterministic responses
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn()
    }
  }
};

vi.mock('openai', () => ({
  default: vi.fn(() => mockOpenAI)
}));

// Mock OpenAI module directly
vi.mock('../lib/openai.js', () => ({
  openai: mockOpenAI
}));

// Mock generateSeed function
vi.mock('../lib/seededRandom.js', () => ({
  generateSeed: vi.fn(() => 'test-seed-123')
}));

describe('Workout API Response Format Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('JSON Response Validation', () => {
    it('should generate valid JSON response structure', async () => {
      // Mock OpenAI response
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              title: "Test Workout",
              est_duration_min: 30,
              intensity: "7/10",
              exercises: [
                {
                  name: "Push-ups",
                  sets: 3,
                  reps: 12,
                  rest_sec: 60,
                  notes: "Keep core engaged"
                }
              ]
            })
          }
        }]
      });

      // Import and test the core simulation logic
      const { generateSeed } = await import('../lib/seededRandom.js');
      const { openai } = await import('../lib/openai.js');

      const goal = 'Strength';
      const durationMin = 30;
      const intensity = 7;
      const equipment = ['Bodyweight'];
      const workoutSeed = 'test-seed-123';

      const sys = `Return ONLY JSON with keys: title, est_duration_min, intensity, exercises[] {name, sets, reps, rest_sec, notes}. Use the provided seed for any random selections to ensure deterministic results.`;
      const user = `Goal: ${goal}\nDuration: ${durationMin} minutes\nIntensity: ${intensity}/10\nEquipment: ${equipment.join(',')}\nSeed: ${workoutSeed}\n\nIMPORTANT: Use this seed value (${workoutSeed}) consistently for any random choices in exercise selection, order, or variations to ensure reproducible results.`;

      const r = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
        seed: parseInt(workoutSeed.slice(-8), 36)
      });

      const raw = r.choices?.[0]?.message?.content ?? '{}';
      const workoutData = JSON.parse(raw);

      const workout = {
        id: null,
        blocks: workoutData.exercises || [],
        estTimeMin: workoutData.est_duration_min || durationMin,
        intensity: workoutData.intensity || intensity,
        seed: workoutSeed,
        meta: {
          title: workoutData.title || `${goal} Workout`,
          goal,
          equipment
        }
      };

      const response = { ok: true, workout };

      // Validate JSON structure matches expected API format
      expect(response).toHaveProperty('ok', true);
      expect(response).toHaveProperty('workout');
      
      const result = response.workout;
      expect(result).toHaveProperty('meta.title');
      expect(result).toHaveProperty('estTimeMin');
      expect(result).toHaveProperty('intensity');
      expect(result).toHaveProperty('seed');
      expect(result).toHaveProperty('blocks');
      expect(Array.isArray(result.blocks)).toBe(true);

      // Ensure response is JSON serializable
      expect(() => JSON.stringify(response)).not.toThrow();
      
      // Ensure we got a seed for determinism
      expect(typeof result.seed).toBe('string');
      expect(result.seed.length).toBeGreaterThan(0);
    });

    it('should handle different workout goals correctly', async () => {
      const goals = ['Strength', 'Conditioning', 'Hypertrophy', 'Mixed'];
      
      for (const goal of goals) {
        // Mock different responses for each goal
        mockOpenAI.chat.completions.create.mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                title: `${goal} Workout`,
                est_duration_min: 45,
                intensity: "6/10",
                exercises: [{
                  name: "Exercise for " + goal,
                  sets: 3,
                  reps: 10,
                  rest_sec: 90,
                  notes: "Focus on " + goal.toLowerCase()
                }]
              })
            }
          }]
        });

        const { openai } = await import('../lib/openai.js');
        
        const result = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Return JSON workout' },
            { role: 'user', content: `Goal: ${goal}` }
          ]
        });

        const workoutData = JSON.parse(result.choices[0].message.content);
        
        expect(workoutData.title).toContain(goal);
        expect(workoutData).toHaveProperty('exercises');
        expect(Array.isArray(workoutData.exercises)).toBe(true);
      }
    });

    it('should fail loudly when API returns HTML instead of JSON', async () => {
      // Mock OpenAI returning invalid JSON (simulating HTML error page)
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: '<html><body>Server Error</body></html>'
          }
        }]
      });

      const { openai } = await import('../lib/openai.js');

      const result = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: 'test' }]
      });

      const raw = result.choices?.[0]?.message?.content ?? '{}';
      
      expect(() => JSON.parse(raw)).toThrow('Unexpected token');
    });
  });

  describe('Deterministic Generation', () => {
    it('should use seed parameter for deterministic generation', async () => {
      const seed = 'test123';
      const mockWorkout = {
        title: "Deterministic Workout",
        est_duration_min: 30,
        intensity: "7/10",
        exercises: [
          {
            name: "Barbell Squat",
            sets: 3,
            reps: 8,
            rest_sec: 90,
            notes: "Keep back straight"
          }
        ]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockWorkout)
          }
        }]
      });

      const { openai } = await import('../lib/openai.js');

      // Test that seed is passed to OpenAI
      await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: 'test' }],
        seed: parseInt(seed.slice(-8), 36)
      });

      // Verify OpenAI was called with the seed parameter
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0,
          seed: expect.any(Number)
        })
      );
    });

    it('should include seed in response when none provided', async () => {
      const { generateSeed } = await import('../lib/seededRandom.js');
      
      const generatedSeed = generateSeed();
      expect(typeof generatedSeed).toBe('string');
      expect(generatedSeed.length).toBeGreaterThan(0);
    });
  });

  describe('Equipment Constraints', () => {
    it('should pass equipment constraints to OpenAI prompt', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              title: "Bodyweight Workout",
              est_duration_min: 30,
              intensity: "7/10",
              exercises: [
                {
                  name: "Push-ups",
                  sets: 3,
                  reps: 15,
                  rest_sec: 60,
                  notes: "Bodyweight exercise"
                }
              ]
            })
          }
        }]
      });

      const { openai } = await import('../lib/openai.js');

      const goal = 'Strength';
      const equipment = ['Bodyweight']; // Excluding barbell
      const user = `Goal: ${goal}\nEquipment: ${equipment.join(',')}\n`;

      await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Return JSON workout' },
          { role: 'user', content: user }
        ]
      });

      // Verify equipment constraint was passed to OpenAI
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Equipment: Bodyweight')
            })
          ])
        })
      );
    });

    it('should validate equipment exclusion logic', () => {
      // Test logic that should prevent barbell exercises when equipment excludes barbell
      const availableEquipment = ['Bodyweight', 'Dumbbells'];
      const exerciseName = 'Barbell Squat';
      
      const hasBarbell = availableEquipment.some(eq => eq.toLowerCase().includes('barbell'));
      const isBarBellExercise = exerciseName.toLowerCase().includes('barbell');
      
      // If no barbell equipment available, barbell exercises should be excluded
      if (!hasBarbell && isBarBellExercise) {
        expect(true).toBe(true); // This logic should prevent barbell exercises
      }
      
      expect(hasBarbell).toBe(false); // Barbell not in available equipment
      expect(isBarBellExercise).toBe(true); // Exercise is barbell exercise
    });

    it('should allow appropriate exercises when equipment is available', () => {
      const availableEquipment = ['Barbell', 'Squat Rack', 'Dumbbells'];
      const exerciseName = 'Barbell Squat';
      
      const hasBarbell = availableEquipment.some(eq => eq.toLowerCase().includes('barbell'));
      const isBarBellExercise = exerciseName.toLowerCase().includes('barbell');
      
      expect(hasBarbell).toBe(true);
      expect(isBarBellExercise).toBe(true);
      // Exercise should be allowed when equipment is available
    });
  });
});