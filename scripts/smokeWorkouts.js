#!/usr/bin/env node

const API_BASE = process.env.VITE_API_BASE_URL || 'http://localhost:5000';

const payloads = [
  {
    name: 'CrossFit with Barbell',
    payload: {
      goal: 'CrossFit',
      durationMin: 30,
      intensity: 8,
      equipment: ['barbell', 'dumbbell'],
      seed: 'SMOKE_CF_BB'
    }
  },
  {
    name: 'HIIT with Kettlebell',
    payload: {
      goal: 'HIIT',
      durationMin: 20,
      intensity: 7,
      equipment: ['kettlebell'],
      seed: 'SMOKE_HIIT_KB'
    }
  },
  {
    name: 'Mixed with All Equipment',
    payload: {
      goal: 'mixed',
      durationMin: 45,
      intensity: 9,
      equipment: ['barbell', 'dumbbell', 'kettlebell'],
      seed: 'SMOKE_MIXED_ALL'
    }
  }
];

async function smokeTest() {
  console.log('🔥 Workout Generator Smoke Test\n');

  for (const { name, payload } of payloads) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 ${name}`);
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
        continue;
      }

      const { workout } = data;

      // Log meta information
      console.log('📊 Meta Information:');
      console.log(`   generator: ${workout.meta?.generator || 'N/A'}`);
      console.log(`   seed: ${workout.meta?.seed || 'N/A'}`);
      console.log(`   name: ${workout.name || 'N/A'}`);
      console.log(`\n🔍 Acceptance Flags:`);
      
      const acceptance = workout.meta?.acceptance || workout.acceptance_flags || {};
      Object.entries(acceptance).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });

      // Log first 10 UI sets
      console.log(`\n📝 First 10 UI Sets:`);
      const first10 = workout.sets.slice(0, 10);
      
      first10.forEach((set, idx) => {
        const parts = [];
        parts.push(`${idx + 1}. ${set.exercise}`);
        
        if (set.reps) parts.push(`reps: ${set.reps}`);
        if (set.duration) parts.push(`duration: ${set.duration}s`);
        if (set.notes) parts.push(`notes: ${set.notes.substring(0, 40)}${set.notes.length > 40 ? '...' : ''}`);
        
        console.log(`   ${parts.join(' | ')}`);
      });

      // Check for data quality issues
      console.log(`\n✅ Quality Checks:`);
      
      // Check for invented data like "Bird Dog x 270s"
      const hasInventedData = workout.sets.some(set => {
        const exerciseLower = (set.exercise || '').toLowerCase();
        const hasTimeSuffix = /\d+s$/.test(set.exercise || '');
        return hasTimeSuffix && !['warm-up', 'cool-down'].includes(exerciseLower);
      });
      
      if (hasInventedData) {
        console.log('   ⚠️  WARNING: Found potential invented data in exercise names');
      } else {
        console.log('   ✓ No invented data in exercise names');
      }

      // Check variety score
      if (workout.variety_score !== undefined) {
        console.log(`   ✓ Variety score: ${workout.variety_score.toFixed(2)}`);
      }

      // Check total sets
      console.log(`   ✓ Total sets: ${workout.sets.length}`);

    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ Smoke test complete\n');
}

smokeTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
