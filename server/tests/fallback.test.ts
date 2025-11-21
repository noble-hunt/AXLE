/**
 * Manual test for generator fallback system
 * 
 * Run this script to verify that when v0.3 generator fails, the system gracefully
 * falls back to v0.2 generator without blocking users.
 * 
 * Usage: node -r tsx/cjs server/tests/fallback.test.ts
 */

import { generateWithFallback } from '../lib/generator/generate.js';

async function testFallbackSystem() {
  console.log('🧪 Testing Generator Fallback System\n');

  // Set environment variables for testing
  process.env.GENERATOR_VERSION_DEFAULT = 'v0.3.0';
  process.env.GENERATOR_FALLBACK = 'v0.2.5';
  process.env.GENERATOR_ALLOW_FALLBACK = 'true';

  const mockSeed = {
    category: 'CrossFit' as any,
    duration: 30,
    intensity: 5,
    equipment: ['bodyweight'],
    constraints: []
  };

  const mockOpts = {
    request: {
      category: 'CrossFit' as any,
      duration: 30,
      intensity: 5,
      equipment: ['bodyweight'],
      constraints: []
    }
  };

  console.log('Test 1: Normal operation (should work with current setup)');
  try {
    const result = await generateWithFallback(mockSeed, mockOpts);
    console.log('✅ Generator returned result:', {
      name: result?.name || 'N/A',
      duration: result?.duration || 'N/A',
      setsCount: result?.sets?.length || 0
    });
  } catch (error) {
    console.log('❌ Generator failed:', (error as Error).message);
  }

  console.log('\nTest 2: Fallback disabled (GENERATOR_ALLOW_FALLBACK=false)');
  process.env.GENERATOR_ALLOW_FALLBACK = 'false';
  try {
    const result = await generateWithFallback(mockSeed, mockOpts);
    console.log('✅ Generator returned result despite fallback disabled');
  } catch (error) {
    console.log('⚠️  Generator threw error (expected when fallback disabled and v0.3 fails):', (error as Error).message);
  }

  console.log('\nTest 3: Direct v0.2 usage (GENERATOR_VERSION_DEFAULT=v0.2.5)');
  process.env.GENERATOR_VERSION_DEFAULT = 'v0.2.5';
  process.env.GENERATOR_ALLOW_FALLBACK = 'true';
  try {
    const result = await generateWithFallback(mockSeed, mockOpts);
    console.log('✅ v0.2 Generator returned result:', {
      name: result?.name || 'N/A',
      duration: result?.duration || 'N/A',
      setsCount: result?.sets?.length || 0
    });
  } catch (error) {
    console.log('❌ v0.2 Generator failed:', (error as Error).message);
  }

  console.log('\n🏁 Fallback system test completed');
  
  // Clean up environment variables
  delete process.env.GENERATOR_VERSION_DEFAULT;
  delete process.env.GENERATOR_FALLBACK;
  delete process.env.GENERATOR_ALLOW_FALLBACK;
}

// Run the test if this file is executed directly
if (require.main === module) {
  testFallbackSystem().catch(console.error);
}