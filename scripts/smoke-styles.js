#!/usr/bin/env node

const API_BASE = process.env.VITE_API_BASE_URL || 'http://localhost:5000';

const cases = [
  { goal: 'crossfit', equipment: ['barbell', 'dumbbell', 'bike'], durationMin: 45 },
  { goal: 'olympic_weightlifting', equipment: ['barbell'], durationMin: 45 },
  { goal: 'powerlifting', equipment: ['barbell'], durationMin: 45 },
  { goal: 'bb_full_body', equipment: ['dumbbell', 'barbell'], durationMin: 45 },
  { goal: 'bb_upper', equipment: ['dumbbell', 'barbell'], durationMin: 45 },
  { goal: 'bb_lower', equipment: ['barbell', 'dumbbell'], durationMin: 45 },
  { goal: 'aerobic', equipment: ['bike', 'rower'], durationMin: 30 },
  { goal: 'gymnastics', equipment: ['pullup-bar'], durationMin: 30 },
  { goal: 'mobility', equipment: ['bodyweight'], durationMin: 30 }
];

// Style-specific policy expectations
const POLICY_EXPECTATIONS = {
  olympic_weightlifting: {
    minLoadedRatio: 0.85,
    requiredPatterns: ['snatch', 'clean.*jerk', 'c&j'],
    bannedNames: [/db snatch/i, /thruster/i, /bear crawl/i, /star jump/i, /burpee/i, /mountain climber/i]
  },
  powerlifting: {
    minLoadedRatio: 0.85,
    requiredPatterns: ['squat', 'deadlift', 'bench'],
    bannedNames: [/thruster/i, /burpee/i, /double under/i]
  },
  crossfit: {
    minLoadedRatio: 0.60,
    requiredPatterns: ['emom', 'amrap', 'e[234]:00', 'every [234]:00'],
    bannedNames: [/wall sit/i, /star jump/i, /high knees/i, /jumping jacks/i]
  },
  bb_full_body: {
    minLoadedRatio: 0.70,
    requiredPatterns: ['squat', 'press', 'row', 'deadlift']
  },
  bb_upper: {
    minLoadedRatio: 0.70,
    requiredPatterns: ['press', 'row', 'curl', 'tricep']
  },
  bb_lower: {
    minLoadedRatio: 0.70,
    requiredPatterns: ['squat', 'deadlift', 'lunge', 'leg']
  },
  aerobic: {
    requiredPatterns: ['bike', 'row', 'ski', 'z[234]', 'steady']
  },
  gymnastics: {
    requiredPatterns: ['handstand', 'pull.*up', 'toes.*to.*bar', 'l.*sit', 'muscle.*up']
  },
  mobility: {
    requiredPatterns: ['stretch', 'mobility', 'breathing', 'pnf']
  }
};

function checkTimeFit(workout, expectedDuration) {
  const actualDuration = workout.duration || workout.duration_min || 0;
  const tolerance = Math.max(2, expectedDuration * 0.05);
  const isOk = Math.abs(actualDuration - expectedDuration) <= tolerance;
  return {
    ok: isOk,
    message: isOk 
      ? `✅ time_fit: ${actualDuration}min (target: ${expectedDuration}min)`
      : `❌ time_fit: ${actualDuration}min (target: ${expectedDuration}min, tolerance: ±${tolerance.toFixed(1)}min)`
  };
}

function checkStyleOk(workout) {
  const acceptance = workout.meta?.acceptance || workout.acceptance_flags || {};
  const isOk = acceptance.style_ok === true;
  return {
    ok: isOk,
    message: isOk 
      ? '✅ style_ok: true'
      : `❌ style_ok: ${acceptance.style_ok || 'undefined'}`
  };
}

