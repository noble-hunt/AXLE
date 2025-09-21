/**
 * Generate Sample Workouts
 * 
 * Creates 8 JSON workout samples across categories and writes to attached_assets/
 */

import { generateCrossFitWorkout } from '../server/ai/generators/crossfit.js';
import { generateOlympicWorkout } from '../server/ai/generators/olympic.js';
import { critiqueAndRepair } from '../server/ai/critic.js';
import { generateWorkoutTitle } from '../server/ai/title.js';
import { render } from '../src/ai/render.js';
import type { WorkoutGenerationRequest } from '../server/ai/generateWorkout.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Sample generation configurations
const CROSSFIT_SAMPLES: Array<{
  name: string;
  request: WorkoutGenerationRequest;
}> = [
  {
    name: 'crossfit-beginner-30min',
    request: {
      category: 'CrossFit/HIIT',
      duration: 30,
      intensity: 4,
      context: {
        equipment: ['barbell', 'kettlebell', 'pull_up_bar', 'box', 'floor'],
        constraints: ['beginner_friendly'],
        goals: ['general_fitness', 'strength_building']
      }
    }
  },
  {
    name: 'crossfit-intermediate-45min',
    request: {
      category: 'CrossFit/HIIT',
      duration: 45,
      intensity: 6,
      context: {
        equipment: ['barbell', 'kettlebell', 'pull_up_bar', 'box', 'dumbbell', 'wall_ball'],
        constraints: [],
        goals: ['conditioning', 'strength_building']
      }
    }
  },
  {
    name: 'crossfit-advanced-60min',
    request: {
      category: 'CrossFit/HIIT',
      duration: 60,
      intensity: 8,
      context: {
        equipment: ['barbell', 'kettlebell', 'pull_up_bar', 'box', 'dumbbell', 'wall_ball', 'rower'],
        constraints: [],
        goals: ['competition_prep', 'max_conditioning']
      }
    }
  },
  {
    name: 'crossfit-travel-20min',
    request: {
      category: 'CrossFit/HIIT',
      duration: 20,
      intensity: 7,
      context: {
        equipment: ['floor'], // Bodyweight only
        constraints: ['no_equipment', 'time_efficient'],
        goals: ['maintenance', 'conditioning']
      }
    }
  }
];

const OLYMPIC_SAMPLES: Array<{
  name: string;
  request: WorkoutGenerationRequest;
}> = [
  {
    name: 'olympic-technique-45min',
    request: {
      category: 'Olympic',
      duration: 45,
      intensity: 5,
      context: {
        equipment: ['barbell', 'platform', 'squat_rack', 'competition_plates'],
        constraints: ['technique_focus'],
        goals: ['skill_development', 'movement_quality']
      }
    }
  },
  {
    name: 'olympic-strength-60min',
    request: {
      category: 'Olympic',
      duration: 60,
      intensity: 7,
      context: {
        equipment: ['barbell', 'platform', 'squat_rack', 'competition_plates', 'blocks'],
        constraints: [],
        goals: ['strength_building', 'competition_prep']
      }
    }
  },
  {
    name: 'olympic-competition-90min',
    request: {
      category: 'Olympic',
      duration: 90,
      intensity: 9,
      context: {
        equipment: ['barbell', 'platform', 'squat_rack', 'competition_plates', 'blocks', 'timing_system'],
        constraints: ['competition_simulation'],
        goals: ['competition_prep', 'max_attempts']
      }
    }
  },
  {
    name: 'olympic-accessory-40min',
    request: {
      category: 'Olympic',
      duration: 40,
      intensity: 6,
      context: {
        equipment: ['barbell', 'dumbbell', 'kettlebell', 'squat_rack', 'pull_up_bar'],
        constraints: ['accessory_focus'],
        goals: ['weakness_addressing', 'injury_prevention']
      }
    }
  }
];

/**
 * Generate a single workout sample
 */
