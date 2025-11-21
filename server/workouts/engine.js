/**
 * Workout Generation Engine
 *
 * Deterministically assembles workouts with progression, safety guardrails,
 * and biometric-driven adaptation.
 */
import { getBlocks } from './library/index.js';
// Main engine function
export function generateWorkoutPlan(request, history = [], progressionStates = [], biometrics = {}, energySystemsHistory) {
    const rationale = [];
    // 1. Determine workout focus (with energy systems balancing)
    const focus = determineFocus(request, history, biometrics, rationale, energySystemsHistory);
    // 2. Calculate target intensity
    const targetIntensity = calculateTargetIntensity(biometrics, history, rationale);
    // 3. Apply safety guardrails
    const safetyAdjustments = applySafetyGuardrails(focus, targetIntensity, biometrics, rationale);
    const adjustedFocus = safetyAdjustments.focus || focus;
    const adjustedIntensity = safetyAdjustments.intensity || targetIntensity;
    // 4. Compose workout blocks (with circadian adjustments)
    const selectedBlocks = composeWorkout(adjustedFocus, adjustedIntensity, request, history, rationale);
    // 5. Apply progression
    const blocksWithProgression = applyProgression(selectedBlocks, progressionStates, rationale);
    // 6. Convert to expected focus format
    const workoutFocus = convertToExistingFocus(adjustedFocus);
    // 7. Build final workout plan
    const workoutPlan = {
        focus: workoutFocus,
        targetIntensity: adjustedIntensity,
        targetRPE: {
            min: Math.max(1, adjustedIntensity - 1),
            max: Math.min(10, adjustedIntensity + 1),
            target: adjustedIntensity
        },
        blocks: blocksWithProgression,
        estimatedCalories: estimateCalories(blocksWithProgression, adjustedIntensity),
        estimatedTSS: estimateTSS(blocksWithProgression, adjustedIntensity),
        rationale: rationale.map(r => `${r.step}: ${r.decision} (${r.factors.join(', ')})`)
    };
    return workoutPlan;
}
// Focus determination based on goals, scheduling, and biometrics
function determineFocus(request, history, biometrics, rationale, energySystemsHistory) {
    const factors = [];
    let primary = 'conditioning';
    let energySystem = 'aerobicZ2';
    let movementPattern = 'squat';
    // Analyze recent history (last 7 days)
    const recentHistory = history.filter(h => new Date(h.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    // Check for 48h pattern avoidance
    const last48h = history.filter(h => new Date(h.date) > new Date(Date.now() - 2 * 24 * 60 * 60 * 1000));
    const recentPatterns = last48h.map(h => h.primaryPattern);
    // Biometric-driven decisions
    const performancePotential = biometrics.performancePotential || 50;
    const vitality = biometrics.vitality || 50;
    const sleepScore = biometrics.sleepScore || 70;
    if (performancePotential >= 70 && vitality >= 60) {
        primary = 'strength';
        energySystem = 'phosphocreatine';
        factors.push(`High performance potential (${performancePotential}) and vitality (${vitality})`);
    }
    else if (vitality < 40 || sleepScore < 60) {
        primary = 'recovery';
        energySystem = 'aerobicZ2';
        factors.push(`Low vitality (${vitality}) or poor sleep (${sleepScore})`);
    }
    else {
        // Default to conditioning
        primary = 'conditioning';
        energySystem = 'glycolytic';
        factors.push('Moderate biometrics, defaulting to conditioning');
    }
    // Movement pattern selection based on history
    const movementPatterns = ['squat', 'hinge', 'push', 'pull'];
    const patternCounts = movementPatterns.map(pattern => ({
        pattern,
        count: recentHistory.filter(h => h.primaryPattern === pattern).length
    }));
    // Select least used pattern, avoiding 48h repeats
    const availablePatterns = movementPatterns.filter(p => !recentPatterns.includes(p));
    if (availablePatterns.length > 0) {
        const leastUsed = patternCounts
            .filter(pc => availablePatterns.includes(pc.pattern))
            .sort((a, b) => a.count - b.count)[0];
        movementPattern = leastUsed.pattern;
        factors.push(`Selected ${movementPattern} (least used, no 48h conflict)`);
    }
    else {
        // All patterns used recently, pick least used overall
        movementPattern = patternCounts.sort((a, b) => a.count - b.count)[0].pattern;
        factors.push(`Selected ${movementPattern} (least used overall)`);
    }
    // Energy system balance over 7 days
    let energySystemCounts;
    // Use external AXLE energy systems history if available, otherwise fall back to workout history
    if (energySystemsHistory && Object.keys(energySystemsHistory).length > 0) {
        energySystemCounts = { ...energySystemsHistory };
        factors.push('Using AXLE energy systems history for balance');
    }
    else {
        energySystemCounts = recentHistory.reduce((acc, h) => {
            h.energySystems.forEach(es => {
                acc[es] = (acc[es] || 0) + 1;
            });
            return acc;
        }, {});
        factors.push('Using workout history for energy system balance');
    }
    // Adjust energy system for balance
    const allEnergySystems = [
        'alactic', 'phosphocreatine', 'glycolytic', 'aerobicZ1', 'aerobicZ2', 'aerobicZ3'
    ];
    const leastUsedEnergySystem = allEnergySystems
        .map(es => ({ es, count: energySystemCounts[es] || 0 }))
        .sort((a, b) => a.count - b.count)[0];
    if (primary !== 'recovery') {
        energySystem = leastUsedEnergySystem.es;
        factors.push(`Energy system balance: ${energySystem} least used (count: ${leastUsedEnergySystem.count})`);
    }
    rationale.push({
        step: 'Focus Determination',
        decision: `Primary: ${primary}, Energy: ${energySystem}, Pattern: ${movementPattern}`,
        factors,
        metrics: { performancePotential, vitality, sleepScore }
    });
    return {
        primary,
        energySystem,
        movementPattern,
        rationale: factors.join('; ')
    };
}
// Target intensity calculation
function calculateTargetIntensity(biometrics, history, rationale) {
    const factors = [];
    let intensity = 5; // Base intensity
    const performancePotential = biometrics.performancePotential || 50;
    const vitality = biometrics.vitality || 50;
    // Primary factor: Performance Potential
    intensity = Math.round(performancePotential / 10);
    factors.push(`Base from performance potential: ${intensity}`);
    // Modifier: Vitality
    const vitalityModifier = (vitality - 50) / 50; // -1 to 1
    intensity += Math.round(vitalityModifier * 2);
    factors.push(`Vitality modifier: ${vitalityModifier.toFixed(2)} (${vitality})`);
    // Recent feedback modifier
    const recentWorkouts = history.slice(-3);
    const highIntensityFeedback = recentWorkouts.filter(w => w.intensityRating && w.intensityRating >= 9);
    if (highIntensityFeedback.length >= 2) {
        intensity -= 1;
        factors.push('Recent high intensity feedback - reducing');
    }
    // Microcycle deload check
    const microcycleDay = (new Date().getDay() + 1) % 7; // Assuming Monday = day 1
    if (microcycleDay === 0) { // Every 4th microcycle (simplified to weekly)
        const weeklyTSS = history
            .filter(h => new Date(h.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
            .reduce((sum, h) => sum + h.estimatedTSS, 0);
        if (weeklyTSS > 300) { // TSS threshold
            intensity = Math.min(intensity, 4);
            factors.push(`Deload: Weekly TSS (${weeklyTSS}) exceeds threshold`);
        }
    }
    // Clamp to valid range
    intensity = Math.max(1, Math.min(10, intensity));
    rationale.push({
        step: 'Intensity Calculation',
        decision: `Target intensity: ${intensity}/10`,
        factors,
        metrics: { performancePotential, vitality, intensity }
    });
    return intensity;
}
// Safety guardrails and adjustments
function applySafetyGuardrails(focus, intensity, biometrics, rationale) {
    const adjustments = {};
    const factors = [];
    const vitality = biometrics.vitality || 50;
    const sleepScore = biometrics.sleepScore || 70;
    // Force recovery mode for very low vitality
    if (vitality < 40) {
        adjustments.focus = {
            ...focus,
            primary: 'recovery',
            energySystem: 'aerobicZ2'
        };
        adjustments.intensity = Math.min(intensity, 4);
        factors.push(`Vitality ${vitality} < 40: Forced recovery mode`);
    }
    // Reduce intensity for poor sleep
    if (sleepScore < 60) {
        adjustments.intensity = Math.min(intensity, 6);
        factors.push(`Sleep score ${sleepScore} < 60: Capped intensity at 6`);
    }
    if (factors.length > 0) {
        rationale.push({
            step: 'Safety Guardrails',
            decision: 'Applied safety adjustments',
            factors,
            metrics: { vitality, sleepScore }
        });
    }
    return adjustments;
}
// Workout composition
function composeWorkout(focus, intensity, request, history, rationale) {
    const blocks = [];
    const factors = [];
    let remainingMinutes = request.availableMinutes || 45;
    // Check for circadian adjustments
    const circadianAdjustments = request.circadianAdjustments;
    const shouldExtendWarmup = circadianAdjustments?.extendWarmup;
    const shouldShortenHIIT = circadianAdjustments?.shortenHIIT;
    if (circadianAdjustments) {
        factors.push(`Circadian adjustments: ${circadianAdjustments.reason}`);
    }
    // 1. Warm-up (6-10 min, extended if needed for circadian alignment)
    let warmupDuration = Math.min(10, remainingMinutes * 0.2);
    if (shouldExtendWarmup) {
        warmupDuration = Math.min(15, remainingMinutes * 0.3); // Extend warmup to 15min max
        factors.push('Extended warmup for circadian alignment');
    }
    const warmupBlocks = getBlocks({
        type: 'warmup',
        movementPattern: focus.movementPattern,
        maxDuration: warmupDuration
    });
    if (warmupBlocks.length > 0) {
        const warmup = selectBestBlock(warmupBlocks, 'warmup', intensity);
        blocks.push(convertToBlock(warmup));
        remainingMinutes -= warmup.durationMin;
        factors.push(`Warmup: ${warmup.id} (${warmup.durationMin}min)`);
    }
    // 2. Primary block
    const primaryBlocks = getBlocks({
        type: 'primary',
        movementPattern: focus.movementPattern,
        energySystem: focus.energySystem,
        equipment: request.equipment,
        maxDuration: remainingMinutes * 0.6
    });
    if (primaryBlocks.length > 0) {
        const primary = selectBestBlock(primaryBlocks, 'primary', intensity);
        blocks.push(convertToBlock(primary));
        remainingMinutes -= primary.durationMin;
        factors.push(`Primary: ${primary.id} (${primary.durationMin}min)`);
    }
    // 3. Accessory (if time allows)
    if (remainingMinutes > 15) {
        const accessoryBlocks = getBlocks({
            type: 'accessory',
            equipment: request.equipment,
            maxDuration: Math.min(12, remainingMinutes * 0.4)
        });
        if (accessoryBlocks.length > 0) {
            const accessory = selectBestBlock(accessoryBlocks, 'accessory', intensity);
            blocks.push(convertToBlock(accessory));
            remainingMinutes -= accessory.durationMin;
            factors.push(`Accessory: ${accessory.id} (${accessory.durationMin}min)`);
        }
    }
    // 4. Conditioning/Finisher (shortened if needed for circadian alignment)
    if (remainingMinutes > 8 && focus.primary !== 'recovery') {
        let conditioningDuration = remainingMinutes - 5; // Save time for cooldown
        // Shorten high-intensity intervals for poor circadian alignment
        if (shouldShortenHIIT && (focus.energySystem === 'phosphocreatine' || focus.energySystem === 'glycolytic')) {
            conditioningDuration = Math.min(conditioningDuration, 8); // Cap at 8min for HIIT
            factors.push('Shortened HIIT for circadian alignment');
        }
        const conditioningBlocks = getBlocks({
            type: intensity >= 7 ? 'conditioning' : 'finisher',
            energySystem: focus.energySystem,
            equipment: request.equipment,
            maxDuration: conditioningDuration
        });
        if (conditioningBlocks.length > 0) {
            const conditioning = selectBestBlock(conditioningBlocks, 'conditioning', intensity);
            blocks.push(convertToBlock(conditioning));
            remainingMinutes -= conditioning.durationMin;
            factors.push(`Conditioning: ${conditioning.id} (${conditioning.durationMin}min)`);
        }
    }
    // 5. Cooldown (3-6 min)
    if (remainingMinutes >= 3) {
        const cooldownBlocks = getBlocks({
            type: 'cooldown',
            maxDuration: Math.min(6, remainingMinutes)
        });
        if (cooldownBlocks.length > 0) {
            const cooldown = selectBestBlock(cooldownBlocks, 'cooldown', intensity);
            blocks.push(convertToBlock(cooldown));
            factors.push(`Cooldown: ${cooldown.id} (${cooldown.durationMin}min)`);
        }
    }
    // Fallback for no equipment/tight time
    if (blocks.length === 0 || (!request.equipment?.length && request.availableMinutes && request.availableMinutes < 20)) {
        return createBodyweightFallback(request.availableMinutes || 15);
    }
    rationale.push({
        step: 'Block Composition',
        decision: `Selected ${blocks.length} blocks`,
        factors
    });
    return blocks;
}
// Block selection scoring
function selectBestBlock(candidates, blockType, targetIntensity) {
    if (candidates.length === 1)
        return candidates[0];
    return candidates.reduce((best, candidate) => {
        const bestScore = scoreBlock(best, blockType, targetIntensity);
        const candidateScore = scoreBlock(candidate, blockType, targetIntensity);
        return candidateScore > bestScore ? candidate : best;
    });
}
function scoreBlock(block, blockType, targetIntensity) {
    let score = 0;
    // Base score for experience level match
    const experienceScores = { beginner: 6, intermediate: 8, advanced: 10, expert: 9 };
    score += experienceScores[block.experience] || 5;
    // Intensity alignment (simplified)
    const blockIntensity = estimateBlockIntensity(block);
    const intensityDiff = Math.abs(blockIntensity - targetIntensity);
    score += Math.max(0, 10 - intensityDiff);
    // Variety bonus (more variants = better)
    score += Math.min(5, block.variants.length);
    return score;
}
function estimateBlockIntensity(block) {
    // Simplified intensity estimation based on energy systems and type
    if (block.energySystems.includes('phosphocreatine'))
        return 8;
    if (block.energySystems.includes('glycolytic'))
        return 7;
    if (block.energySystems.includes('aerobicZ3'))
        return 6;
    if (block.energySystems.includes('aerobicZ2'))
        return 4;
    if (block.energySystems.includes('aerobicZ1'))
        return 3;
    return 5;
}
// Progression application
function applyProgression(blocks, progressionStates, rationale) {
    const factors = [];
    return blocks.map(block => {
        // Block type doesn't have progressionKey, skip progression for now
        // TODO: Add progressionKey to Block type if progression tracking is needed
        return block;
    });
}
// Helper functions
function generateWorkoutId() {
    return `wkt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
function convertToExistingFocus(focus) {
    // Map internal focus to the existing focus enum
    if (focus.primary === 'strength') {
        return focus.movementPattern === 'squat' || focus.movementPattern === 'hinge'
            ? 'Strength Lower' : 'Strength Upper';
    }
    if (focus.primary === 'conditioning') {
        if (focus.energySystem === 'aerobicZ2' || focus.energySystem === 'aerobicZ1') {
            return 'Endurance Zone2';
        }
        if (focus.energySystem === 'phosphocreatine') {
            return 'Power Development';
        }
        return 'Hybrid MetCon';
    }
    if (focus.primary === 'recovery') {
        return 'Recovery Active';
    }
    if (focus.primary === 'technique') {
        return 'Mobility Focus';
    }
    return 'Hybrid MetCon';
}
function estimateCalories(blocks, intensity) {
    // Simple estimation based on duration and intensity
    const totalMinutes = blocks.reduce((sum, block) => {
        // Convert to minutes - assuming block durations are in minutes
        return sum + (block.prescription?.time ? block.prescription.time / 60 : 20);
    }, 0);
    const baseCaloriesPerMinute = 8; // Conservative estimate
    const intensityMultiplier = 0.5 + (intensity / 10) * 1.5; // 0.5 to 2.0 range
    return Math.round(totalMinutes * baseCaloriesPerMinute * intensityMultiplier);
}
function estimateTSS(blocks, intensity) {
    // Training Stress Score estimation
    const totalMinutes = blocks.reduce((sum, block) => {
        return sum + (block.prescription?.time ? block.prescription.time / 60 : 20);
    }, 0);
    // TSS roughly correlates with intensity^2 * duration
    const intensityFactor = Math.pow(intensity / 10, 2);
    const baseTSSPerHour = 100;
    return Math.round((totalMinutes / 60) * baseTSSPerHour * intensityFactor);
}
function generateProgressionNotes(blocks, progressionStates) {
    // Block type doesn't have progressionKey or id, return empty array for now
    // TODO: Add progression tracking fields to Block type if needed
    return [];
}
function convertToBlock(workoutBlock) {
    // Select a variant (simplified - could be more sophisticated)
    const variant = workoutBlock.variants[0];
    // Map energy systems
    const energySystems = workoutBlock.energySystems.map(es => {
        switch (es) {
            case 'alactic':
            case 'phosphocreatine':
                return 'phosphocreatine';
            case 'glycolytic':
            case 'aerobicZ3':
                return 'glycolytic';
            case 'aerobicZ1':
            case 'aerobicZ2':
                return 'oxidative';
            default:
                return 'mixed';
        }
    });
    return {
        type: workoutBlock.type,
        energySystems: energySystems.length > 0 ? energySystems : ['mixed'],
        movements: variant.movements.map(movement => ({
            name: movement,
            category: workoutBlock.movementPatterns[0] || 'squat',
            primaryMuscles: ['unknown'], // Would need more detailed mapping
            equipment: workoutBlock.minEquipment || [],
            complexity: workoutBlock.experience === 'beginner' ? 'simple' : 'moderate'
        })),
        prescription: {
            time: workoutBlock.durationMin * 60, // Convert to seconds
            load: {
                type: 'RPE',
                value: 6 // Default RPE
            }
        },
        rest: {
            betweenSets: 60,
            betweenMovements: 30,
            betweenBlocks: 120,
            type: 'incomplete'
        },
        notes: variant.name,
        scaling: {
            beginner: 'Reduce intensity by 20%',
            intermediate: 'As prescribed',
            advanced: 'Increase intensity by 10%'
        }
    };
}
function createBodyweightFallback(availableMinutes) {
    const duration = Math.max(10, availableMinutes);
    return [{
            type: 'primary',
            energySystems: ['mixed'],
            movements: [
                {
                    name: 'Bodyweight squats',
                    category: 'squat',
                    primaryMuscles: ['quadriceps', 'glutes'],
                    equipment: [],
                    complexity: 'simple'
                },
                {
                    name: 'Push-ups',
                    category: 'push',
                    primaryMuscles: ['chest', 'triceps'],
                    equipment: [],
                    complexity: 'simple'
                },
                {
                    name: 'Walking',
                    category: 'locomotion',
                    primaryMuscles: ['legs'],
                    equipment: [],
                    complexity: 'simple'
                }
            ],
            prescription: {
                time: duration * 60,
                load: {
                    type: 'bodyweight',
                    value: 1
                }
            },
            rest: {
                betweenSets: 30,
                betweenMovements: 60,
                betweenBlocks: 0,
                type: 'incomplete'
            },
            notes: 'Equipment-free workout',
            scaling: {
                beginner: 'Reduce reps by 50%',
                intermediate: 'As prescribed',
                advanced: 'Add plyometric variations'
            }
        }];
}
