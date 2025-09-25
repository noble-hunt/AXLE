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