import { describe, it, expect, vi } from 'vitest';
import { convertPremiumToGenerated } from '../workoutGenerator.js';
import type { Category } from '../../shared/schema.js';

describe('Premium Workout Conversion', () => {
  it('should not generate synthetic placeholders like "Bird Dog x 270s"', () => {
    // Arrange - Mock premium workout response
    const mockPremiumWorkout = {
      title: 'Test CrossFit Workout',
      duration_min: 45,
      focus: 'Mixed Focus',
      variety_score: 0.85,
      acceptance_flags: {
        time_fit: true,
        has_warmup: true,
        has_cooldown: true,
        mixed_rule_ok: true,
        equipment_ok: true,
        injury_safe: true,
        readiness_mod_applied: true,
        hardness_ok: true,
        patterns_locked: true
      },
      blocks: [
        {
          kind: 'warmup',
          title: 'Warm-Up',
          time_min: 8,
          items: [
            { exercise: 'Foam Roll', target: '2 min', notes: 'Upper back, hamstrings' },
            { exercise: 'Dynamic Stretching', target: '3 min', notes: 'Leg swings, arm circles' },
            { exercise: 'Barbell Warm-Up', target: '3 min', notes: '5 reps each' }
          ],
          notes: 'Prepare body for workout'
        },
        {
          kind: 'strength',
          title: 'E3:00 x 5',
          time_min: 15,
          items: [
            { exercise: 'BB Front Squat', target: '4 reps @ 80%', notes: 'Keep core engaged' }
          ],
          notes: 'Build towards working weight'
        },
        {
          kind: 'conditioning',
          title: 'EMOM 12',
          time_min: 12,
          items: [
            { exercise: 'Echo Bike Calories', target: '15/12 cal', notes: 'Odd minutes' },
            { exercise: 'DB Snatches', target: '12 reps (6/arm)', notes: 'Even minutes' }
          ],
          notes: 'Alternate exercises'
        },
        {
          kind: 'cooldown',
          title: 'Cool-Down',
          time_min: 10,
          items: [
            { exercise: 'Stretching', target: '5 min', notes: 'Focus on hamstrings and shoulders' },
            { exercise: 'Breathing', target: '5 min', notes: 'Box breathing' }
          ],
          notes: 'Recovery and relaxation'
        }
      ]
    };

    const mockRequest = {
      category: 'CrossFit' as Category,
      duration: 45,
      intensity: 8
    };

    // Act
    const converted = convertPremiumToGenerated(mockPremiumWorkout, mockRequest);

    // Assert - No synthetic placeholders
    expect(converted.sets).toHaveLength(4);
    
    for (const set of converted.sets) {
      // Exercise name should not contain synthetic time like "270s"
      expect(set.exercise).not.toMatch(/Bird Dog x \d+s/i);
      expect(set.exercise).not.toMatch(/\d{3,}s/); // No large second values like 270s, 480s etc
      
      // Notes should not contain synthetic placeholders
      if (set.notes) {
        expect(set.notes).not.toMatch(/Bird Dog x \d+s/i);
        expect(set.notes).not.toContain('PLACEHOLDER');
        expect(set.notes).not.toContain('TODO');
      }
      
      // Should have actual exercise names
      expect(set.exercise.length).toBeGreaterThan(0);
    }
  });
  
  it('should preserve premium block structure with pattern titles', () => {
    const mockPremiumWorkout = {
      title: 'Pattern Preservation Test',
      duration_min: 45,
      focus: 'Mixed',
      variety_score: 0.8,
      acceptance_flags: {
        time_fit: true,
        has_warmup: true,
        has_cooldown: true,
        mixed_rule_ok: true,
        equipment_ok: true,
        injury_safe: true,
        readiness_mod_applied: true,
        hardness_ok: true,
        patterns_locked: true
      },
      blocks: [
        {
          kind: 'warmup',
          title: 'Warm-Up',
          time_min: 8,
          items: [{ exercise: 'Foam Roll', target: '2 min' }]
        },
        {
          kind: 'strength',
          title: 'E3:00 x 5',
          time_min: 15,
          items: [{ exercise: 'BB Back Squat', target: '5 reps @ 75%' }]
        },
        {
          kind: 'conditioning',
          title: 'AMRAP 12',
          time_min: 12,
          items: [{ exercise: 'Burpees', target: '10 reps' }]
        },
        {
          kind: 'cooldown',
          title: 'Cool-Down',
          time_min: 10,
          items: [{ exercise: 'Stretching', target: '10 min' }]
        }
      ]
    };

    const mockRequest = {
      category: 'CrossFit' as Category,
      duration: 45,
      intensity: 8
    };

    const converted = convertPremiumToGenerated(mockPremiumWorkout, mockRequest);
    
    // Should have warm-up
    const warmup = converted.sets.find(s => /warm.?up/i.test(s.exercise));
    expect(warmup).toBeDefined();
    expect(warmup?.notes).toContain('WARMUP');
    
    // Should have main block with pattern title (E3:00, EMOM, AMRAP, or For Time)
    const e3Block = converted.sets.find(s => s.exercise === 'E3:00 x 5');
    expect(e3Block).toBeDefined();
    expect(e3Block?.notes).toContain('STRENGTH');
    
    const amrapBlock = converted.sets.find(s => s.exercise === 'AMRAP 12');
    expect(amrapBlock).toBeDefined();
    expect(amrapBlock?.notes).toContain('CONDITIONING');
    
    // Should have cool-down
    const cooldown = converted.sets.find(s => /cool.?down/i.test(s.exercise));
    expect(cooldown).toBeDefined();
    expect(cooldown?.notes).toContain('COOLDOWN');
  });
  
  it('should list actual exercises with targets in notes', () => {
    const mockPremiumWorkout = {
      title: 'Exercise List Test',
      duration_min: 30,
      focus: 'Conditioning',
      variety_score: 0.75,
      acceptance_flags: {
        time_fit: true,
        has_warmup: true,
        has_cooldown: true,
        mixed_rule_ok: true,
        equipment_ok: true,
        injury_safe: true,
        readiness_mod_applied: true,
        hardness_ok: true,
        patterns_locked: true
      },
      blocks: [
        {
          kind: 'warmup',
          title: 'Warm-Up',
          time_min: 5,
          items: [{ exercise: 'Jumping Jacks', target: '30 reps' }]
        },
        {
          kind: 'conditioning',
          title: 'EMOM 10',
          time_min: 10,
          items: [
            { exercise: 'KB Swings', target: '15 reps', notes: 'Russian style' },
            { exercise: 'Box Jumps', target: '12 reps', notes: '24 inch box' }
          ]
        },
        {
          kind: 'cooldown',
          title: 'Cool-Down',
          time_min: 5,
          items: [{ exercise: 'Walking', target: '5 min' }]
        }
      ]
    };

    const mockRequest = {
      category: 'HIIT' as Category,
      duration: 30,
      intensity: 7
    };

    const converted = convertPremiumToGenerated(mockPremiumWorkout, mockRequest);
    
    // Check EMOM block has exercise items listed in notes
    const emomBlock = converted.sets.find(s => s.exercise === 'EMOM 10');
    expect(emomBlock).toBeDefined();
    expect(emomBlock?.notes).toMatch(/•/); // Should have bullet points
    expect(emomBlock?.notes).toContain('KB Swings: 15 reps');
    expect(emomBlock?.notes).toContain('Box Jumps: 12 reps');
    expect(emomBlock?.notes).toContain('Russian style');
    expect(emomBlock?.notes).toContain('24 inch box');
  });

  it('should convert block time_min to duration in seconds', () => {
    const mockPremiumWorkout = {
      title: 'Duration Test',
      duration_min: 20,
      focus: 'Quick',
      variety_score: 0.7,
      acceptance_flags: {
        time_fit: true,
        has_warmup: true,
        has_cooldown: true,
        mixed_rule_ok: true,
        equipment_ok: true,
        injury_safe: true,
        readiness_mod_applied: true,
        hardness_ok: true,
        patterns_locked: true
      },
      blocks: [
        {
          kind: 'warmup',
          title: 'Warm-Up',
          time_min: 5,
          items: [{ exercise: 'Light Jog', target: '5 min' }]
        },
        {
          kind: 'conditioning',
          title: 'AMRAP 10',
          time_min: 10,
          items: [{ exercise: 'Push-Ups', target: '10 reps' }]
        },
        {
          kind: 'cooldown',
          title: 'Cool-Down',
          time_min: 5,
          items: [{ exercise: 'Stretching', target: '5 min' }]
        }
      ]
    };

    const mockRequest = {
      category: 'HIIT' as Category,
      duration: 20,
      intensity: 6
    };

    const converted = convertPremiumToGenerated(mockPremiumWorkout, mockRequest);
    
    // Check duration conversion (minutes -> seconds)
    expect(converted.sets[0].duration).toBe(5 * 60); // 300 seconds
    expect(converted.sets[1].duration).toBe(10 * 60); // 600 seconds
    expect(converted.sets[2].duration).toBe(5 * 60); // 300 seconds
  });
});
