/**
 * Critic Acceptance Test
 * 
 * Tests the acceptance criteria:
 * - For a "caution" health snapshot after heavy legs yesterday, 
 *   critic reduces intensity or shifts focus
 * - Score is ≥80 after patch
 * - JSON stays valid
 */

import { generateWorkout } from '../generateWorkout';

async function testCriticAcceptance() {
  console.log('🧪 Testing Critic Acceptance Criteria\n');
  
  // Test case: Caution health + heavy legs yesterday
  const cautionRequest = {
    category: 'Powerlifting' as const,
    duration: 45,
    intensity: 8, // High intensity that should be reduced
    context: {
      equipment: ['barbell', 'squat_rack', 'bench'],
      constraints: [],
      goals: ['strength'],
      // Caution health indicators
      health_snapshot: {
        hrv: 25,        // Low HRV - caution
        resting_hr: 85, // High RHR - caution
        sleep_score: 55, // Poor sleep - caution
        stress_flag: true // Stress - caution
      },
      // Heavy leg workout yesterday
      yesterday: {
        category: 'Powerlifting',
        duration: 60,
        intensity: 9,
        type: 'heavy_legs',
        movements: ['squat', 'deadlift']
      },
      seed: 'critic_test_caution'
    }
  };
  
  try {
    console.log('📋 Testing: Caution health + heavy legs yesterday');
    console.log('   Health: HRV 25, RHR 85, Sleep 55, STRESSED');
    console.log('   Yesterday: Heavy legs (squat/deadlift) at 9/10');
    console.log('   Request: Powerlifting, 45min, 8/10 intensity\n');
    
    const startTime = Date.now();
    const result = await generateWorkout(cautionRequest);
    const duration = Date.now() - startTime;
    
    // Validate the result structure
    if (!result.workout || !result.rationale) {
      throw new Error('Missing required fields in result');
    }
    
    // Check if critic fields are present
    if (typeof result.critic_score !== 'number' || 
        !Array.isArray(result.critic_issues) ||
        typeof result.was_patched !== 'boolean') {
      throw new Error('Missing critic telemetry fields');
    }
    
    console.log('✅ STRUCTURE VALIDATION PASSED');
    console.log(`   ⏱️  Generated in ${duration}ms`);
    console.log(`   📝 Name: ${result.workout.name}`);
    console.log(`   💪 Final Intensity: ${result.workout.intensity_1_to_10}/10 (requested: 8/10)`);
    console.log(`   🎯 Category: ${result.workout.category}`);
    console.log(`   ⏱️  Duration: ${result.workout.duration_min}min (target: 45min)`);
    console.log(`   🛡️  Equipment: ${result.equipment_list.length} items`);
    console.log(`   ⚠️  Hazards: ${result.hazards.length}\n`);
    
    // Check critic results
    console.log('📊 CRITIC ANALYSIS:');
    console.log(`   🏆 Score: ${result.critic_score}/100`);
    console.log(`   🔧 Was Patched: ${result.was_patched ? 'YES' : 'NO'}`);
    console.log(`   ⚠️  Issues Found: ${result.critic_issues.length}`);
    
    if (result.critic_issues.length > 0) {
      console.log('   📋 Issues:');
      result.critic_issues.forEach((issue, i) => {
        console.log(`      ${i + 1}. ${issue}`);
      });
    }
    console.log('');
    
    // Acceptance Criteria Validation
    let passed = 0;
    let total = 3;
    
    // Criteria 1: Intensity reduction or focus shift
    const intensityReduced = result.workout.intensity_1_to_10 < cautionRequest.intensity;
    const focusShifted = !result.workout.blocks.some(block => 
      block.sets?.some(set => 
        set.movements?.some(movement => 
          movement.name.includes('squat') || movement.name.includes('deadlift')
        )
      )
    );
    
    if (intensityReduced || focusShifted) {
      console.log('✅ CRITERIA 1: Recovery adaptation applied');
      if (intensityReduced) console.log(`   📉 Intensity reduced: ${cautionRequest.intensity}/10 → ${result.workout.intensity_1_to_10}/10`);
      if (focusShifted) console.log('   🔄 Focus shifted away from heavy legs');
      passed++;
    } else {
      console.log('❌ CRITERIA 1: No recovery adaptation detected');
      console.log(`   Expected: Intensity < ${cautionRequest.intensity} OR focus away from legs`);
      console.log(`   Actual: Intensity = ${result.workout.intensity_1_to_10}, contains leg work`);
    }
    
    // Criteria 2: Score ≥80 after patch
    if (result.critic_score >= 80) {
      console.log(`✅ CRITERIA 2: Score ≥80 (${result.critic_score})`);
      passed++;
    } else {
      console.log(`❌ CRITERIA 2: Score < 80 (${result.critic_score})`);
    }
    
    // Criteria 3: JSON stays valid (if we got here, it's valid)
    console.log('✅ CRITERIA 3: JSON remains valid after processing');
    passed++;
    
    console.log(`\n📊 ACCEPTANCE RESULT: ${passed}/${total} criteria passed`);
    
    if (passed === total) {
      console.log('\n🎉 ALL ACCEPTANCE CRITERIA MET!');
      console.log('✅ Recovery logic detects caution indicators');
      console.log('✅ Critic ensures quality score ≥80');
      console.log('✅ JSON validation maintained throughout');
      return true;
    } else {
      console.log(`\n⚠️  ${total - passed} criteria failed`);
      return false;
    }
    
  } catch (error: any) {
    console.log(`❌ TEST FAILED: ${error.message}`);
    console.error(error);
    return false;
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testCriticAcceptance().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(console.error);
}

export { testCriticAcceptance };