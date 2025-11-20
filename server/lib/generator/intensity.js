/**
 * Intensity Mapping and AXLE Health Metric Integration
 *
 * Maps target intensity (1-10) to workout parameters and applies
 * health-based caps using AXLE metrics.
 */
/**
 * Base intensity mapping without health constraints
 */
const INTENSITY_MAP = {
    1: {
        totalSets: 8,
        avgRestSeconds: 60,
        timeUnderTension: 20,
        loadPercentage: [40, 55],
        complexityLimit: 2,
        volumeMultiplier: 0.7
    },
    2: {
        totalSets: 10,
        avgRestSeconds: 75,
        timeUnderTension: 25,
        loadPercentage: [45, 60],
        complexityLimit: 2,
        volumeMultiplier: 0.8
    },
    3: {
        totalSets: 12,
        avgRestSeconds: 90,
        timeUnderTension: 30,
        loadPercentage: [50, 65],
        complexityLimit: 3,
        volumeMultiplier: 0.9
    },
    4: {
        totalSets: 14,
        avgRestSeconds: 105,
        timeUnderTension: 35,
        loadPercentage: [55, 70],
        complexityLimit: 3,
        volumeMultiplier: 1.0
    },
    5: {
        totalSets: 16,
        avgRestSeconds: 120,
        timeUnderTension: 40,
        loadPercentage: [60, 75],
        complexityLimit: 3,
        volumeMultiplier: 1.0
    },
    6: {
        totalSets: 18,
        avgRestSeconds: 135,
        timeUnderTension: 45,
        loadPercentage: [65, 80],
        complexityLimit: 4,
        volumeMultiplier: 1.1
    },
    7: {
        totalSets: 20,
        avgRestSeconds: 150,
        timeUnderTension: 50,
        loadPercentage: [70, 85],
        complexityLimit: 4,
        volumeMultiplier: 1.1
    },
    8: {
        totalSets: 22,
        avgRestSeconds: 165,
        timeUnderTension: 55,
        loadPercentage: [75, 90],
        complexityLimit: 4,
        volumeMultiplier: 1.2
    },
    9: {
        totalSets: 24,
        avgRestSeconds: 180,
        timeUnderTension: 60,
        loadPercentage: [80, 95],
        complexityLimit: 5,
        volumeMultiplier: 1.2
    },
    10: {
        totalSets: 26,
        avgRestSeconds: 200,
        timeUnderTension: 65,
        loadPercentage: [85, 100],
        complexityLimit: 5,
        volumeMultiplier: 1.3
    }
};
/**
 * Apply AXLE health metric caps to target intensity
 */
export function applyHealthCaps(targetIntensity, axleMetrics) {
    let cappedIntensity = targetIntensity;
    // Cap intensity based on vitality and AXLE score
    if ((axleMetrics.vitality && axleMetrics.vitality < 40) ||
        (axleMetrics.axleScore && axleMetrics.axleScore < 40)) {
        cappedIntensity = Math.min(cappedIntensity, 6);
    }
    // Further cap if performance potential is very low
    if (axleMetrics.performancePotential && axleMetrics.performancePotential < 35) {
        cappedIntensity = Math.min(cappedIntensity, 5);
    }
    // Cap if stress is high
    if (axleMetrics.stress && axleMetrics.stress > 7) {
        cappedIntensity = Math.min(cappedIntensity, 4);
    }
    // Cap if recovery is poor
    if (axleMetrics.recovery && axleMetrics.recovery < 30) {
        cappedIntensity = Math.min(cappedIntensity, 5);
    }
    return Math.max(1, cappedIntensity); // Never go below 1
}
/**
 * Adjust volume based on performance potential
 */
export function adjustVolumeForPerformance(baseParameters, axleMetrics) {
    const adjusted = { ...baseParameters };
    // Reduce volume if performance potential is low
    if (axleMetrics.performancePotential && axleMetrics.performancePotential < 35) {
        adjusted.volumeMultiplier *= 0.8; // 20% volume reduction
        adjusted.totalSets = Math.max(6, Math.floor(adjusted.totalSets * 0.8));
    }
    // Prefer aerobic bias if performance potential is low
    if (axleMetrics.performancePotential && axleMetrics.performancePotential < 35) {
        adjusted.avgRestSeconds = Math.min(90, adjusted.avgRestSeconds); // Shorter rest for aerobic bias
        adjusted.loadPercentage = [
            Math.max(40, adjusted.loadPercentage[0] - 10),
            Math.max(60, adjusted.loadPercentage[1] - 10)
        ];
    }
    return adjusted;
}
/**
 * Check if session should be shorter based on circadian rhythm
 */
