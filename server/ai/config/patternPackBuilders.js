// Helper to clamp a value within bounds
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
// Helper to pick the best available cardio modality from equipment
function pickCyclical(equipment = []) {
    const eq = (equipment || []).map(e => String(e).toLowerCase());
    if (eq.includes('rower'))
        return { name: 'Row', patterns: ['row', 'erg', 'cyclical'], registryIdHint: 'row' };
    if (eq.includes('bike') || eq.includes('air_bike') || eq.includes('assault_bike'))
        return { name: 'Bike', patterns: ['bike', 'erg', 'cyclical'], registryIdHint: 'bike' };
    if (eq.includes('treadmill'))
        return { name: 'Run', patterns: ['run', 'cyclical'], registryIdHint: 'run' };
    if (eq.includes('ski_erg'))
        return { name: 'Ski Erg', patterns: ['ski', 'erg', 'cyclical'], registryIdHint: 'ski' };
    if (eq.includes('jump_rope'))
        return { name: 'Jump Rope', patterns: ['jump_rope', 'cyclical'], registryIdHint: 'jump_rope' };
    // Fallback if nothing cyclical present
    return { name: 'Jump Rope', patterns: ['jump_rope', 'cyclical'], registryIdHint: 'jump_rope' };
}
// ---- OLYMPIC WEIGHTLIFTING ----
export function buildOlympicPack(totalMin) {
    // Default mins; compress if budget is tight
    const warmup = totalMin >= 35 ? 8 : 6;
    const cooldown = totalMin >= 35 ? 6 : 4;
    const budgetForMains = Math.max(0, totalMin - warmup - cooldown);
    // Always require both olympic patterns overall
    const requiredPatterns = ["olympic_snatch", "olympic_cleanjerk"];
    // Two separate mains if we have the time
    if (budgetForMains >= 24) {
        const per = Math.floor(budgetForMains / 2); // split mains
        return {
            name: "Olympic Weightlifting",
            warmupMin: warmup,
            cooldownMin: cooldown,
            hardnessFloor: 0.85,
            requiredPatterns,
            mainBlocks: [
                {
                    pattern: "E2:00x",
                    minutes: clamp(per, 10, 16), // 5–8 rounds typical
                    kind: 'strength',
                    select: {
                        categories: ["olympic_weightlifting"],
                        patterns: ["olympic_snatch"], // Guarantee snatch pattern
                        modality: ["strength", "skill"],
                        items: 1,
                        requireLoaded: true
                    },
                    title: "Every 2:00 — Snatch Complex",
                },
                {
                    pattern: "E2:00x",
                    minutes: clamp(per, 10, 16),
                    kind: 'strength',
                    select: {
                        categories: ["olympic_weightlifting"],
                        patterns: ["olympic_cleanjerk"], // Guarantee C&J pattern
                        modality: ["strength", "skill"],
                        items: 1,
                        requireLoaded: true
                    },
                    title: "Every 2:00 — Clean & Jerk Complex",
                },
            ],
        };
    }
    // Otherwise: one alternating main (both patterns present)
    const altMin = clamp(budgetForMains, 10, Math.max(10, budgetForMains));
    return {
        name: "Olympic Weightlifting",
        warmupMin: warmup,
        cooldownMin: cooldown,
        hardnessFloor: 0.85,
        requiredPatterns,
        mainBlocks: [
            {
                pattern: "E2:00x", // Combined block for both lifts when time is limited
                minutes: altMin, // ~10–16 min based on budget
                kind: 'strength',
                select: {
                    categories: ["olympic_weightlifting"],
                    patterns: ["olympic_snatch", "olympic_cleanjerk"], // Both required patterns
                    modality: ["strength", "skill"],
                    items: 2, // Must pick 2 items to guarantee both patterns
                    requireLoaded: true
                },
                title: "Every 2:00 — Snatch / Clean & Jerk",
            },
        ],
    };
}
// ---- ENDURANCE ----
export function buildEndurancePack(totalMin, requestedIntensity = 6, equipment) {
    const warmup = totalMin >= 40 ? 8 : totalMin >= 30 ? 6 : 5;
    const cooldown = totalMin >= 40 ? 6 : totalMin >= 30 ? 4 : 3;
    const budget = Math.max(10, totalMin - warmup - cooldown);
    // Pick the best available cardio modality
    const mod = pickCyclical(equipment);
    const mainBlocks = [];
    // Choose structure by intensity (Steady / Cruise / VO2)
    const isSteady = requestedIntensity <= 6;
    const isTempo = requestedIntensity === 7;
    if (isSteady) {
        // One steady block - continuous effort
        mainBlocks.push({
            pattern: "STEADY",
            minutes: budget,
            kind: 'aerobic',
            select: {
                categories: ["endurance", "aerobic"],
                patterns: mod.patterns,
                modality: ["aerobic"],
                items: 1
            },
            title: `Steady ${mod.name} Z2–Z3`,
            notes: `Continuous ${budget}:00 @ Z2–Z3. Nose-breathing pace.`,
        });
    }
    else if (isTempo) {
        // Cruise intervals
        const workMin = Math.floor(budget / 3);
        const restMin = Math.max(2, Math.round(budget / 9));
        mainBlocks.push({
            pattern: "CRUISE",
            minutes: budget,
            kind: 'aerobic',
            select: {
                categories: ["endurance", "aerobic"],
                patterns: mod.patterns,
                modality: ["aerobic"],
                items: 1
            },
            title: `Cruise Intervals ${mod.name} Z3–Z4`,
            notes: `3 x ${workMin}:00 @ Z3–Z4, ${restMin}:00 easy between.`,
        });
    }
    else {
        // VO2 repeats
        mainBlocks.push({
            pattern: "VO2",
            minutes: budget,
            kind: 'aerobic',
            select: {
                categories: ["endurance", "aerobic"],
                patterns: mod.patterns,
                modality: ["aerobic"],
                items: 1
            },
            title: `VO2 Repeats ${mod.name} Z4–Z5`,
            notes: `10 x 1:00 hard / 1:00 easy. Even effort; don't sprint the first reps.`,
        });
    }
    return {
        name: "Endurance",
        warmupMin: warmup,
        cooldownMin: cooldown,
        hardnessFloor: 0.45, // Lower floor for cardio-only workouts (no loaded movements)
        mainBlocks,
    };
}
// TODO: If needed later, create builders for powerlifting, crossfit, etc.
// For now we only wire olympic and endurance here and default to existing packs for others.
