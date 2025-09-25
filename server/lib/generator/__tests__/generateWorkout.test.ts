/**
 * Vitest tests for deterministic workout generation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateDeterministicWorkout } from '../generateWorkout.js';
import type { GeneratorInputs, GeneratorContext } from '../../../../shared/generator-types.js';

// Shared test data
const sampleInputs: GeneratorInputs = {
  archetype: 'strength',
  minutes: 45,
  targetIntensity: 6,
  equipment: ['barbell', 'dumbbell', 'bodyweight'],
  constraints: [],
  location: 'gym'
};

const sampleContext: GeneratorContext = {
  dateISO: '2025-09-25T10:00:00.000Z',
  userId: 'test-user-123',
  healthModifiers: {
    axleScore: 75,
    vitality: 80,
    performancePotential: 70,
    circadian: 85
  }
};

const testSeed = 'test-seed-12345';

describe('Deterministic Workout Generation', () => {

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  it('should generate identical workouts with the same seed', async () => {
    const result1 = await generateDeterministicWorkout(
      sampleInputs,
      sampleContext,
      testSeed
    );

    const result2 = await generateDeterministicWorkout(
      sampleInputs,
      sampleContext,
      testSeed
    );

    // Workouts should be structurally identical
    expect(result1.workout).toEqual(result2.workout);
    expect(result1.choices).toEqual(result2.choices);
  });

  it('should generate different workouts with different seeds', async () => {
    const result1 = await generateDeterministicWorkout(
      sampleInputs,
      sampleContext,
      'seed-1'
    );

    const result2 = await generateDeterministicWorkout(
      sampleInputs,
      sampleContext,
      'seed-2'
    );

    // Workouts should be different
    expect(result1.workout).not.toEqual(result2.workout);
    expect(result1.choices).not.toEqual(result2.choices);
  });

  it('should apply health caps when AXLE score is low', async () => {
    const lowHealthContext = {
      ...sampleContext,
      healthModifiers: {
        axleScore: 30,
        vitality: 25,
        performancePotential: 20,
        circadian: 40
      }
    };

    const highIntensityInputs = {
      ...sampleInputs,
      targetIntensity: 9 as const
    };

    const result = await generateDeterministicWorkout(
      highIntensityInputs,
      lowHealthContext,
      testSeed
    );

    // Intensity should be capped due to low health metrics
    expect(result.workout.estimatedIntensity).toBeLessThan(9);
    expect(result.workout.coaching_notes).toContain('intensity has been adjusted');
  });

  it('should include warm-up for all workout types', async () => {
    const result = await generateDeterministicWorkout(
      sampleInputs,
      sampleContext,
      testSeed
    );

    const warmupBlock = result.workout.blocks.find(b => b.type === 'warmup');
    expect(warmupBlock).toBeDefined();
    expect(warmupBlock?.exercises.length).toBeGreaterThan(0);
  });

  it('should include cool-down for high intensity workouts', async () => {
    const highIntensityInputs = {
      ...sampleInputs,
      targetIntensity: 8 as const
    };

    const result = await generateDeterministicWorkout(
      highIntensityInputs,
      sampleContext,
      testSeed
    );

    const cooldownBlock = result.workout.blocks.find(b => b.type === 'cooldown');
    expect(cooldownBlock).toBeDefined();
  });

  it('should respect equipment constraints', async () => {
    const bodyweightOnlyInputs = {
      ...sampleInputs,
      equipment: ['bodyweight'],
      constraints: ['no_weights']
    };

    const result = await generateDeterministicWorkout(
      bodyweightOnlyInputs,
      sampleContext,
      testSeed
    );

    // All exercises should use only bodyweight equipment
    const allExercises = result.workout.blocks.flatMap(b => b.exercises);
    allExercises.forEach(exercise => {
      expect(exercise.movement.equipment).not.toContain('barbell');
      expect(exercise.movement.equipment).not.toContain('dumbbell');
    });
  });

  it('should generate appropriate workout duration', async () => {
    const result = await generateDeterministicWorkout(
      sampleInputs,
      sampleContext,
      testSeed
    );

    expect(result.workout.totalMinutes).toBeGreaterThan(20);
    expect(result.workout.totalMinutes).toBeLessThan(60);
  });

  it('should handle different archetypes', async () => {
    const conditioningInputs = {
      ...sampleInputs,
      archetype: 'mixed' as const,
      minutes: 30
    };

    const enduranceInputs = {
      ...sampleInputs,
      archetype: 'endurance' as const,
      minutes: 40
    };

    const strengthResult = await generateDeterministicWorkout(
      sampleInputs,
      sampleContext,
      testSeed
    );

    const conditioningResult = await generateDeterministicWorkout(
      conditioningInputs,
      sampleContext,
      testSeed + '-conditioning'
    );

    const enduranceResult = await generateDeterministicWorkout(
      enduranceInputs,
      sampleContext,
      testSeed + '-endurance'
    );

    // Each archetype should have different characteristics
    expect(strengthResult.workout.metadata.template).not.toEqual(conditioningResult.workout.metadata.template);
    expect(conditioningResult.workout.metadata.template).not.toEqual(enduranceResult.workout.metadata.template);
  });

  it('should track movement choices in generator choices', async () => {
    const result = await generateDeterministicWorkout(
      sampleInputs,
      sampleContext,
      testSeed
    );

    expect(result.choices.templateId).toBeDefined();
    expect(result.choices.movementPoolIds).toBeInstanceOf(Array);
    expect(result.choices.movementPoolIds.length).toBeGreaterThan(0);
    expect(result.choices.schemeId).toBeDefined();
  });

  it('should handle workout history for progression', async () => {
    const mockWorkoutHistory = [
      {
        id: 'workout-1',
        createdAt: new Date('2025-09-24'),
        request: { category: 'strength', intensity: 6 },
        feedback: { difficulty: 8, satisfaction: 7 },
        completed: true
      },
      {
        id: 'workout-2',
        createdAt: new Date('2025-09-22'),
        request: { category: 'strength', intensity: 5 },
        feedback: { difficulty: 6, satisfaction: 8 },
        completed: true
      }
    ];

    const result = await generateDeterministicWorkout(
      sampleInputs,
      sampleContext,
      testSeed,
      mockWorkoutHistory
    );

    expect(result.workout.coaching_notes).toBeDefined();
    expect(result.choices.schemeId).toBeDefined();
  });

  it('should be consistent across multiple runs with same parameters', async () => {
    const results: Array<{ workout: any; choices: any }> = [];
    
    // Generate same workout 5 times
    for (let i = 0; i < 5; i++) {
      const result = await generateDeterministicWorkout(
        sampleInputs,
        sampleContext,
        testSeed
      );
      results.push(result);
    }

    // All results should be identical
    const firstResult = results[0];
    for (let i = 1; i < results.length; i++) {
      expect(results[i].workout).toEqual(firstResult.workout);
      expect(results[i].choices).toEqual(firstResult.choices);
    }
  });

  it('should validate required fields in generated workout', async () => {
    const result = await generateDeterministicWorkout(
      sampleInputs,
      sampleContext,
      testSeed
    );

    const workout = result.workout;
    
    // Required workout fields
    expect(workout.id).toBeDefined();
    expect(workout.name).toBeDefined();
    expect(workout.description).toBeDefined();
    expect(workout.totalMinutes).toBeGreaterThan(0);
    expect(workout.estimatedIntensity).toBeGreaterThan(0);
    expect(workout.blocks).toBeInstanceOf(Array);
    expect(workout.blocks.length).toBeGreaterThan(0);
    expect(workout.coaching_notes).toBeDefined();
    expect(workout.metadata).toBeDefined();

    // Each block should have required fields
    workout.blocks.forEach(block => {
      expect(block.id).toBeDefined();
      expect(block.name).toBeDefined();
      expect(block.type).toBeDefined();
      expect(block.exercises).toBeInstanceOf(Array);
      
      // Each exercise should have required fields
      block.exercises.forEach(exercise => {
        expect(exercise.id).toBeDefined();
        expect(exercise.name).toBeDefined();
        expect(exercise.movement).toBeDefined();
        expect(exercise.sets).toBeGreaterThan(0);
        expect(exercise.reps).toBeDefined();
      });
    });
  });

  it('should handle edge cases gracefully', async () => {
    // Test with minimal equipment
    const minimalInputs = {
      ...sampleInputs,
      equipment: ['bodyweight'],
      minutes: 10,
      targetIntensity: 1 as const
    };

    const result = await generateDeterministicWorkout(
      minimalInputs,
      sampleContext,
      testSeed
    );

    expect(result.workout).toBeDefined();
    expect(result.workout.blocks.length).toBeGreaterThan(0);
  });
});

describe('Movement Taxonomy', () => {
  it('should filter movements by equipment', async () => {
    const bodyweightOnly = {
      ...sampleInputs,
      equipment: ['bodyweight']
    };

    const result = await generateDeterministicWorkout(
      bodyweightOnly,
      sampleContext,
      testSeed
    );

    const allExercises = result.workout.blocks.flatMap(b => b.exercises);
    allExercises.forEach(exercise => {
      const hasBodyweight = exercise.movement.equipment.includes('bodyweight');
      const hasOtherEquipment = exercise.movement.equipment.some(eq => 
        eq !== 'bodyweight' && eq !== 'floor'
      );
      
      // Should either be bodyweight-only or allow floor exercises
      expect(hasBodyweight || exercise.movement.equipment.includes('floor')).toBe(true);
    });
  });

  it('should respect constraint filtering', async () => {
    const constrainedInputs = {
      ...sampleInputs,
      constraints: ['no_weights', 'upper_only']
    };

    const result = await generateDeterministicWorkout(
      constrainedInputs,
      sampleContext,
      testSeed
    );

    const allExercises = result.workout.blocks.flatMap(b => b.exercises);
    
    // Should not include weight-based movements
    allExercises.forEach(exercise => {
      expect(exercise.movement.equipment).not.toContain('barbell');
      expect(exercise.movement.equipment).not.toContain('dumbbell');
    });
  });
});

describe('Intensity System', () => {
  it('should cap intensity based on health metrics', async () => {
    const poorHealthContext = {
      ...sampleContext,
      healthModifiers: {
        axleScore: 25,
        vitality: 20,
        performancePotential: 15,
        circadian: 30
      }
    };

    const result = await generateDeterministicWorkout(
      { ...sampleInputs, targetIntensity: 10 },
      poorHealthContext,
      testSeed
    );

    expect(result.workout.estimatedIntensity).toBeLessThan(10);
  });

  it('should maintain intensity for good health metrics', async () => {
    const goodHealthContext = {
      ...sampleContext,
      healthModifiers: {
        axleScore: 85,
        vitality: 90,
        performancePotential: 88,
        circadian: 80
      }
    };

    const result = await generateDeterministicWorkout(
      { ...sampleInputs, targetIntensity: 8 },
      goodHealthContext,
      testSeed
    );

    expect(result.workout.estimatedIntensity).toBeGreaterThanOrEqual(7);
  });
});

describe('Template Selection', () => {
  it('should select appropriate templates for each archetype', async () => {
    const archetypes = ['strength', 'conditioning', 'mixed', 'endurance'] as const;
    
    for (const archetype of archetypes) {
      const inputs = { ...sampleInputs, archetype };
      const result = await generateDeterministicWorkout(
        inputs,
        sampleContext,
        testSeed + archetype
      );
      
      expect(result.workout.metadata.template).toBeDefined();
      expect(result.choices.templateId).toBeDefined();
    }
  });

  it('should adjust workout structure based on duration', async () => {
    const shortWorkout = await generateDeterministicWorkout(
      { ...sampleInputs, minutes: 20 },
      sampleContext,
      testSeed + 'short'
    );

    const longWorkout = await generateDeterministicWorkout(
      { ...sampleInputs, minutes: 60 },
      sampleContext,
      testSeed + 'long'
    );

    expect(shortWorkout.workout.totalMinutes).toBeLessThan(longWorkout.workout.totalMinutes);
  });
});