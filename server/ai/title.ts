/**
 * AI Title Generator
 * 
 * Generates short, punchy CrossFit-style titles like:
 * "HARDY BACARDI PARTY", "SLAP HAPPY SAMURAI", "KETTLEBELL KRONOS"
 * 
 * Uses date+movement hashing to avoid duplicates
 */

import { createHash } from 'crypto';

// High-energy adjectives
const ADJECTIVES = [
  'BRUTAL', 'SAVAGE', 'EPIC', 'MIGHTY', 'FURIOUS', 'IRON', 'STEEL', 'BLAZING',
  'THUNDER', 'LIGHTNING', 'HURRICANE', 'TORNADO', 'VOLCANIC', 'ATOMIC', 'NUCLEAR',
  'TITANIUM', 'DIAMOND', 'GRANITE', 'PHOENIX', 'DRAGON', 'WARRIOR', 'GLADIATOR',
  'CHAMPION', 'DESTROYER', 'CRUSHER', 'HAMMER', 'ANVIL', 'FORGE', 'INFERNO',
  'RAMPAGE', 'BEAST', 'MONSTER', 'GIANT', 'TITAN', 'KING', 'EMPEROR', 'LEGEND',
  'WILD', 'CRAZY', 'INSANE', 'WICKED', 'TWISTED', 'RUTHLESS', 'RELENTLESS',
  'UNSTOPPABLE', 'UNTAMED', 'UNBREAKABLE', 'INVINCIBLE', 'IMMORTAL', 'ETERNAL'
];

// Strong nouns and alliterative combos
const NOUNS = [
  'BLITZ', 'STORM', 'FURY', 'RAGE', 'FORCE', 'POWER', 'MIGHT', 'STRENGTH',
  'THUNDER', 'LIGHTNING', 'HURRICANE', 'TORNADO', 'AVALANCHE', 'EARTHQUAKE',
  'TSUNAMI', 'VOLCANO', 'EXPLOSION', 'CHAOS', 'MAYHEM', 'CARNAGE', 'BATTLE',
  'WAR', 'COMBAT', 'SIEGE', 'ASSAULT', 'ATTACK', 'STRIKE', 'CRUSH', 'SMASH',
  'DOMINATION', 'DESTRUCTION', 'ANNIHILATION', 'OBLITERATION', 'DEVASTATION',
  'MASSACRE', 'SLAUGHTER', 'RAMPAGE', 'ONSLAUGHT', 'BARRAGE', 'BOMBARDMENT',
  'KRONOS', 'ATLAS', 'HERCULES', 'SPARTAN', 'VIKING', 'SAMURAI', 'NINJA',
  'GLADIATOR', 'WARRIOR', 'BERSERKER', 'DESTROYER', 'CONQUEROR', 'CHAMPION'
];

// Alliterative word pairs for extra punch
const ALLITERATIVE_PAIRS = [
  'BRUTAL BLITZ', 'SAVAGE STORM', 'MIGHTY MAYHEM', 'FURIOUS FURY',
  'IRON INFERNO', 'STEEL STORM', 'BLAZING BLITZ', 'THUNDER TITAN',
  'LIGHTNING LEGEND', 'HURRICANE HAMMER', 'TORNADO THUNDER', 'VOLCANIC VIKING',
  'ATOMIC ANVIL', 'NUCLEAR NINJA', 'TITANIUM TITAN', 'DIAMOND DESTROYER',
  'GRANITE GLADIATOR', 'PHOENIX POWER', 'DRAGON DESTROYER', 'WARRIOR WRATH',
  'GLADIATOR GLORY', 'CHAMPION CHAOS', 'DESTROYER DOMINATION', 'CRUSHER CARNAGE',
  'HAMMER HURRICANE', 'ANVIL ATTACK', 'FORGE FURY', 'INFERNO IRON',
  'RAMPAGE RIOT', 'BEAST BLITZ', 'MONSTER MAYHEM', 'GIANT GLADIATOR',
  'TITAN THUNDER', 'KING KRONOS', 'EMPEROR EARTHQUAKE', 'LEGEND LIGHTNING'
];