export function shouldShortenSession(axleMetrics) {
    return axleMetrics.circadian !== undefined && axleMetrics.circadian < 35;
}
/**
 * Get intensity parameters with health adjustments
 */
export function getIntensityParameters(targetIntensity, axleMetrics = {}) {
    // Apply health caps first
    const cappedIntensity = applyHealthCaps(targetIntensity, axleMetrics);
    // Get base parameters
    const baseParameters = INTENSITY_MAP[cappedIntensity] || INTENSITY_MAP[5];
    // Apply performance-based adjustments
    return adjustVolumeForPerformance(baseParameters, axleMetrics);
}
/**
 * Create session intensity plan with gentle wave pattern
 */
export function createSessionIntensityPlan(targetIntensity, sessionMinutes, axleMetrics = {}) {
    const cappedIntensity = applyHealthCaps(targetIntensity, axleMetrics);
    // Adjust session length if needed
    const adjustedMinutes = shouldShortenSession(axleMetrics)
        ? Math.min(sessionMinutes, sessionMinutes * 0.8)
        : sessionMinutes;
    // Create phases with gentle wave (ramp up, peak, down)
    const phases = [];
    const numPhases = Math.max(3, Math.min(6, Math.floor(adjustedMinutes / 8)));
    const phaseMinutes = adjustedMinutes / numPhases;
    for (let i = 0; i < numPhases; i++) {
        let phaseIntensity;
        if (numPhases <= 3) {
            // Simple 3-phase: ramp, peak, down
            if (i === 0)
                phaseIntensity = Math.max(1, cappedIntensity - 2);
            else if (i === 1)
                phaseIntensity = cappedIntensity;
            else
                phaseIntensity = Math.max(1, cappedIntensity - 1);
        }
        else {
            // Multi-phase gentle wave
            const progress = i / (numPhases - 1);
            const waveValue = Math.sin(progress * Math.PI);
            phaseIntensity = Math.round(Math.max(1, cappedIntensity - 2) +
                waveValue * 2);
        }
        phases.push({
            phaseIndex: i,
            duration: phaseMinutes,
            intensity: phaseIntensity,
            description: getPhaseDescription(i, numPhases, phaseIntensity)
        });
    }
    const peakPhase = phases.findIndex(p => p.intensity === Math.max(...phases.map(p => p.intensity)));
    const avgIntensity = phases.reduce((sum, p) => sum + p.intensity, 0) / phases.length;
    return {
        phases,
        peakPhase,
        avgIntensity
    };
}
/**
 * Get descriptive text for workout phase
 */
function getPhaseDescription(phaseIndex, totalPhases, intensity) {
    if (phaseIndex === 0)
        return "Warm-up and activation";
    if (phaseIndex === totalPhases - 1)
        return "Cool-down and recovery";
    if (intensity <= 3)
        return "Easy preparation";
    if (intensity <= 5)
        return "Moderate work";
    if (intensity <= 7)
        return "Challenging effort";
    if (intensity <= 9)
        return "High intensity";
    return "Maximum effort";
}
/**
 * Determine if workout should include extended cool-down
 */
export function needsExtendedCooldown(intensity) {
    return intensity >= 7;
}
/**
 * Get recommended rest between exercises based on intensity
 */
export function getRestRecommendation(intensity, exerciseType) {
    const baseRest = INTENSITY_MAP[intensity]?.avgRestSeconds || 120;
    switch (exerciseType) {
        case 'strength':
            return baseRest;
        case 'conditioning':
            return Math.max(30, baseRest * 0.5);
        case 'skill':
            return Math.max(60, baseRest * 0.7);
        default:
            return baseRest;
    }
}
/**
 * Calculate target heart rate zones based on intensity
 */
export function getHeartRateZones(intensity, maxHR) {
    if (!maxHR)
        maxHR = 190; // Default estimate
    const zoneMap = {
        1: [0.5, 0.6], // Recovery
        2: [0.6, 0.65], // Aerobic base
        3: [0.65, 0.7], // Aerobic
        4: [0.7, 0.75], // Aerobic threshold
        5: [0.75, 0.8], // Tempo
        6: [0.8, 0.85], // Lactate threshold
        7: [0.85, 0.9], // VO2 max
        8: [0.9, 0.95], // Neuromuscular
        9: [0.95, 0.98], // Alactic
        10: [0.98, 1.0] // Peak
    };
    const [minPercent, maxPercent] = zoneMap[intensity] || [0.7, 0.8];
    return {
        min: Math.round(maxHR * minPercent),
        max: Math.round(maxHR * maxPercent),
        target: Math.round(maxHR * ((minPercent + maxPercent) / 2))
    };
}
