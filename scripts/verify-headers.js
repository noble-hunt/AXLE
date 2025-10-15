#!/usr/bin/env node

const API_BASE = process.env.VITE_API_BASE_URL || 'http://localhost:5000';

async function verifyHeaders() {
  console.log('🔍 Verifying Premium Generator Headers\n');
  console.log('Testing /api/workouts/simulate endpoint...\n');

  try {
    const response = await fetch(`${API_BASE}/api/workouts/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: 'crossfit',
        equipment: ['barbell', 'dumbbell'],
        durationMin: 45,
        intensity: 8,
        seed: 'VERIFY-TEST'
      })
    });

    console.log('📊 Response Status:', response.status, response.statusText);
    console.log('\n📋 Response Headers:');
    
    const generator = response.headers.get('X-AXLE-Generator');
    const style = response.headers.get('X-AXLE-Style');
    
    console.log(`   X-AXLE-Generator: ${generator || 'NOT SET'}`);
    console.log(`   X-AXLE-Style: ${style || 'NOT SET'}`);
    
    const data = await response.json();
    
    console.log('\n💡 Workout Meta:');
    console.log(`   meta.generator: ${data.workout?.meta?.generator || 'N/A'}`);
    console.log(`   meta.style: ${data.workout?.meta?.style || 'N/A'}`);
    
    console.log('\n✅ Environment Variables Status:');
    console.log(`   AXLE_DISABLE_SIMPLE: ${process.env.AXLE_DISABLE_SIMPLE || 'NOT SET'}`);
    console.log(`   HOBH_FORCE_PREMIUM: ${process.env.HOBH_FORCE_PREMIUM || 'NOT SET'}`);
    console.log(`   DEBUG_PREMIUM_STAMP: ${process.env.DEBUG_PREMIUM_STAMP || 'NOT SET'}`);
    
    console.log('\n🎯 Verification:');
    if (generator === 'premium') {
      console.log('   ✅ Headers show PREMIUM generator');
    } else if (generator) {
      console.log(`   ⚠️  Headers show ${generator.toUpperCase()} generator (expected PREMIUM)`);
    } else {
      console.log('   ❌ Headers NOT SET (make sure DEBUG_PREMIUM_STAMP=1)');
    }
    
    if (data.workout?.meta?.generator === 'premium') {
      console.log('   ✅ Workout meta confirms PREMIUM generator');
    } else {
      console.log(`   ⚠️  Workout meta shows ${data.workout?.meta?.generator || 'UNKNOWN'} generator`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyHeaders().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
