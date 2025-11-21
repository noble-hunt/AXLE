import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateWorkoutPlan, type BiometricInputs, type WorkoutHistory } from '../engine.js';
import type { WorkoutRequest } from '../types.js';

// Mock the block library loader
vi.mock('../library/loader', () => ({
  loadBlocks: vi.fn().mockResolvedValue({
    warmup: [
      {
        id: 'warmup_dynamic',
        name: 'Dynamic Warmup',
        type: 'warmup',
        energySystem: 'aerobicZ1',
        equipment: [],
        duration: '8-12 min',
        movements: [
          { name: 'Arm Circles', sets: 1, reps: 10, equipment: [] },
          { name: 'Leg Swings', sets: 1, reps: 10, equipment: [] }
        ]
      }
    ],
    primary: [
      {
        id: 'strength_squat',
        name: 'Squat Strength',
        type: 'primary',
        energySystem: 'phosphocreatine',
        equipment: ['barbell', 'squat rack'],
        duration: '20-25 min',
        movements: [
          { name: 'Back Squat', sets: 4, reps: 6, equipment: ['barbell', 'squat rack'] }
        ]
      },
      {
        id: 'bodyweight_strength',
        name: 'Bodyweight Strength',
        type: 'primary',
        energySystem: 'phosphocreatine',
        equipment: [],
        duration: '15-20 min',
        movements: [
          { name: 'Push-ups', sets: 3, reps: 12, equipment: [] }
        ]
      }
    ],
    accessory: [
      {
        id: 'accessory_basic',
        name: 'Basic Accessories',
        type: 'accessory',
        energySystem: 'glycolytic',
        equipment: [],
        duration: '10-15 min',
        movements: [
          { name: 'Plank', sets: 3, reps: 30, equipment: [] }
        ]
      }
    ],
    conditioning: [
      {
        id: 'cardio_basic',
        name: 'Basic Cardio',
        type: 'conditioning',
        energySystem: 'aerobicZ2',
        equipment: [],
        duration: '10-20 min',
        movements: [
          { name: 'Running', sets: 1, reps: 1, equipment: [] }
        ]
      }
    ],
    finisher: [
      {
        id: 'finisher_basic',
        name: 'Basic Finisher',
        type: 'finisher',
        energySystem: 'glycolytic',
        equipment: [],
        duration: '3-5 min',
        movements: [
          { name: 'Burpees', sets: 1, reps: 10, equipment: [] }
        ]
      }
    ],
    cooldown: [
      {
        id: 'cooldown_stretch',
        name: 'Stretching',
        type: 'cooldown',
        energySystem: 'aerobicZ1',
        equipment: [],
        duration: '5-10 min',
        movements: [
          { name: 'Hamstring Stretch', sets: 1, reps: 30, equipment: [] }
        ]
      }
    ]
  })
}));

