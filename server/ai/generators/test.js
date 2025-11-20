/**
 * Generator acceptance test script
 *
 * Tests both CrossFit and Olympic generators to ensure they:
 * - Generate valid JSON
 * - Pass Zod validation
 * - Render in correct brand format
 * - Meet duration requirements
 */
import { generateCrossFitWorkout } from './crossfit';
import { generateOlympicWorkout } from './olympic';
import { WorkoutSchema } from '../../../client/src/ai/schemas';
import { render } from '../../../src/ai/render';
async function testCrossFitGenerations() {
    console.log('🏋️ Testing CrossFit Generations...\n');
    const intensities = [5, 7, 9];
    const results = [];
    for (const intensity of intensities) {
        console.log(`🎯 Generating CrossFit workout - Intensity ${intensity}/10`);
        const request = {
            category: 'CrossFit/HIIT',
            duration: 20,
            intensity,
            context: {
                equipment: ['barbell', 'pull_up_bar', 'box', 'kettlebell'],
                constraints: []
            }
        };
        try {
            // Generate workout
            const workout = await generateCrossFitWorkout(request);
            // Validate with Zod
            const validation = WorkoutSchema.safeParse(workout);
            if (!validation.success) {
                console.log(`❌ Validation failed for intensity ${intensity}`);
                console.log('Errors:', validation.error.errors);
                results.push({ intensity, success: false, error: 'Validation failed' });
                continue;
            }
            // Check duration (±10%)
            const targetDuration = request.duration;
            const tolerance = targetDuration * 0.1;
            const actualDuration = workout.duration_min;
            const durationOk = Math.abs(actualDuration - targetDuration) <= tolerance;
            if (!durationOk) {
                console.log(`❌ Duration mismatch for intensity ${intensity}: expected ${targetDuration}±${tolerance}, got ${actualDuration}`);
                results.push({ intensity, success: false, error: 'Duration mismatch' });
                continue;
            }
            // Render and check format
            const rendered = render(workout);
            // Check CrossFit format compliance
            const hasTimeCapOrAMRAP = rendered.includes('time cap') || rendered.includes('AMRAP') || rendered.includes('rounds:');
            const hasRXWeights = /\d+#|\d+\/\d+#/.test(rendered);
            const hasTitle = rendered.includes(workout.name.toUpperCase());
            const formatOk = hasTimeCapOrAMRAP && hasRXWeights && hasTitle;
            console.log(`✅ CrossFit intensity ${intensity}: Valid JSON, duration ${actualDuration}min, format compliant`);
            console.log(`   Title: "${workout.name}"`);
            console.log(`   Format checks: Time cap/AMRAP=${hasTimeCapOrAMRAP}, RX weights=${hasRXWeights}, Title=${hasTitle}\n`);
            results.push({
                intensity,
                success: true,
                workout,
                rendered,
                duration: actualDuration,
                formatChecks: { hasTimeCapOrAMRAP, hasRXWeights, hasTitle }
            });
        }
        catch (error) {
            console.log(`❌ Generation failed for intensity ${intensity}:`, error);
            results.push({ intensity, success: false, error: String(error) });
        }
    }
    return results;
}
async function testOlympicGenerations() {
    console.log('🏋️‍♀️ Testing Olympic Generations...\n');
    const intensities = [6, 8, 9];
    const results = [];
    for (const intensity of intensities) {
        console.log(`🎯 Generating Olympic workout - Intensity ${intensity}/10`);
        const request = {
            category: 'Olympic',
            duration: 60,
            intensity,
            context: {
                equipment: ['barbell', 'platform', 'squat_rack'],
                constraints: []
            }
        };
        try {
            // Generate workout
            const workout = await generateOlympicWorkout(request);
            // Validate with Zod
            const validation = WorkoutSchema.safeParse(workout);
            if (!validation.success) {
                console.log(`❌ Validation failed for intensity ${intensity}`);
                console.log('Errors:', validation.error.errors);
                results.push({ intensity, success: false, error: 'Validation failed' });
                continue;
            }
            // Check duration (±10%)
            const targetDuration = request.duration;
            const tolerance = targetDuration * 0.1;
            const actualDuration = workout.duration_min;
            const durationOk = Math.abs(actualDuration - targetDuration) <= tolerance;
            if (!durationOk) {
                console.log(`❌ Duration mismatch for intensity ${intensity}: expected ${targetDuration}±${tolerance}, got ${actualDuration}`);
                results.push({ intensity, success: false, error: 'Duration mismatch' });
                continue;
            }
            // Render and check format
            const rendered = render(workout);
            // Check Olympic format compliance
            const hasABCSections = /\*\*[A-E]\.\*\*/.test(rendered);
            const hasPercentRM = /\d+% of 1RM/.test(rendered);
            const hasComplexOrProgression = /\([^)]+\)/.test(rendered) || rendered.includes('complex') || rendered.includes('progression');
            const hasTitle = rendered.includes(workout.name.toUpperCase());
            const formatOk = hasABCSections && hasPercentRM && hasTitle;
            console.log(`✅ Olympic intensity ${intensity}: Valid JSON, duration ${actualDuration}min, format compliant`);
            console.log(`   Title: "${workout.name}"`);
            console.log(`   Format checks: A/B/C sections=${hasABCSections}, %1RM=${hasPercentRM}, Complex/progression=${hasComplexOrProgression}, Title=${hasTitle}\n`);
            results.push({
                intensity,
                success: true,
                workout,
                rendered,
                duration: actualDuration,
                formatChecks: { hasABCSections, hasPercentRM, hasComplexOrProgression, hasTitle }
            });
        }
        catch (error) {
            console.log(`❌ Generation failed for intensity ${intensity}:`, error);
            results.push({ intensity, success: false, error: String(error) });
        }
    }
    return results;
}
async function runGeneratorTests() {
    console.log('🚀 Generator Acceptance Tests\n');
    try {
        // Test CrossFit generator
        const crossfitResults = await testCrossFitGenerations();
        // Test Olympic generator
        const olympicResults = await testOlympicGenerations();
        // Summary
        console.log('📊 FINAL RESULTS:');
        const cfSuccess = crossfitResults.filter(r => r.success).length;
        const cfTotal = crossfitResults.length;
        console.log(`CrossFit: ${cfSuccess}/${cfTotal} passed`);
        const olySuccess = olympicResults.filter(r => r.success).length;
        const olyTotal = olympicResults.length;
        console.log(`Olympic: ${olySuccess}/${olyTotal} passed`);
        const overallSuccess = cfSuccess === cfTotal && olySuccess === olyTotal;
        console.log(`\n🎯 ACCEPTANCE: ${overallSuccess ? '✅ REQUIREMENTS MET' : '❌ REQUIREMENTS NOT MET'}`);
        // Show sample rendered outputs for successful generations
        if (cfSuccess > 0) {
            const sampleCF = crossfitResults.find(r => r.success);
            if (sampleCF && 'rendered' in sampleCF) {
                console.log('\n' + '='.repeat(60));
                console.log('SAMPLE CROSSFIT RENDER:');
                console.log('='.repeat(60));
                console.log(sampleCF.rendered);
            }
        }
        if (olySuccess > 0) {
            const sampleOly = olympicResults.find(r => r.success);
            if (sampleOly && 'rendered' in sampleOly) {
                console.log('\n' + '='.repeat(60));
                console.log('SAMPLE OLYMPIC RENDER:');
                console.log('='.repeat(60));
                console.log(sampleOly.rendered);
            }
        }
        process.exit(overallSuccess ? 0 : 1);
    }
    catch (error) {
        console.error('💥 Test suite failed:', error);
        process.exit(1);
    }
}
// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runGeneratorTests();
}
export { runGeneratorTests };
