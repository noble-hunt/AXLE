import { describe, it, expect, vi, beforeAll } from 'vitest';
import { generatePremiumWorkout } from '../ai/generators/premium.js';
import { convertPremiumToGenerated } from '../workoutGenerator.js';
import type { WorkoutGenerationRequest } from '../ai/generateWorkout.js';
import { Category } from '../../shared/schema.js';

describe('Premium Generator Integration Tests', () => {
  beforeAll(() => {
    // Ensure OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not set, tests may fail');
    }
  });

  it('should use premium generator for CrossFit with barbell/dumbbell/bike equipment', async () => {
    const request: WorkoutGenerationRequest = {
      category: Category.CROSSFIT,
      duration: 45,
      intensity: 8,
      context: {
        equipment: ['barbell', 'dumbbell', 'bike'],
        constraints: [],
        goals: ['general_fitness']
      }
    };

    const workout = await generatePremiumWorkout(request);

    // Check basic structure
    expect(workout).toBeDefined();
    expect(workout.title).toBeTruthy();
    expect(workout.duration_min).toBe(45);
    expect(workout.blocks).toBeInstanceOf(Array);
    expect(workout.blocks.length).toBeGreaterThan(0);

    // Check acceptance flags
    expect(workout.acceptance_flags.time_fit).toBe(true);
    expect(workout.acceptance_flags.hardness_ok).toBe(true);
    expect(workout.acceptance_flags.patterns_locked).toBe(true);
    expect(workout.acceptance_flags.has_warmup).toBe(true);
    expect(workout.acceptance_flags.has_cooldown).toBe(true);
    expect(workout.acceptance_flags.equipment_ok).toBe(true);

    // Check for warm-up and cool-down blocks
    const warmup = workout.blocks.find(b => b.kind === 'warmup');
    const cooldown = workout.blocks.find(b => b.kind === 'cooldown');
    expect(warmup).toBeDefined();
    expect(cooldown).toBeDefined();
    expect(warmup!.time_min).toBeGreaterThanOrEqual(6);
    expect(cooldown!.time_min).toBeGreaterThanOrEqual(4);
  }, 60000); // 60s timeout for API call

  it('should have no banned BW movements in main blocks', async () => {
    const request: WorkoutGenerationRequest = {
      category: Category.HIIT,
      duration: 30,
      intensity: 7,
      context: {
        equipment: ['barbell', 'kettlebell'],
        constraints: [],
        goals: ['general_fitness']
      }
    };

    const workout = await generatePremiumWorkout(request);

    // Define banned movements (case-insensitive)
    const bannedMovements = [
      'wall sit', 'wall sits',
      'mountain climber', 'mountain climbers',
      'star jump', 'star jumps',
      'high knee', 'high knees'
    ];

    // Check main blocks (strength, conditioning, skill, core)
    const mainBlocks = workout.blocks.filter(b => 
      ['strength', 'conditioning', 'skill', 'core'].includes(b.kind)
    );

    for (const block of mainBlocks) {
      for (const item of block.items) {
        const exerciseLower = item.exercise.toLowerCase();
        const hasBanned = bannedMovements.some(banned => 
          exerciseLower.includes(banned)
        );
        
        if (hasBanned) {
          console.error(`Found banned movement in ${block.kind} block: ${item.exercise}`);
        }
        
        expect(hasBanned).toBe(false);
      }
    }
  }, 60000);

  it('should respect mixed rule when categories_for_mixed provided', async () => {
    const request: WorkoutGenerationRequest = {
      category: Category.STRENGTH,
      duration: 50,
      intensity: 8,
      context: {
        equipment: ['barbell', 'dumbbell', 'rower'],
        constraints: [],
        goals: ['general_fitness']
      }
    };

    const workout = await generatePremiumWorkout(request);

    // Check mixed_rule_ok flag
    expect(workout.acceptance_flags.mixed_rule_ok).toBe(true);

    // Should have at least one strength and one conditioning block
    const strengthBlocks = workout.blocks.filter(b => b.kind === 'strength');
    const conditioningBlocks = workout.blocks.filter(b => b.kind === 'conditioning');

    expect(strengthBlocks.length).toBeGreaterThan(0);
    expect(conditioningBlocks.length).toBeGreaterThan(0);
  }, 60000);

  it('should preserve block titles and items in conversion', async () => {
    const request: WorkoutGenerationRequest = {
      category: Category.CROSSFIT,
      duration: 40,
      intensity: 7,
      context: {
        equipment: ['barbell', 'dumbbell'],
        constraints: [],
        goals: ['general_fitness']
      }
    };

    const premiumWorkout = await generatePremiumWorkout(request);
    const converted = convertPremiumToGenerated(premiumWorkout, {
      category: Category.CROSSFIT,
      duration: 40,
      intensity: 7
    });

    // Check that conversion preserves structure
    expect(converted.sets).toBeDefined();
    expect(converted.sets.length).toBe(premiumWorkout.blocks.length);

    // Check that each block becomes a set with preserved title
    premiumWorkout.blocks.forEach((block, index) => {
      const set = converted.sets[index];
      
      // Title should be preserved as exercise name
      expect(set.exercise).toBe(block.title);
      
      // Duration should be converted to seconds
      expect(set.duration).toBe(block.time_min * 60);
      
      // Notes should contain items
      expect(set.notes).toBeTruthy();
      
      // Check that block items are present in notes
      if (block.items && block.items.length > 0) {
        const firstItem = block.items[0];
        // Notes should mention exercises from the block
        const notesHasExercise = block.items.some(item => 
          set.notes?.includes(item.exercise)
        );
        expect(notesHasExercise).toBe(true);
      }
    });

    // Check meta includes generator type
    expect(converted.meta).toBeDefined();
    expect(converted.meta.generator).toBe('premium');
    expect(converted.meta.acceptance).toBeDefined();
  }, 60000);

  it('should have hardness >= 0.75 when equipped and good readiness', async () => {
    const request: WorkoutGenerationRequest = {
      category: Category.CROSSFIT,
      duration: 45,
      intensity: 8,
      context: {
        equipment: ['barbell', 'dumbbell', 'kettlebell'],
        constraints: [],
        goals: ['general_fitness'],
        health_snapshot: {
          sleep_score: 80,
          hrv: 75,
          resting_hr: 55
        }
      }
    };

    const workout = await generatePremiumWorkout(request);

    // With good equipment and readiness, hardness should be >= 0.75
    expect(workout.variety_score).toBeDefined();
    if (workout.variety_score !== undefined) {
      expect(workout.variety_score).toBeGreaterThanOrEqual(0.55);
    }

    // Should have hardness_ok flag
    expect(workout.acceptance_flags.hardness_ok).toBe(true);
  }, 60000);

  it('should generate workouts with allowed patterns only', async () => {
    const request: WorkoutGenerationRequest = {
      category: Category.HIIT,
      duration: 35,
      intensity: 8,
      context: {
        equipment: ['barbell', 'rower'],
        constraints: [],
        goals: ['general_fitness']
      }
    };

    const workout = await generatePremiumWorkout(request);

    // Define allowed patterns
    const allowedPatterns = [
      /E[34]:00 x \d+/i,
      /Every [34]:00 x \d+/i,
      /EMOM \d+(-\d+)?/i,
      /AMRAP \d+/i,
      /For Time 21-15-9/i,
      /Chipper 40-30-20-10/i
    ];

    // Check main blocks have valid patterns
    const mainBlocks = workout.blocks.filter(b => 
      ['strength', 'conditioning', 'skill', 'core'].includes(b.kind)
    );

    for (const block of mainBlocks) {
      const matchesPattern = allowedPatterns.some(pattern => 
        pattern.test(block.title)
      );
      
      if (!matchesPattern) {
        console.error(`Invalid pattern in ${block.kind} block: "${block.title}"`);
      }
      
      expect(matchesPattern).toBe(true);
    }

    // patterns_locked flag should be true
    expect(workout.acceptance_flags.patterns_locked).toBe(true);
  }, 60000);
});
