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
          { name: 'Push-ups', sets: 3, reps: 12, equipment: [] },
          { name: 'Bodyweight Squats', sets: 3, reps: 15, equipment: [] }
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

describe('Archetype Snapshot Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Newbie Archetype', () => {
    it('should generate appropriate workout for fitness newbie', () => {
      const request: WorkoutRequest = {
        date: new Date().toISOString(),
        userId: 'newbie-user',
        goal: 'get started with fitness',
        availableMinutes: 30,
        equipment: [],
        experienceLevel: 'beginner',
        injuries: [],
        preferredDays: [],
        recentHistory: [],
        metricsSnapshot: {
          vitality: 60, // Lower starting vitality
          performancePotential: 40, // Lower performance potential
          circadianAlignment: 70,
          fatigueScore: 0.2 // Low fatigue
        },
        intensityFeedback: []
      };

      const metrics: BiometricInputs = {
        vitality: 60,
        performancePotential: 40,
        sleepScore: 70
      };

      const result = generateWorkoutPlan(request, [], [], metrics);

      // Snapshot assertions for newbie archetype
      expect(result).toMatchObject({
        targetIntensity: expect.any(Number),
        targetRPE: {
          min: expect.any(Number),
          max: expect.any(Number),
          target: expect.any(Number)
        },
        blocks: expect.any(Array),
        estimatedCalories: expect.any(Number),
        estimatedTSS: expect.any(Number),
        rationale: expect.any(Array)
      });

      // Newbie-specific expectations
      expect(result.targetIntensity).toBeLessThanOrEqual(6); // Conservative intensity
      expect(result.targetRPE.target).toBeLessThanOrEqual(6); // Conservative RPE
      expect(result.estimatedTSS).toBeLessThanOrEqual(150); // Lower TSS for beginners
      expect(result.blocks.length).toBeGreaterThan(0);
      expect(result.rationale.length).toBeGreaterThan(0);

      // Focus should be appropriate for beginner
      expect(typeof result.focus).toBe('string');
      expect(result.focus.length).toBeGreaterThan(0);
    });
  });

  describe('Intermediate Archetype', () => {
    it('should generate appropriate workout for intermediate trainee', () => {
      const request: WorkoutRequest = {
        date: new Date().toISOString(),
        userId: 'intermediate-user',
        goal: 'improve strength and conditioning',
        availableMinutes: 45,
        equipment: ['dumbbells', 'kettlebells'],
        experienceLevel: 'intermediate',
        injuries: [],
        preferredDays: [],
        recentHistory: [
          {
            workoutType: 'strength',
            intensity: 7,
            duration: 40,
            date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
            notes: 'Good session'
          }
        ],
        metricsSnapshot: {
          vitality: 75, // Good vitality
          performancePotential: 70, // Solid performance potential
          circadianAlignment: 80,
          fatigueScore: 0.35 // Moderate fatigue
        },
        intensityFeedback: [
          {
            date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            perceivedIntensity: 7,
            workoutId: 'prev-workout'
          }
        ]
      };

      const metrics: BiometricInputs = {
        vitality: 75,
        performancePotential: 70,
        sleepScore: 80
      };

      const history: WorkoutHistory[] = [
        {
          date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          primaryPattern: 'push',
          energySystems: ['phosphocreatine'],
          estimatedTSS: 120,
          intensityRating: 7
        }
      ];

      const result = generateWorkoutPlan(request, history, [], metrics);

      // Snapshot assertions for intermediate archetype
      expect(result).toMatchObject({
        targetIntensity: expect.any(Number),
        targetRPE: {
          min: expect.any(Number),
          max: expect.any(Number),
          target: expect.any(Number)
        },
        blocks: expect.any(Array),
        estimatedCalories: expect.any(Number),
        estimatedTSS: expect.any(Number),
        rationale: expect.any(Array)
      });

      // Intermediate-specific expectations
      expect(result.targetIntensity).toBeGreaterThanOrEqual(5);
      expect(result.targetIntensity).toBeLessThanOrEqual(8); // Moderate to high intensity
      expect(result.targetRPE.target).toBeGreaterThanOrEqual(5);
      expect(result.targetRPE.target).toBeLessThanOrEqual(8);
      expect(result.estimatedTSS).toBeGreaterThanOrEqual(30); // TSS for intermediate (adjusted for mock data)
      expect(result.estimatedTSS).toBeLessThanOrEqual(250);
      expect(result.blocks.length).toBeGreaterThan(0);
      expect(result.rationale.length).toBeGreaterThan(0);

      // Should handle equipment appropriately
      const hasEquipmentMovements = result.blocks.some(block =>
        block.movements?.some(movement =>
          movement.equipment && movement.equipment.length > 0
        )
      );
      expect(hasEquipmentMovements).toBe(true);
    });
  });

  describe('Experienced Archetype', () => {
    it('should generate appropriate workout for experienced athlete', () => {
      const request: WorkoutRequest = {
        date: new Date().toISOString(),
        userId: 'experienced-user',
        goal: 'peak performance and competition prep',
        availableMinutes: 60,
        equipment: ['barbell', 'squat rack', 'dumbbells', 'kettlebells', 'bench'],
        experienceLevel: 'advanced',
        injuries: [],
        preferredDays: [],
        recentHistory: [
          {
            workoutType: 'strength',
            intensity: 9,
            duration: 60,
            date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            notes: 'Heavy session'
          },
          {
            workoutType: 'conditioning',
            intensity: 8,
            duration: 45,
            date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
            notes: 'High intensity'
          }
        ],
        metricsSnapshot: {
          vitality: 85, // High vitality
          performancePotential: 90, // High performance potential
          circadianAlignment: 90,
          fatigueScore: 0.45 // Higher fatigue from training
        },
        intensityFeedback: [
          {
            date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            perceivedIntensity: 9,
            workoutId: 'prev-workout-1'
          },
          {
            date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
            perceivedIntensity: 8,
            workoutId: 'prev-workout-2'
          }
        ]
      };

      const metrics: BiometricInputs = {
        vitality: 85,
        performancePotential: 90,
        sleepScore: 90
      };

      const history: WorkoutHistory[] = [
        {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          primaryPattern: 'squat',
          energySystems: ['phosphocreatine'],
          estimatedTSS: 180,
          intensityRating: 9
        },
        {
          date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          primaryPattern: 'push',
          energySystems: ['glycolytic'],
          estimatedTSS: 160,
          intensityRating: 8
        }
      ];

      const result = generateWorkoutPlan(request, history, [], metrics);

      // Snapshot assertions for experienced archetype
      expect(result).toMatchObject({
        targetIntensity: expect.any(Number),
        targetRPE: {
          min: expect.any(Number),
          max: expect.any(Number),
          target: expect.any(Number)
        },
        blocks: expect.any(Array),
        estimatedCalories: expect.any(Number),
        estimatedTSS: expect.any(Number),
        rationale: expect.any(Array)
      });

      // Experienced-specific expectations
      expect(result.targetIntensity).toBeGreaterThanOrEqual(6); // Can handle higher intensity
      expect(result.targetIntensity).toBeLessThanOrEqual(10);
      expect(result.targetRPE.target).toBeGreaterThanOrEqual(6);
      expect(result.estimatedTSS).toBeGreaterThanOrEqual(40); // TSS for experienced (adjusted for mock data)
      expect(result.blocks.length).toBeGreaterThan(0);
      expect(result.rationale.length).toBeGreaterThan(0);

      // Should utilize full equipment range
      const hasAdvancedEquipment = result.blocks.some(block =>
        block.movements?.some(movement =>
          movement.equipment && movement.equipment.includes('barbell')
        )
      );
      expect(hasAdvancedEquipment).toBe(true);

      // Should account for recent high intensity and potentially adjust
      // (might reduce intensity due to high recent feedback)
      const rationaleText = result.rationale.join(' ').toLowerCase();
      expect(rationaleText).toMatch(/(intensity|feedback|recent)/);
    });
  });

  describe('Cross-Archetype Consistency', () => {
    it('should maintain consistent structure across all archetypes', () => {
      const createRequest = (level: 'beginner' | 'intermediate' | 'advanced'): WorkoutRequest => ({
        date: new Date().toISOString(),
        userId: `${level}-user`,
        goal: 'fitness',
        availableMinutes: 30,
        equipment: [],
        experienceLevel: level,
        injuries: [],
        preferredDays: [],
        recentHistory: [],
        metricsSnapshot: {
          vitality: 70,
          performancePotential: 70,
          circadianAlignment: 70,
          fatigueScore: 0.3
        },
        intensityFeedback: []
      });

      const metrics: BiometricInputs = {
        vitality: 70,
        performancePotential: 70,
        sleepScore: 70
      };

      const beginnerResult = generateWorkoutPlan(createRequest('beginner'), [], [], metrics);
      const intermediateResult = generateWorkoutPlan(createRequest('intermediate'), [], [], metrics);
      const advancedResult = generateWorkoutPlan(createRequest('advanced'), [], [], metrics);

      // All should have consistent structure
      [beginnerResult, intermediateResult, advancedResult].forEach(result => {
        expect(result).toHaveProperty('focus');
        expect(result).toHaveProperty('targetIntensity');
        expect(result).toHaveProperty('targetRPE');
        expect(result).toHaveProperty('blocks');
        expect(result).toHaveProperty('estimatedCalories');
        expect(result).toHaveProperty('estimatedTSS');
        expect(result).toHaveProperty('rationale');
        
        expect(result.blocks.length).toBeGreaterThan(0);
        expect(result.rationale.length).toBeGreaterThan(0);
        expect(result.targetIntensity).toBeGreaterThanOrEqual(1);
        expect(result.targetIntensity).toBeLessThanOrEqual(10);
      });

      // Intensity should generally scale with experience level
      // (though safety guardrails may override this)
      expect(beginnerResult.targetIntensity).toBeLessThanOrEqual(advancedResult.targetIntensity + 2);
    });
  });
});