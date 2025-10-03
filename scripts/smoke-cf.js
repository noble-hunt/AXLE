#!/usr/bin/env node

const API_BASE = process.env.VITE_API_BASE_URL || 'http://localhost:5000';

async function smokeTestCF() {
  console.log('🔥 CrossFit Generator Smoke Test\n');

  const payload = {
    goal: 'crossfit',
    durationMin: 45,
    intensity: 8,
    equipment: ['barbell', 'dumbbell', 'bike'],
    seed: 'SMOKE_CF'
  };

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 CrossFit HIIT with Full Equipment`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  try {
    const response = await fetch(`${API_BASE}/api/workouts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('❌ Failed:', data.error || 'Unknown error');
      process.exit(1);
    }

    const { workout } = data;

    console.log('📊 Meta Information:');
    console.log(`   generator: ${workout.meta?.generator || 'N/A'}`);
    console.log(`   seed: ${workout.meta?.seed || 'N/A'}`);
    console.log(`   hardness: ${workout.variety_score?.toFixed(2) || 'N/A'}`);
    console.log(`   name: ${workout.name || 'N/A'}`);
    
    console.log(`\n🔍 Acceptance Flags:`);
    const acceptance = workout.meta?.acceptance || workout.acceptance_flags || {};
    Object.entries(acceptance).forEach(([key, value]) => {
      const icon = value ? '✅' : '❌';
      console.log(`   ${icon} ${key}: ${value}`);
    });

    console.log(`\n📝 First 8 Exercises:`);
    const first8 = workout.sets.slice(0, 8);
    first8.forEach((set, idx) => {
      console.log(`   ${idx + 1}. ${set.exercise}${set.reps ? ` (${set.reps} reps)` : ''}${set.duration ? ` (${set.duration}s)` : ''}`);
    });

    console.log(`\n✅ Quality Checks:`);
    console.log(`   ✓ Total sets: ${workout.sets.length}`);
    console.log(`   ✓ Hardness score: ${workout.variety_score?.toFixed(2) || 'N/A'}`);
    
    // Check for pattern compliance
    const hasPattern = workout.sets.some(s => 
      /EMOM|AMRAP|E[234]:00|Every [234]:00|For Time/.test(s.section || '')
    );
    console.log(`   ${hasPattern ? '✓' : '⚠️'} CF pattern detected: ${hasPattern}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ Smoke test complete\n');
}

smokeTestCF().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
