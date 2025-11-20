/**
 * Simple seeded random number generator for deterministic workout generation
 * Based on a multiplicative linear congruential generator (LCG)
 */
export class SeededRandom {
    constructor(seed) {
        // Convert string seed to number using a simple hash
        if (typeof seed === 'string') {
            let hash = 0;
            for (let i = 0; i < seed.length; i++) {
                const char = seed.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            this.seed = Math.abs(hash);
        }
        else {
            this.seed = Math.abs(seed);
        }
        // Ensure seed is non-zero for LCG
        if (this.seed === 0)
            this.seed = 1;
    }
    /**
     * Generate next random number between 0 and 1
     */
    next() {
        // LCG parameters (from Numerical Recipes)
        this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
        return this.seed / Math.pow(2, 32);
    }
    /**
     * Generate random integer between min (inclusive) and max (exclusive)
     */
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min)) + min;
    }
    /**
     * Generate random element from array
     */
    choice(array) {
        const index = this.nextInt(0, array.length);
        return array[index];
    }
    /**
     * Shuffle array in place using Fisher-Yates algorithm
     */
    shuffle(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i + 1);
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
    /**
     * Generate random boolean with given probability
     */
    chance(probability) {
        return this.next() < probability;
    }
}
/**
 * Create a seed string from GenerationSeed components
 */
export function createSeedString(userHash, day, focus, nonce) {
    const parts = [userHash, day];
    if (focus)
        parts.push(focus);
    if (nonce !== undefined)
        parts.push(nonce.toString());
    return parts.join('-');
}
