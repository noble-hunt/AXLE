/**
 * Simple seeded pseudorandom number generator using mulberry32 algorithm
 * Based on: https://github.com/bryc/code/blob/master/jshash/PRNGs.md
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: string) {
    // Convert string seed to 32-bit integer
    this.seed = this.hashCode(seed);
  }

  /**
   * Generate next random number between 0 (inclusive) and 1 (exclusive)
   */
  next(): number {
    this.seed |= 0;
    this.seed = this.seed + 0x6D2B79F5 | 0;
    let t = Math.imul(this.seed ^ this.seed >>> 15, this.seed | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  /**
   * Generate random integer between min (inclusive) and max (exclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Generate random number between min (inclusive) and max (exclusive)
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Randomly shuffle an array in place using Fisher-Yates algorithm
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Select random element from array
   */
  choice<T>(array: T[]): T {
    return array[this.nextInt(0, array.length)];
  }

  /**
   * Select multiple random elements from array without replacement
   */
  sample<T>(array: T[], count: number): T[] {
    const shuffled = this.shuffle(array);
    return shuffled.slice(0, Math.min(count, array.length));
  }

  /**
   * Weighted random choice
   * @param items Array of items to choose from
   * @param weights Array of weights (will be normalized)
   * @returns Selected item based on weights
   */
  weightedChoice<T>(items: T[], weights: number[]): T {
    if (items.length !== weights.length) {
      throw new Error('Items and weights must have same length');
    }
    if (items.length === 0) {
      throw new Error('Cannot choose from empty array');
    }

    // Normalize weights to sum to 1
    const total = weights.reduce((sum, w) => sum + w, 0);
    if (total === 0) {
      // All weights are 0, choose uniformly
      return this.choice(items);
    }

    const normalized = weights.map(w => w / total);

    // Generate random number and find corresponding item
    const rand = this.next();
    let cumulative = 0;

    for (let i = 0; i < items.length; i++) {
      cumulative += normalized[i];
      if (rand < cumulative) {
        return items[i];
      }
    }

    // Fallback to last item (shouldn't reach here due to floating point)
    return items[items.length - 1];
  }

  /**
   * Convert string to 32-bit hash
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
}

/**
 * Generate a new seed string using current timestamp
 */
export function generateSeed(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}