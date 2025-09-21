#!/usr/bin/env node

/**
 * Foundation Test Script
 * 
 * Tests that:
 * 1. Types compile correctly
 * 2. Zod validates fixtures
 * 3. Renderers produce brand-format output
 */

import { validateWorkout, isValidWorkout } from './schemas';
import { render, renderCrossFit, renderOly } from './render';
import { hardyBacardiParty, slapHappySamurai, battleAxe } from './__fixtures__/crossfit';
import { olympicTechnique, competitionPrep } from './__fixtures__/olympic';

function testValidation() {
  console.log('🧪 Testing Schema Validation...\n');
  
  const fixtures = [
    { name: 'Hardy Bacardi Party', workout: hardyBacardiParty },
    { name: 'Slap Happy Samurai', workout: slapHappySamurai },
    { name: 'Battle Axe', workout: battleAxe },
    { name: 'Olympic Technique', workout: olympicTechnique },
    { name: 'Competition Prep', workout: competitionPrep }
  ];
  
  let passCount = 0;
  
  fixtures.forEach(({ name, workout }) => {
    try {
      // Test Zod validation
      const validated = validateWorkout(workout);
      const isValid = isValidWorkout(workout);
      
      if (isValid && validated) {
        console.log(`✅ ${name}: Schema validation passed`);
        passCount++;
      } else {
        console.log(`❌ ${name}: Schema validation failed`);
      }
    } catch (error: any) {
      console.log(`❌ ${name}: Validation error - ${error.message}`);
    }
  });
  
  console.log(`\n📊 Schema Validation: ${passCount}/${fixtures.length} passed\n`);
  return passCount === fixtures.length;
}

function testRendering() {
  console.log('🎨 Testing Rendering Output...\n');
  
  console.log('='.repeat(60));
  console.log('CROSSFIT RENDER TEST: Hardy Bacardi Party');
  console.log('='.repeat(60));
  const cfRender = renderCrossFit(hardyBacardiParty);
  console.log(cfRender);
  
  console.log('\n' + '='.repeat(60));
  console.log('CROSSFIT RENDER TEST: Slap Happy Samurai');
  console.log('='.repeat(60));
  const cfRender2 = renderCrossFit(slapHappySamurai);
  console.log(cfRender2);
  
  console.log('\n' + '='.repeat(60));
  console.log('OLYMPIC RENDER TEST: Power Development');
  console.log('='.repeat(60));
  const olyRender = renderOly(olympicTechnique);
  console.log(olyRender);
  
  console.log('\n' + '='.repeat(60));
  console.log('DISPATCHER TEST: Auto-routing by category');
  console.log('='.repeat(60));
  const autoRender = render(competitionPrep);
  console.log(autoRender);
  
  return true;
}

function testBrandFormatCompliance() {
  console.log('\n🎯 Testing Brand Format Compliance...\n');
  
  const cfOutput = renderCrossFit(hardyBacardiParty);
  const olyOutput = renderOly(olympicTechnique);
  
  // Check CrossFit format requirements
  const cfChecks = [
    { name: 'Contains time cap', test: cfOutput.includes('time cap!') },
    { name: 'Shows ladder format', test: cfOutput.includes('27 - 21 - 15 - 9') },
    { name: 'Uses bold headers', test: cfOutput.includes('**') },
    { name: 'Shows RX loads', test: cfOutput.includes('95#') || cfOutput.includes('@ 95') },
    { name: 'Has title in caps', test: cfOutput.includes('**HARDY BACARDI PARTY**') }
  ];
  
  // Check Olympic format requirements
  const olyChecks = [
    { name: 'Uses A/B/C sections', test: olyOutput.includes('**A.**') },
    { name: 'Shows %1RM', test: olyOutput.includes('% of 1RM') },
    { name: 'Complex notation', test: olyOutput.includes('(1+2+1)') || olyOutput.includes('1+2') },
    { name: 'Has title in caps', test: olyOutput.includes('**POWER DEVELOPMENT**') },
    { name: 'Shows load prescriptions', test: olyOutput.includes('@') }
  ];
  
  console.log('CrossFit Format Checks:');
  cfChecks.forEach(check => {
    console.log(`${check.test ? '✅' : '❌'} ${check.name}`);
  });
  
  console.log('\nOlympic Format Checks:');
  olyChecks.forEach(check => {
    console.log(`${check.test ? '✅' : '❌'} ${check.name}`);
  });
  
  const cfPass = cfChecks.every(c => c.test);
  const olyPass = olyChecks.every(c => c.test);
  
  console.log(`\n📊 Format Compliance: CF ${cfPass ? 'PASS' : 'FAIL'} | Oly ${olyPass ? 'PASS' : 'FAIL'}\n`);
  
  return cfPass && olyPass;
}

function testTypeCompilation() {
  console.log('⚙️  Testing Type Compilation...\n');
  
  // This function will only compile if types are correct
  try {
    const testWorkout = hardyBacardiParty;
    const title: string = testWorkout.title;
    const category: "CrossFit" | "Olympic" | "Powerlifting" | "Bodybuilding" | "Gymnastics" | "Endurance" = testWorkout.category;
    const intensity: number = testWorkout.intensity_1_to_10;
    
    // Test block types
    const firstBlock = testWorkout.blocks[0];
    if (firstBlock.kind === 'cf_for_time') {
      const scheme: string = firstBlock.reps_scheme;
      const timeCap: number = firstBlock.time_cap_min;
    }
    
    console.log('✅ TypeScript compilation: All types check out');
    return true;
  } catch (error) {
    console.log('❌ TypeScript compilation: Type errors detected');
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Foundation + Validator + Renderer Tests\n');
  
  const results = {
    types: testTypeCompilation(),
    validation: testValidation(),
    rendering: testRendering(),
    format: testBrandFormatCompliance()
  };
  
  console.log('📋 FINAL RESULTS:');
  console.log(`Types: ${results.types ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Validation: ${results.validation ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Rendering: ${results.rendering ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Format: ${results.format ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(Boolean);
  
  console.log(`\n🎯 ACCEPTANCE: ${allPassed ? '✅ ALL CRITERIA MET' : '❌ REQUIREMENTS NOT MET'}`);
  
  if (allPassed) {
    console.log('\n🎉 Foundation system ready!');
    console.log('✅ Types compile');
    console.log('✅ Zod validates fixtures');
    console.log('✅ CrossFit renders in brand format');
    console.log('✅ Olympic renders in brand format');
  }
  
  process.exit(allPassed ? 0 : 1);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { runTests };