// Movement-specific prefixes
const MOVEMENT_PREFIXES: Record<string, string[]> = {
  'kettlebell': ['KETTLEBELL', 'BELL', 'IRON BELL'],
  'barbell': ['BARBELL', 'BAR', 'IRON BAR', 'STEEL BAR'],
  'dumbbell': ['DUMBBELL', 'BELL', 'IRON'],
  'pull': ['PULL-UP', 'PULLUP', 'CHIN'],
  'squat': ['SQUAT', 'GOBLET', 'FRONT'],
  'deadlift': ['DEADLIFT', 'DEAD', 'LIFT'],
  'press': ['PRESS', 'PUSH', 'OVERHEAD'],
  'row': ['ROW', 'BENT'],
  'clean': ['CLEAN', 'POWER'],
  'snatch': ['SNATCH', 'POWER'],
  'jerk': ['JERK', 'PUSH'],
  'burpee': ['BURPEE', 'DEATH'],
  'run': ['RUN', 'SPRINT', 'DASH'],
  'box': ['BOX', 'JUMP', 'STEP'],
  'wall': ['WALL', 'SLAM'],
  'rope': ['ROPE', 'CLIMB', 'BATTLE'],
  'bike': ['BIKE', 'CYCLE', 'ASSAULT'],
  'ski': ['SKI', 'ERGO'],
  'row': ['ROW', 'ERGO', 'C2']
};

/**
 * Generate a punchy workout title
 */
export function generateTitle(
  movements: string[] = [],
  category: string = 'CrossFit',
  date: Date = new Date()
): string {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const movementKey = movements.join('|').toLowerCase();
  
  // Create deterministic hash from date + movements
  const hash = createHash('md5')
    .update(`${dateStr}:${movementKey}:${category}`)
    .digest('hex');
  
  // Use hash to seed pseudo-random selection
  const seed = parseInt(hash.substring(0, 8), 16);
  
  // Try to find movement-specific prefix first
  let prefix = '';
  for (const movement of movements) {
    for (const [key, prefixes] of Object.entries(MOVEMENT_PREFIXES)) {
      if (movement.toLowerCase().includes(key)) {
        const prefixIndex = (seed + movement.length) % prefixes.length;
        prefix = prefixes[prefixIndex];
        break;
      }
    }
    if (prefix) break;
  }
  
  // If no movement-specific prefix, use alliterative pairs or random combo
  if (!prefix) {
    const useAlliterative = (seed % 3) === 0; // 33% chance
    
    if (useAlliterative) {
      const pairIndex = seed % ALLITERATIVE_PAIRS.length;
      return ALLITERATIVE_PAIRS[pairIndex];
    } else {
      // Random adjective + noun combo
      const adjIndex = seed % ADJECTIVES.length;
      const nounIndex = (seed * 7) % NOUNS.length; // Different multiplier for variety
      return `${ADJECTIVES[adjIndex]} ${NOUNS[nounIndex]}`;
    }
  }
  
  // Build title with movement prefix
  const suffixSeed = (seed * 13) % NOUNS.length;
  const suffix = NOUNS[suffixSeed];
  
  return `${prefix} ${suffix}`;
}

/**
 * Get primary movement from workout blocks for title generation
 */
export function extractPrimaryMovements(workoutBlocks: any[]): string[] {
  const movements: string[] = [];
  
  for (const block of workoutBlocks) {
    if (block.sets) {
      for (const set of block.sets) {
        if (set.movements) {
          for (const movement of set.movements) {
            if (movement.name) {
              movements.push(movement.name);
            }
          }
        }
      }
    }
  }
  
  // Return first 3 movements for title generation
  return movements.slice(0, 3);
}

/**
 * Generate title from workout data
 */
export function generateWorkoutTitle(
  workout: any,
  category: string = 'CrossFit',
  date: Date = new Date()
): string {
  const movements = extractPrimaryMovements(workout.blocks || []);
  return generateTitle(movements, category, date);
}