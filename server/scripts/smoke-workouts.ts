#!/usr/bin/env tsx
/**
 * Smoke test for workout generation
 * Tests 3 canned payloads and prints generator, hardness, and flags
 */

import { generatePremiumWorkout } from '../ai/generators/premium';
import { convertPremiumToGenerated } from '../workoutGenerator';
import type { WorkoutGenerationRequest } from '../ai/generateWorkout';
import { Category } from '../../shared/schema';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

function printHeader(title: string) {
  console.log('\n' + colors.blue + '═'.repeat(80) + colors.reset);
  console.log(colors.cyan + title + colors.reset);
  console.log(colors.blue + '═'.repeat(80) + colors.reset);
}

function printResult(label: string, value: any, color: string = colors.green) {
  console.log(`${color}${label}:${colors.reset} ${value}`);
}

async function testWorkout(name: string, request: WorkoutGenerationRequest, seed?: string) {
  printHeader(`Test: ${name}`);
  
  console.log('\nInput:');
  console.log(`  Category: ${request.category}`);
  console.log(`  Duration: ${request.duration} min`);
  console.log(`  Intensity: ${request.intensity}/10`);
  console.log(`  Equipment: ${request.context?.equipment?.join(', ') || 'none'}`);
  if (seed) {
    console.log(`  Seed: ${seed}`);
  }

  try {
    const startTime = Date.now();
    const workout = await generatePremiumWorkout(request, seed);
    const elapsedTime = Date.now() - startTime;

    // Convert to UI format
    const converted = convertPremiumToGenerated(workout as any);

    console.log('\nOutput:');
    printResult('  ✓ Generator', converted.meta.generator, colors.green);
    printResult('  ✓ Title', `"${workout.title}"`, colors.cyan);
    printResult('  ✓ Duration', `${workout.duration_min} min`, colors.cyan);
    printResult('  ✓ Blocks', workout.blocks.length, colors.cyan);
    printResult('  ✓ Hardness', workout.variety_score?.toFixed(2) ?? 'N/A', colors.yellow);
    printResult('  ✓ Generation Time', `${elapsedTime}ms`, colors.yellow);

    console.log('\nAcceptance Flags:');
    const flags = workout.acceptance_flags;
    printResult('  • time_fit', flags.time_fit ? '✓' : '✗', flags.time_fit ? colors.green : colors.red);
    printResult('  • has_warmup', flags.has_warmup ? '✓' : '✗', flags.has_warmup ? colors.green : colors.red);
    printResult('  • has_cooldown', flags.has_cooldown ? '✓' : '✗', flags.has_cooldown ? colors.green : colors.red);
    printResult('  • hardness_ok', flags.hardness_ok ? '✓' : '✗', flags.hardness_ok ? colors.green : colors.red);
    printResult('  • patterns_locked', flags.patterns_locked ? '✓' : '✗', flags.patterns_locked ? colors.green : colors.red);
    printResult('  • equipment_ok', flags.equipment_ok ? '✓' : '✗', flags.equipment_ok ? colors.green : colors.red);
    printResult('  • mixed_rule_ok', flags.mixed_rule_ok ? '✓' : '✗', flags.mixed_rule_ok ? colors.green : colors.red);

    console.log('\nBlock Summary:');
    workout.blocks.forEach((block, i) => {
      console.log(`  ${i + 1}. [${block.kind.toUpperCase()}] "${block.title}" (${block.time_min} min, ${block.items.length} items)`);
    });

    // Check for banned movements in main blocks
    const bannedMovements = ['wall sit', 'wall sits', 'mountain climber', 'mountain climbers', 'star jump', 'star jumps', 'high knee', 'high knees'];
    const mainBlocks = workout.blocks.filter(b => ['strength', 'conditioning', 'skill', 'core'].includes(b.kind));
    let hasBanned = false;
    
    for (const block of mainBlocks) {
      for (const item of block.items) {
        const exerciseLower = item.exercise.toLowerCase();
        if (bannedMovements.some(banned => exerciseLower.includes(banned))) {
          console.log(`  ${colors.red}⚠ Found banned movement: ${item.exercise} in ${block.kind} block${colors.reset}`);
          hasBanned = true;
        }
      }
    }
    
    if (!hasBanned) {
      console.log(`  ${colors.green}✓ No banned movements in main blocks${colors.reset}`);
    }

    return { success: true, workout, converted };
  } catch (error: any) {
    console.log(`\n${colors.red}✗ Error: ${error.message}${colors.reset}`);
    if (error.stack) {
      console.log(colors.red + error.stack + colors.reset);
    }
    return { success: false, error };
  }
}

async function main() {
  console.log(colors.cyan + '\n🏋️  Workout Generation Smoke Test' + colors.reset);
  console.log('Testing 3 canned payloads...\n');

  if (!process.env.OPENAI_API_KEY) {
    console.error(colors.red + '✗ OPENAI_API_KEY not set. Set it in your environment variables.' + colors.reset);
    process.exit(1);
  }

  const results = [];

  // Test 1: CrossFit with full equipment
  results.push(await testWorkout(
    'CrossFit with Barbell/Dumbbell/Bike',
    {
      category: Category.CROSSFIT,
      duration: 45,
      intensity: 8,
      context: {
        equipment: ['barbell', 'dumbbell', 'bike'],
        constraints: [],
        goals: ['general_fitness']
      }
    },
    'smoke-test-1'
  ));

  // Test 2: HIIT with kettlebell and rower
  results.push(await testWorkout(
    'HIIT with Kettlebell/Rower',
    {
      category: Category.HIIT,
      duration: 30,
      intensity: 7,
      context: {
        equipment: ['kettlebell', 'rower'],
        constraints: [],
        goals: ['conditioning']
      }
    },
    'smoke-test-2'
  ));

  // Test 3: Strength focus with multiple equipment
  results.push(await testWorkout(
    'Strength Focus (Barbell/Dumbbell)',
    {
      category: Category.STRENGTH,
      duration: 50,
      intensity: 8,
      context: {
        equipment: ['barbell', 'dumbbell', 'rower', 'bike'],
        constraints: [],
        goals: ['general_fitness']
      }
    },
    'smoke-test-3'
  ));

  // Print summary
  printHeader('Summary');
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  console.log(`\nTests: ${successCount}/${totalCount} passed`);
  
  if (successCount === totalCount) {
    console.log(colors.green + '\n✓ All smoke tests passed!' + colors.reset);
    process.exit(0);
  } else {
    console.log(colors.red + '\n✗ Some smoke tests failed.' + colors.reset);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(colors.red + '\n✗ Fatal error:' + colors.reset, error);
  process.exit(1);
});
