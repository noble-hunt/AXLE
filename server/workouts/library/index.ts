/**
 * Workout Block Library Loader
 * 
 * Loads, validates, and provides access to workout blocks from JSON files
 */

import { z } from 'zod';

// Static imports for Vercel compatibility - bundler can trace these
import warmupBlocksRaw from './blocks/warmup.json' with { type: 'json' };
import primaryBlocksRaw from './blocks/primary.json' with { type: 'json' };
import accessoryBlocksRaw from './blocks/accessory.json' with { type: 'json' };
import conditioningBlocksRaw from './blocks/conditioning.json' with { type: 'json' };
import finisherBlocksRaw from './blocks/finisher.json' with { type: 'json' };
import cooldownBlocksRaw from './blocks/cooldown.json' with { type: 'json' };

// Zod schema for workout block validation
const BlockVariantSchema = z.object({
  name: z.string(),
  movements: z.array(z.string()),
});

const WorkoutBlockSchema = z.object({
  id: z.string(),
  type: z.enum(['warmup', 'primary', 'accessory', 'conditioning', 'finisher', 'cooldown']),
  durationMin: z.number().min(1).max(120),
  minEquipment: z.array(z.string()),
  contraindications: z.array(z.string()),
  experience: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  energySystems: z.array(z.enum(['alactic', 'phosphocreatine', 'glycolytic', 'aerobicZ1', 'aerobicZ2', 'aerobicZ3'])),
  movementPatterns: z.array(z.enum(['squat', 'hinge', 'push', 'pull', 'carry', 'locomotion', 'power', 'core'])),
  progressionKey: z.string(),
  variants: z.array(BlockVariantSchema),
});

export type WorkoutBlock = z.infer<typeof WorkoutBlockSchema>;
export type BlockType = WorkoutBlock['type'];
export type EnergySystem = WorkoutBlock['energySystems'][0];
export type MovementPattern = WorkoutBlock['movementPatterns'][0];
export type ExperienceLevel = WorkoutBlock['experience'];

export interface BlockFilter {
  type?: BlockType;
  energySystem?: EnergySystem;
  movementPattern?: MovementPattern;
  experience?: ExperienceLevel;
  equipment?: string[];
  maxDuration?: number;
  contraindications?: string[];
}

// In-memory cache for blocks
let blocksCache: WorkoutBlock[] = [];
let isLoaded = false;

/**
 * Load and validate all workout blocks from statically imported JSON
 */
export function loadBlocks(): { blocks: WorkoutBlock[]; errors: string[] } {
  const errors: string[] = [];
  const allBlocks: WorkoutBlock[] = [];
  
  // Map of category name to imported JSON data
  const blockData: Record<string, any[]> = {
    warmup: warmupBlocksRaw as any[],
    primary: primaryBlocksRaw as any[],
    accessory: accessoryBlocksRaw as any[],
    conditioning: conditioningBlocksRaw as any[],
    finisher: finisherBlocksRaw as any[],
    cooldown: cooldownBlocksRaw as any[],
  };
  
  for (const [category, rawBlocks] of Object.entries(blockData)) {
    if (!Array.isArray(rawBlocks)) {
      errors.push(`${category}.json: Expected array of blocks`);
      continue;
    }
    
    for (let i = 0; i < rawBlocks.length; i++) {
      try {
        const validatedBlock = WorkoutBlockSchema.parse(rawBlocks[i]);
        allBlocks.push(validatedBlock);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          errors.push(`${category}.json[${i}]: ${validationError.issues.map(issue => 
            `${issue.path.join('.')}: ${issue.message}`
          ).join(', ')}`);
        } else {
          errors.push(`${category}.json[${i}]: Validation failed`);
        }
      }
    }
  }
  
  return { blocks: allBlocks, errors };
}

/**
 * Initialize the block library cache
 */
export function initializeBlockLibrary(): void {
  const { blocks, errors } = loadBlocks();
  
  blocksCache = blocks;
  isLoaded = true;
  
  console.log(`Loaded ${blocks.length} blocks validated (${errors.length} errors)`);
  
  if (errors.length > 0) {
    console.error('Block validation errors:');
    errors.forEach(error => console.error(`  - ${error}`));
  }
}

/**
 * Get blocks with optional filtering
 */
export function getBlocks(filter?: BlockFilter): WorkoutBlock[] {
  if (!isLoaded) {
    initializeBlockLibrary();
  }
  
  if (!filter) {
    return [...blocksCache];
  }
  
  return blocksCache.filter(block => {
    // Type filter
    if (filter.type && block.type !== filter.type) {
      return false;
    }
    
    // Energy system filter
    if (filter.energySystem && !block.energySystems.includes(filter.energySystem)) {
      return false;
    }
    
    // Movement pattern filter
    if (filter.movementPattern && !block.movementPatterns.includes(filter.movementPattern)) {
      return false;
    }
    
    // Experience level filter
    if (filter.experience && block.experience !== filter.experience) {
      return false;
    }
    
    // Equipment filter (block must require only available equipment)
    if (filter.equipment) {
      const hasRequiredEquipment = block.minEquipment.every(required => 
        filter.equipment!.includes(required)
      );
      if (!hasRequiredEquipment) {
        return false;
      }
    }
    
    // Duration filter
    if (filter.maxDuration && block.durationMin > filter.maxDuration) {
      return false;
    }
    
    // Contraindications filter (exclude blocks with user's contraindications)
    if (filter.contraindications && filter.contraindications.length > 0) {
      const hasContraindication = block.contraindications.some(contraindication =>
        filter.contraindications!.includes(contraindication)
      );
      if (hasContraindication) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Get a specific block by ID
 */
export function getBlockById(id: string): WorkoutBlock | null {
  if (!isLoaded) {
    initializeBlockLibrary();
  }
  
  return blocksCache.find(block => block.id === id) || null;
}

/**
 * Get blocks grouped by type
 */
export function getBlocksByType(): Record<BlockType, WorkoutBlock[]> {
  if (!isLoaded) {
    initializeBlockLibrary();
  }
  
  const grouped: Record<BlockType, WorkoutBlock[]> = {
    warmup: [],
    primary: [],
    accessory: [],
    conditioning: [],
    finisher: [],
    cooldown: [],
  };
  
  blocksCache.forEach(block => {
    grouped[block.type].push(block);
  });
  
  return grouped;
}