async function generateSample(config: {
  name: string;
  request: WorkoutGenerationRequest;
}, generator: (req: WorkoutGenerationRequest) => Promise<any>): Promise<any> {
  try {
    console.log(`🏋️ Generating ${config.name}...`);
    
    // Generate workout
    const workout = await generator(config.request);
    
    // Add title if missing
    if (!workout.name || workout.name === 'CrossFit Workout' || workout.name === 'Olympic Training') {
      workout.name = generateWorkoutTitle(workout, config.request.category);
    }
    
    // Critique and repair
    const critique = await critiqueAndRepair(workout, {
      request: config.request,
      originalWorkout: workout
    });
    
    // Render workout
    const rendered = render(critique.workout);
    
    const result = {
      metadata: {
        name: config.name,
        category: config.request.category,
        duration: config.request.duration,
        intensity: config.request.intensity,
        generated_at: new Date().toISOString(),
        generator_version: '1.0.0'
      },
      request: config.request,
      workout: critique.workout,
      critique: {
        score: critique.score,
        issues: critique.issues,
        was_patched: critique.wasPatched
      },
      rendered: rendered
    };
    
    console.log(`✅ Generated ${config.name} (score: ${critique.score})`);
    return result;
    
  } catch (error) {
    console.error(`❌ Failed to generate ${config.name}:`, error);
    return {
      metadata: {
        name: config.name,
        category: config.request.category,
        duration: config.request.duration,
        intensity: config.request.intensity,
        generated_at: new Date().toISOString(),
        generator_version: '1.0.0'
      },
      request: config.request,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Main generation function
 */
async function generateAllSamples() {
  console.log('🚀 Starting sample generation...\n');
  
  // Ensure output directory exists
  const outputDir = join(process.cwd(), 'attached_assets');
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  
  const allSamples: any[] = [];
  
  // Generate CrossFit samples
  console.log('🏋️ Generating CrossFit samples...');
  for (const config of CROSSFIT_SAMPLES) {
    const sample = await generateSample(config, generateCrossFitWorkout);
    allSamples.push(sample);
    
    // Write individual file
    const filename = `${config.name}.json`;
    const filepath = join(outputDir, filename);
    writeFileSync(filepath, JSON.stringify(sample, null, 2));
    console.log(`📝 Wrote ${filename}`);
  }
  
  // Generate Olympic samples
  console.log('\n🏋️‍♀️ Generating Olympic samples...');
  for (const config of OLYMPIC_SAMPLES) {
    const sample = await generateSample(config, generateOlympicWorkout);
    allSamples.push(sample);
    
    // Write individual file
    const filename = `${config.name}.json`;
    const filepath = join(outputDir, filename);
    writeFileSync(filepath, JSON.stringify(sample, null, 2));
    console.log(`📝 Wrote ${filename}`);
  }
  
  // Write master index file
  const indexFile = {
    generated_at: new Date().toISOString(),
    total_samples: allSamples.length,
    categories: {
      crossfit: CROSSFIT_SAMPLES.length,
      olympic: OLYMPIC_SAMPLES.length
    },
    samples: allSamples.map(s => ({
      name: s.metadata.name,
      category: s.metadata.category,
      duration: s.metadata.duration,
      intensity: s.metadata.intensity,
      score: s.critique?.score || null,
      has_error: !!s.error
    }))
  };
  
  const indexPath = join(outputDir, 'samples-index.json');
  writeFileSync(indexPath, JSON.stringify(indexFile, null, 2));
  
  console.log(`\n✅ Generation complete!`);
  console.log(`📊 Generated ${allSamples.length} samples total`);
  console.log(`📂 Files written to: ${outputDir}`);
  
  // Print summary
  const successful = allSamples.filter(s => !s.error).length;
  const failed = allSamples.filter(s => s.error).length;
  const avgScore = allSamples
    .filter(s => s.critique?.score)
    .reduce((sum, s) => sum + s.critique.score, 0) / successful;
  
  console.log(`\n📈 Summary:`);
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ❌ Failed: ${failed}`);
  if (successful > 0) {
    console.log(`   📊 Average critic score: ${avgScore.toFixed(1)}/100`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateAllSamples().catch(error => {
    console.error('💥 Sample generation failed:', error);
    process.exit(1);
  });
}

export { generateAllSamples };