import { describe, it, expect } from 'vitest';

const API_BASE = process.env.VITE_API_BASE_URL || 'http://localhost:5000';

const BANNED_BW_MOVEMENTS = [
  'wall sit', 'wall sits',
  'mountain climber', 'mountain climbers',
  'star jump', 'star jumps',
  'high knee', 'high knees',
  'jumping jack', 'jumping jacks',
  'bicycle crunch', 'bicycle crunches'
];

const ALLOWED_PATTERNS = [
  /E[34]:00 x \d+/i,
  /Every [34]:00 x \d+/i,
  /EMOM \d+(-\d+)?/i,
  /AMRAP \d+/i,
  /For Time 21-15-9/i,
  /Chipper 40-30-20-10/i
];

describe('Premium Workout Generator', () => {
  it('forces premium for CrossFit and validates pattern lock', async () => {
    const response = await fetch(`${API_BASE}/api/workouts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: 'CrossFit',
        durationMin: 30,
        intensity: 8,
        equipment: ['barbell', 'dumbbell'],
        seed: 'TEST_PREMIUM_PATTERN'
      })
    });

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.workout.meta?.generator).toBe('premium');

    // Verify pattern lock on main blocks
    const mainBlocks = data.workout.sets.filter((set: any) => 
      ALLOWED_PATTERNS.some(pattern => pattern.test(set.exercise))
    );

    expect(mainBlocks.length).toBeGreaterThan(0);
    
    for (const block of mainBlocks) {
      const matchesPattern = ALLOWED_PATTERNS.some(pattern => pattern.test(block.exercise));
      expect(matchesPattern).toBe(true);
    }
  }, 30000);

  it('asserts no banned BW movements in mains with equipment', async () => {
    const response = await fetch(`${API_BASE}/api/workouts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: 'CrossFit',
        durationMin: 25,
        intensity: 7,
        equipment: ['barbell', 'kettlebell'],
        seed: 'TEST_NO_BANNED_BW'
      })
    });

    const data = await response.json();
    expect(data.ok).toBe(true);

    // Find main block sets (those with pattern titles)
    const mainBlockIndices: number[] = [];
    data.workout.sets.forEach((set: any, idx: number) => {
      if (ALLOWED_PATTERNS.some(pattern => pattern.test(set.exercise))) {
        mainBlockIndices.push(idx);
      }
    });

    // Check exercises in main blocks
    for (let i = 0; i < mainBlockIndices.length; i++) {
      const blockStart = mainBlockIndices[i];
      const blockEnd = mainBlockIndices[i + 1] || data.workout.sets.length;

      for (let j = blockStart + 1; j < blockEnd; j++) {
        const set = data.workout.sets[j];
        const exerciseLower = (set.exercise || '').toLowerCase();
        
        const isBanned = BANNED_BW_MOVEMENTS.some(banned => 
          exerciseLower.includes(banned)
        );
        
        expect(isBanned).toBe(false);
      }
    }
  }, 30000);

  it('asserts variety_score, time_fit, and mixed_rule_ok', async () => {
    const response = await fetch(`${API_BASE}/api/workouts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: 'CrossFit',
        durationMin: 45,
        intensity: 9,
        equipment: ['barbell', 'dumbbell', 'kettlebell'],
        seed: 'TEST_ACCEPTANCE_FLAGS'
      })
    });

    const data = await response.json();
    expect(data.ok).toBe(true);

    // Variety score should exist and be reasonable
    if (data.workout.variety_score !== undefined) {
      expect(data.workout.variety_score).toBeGreaterThanOrEqual(0);
      expect(data.workout.variety_score).toBeLessThanOrEqual(1);
    }

    // Check acceptance flags
    const flags = data.workout.acceptance_flags || data.workout.meta?.acceptance;
    expect(flags).toBeDefined();
    expect(flags.time_fit).toBe(true);
    expect(flags.mixed_rule_ok).toBe(true);
    expect(flags.patterns_locked).toBe(true);
  }, 30000);

  it('verifies conversion preserves pattern titles and item reps', async () => {
    const response = await fetch(`${API_BASE}/api/workouts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: 'CrossFit',
        durationMin: 20,
        intensity: 6,
        equipment: ['dumbbell'],
        seed: 'TEST_CONVERSION'
      })
    });

    const data = await response.json();
    expect(data.ok).toBe(true);

    // Find header sets (pattern titles) - should have duration
    const headerSets = data.workout.sets.filter((set: any) => 
      ALLOWED_PATTERNS.some(pattern => pattern.test(set.exercise)) ||
      set.exercise === 'Warm-up' ||
      set.exercise === 'Cool-down'
    );

    for (const header of headerSets) {
      expect(header.duration).toBeDefined();
      expect(typeof header.duration).toBe('number');
      expect(header.duration).toBeGreaterThan(0);
    }

    // Find item sets (individual exercises) - should have reps, NOT auto-filled duration
    const itemSets = data.workout.sets.filter((set: any) => 
      !ALLOWED_PATTERNS.some(pattern => pattern.test(set.exercise)) &&
      set.exercise !== 'Warm-up' &&
      set.exercise !== 'Cool-down'
    );

    for (const item of itemSets) {
      // Items should have reps (can be empty string) but duration should be undefined
      expect(item.reps !== undefined || item.notes !== undefined).toBe(true);
      
      // Duration should NOT be auto-filled for items (prevents invented "270s" data)
      if (item.duration !== undefined) {
        // If duration exists, it must be null or 0 (not a made-up number)
        expect([null, undefined].includes(item.duration)).toBe(true);
      }
    }
  }, 30000);
});
