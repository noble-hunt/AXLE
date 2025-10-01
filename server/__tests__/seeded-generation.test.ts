import { describe, it, expect } from 'vitest';
import { SeededRandom } from '../lib/seededRandom';

describe('Seeded Random Generation', () => {
  it('should produce identical sequences with same seed', () => {
    const seed = 'test-seed-123';
    const rng1 = new SeededRandom(seed);
    const rng2 = new SeededRandom(seed);
    
    // Generate sequences of random numbers
    const sequence1 = Array.from({ length: 10 }, () => rng1.next());
    const sequence2 = Array.from({ length: 10 }, () => rng2.next());
    
    expect(sequence1).toEqual(sequence2);
  });

  it('should produce different sequences with different seeds', () => {
    const rng1 = new SeededRandom('seed-1');
    const rng2 = new SeededRandom('seed-2');
    
    const sequence1 = Array.from({ length: 10 }, () => rng1.next());
    const sequence2 = Array.from({ length: 10 }, () => rng2.next());
    
    expect(sequence1).not.toEqual(sequence2);
  });

  it('should make identical weighted choices with same seed', () => {
    const items = ['barbell', 'dumbbell', 'kettlebell', 'bodyweight'];
    const weights = [60, 30, 8, 2]; // 60% BB, 30% DB, 8% KB, 2% BW
    
    const rng1 = new SeededRandom('weighted-test-seed');
    const rng2 = new SeededRandom('weighted-test-seed');
    
    const choices1 = Array.from({ length: 20 }, () => rng1.weightedChoice(items, weights));
    const choices2 = Array.from({ length: 20 }, () => rng2.weightedChoice(items, weights));
    
    expect(choices1).toEqual(choices2);
  });

  it('should respect weight distribution in weighted choice', () => {
    const items = ['barbell', 'dumbbell', 'kettlebell', 'bodyweight'];
    const weights = [60, 30, 8, 2];
    
    const rng = new SeededRandom('distribution-test');
    const sampleSize = 1000;
    const choices = Array.from({ length: sampleSize }, () => rng.weightedChoice(items, weights));
    
    // Count occurrences
    const counts = choices.reduce((acc, choice) => {
      acc[choice] = (acc[choice] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Check approximate distribution (within 10% tolerance)
    const barbellPercent = (counts['barbell'] / sampleSize) * 100;
    const dumbbellPercent = (counts['dumbbell'] / sampleSize) * 100;
    
    expect(barbellPercent).toBeGreaterThan(50); // Should be around 60%
    expect(barbellPercent).toBeLessThan(70);
    expect(dumbbellPercent).toBeGreaterThan(20); // Should be around 30%
    expect(dumbbellPercent).toBeLessThan(40);
  });

  it('should handle edge cases in weighted choice', () => {
    const items = ['a', 'b', 'c'];
    const rng = new SeededRandom('edge-case');
    
    // All weights zero - should choose uniformly
    const result1 = rng.weightedChoice(items, [0, 0, 0]);
    expect(items).toContain(result1);
    
    // Single item with all weight
    const rng2 = new SeededRandom('edge-case-2');
    const result2 = rng2.weightedChoice(items, [100, 0, 0]);
    expect(result2).toBe('a');
  });

  it('should produce consistent shuffles with same seed', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    
    const rng1 = new SeededRandom('shuffle-test');
    const rng2 = new SeededRandom('shuffle-test');
    
    const shuffled1 = rng1.shuffle(items);
    const shuffled2 = rng2.shuffle(items);
    
    expect(shuffled1).toEqual(shuffled2);
    expect(shuffled1).not.toEqual(items); // Should be shuffled, not original order
  });
});
