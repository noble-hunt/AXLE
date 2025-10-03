#!/usr/bin/env node

const API_BASE = process.env.VITE_API_BASE_URL || 'http://localhost:5000';

const cases = [
  { goal: 'crossfit', equipment: ['barbell', 'dumbbell', 'bike'], durationMin: 45 },
  { goal: 'olympic_weightlifting', equipment: ['barbell'], durationMin: 45 },
  { goal: 'powerlifting', equipment: ['barbell'], durationMin: 45 },
  { goal: 'bb_upper', equipment: ['dumbbell', 'barbell'], durationMin: 45 },
  { goal: 'aerobic', equipment: ['bike', 'rower'], durationMin: 30 },
  { goal: 'gymnastics', equipment: ['pullup-bar'], durationMin: 30 },
  { goal: 'mobility', equipment: ['bodyweight'], durationMin: 30 }
];

async function smokeTestStyles() {
  console.log('🔥 Style-Aware Generator Smoke Test\n');

  for (const testCase of cases) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 Testing: ${testCase.goal.toUpperCase()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
      const response = await fetch(`${API_BASE}/api/workouts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...testCase,
          intensity: 8,
          seed: 'STYLE'
        })
      });

      if (!response.ok) {
        console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
        continue;
      }

      const data = await response.json();

      if (!data.ok) {
        console.error('❌ Failed:', data.error || 'Unknown error');
        continue;
      }

      const workout = data.workout;

      console.log('\n📊 Meta:');
      console.log(`   generator: ${workout.meta?.generator || 'N/A'}`);
      console.log(`   hardness: ${workout.variety_score?.toFixed(2) || data.variety_score?.toFixed(2) || 'N/A'}`);
      console.log(`   title: ${workout.name || data.title || 'N/A'}`);

      console.log('\n📝 First 6 Exercises:');
      const exercises = workout.sets || [];
      exercises.slice(0, 6).forEach((set, idx) => {
        console.log(`   ${idx + 1}. ${set.exercise}`);
      });

      console.log('\n🔍 Acceptance:');
      const acceptance = workout.meta?.acceptance || workout.acceptance_flags || data.acceptance_flags || {};
      const flags = Object.entries(acceptance)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      console.log(`   ${flags || 'N/A'}`);

      // Verify style-specific patterns
      const allText = JSON.stringify(exercises).toLowerCase();
      let styleCheck = '';
      
      switch (testCase.goal) {
        case 'crossfit':
          styleCheck = /emom|amrap|e[234]:00|every [234]:00/.test(allText) ? '✅ CF patterns' : '⚠️ No CF patterns';
          break;
        case 'olympic_weightlifting':
          styleCheck = /snatch|clean.*jerk|c&j/.test(allText) ? '✅ Olympic lifts' : '⚠️ No Olympic lifts';
          break;
        case 'powerlifting':
          styleCheck = /squat|deadlift|bench/.test(allText) ? '✅ Powerlifts' : '⚠️ No powerlifts';
          break;
        case 'bb_upper':
          styleCheck = /press|row|curl|tricep/.test(allText) ? '✅ Upper body' : '⚠️ No upper body';
          break;
        case 'aerobic':
          styleCheck = /bike|row|ski|z[234]/.test(allText) ? '✅ Cardio' : '⚠️ No cardio';
          break;
        case 'gymnastics':
          styleCheck = /handstand|pull.*up|toes.*to.*bar|l.*sit/.test(allText) ? '✅ Gymnastics' : '⚠️ No gymnastics';
          break;
        case 'mobility':
          styleCheck = /stretch|mobility|breathing|pnf/.test(allText) ? '✅ Mobility' : '⚠️ No mobility';
          break;
      }
      
      console.log(`\n${styleCheck}`);

    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ Style smoke test complete\n');
}

smokeTestStyles().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
