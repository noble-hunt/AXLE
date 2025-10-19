import { generateWorkout } from '../dist/workoutGenerator.js';

async function testEnduranceScheme() {
  const request = {
    style: 'endurance',
    goal: 'endurance',
    focus: 'endurance',
    category: 'endurance',
    duration: 30,
    durationMin: 30,
    intensity: 7,
    equipment: ['rower'],
    seed: 'TEST_SCHEME_001'
  };

  console.log('[TEST] Generating endurance workout...');
  const result = await generateWorkout(request);
  
  console.log('\n[TEST] Workout generated successfully');
  console.log('[TEST] Sets count:', result.sets.length);
  
  // Find the Row exercise
  const rowExercises = result.sets.filter(s => s.exercise === 'Row');
  console.log('\n[TEST] Row exercises found:', rowExercises.length);
  
  if (rowExercises.length > 0) {
    console.log('\n[TEST] First Row exercise:');
    console.log(JSON.stringify(rowExercises[0], null, 2));
  } else {
    console.log('\n[TEST] ERROR: No Row exercises found!');
    console.log('\n[TEST] All exercises:');
    result.sets.forEach((s, i) => {
      console.log(`  ${i}: ${s.exercise} (header: ${s.is_header})`);
    });
  }
}

testEnduranceScheme().catch(err => {
  console.error('[TEST] Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