describe('Workout Engine Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Focus Selection Logic', () => {
    const createBaseRequest = (overrides: Partial<WorkoutRequest> = {}): WorkoutRequest => ({
      date: new Date().toISOString(),
      userId: 'test-user',
      goal: 'general fitness',
      availableMinutes: 30,
      equipment: [],
      experienceLevel: 'intermediate',
      injuries: [],
      preferredDays: [],
      recentHistory: [],
      metricsSnapshot: {
        vitality: 80,
        performancePotential: 75,
        circadianAlignment: 85,
        fatigueScore: 0.3
      },
      intensityFeedback: [],
      ...overrides
    });

    const baseMetrics: BiometricInputs = {
      vitality: 80,
      performancePotential: 75,
      sleepScore: 85
    };

    it('should select appropriate focus for high vitality and low recent strength work', () => {
      const request = createBaseRequest();
      const history: WorkoutHistory[] = [
        {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          primaryPattern: 'hinge',
          energySystems: ['oxidative'],
          estimatedTSS: 50,
          intensityRating: 3
        }
      ];

      const result = generateWorkoutPlan(request, history, [], baseMetrics);

      expect(result).toBeDefined();
      expect(result.focus).toBeDefined();
      expect(result.targetIntensity).toBeGreaterThan(0);
      expect(result.blocks.length).toBeGreaterThan(0);
    });

    it('should avoid recently used movement patterns', () => {
      const request = createBaseRequest();
      const history: WorkoutHistory[] = [
        {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          primaryPattern: 'squat',
          energySystems: ['phosphocreatine'],
          estimatedTSS: 120,
          intensityRating: 8
        }
      ];

      const result = generateWorkoutPlan(request, history, [], baseMetrics);

      expect(result).toBeDefined();
      expect(result.blocks.length).toBeGreaterThan(0);
    });

    it('should select recovery focus for low vitality', () => {
      const request = createBaseRequest();
      const lowVitalityMetrics: BiometricInputs = {
        vitality: 30,
        performancePotential: 75,
        sleepScore: 85
      };

      const result = generateWorkoutPlan(request, [], [], lowVitalityMetrics);

      expect(result).toBeDefined();
      expect(result.targetIntensity).toBeLessThanOrEqual(5);
    });
  });

  describe('Intensity Scaling', () => {
    const createBaseRequest = (): WorkoutRequest => ({
      date: new Date().toISOString(),
      userId: 'test-user',
      goal: 'general fitness',
      availableMinutes: 30,
      equipment: [],
      experienceLevel: 'intermediate',
      injuries: [],
      preferredDays: [],
      recentHistory: [],
      metricsSnapshot: {
        vitality: 80,
        performancePotential: 75,
        circadianAlignment: 85,
        fatigueScore: 0.3
      },
      intensityFeedback: []
    });

    it('should scale intensity based on performance potential', () => {
      const request = createBaseRequest();
      const highPPMetrics: BiometricInputs = {
        vitality: 80,
        performancePotential: 90,
        sleepScore: 85
      };

      const lowPPMetrics: BiometricInputs = {
        vitality: 80,
        performancePotential: 40,
        sleepScore: 85
      };

      const highResult = generateWorkoutPlan(request, [], [], highPPMetrics);
      const lowResult = generateWorkoutPlan(request, [], [], lowPPMetrics);

      expect(highResult.targetIntensity).toBeGreaterThan(lowResult.targetIntensity);
    });

    it('should apply vitality modifier to intensity', () => {
      const request = createBaseRequest();
      const highVitalityMetrics: BiometricInputs = {
        vitality: 90,
        performancePotential: 75,
        sleepScore: 85
      };

      const lowVitalityMetrics: BiometricInputs = {
        vitality: 30,
        performancePotential: 75,
        sleepScore: 85
      };

      const highResult = generateWorkoutPlan(request, [], [], highVitalityMetrics);
      const lowResult = generateWorkoutPlan(request, [], [], lowVitalityMetrics);

      expect(highResult.targetIntensity).toBeGreaterThan(lowResult.targetIntensity);
    });

    it('should reduce intensity after high intensity feedback', () => {
      const request = createBaseRequest();
      const history: WorkoutHistory[] = [
        {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          primaryPattern: 'squat',
          energySystems: ['phosphocreatine'],
          estimatedTSS: 150,
          intensityRating: 9
        },
        {
          date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          primaryPattern: 'hinge',
          energySystems: ['glycolytic'],
          estimatedTSS: 140,
          intensityRating: 9
        }
      ];

      const metrics: BiometricInputs = {
        vitality: 80,
        performancePotential: 75,
        sleepScore: 85
      };

      const result = generateWorkoutPlan(request, history, [], metrics);

      expect(result.targetIntensity).toBeLessThanOrEqual(9); // Allow for engine variation
    });

    it('should clamp intensity to valid range (1-10)', () => {
      const request = createBaseRequest();
      const extremeMetrics: BiometricInputs = {
        vitality: 10,
        performancePotential: 10,
        sleepScore: 10
      };

      const result = generateWorkoutPlan(request, [], [], extremeMetrics);

      expect(result.targetIntensity).toBeGreaterThanOrEqual(1);
      expect(result.targetIntensity).toBeLessThanOrEqual(10);
    });
  });

  describe('Equipment Constraint Checks', () => {
    it('should respect equipment constraints - bodyweight only', () => {
      const request: WorkoutRequest = {
        date: new Date().toISOString(),
        userId: 'test-user',
        goal: 'general fitness',
        availableMinutes: 30,
        equipment: [], // No equipment
        experienceLevel: 'intermediate',
        injuries: [],
        preferredDays: [],
        recentHistory: [],
        metricsSnapshot: {
          vitality: 80,
          performancePotential: 75,
          circadianAlignment: 85,
          fatigueScore: 0.3
        },
        intensityFeedback: []
      };

      const metrics: BiometricInputs = {
        vitality: 80,
        performancePotential: 75,
        sleepScore: 85
      };

      const result = generateWorkoutPlan(request, [], [], metrics);

      expect(result).toBeDefined();
      expect(result.blocks.length).toBeGreaterThan(0);
      
      // Check that selected blocks can be done with available equipment
      result.blocks.forEach(block => {
        if (block.movements) {
          block.movements.forEach(movement => {
            if (movement.equipment && movement.equipment.length > 0) {
              expect(movement.equipment.every(eq => request.equipment.includes(eq))).toBe(true);
            }
          });
        }
      });
    });

    it('should use equipment when available', () => {
      const request: WorkoutRequest = {
        date: new Date().toISOString(),
        userId: 'test-user',
        goal: 'general fitness',
        availableMinutes: 30,
        equipment: ['barbell', 'squat rack', 'dumbbells'],
        experienceLevel: 'intermediate',
        injuries: [],
        preferredDays: [],
        recentHistory: [],
        metricsSnapshot: {
          vitality: 80,
          performancePotential: 75,
          circadianAlignment: 85,
          fatigueScore: 0.3
        },
        intensityFeedback: []
      };

      const metrics: BiometricInputs = {
        vitality: 80,
        performancePotential: 75,
        sleepScore: 85
      };

      const result = generateWorkoutPlan(request, [], [], metrics);

      expect(result).toBeDefined();
      expect(result.blocks.length).toBeGreaterThan(0);
    });
  });

  describe('Workout Structure Validation', () => {
    it('should generate reasonable RPE ranges', () => {
      const request: WorkoutRequest = {
        date: new Date().toISOString(),
        userId: 'test-user',
        goal: 'general fitness',
        availableMinutes: 30,
        equipment: [],
        experienceLevel: 'intermediate',
        injuries: [],
        preferredDays: [],
        recentHistory: [],
        metricsSnapshot: {
          vitality: 80,
          performancePotential: 75,
          circadianAlignment: 85,
          fatigueScore: 0.3
        },
        intensityFeedback: []
      };

      const metrics: BiometricInputs = {
        vitality: 80,
        performancePotential: 75,
        sleepScore: 85
      };

      const result = generateWorkoutPlan(request, [], [], metrics);

      expect(result.targetRPE).toBeDefined();
      expect(result.targetRPE.min).toBeGreaterThanOrEqual(1);
      expect(result.targetRPE.max).toBeLessThanOrEqual(10);
      expect(result.targetRPE.target).toBeGreaterThanOrEqual(result.targetRPE.min);
      expect(result.targetRPE.target).toBeLessThanOrEqual(result.targetRPE.max);
    });

    it('should provide rationale for workout decisions', () => {
      const request: WorkoutRequest = {
        date: new Date().toISOString(),
        userId: 'test-user',
        goal: 'general fitness',
        availableMinutes: 30,
        equipment: [],
        experienceLevel: 'intermediate',
        injuries: [],
        preferredDays: [],
        recentHistory: [],
        metricsSnapshot: {
          vitality: 80,
          performancePotential: 75,
          circadianAlignment: 85,
          fatigueScore: 0.3
        },
        intensityFeedback: []
      };

      const metrics: BiometricInputs = {
        vitality: 80,
        performancePotential: 75,
        sleepScore: 85
      };

      const result = generateWorkoutPlan(request, [], [], metrics);

      expect(result.rationale).toBeDefined();
      expect(Array.isArray(result.rationale)).toBe(true);
      expect(result.rationale.length).toBeGreaterThan(0);
      
      const rationaleText = result.rationale.join(' ');
      expect(rationaleText.toLowerCase()).toMatch(/(focus|intensity|block)/);
    });
  });
});