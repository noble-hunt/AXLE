import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseFreeform } from '../freeform.js';

const mockCreate = vi.fn();

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }))
  };
});

describe('parseFreeform', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse powerlifting workout correctly', async () => {
    const input = "Powerlifting day: 5x5 back squat at 225 lb, bench 3x5 at 155 lb, 20 min total, intensity 7.";
    
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            request: {
              category: "Powerlifting",
              durationMinutes: 20,
              intensity: 7
            },
            format: "Strength",
            title: "Powerlifting Day",
            sets: [
              {
                movement: "Back Squat",
                repScheme: "5x5",
                reps: 5,
                weightKg: 102.1,
                notes: "225 lb"
              },
              {
                movement: "Bench Press",
                repScheme: "3x5", 
                reps: 5,
                weightKg: 70.3,
                notes: "155 lb"
              }
            ],
            notes: "20 min total, intensity 7",
            confidence: 0.9
          })
        }
      }]
    };

    mockCreate.mockResolvedValue(mockResponse);

    const result = await parseFreeform(input, 'test-user-id');

    expect(result.request.category).toBe('Powerlifting');
    expect(result.request.durationMinutes).toBe(20);
    expect(result.request.intensity).toBe(7);
    expect(result.format).toBe('Strength');
    expect(result.sets).toHaveLength(2);
    expect(result.sets[0].movement).toBe('Back Squat');
    expect(result.sets[0].repScheme).toBe('5x5');
  });

  it('should parse AMRAP workout correctly', async () => {
    const input = "20-minute AMRAP: 10 pull-ups, 15 push-ups, 20 squats. RPE 6.";
    
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            request: {
              category: "CrossFit",
              durationMinutes: 20,
              intensity: 6
            },
            format: "AMRAP",
            title: "20-Minute AMRAP",
            sets: [
              {
                movement: "Pull-ups",
                reps: 10
              },
              {
                movement: "Push-ups",
                reps: 15
              },
              {
                movement: "Squats",
                reps: 20
              }
            ],
            notes: "RPE 6",
            confidence: 0.95
          })
        }
      }]
    };

    mockCreate.mockResolvedValue(mockResponse);

    const result = await parseFreeform(input, 'test-user-id');

    expect(result.request.category).toBe('CrossFit');
    expect(result.request.durationMinutes).toBe(20);
    expect(result.request.intensity).toBe(6);
    expect(result.format).toBe('AMRAP');
    expect(result.sets).toHaveLength(3);
    expect(result.sets[0].movement).toBe('Pull-ups');
    expect(result.sets[0].reps).toBe(10);
  });

  it('should parse EMOM workout correctly', async () => {
    const input = "EMOM 12: 5 burpees, 10 kettlebell swings (24kg). Easy recovery.";
    
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            request: {
              category: "CrossFit",
              durationMinutes: 12,
              intensity: 4
            },
            format: "EMOM",
            title: "EMOM 12 Recovery",
            sets: [
              {
                movement: "Burpees",
                reps: 5
              },
              {
                movement: "Kettlebell Swings",
                reps: 10,
                weightKg: 24,
                notes: "24kg"
              }
            ],
            notes: "Easy recovery",
            confidence: 0.9
          })
        }
      }]
    };

    mockCreate.mockResolvedValue(mockResponse);

    const result = await parseFreeform(input, 'test-user-id');

    expect(result.request.category).toBe('CrossFit');
    expect(result.request.durationMinutes).toBe(12);
    expect(result.request.intensity).toBe(4);
    expect(result.format).toBe('EMOM');
    expect(result.sets).toHaveLength(2);
    expect(result.sets[1].movement).toBe('Kettlebell Swings');
    expect(result.sets[1].weightKg).toBe(24);
  });

  it('should handle normalization correctly', async () => {
    const input = "Test workout";
    
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            request: {
              category: "Strength",
              durationMinutes: 150, // Over limit
              intensity: 15 // Over limit
            },
            format: "Other",
            title: "Test    Workout   Title", // Multiple spaces
            sets: [],
            confidence: 0.8
          })
        }
      }]
    };

    mockCreate.mockResolvedValue(mockResponse);

    const result = await parseFreeform(input, 'test-user-id');

    expect(result.request.durationMinutes).toBe(120); // Clamped to max
    expect(result.request.intensity).toBe(10); // Clamped to max
    expect(result.title).toBe('Test Workout Title'); // Spaces collapsed
  });
});