function checkLoadedRatio(workout, policy) {
  if (!policy.minLoadedRatio) {
    return { ok: true, message: '⏭️  loaded_ratio: not required' };
  }

  const actualRatio = workout.meta?.main_loaded_ratio || 0;
  const isOk = actualRatio >= policy.minLoadedRatio;
  return {
    ok: isOk,
    message: isOk
      ? `✅ loaded_ratio: ${(actualRatio * 100).toFixed(0)}% (min: ${(policy.minLoadedRatio * 100).toFixed(0)}%)`
      : `❌ loaded_ratio: ${(actualRatio * 100).toFixed(0)}% (min: ${(policy.minLoadedRatio * 100).toFixed(0)}%)`
  };
}

function checkRequiredPatterns(workout, policy) {
  if (!policy.requiredPatterns || policy.requiredPatterns.length === 0) {
    return { ok: true, message: '⏭️  required_patterns: none' };
  }

  const allText = JSON.stringify(workout.sets || []).toLowerCase();
  const found = policy.requiredPatterns.filter(pattern => 
    new RegExp(pattern, 'i').test(allText)
  );

  const isOk = found.length > 0;
  return {
    ok: isOk,
    message: isOk
      ? `✅ required_patterns: found [${found.join(', ')}]`
      : `❌ required_patterns: none found (expected one of: ${policy.requiredPatterns.join(', ')})`
  };
}

function checkBannedNames(workout, policy) {
  if (!policy.bannedNames || policy.bannedNames.length === 0) {
    return { ok: true, message: '⏭️  banned_names: none' };
  }

  const exercises = (workout.sets || []).map(s => s.exercise || '');
  const violations = [];

  for (const exercise of exercises) {
    for (const bannedRegex of policy.bannedNames) {
      if (bannedRegex.test(exercise)) {
        violations.push(exercise);
        break;
      }
    }
  }

  const isOk = violations.length === 0;
  return {
    ok: isOk,
    message: isOk
      ? '✅ banned_names: none found'
      : `❌ banned_names: found [${violations.join(', ')}]`
  };
}

async function smokeTestStyles() {
  console.log('🔥 Style Policy Smoke Test (CI-Friendly)\n');

  let allPassed = true;

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
          seed: 'SMOKE-TEST'
        })
      });

      if (!response.ok) {
        console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
        allPassed = false;
        continue;
      }

      const data = await response.json();

      if (!data.ok) {
        console.error('❌ Failed:', data.error || 'Unknown error');
        allPassed = false;
        continue;
      }

      const workout = data.workout;
      const policy = POLICY_EXPECTATIONS[testCase.goal];

      console.log('\n📊 Meta:');
      console.log(`   generator: ${workout.meta?.generator || 'N/A'}`);
      console.log(`   style: ${workout.meta?.style || 'N/A'}`);
      console.log(`   seed: ${workout.meta?.seed || 'N/A'}`);
      console.log(`   hardness: ${workout.variety_score?.toFixed(2) || data.variety_score?.toFixed(2) || 'N/A'}`);
      console.log(`   title: ${workout.name || data.title || 'N/A'}`);

      console.log('\n📝 First 10 Exercises:');
      const exercises = workout.sets || [];
      exercises.slice(0, 10).forEach((set, idx) => {
        console.log(`   ${idx + 1}. ${set.exercise}`);
      });

      // Run all policy checks
      console.log('\n🔍 Policy Checks:');
      
      const checks = [
        checkTimeFit(workout, testCase.durationMin),
        checkStyleOk(workout),
        checkLoadedRatio(workout, policy),
        checkRequiredPatterns(workout, policy),
        checkBannedNames(workout, policy)
      ];

      checks.forEach(check => console.log(`   ${check.message}`));

      // Check if all passed
      const testPassed = checks.every(check => check.ok);
      
      if (!testPassed) {
        console.log(`\n❌ ${testCase.goal.toUpperCase()} FAILED POLICY CHECKS`);
        allPassed = false;
      } else {
        console.log(`\n✅ ${testCase.goal.toUpperCase()} PASSED`);
      }

    } catch (error) {
      console.error('❌ Error:', error.message);
      allPassed = false;
    }
  }

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (allPassed) {
    console.log('✨ All style tests PASSED\n');
    process.exit(0);
  } else {
    console.log('💥 Some style tests FAILED\n');
    process.exit(1);
  }
}

smokeTestStyles().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
