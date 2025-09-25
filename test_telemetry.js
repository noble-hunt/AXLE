#!/usr/bin/env node

// Test script to verify telemetry system works end-to-end
// This script tests both generation and feedback telemetry logging

import { storage } from './server/storage.js';
import { logGenerationEvent, logFeedbackEvent, extractMetricsSnapshot } from './server/workouts/telemetry.js';

async function testTelemetrySystem() {
  console.log('🧪 Testing Telemetry System End-to-End\n');
  
  try {
    // Test 1: Verify storage interface works
    console.log('1. Testing storage interface...');
    const initialStats = await storage.getWorkoutEventStats();
    console.log('   Initial stats:', initialStats);
    
    // Test 2: Log a generation event
    console.log('\n2. Testing generation event logging...');
    const testUserId = 'test-user-123';
    const testGenerationId = 'gen-test-456';
    
    const generationEventData = {
      selectedFocus: 'Strength Upper',
      targetIntensity: 8,
      blockIds: ['block-1', 'block-2'],
      estimatedTSS: 45,
      metricsSnapshot: {
        vitality: 85,
        performance: 75,
        circadian: 90,
        balance: 70
      },
      workoutRequest: {
        category: 'CrossFit',
        duration: 45,
        intensity: 8,
        equipment: ['barbell', 'dumbbells']
      }
    };
    
    await logGenerationEvent(testUserId, generationEventData, 150, testGenerationId);
    console.log('   ✅ Generation event logged successfully');
    
    // Test 3: Log feedback events
    console.log('\n3. Testing feedback event logging...');
    const testWorkoutId = 'workout-test-789';
    
    const feedbackEventData = {
      feedbackType: 'difficulty',
      difficultyRating: 'moderate',
      rpe: 7,
      completionPercentage: 95,
      comments: 'Great workout, felt challenging but doable'
    };
    
    await logFeedbackEvent(testUserId, testWorkoutId, testGenerationId, feedbackEventData);
    console.log('   ✅ Feedback event logged successfully');
    
    // Test 4: Verify events were saved
    console.log('\n4. Verifying events in database...');
    const finalStats = await storage.getWorkoutEventStats();
    console.log('   Final stats:', finalStats);
    
    const allEvents = await storage.getWorkoutEvents();
    console.log('   Total events stored:', allEvents.length);
    
    if (allEvents.length > 0) {
      console.log('   Sample event:', {
        id: allEvents[0].id,
        event: allEvents[0].event,
        userId: allEvents[0].userId,
        generationId: allEvents[0].generationId,
        createdAt: allEvents[0].createdAt
      });
    }
    
    // Test 5: Verify metrics extraction
    console.log('\n5. Testing metrics extraction...');
    const testMetrics = extractMetricsSnapshot({
      vitality: 80,
      performancePotential: 70,
      circadianAlignment: 85,
      fatigueScore: 25
    });
    console.log('   Extracted metrics:', testMetrics);
    
    console.log('\n🎉 All telemetry tests passed!');
    console.log('\n📊 Summary:');
    console.log(`   - Generation events: ${finalStats.totalGenerationEvents}`);
    console.log(`   - Feedback events: ${finalStats.totalFeedbackEvents}`);
    console.log(`   - Total events: ${allEvents.length}`);
    
  } catch (error) {
    console.error('❌ Telemetry test failed:', error);
    process.exit(1);
  }
}

// Run the test
testTelemetrySystem();