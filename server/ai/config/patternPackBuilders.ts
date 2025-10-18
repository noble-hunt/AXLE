// Duration-aware pattern pack builders.
// Each builder returns the same shape as the old static pack.
export type PatternBlock = {
  pattern: 'E2:00x' | 'E2:30x' | 'E3:00x' | 'EMOM' | 'AMRAP' | 'FOR_TIME_21_15_9' | 'CHIPPER_40_30_20_10' | 'INTERVALS' | 'STEADY' | 'MOBILITY_QUALITY';
  minutes: number;        // target minutes for this block
  kind: 'strength' | 'conditioning' | 'skill' | 'aerobic' | 'mobility';  // block type
  select: {
    categories: string[];
    patterns: string[];
    modality: ('strength' | 'conditioning' | 'skill' | 'aerobic' | 'mobility')[];
    items: number;
    requireLoaded?: boolean;
  };
  title?: string;         // optional explicit title
};
export type PatternPack = {
  name: string;
  warmupMin: number;
  cooldownMin: number;
  hardnessFloor: number;
  mainBlocks: PatternBlock[];
  requiredPatterns?: string[];   // patterns that must appear across mains
};

// Helper to clamp a value within bounds
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ---- OLYMPIC WEIGHTLIFTING ----
export function buildOlympicPack(totalMin: number): PatternPack {
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
            patterns: ["olympic_snatch"],  // Guarantee snatch pattern
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
            patterns: ["olympic_cleanjerk"],  // Guarantee C&J pattern
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
        pattern: "E2:00x",        // Combined block for both lifts when time is limited
        minutes: altMin,          // ~10–16 min based on budget
        kind: 'strength',
        select: {
          categories: ["olympic_weightlifting"],
          patterns: ["olympic_snatch", "olympic_cleanjerk"],  // Both required patterns
          modality: ["strength", "skill"],
          items: 2,  // Must pick 2 items to guarantee both patterns
          requireLoaded: true
        },
        title: "Every 2:00 — Snatch / Clean & Jerk",
      },
    ],
  };
}

// ---- ENDURANCE ----
export function buildEndurancePack(totalMin: number, requestedIntensity = 6): PatternPack {
  const warmup = totalMin >= 40 ? 8 : totalMin >= 30 ? 6 : 5;
  const cooldown = totalMin >= 40 ? 6 : totalMin >= 30 ? 4 : 3;
  const budget = Math.max(10, totalMin - warmup - cooldown);

  // Translate 1–10 to zones/structure:
  // 4–5 → steady Z2/Z3, 6–7 → tempo / cruise intervals, 8+ → VO2 short repeats.
  const i = Math.max(1, Math.min(10, requestedIntensity));
  const isSteady = i <= 5;
  const isTempo = i >= 6 && i <= 7;
  const isVO2   = i >= 8;

  const mainBlocks: PatternBlock[] = [];

  if (isSteady) {
    // One steady block
    mainBlocks.push({
      pattern: "STEADY",
      minutes: budget,
      kind: 'aerobic',
      select: {
        categories: ["endurance","aerobic"],
        patterns: ["cyclical","cardio","run","row","bike","erg","ski","swim","jump_rope"],
        modality: ["aerobic"],
        items: 1
      },
      title: "Steady Z2–Z3",
    });
  } else if (isTempo) {
    // Cruise intervals e.g., 3 x 6' @ Z3/4 with 2' easy
    mainBlocks.push({
      pattern: "INTERVALS",
      minutes: budget,
      kind: 'aerobic',
      select: {
        categories: ["endurance","aerobic"],
        patterns: ["cyclical","cardio","run","row","bike","erg","ski","swim"],
        modality: ["aerobic"],
        items: 1
      },
      title: "Cruise Intervals Z3–Z4",
    });
  } else if (isVO2) {
    // VO2 repeats e.g., 10 x 1' hard / 1' easy
    mainBlocks.push({
      pattern: "INTERVALS",
      minutes: budget,
      kind: 'aerobic',
      select: {
        categories: ["endurance","aerobic"],
        patterns: ["cyclical","cardio","run","row","bike","erg","ski"],
        modality: ["aerobic"],
        items: 1
      },
      title: "VO2 Repeats Z4–Z5",
    });
  }

  return {
    name: "Endurance",
    warmupMin: warmup,
    cooldownMin: cooldown,
    hardnessFloor: 0.80,
    mainBlocks,
  };
}

// TODO: If needed later, create builders for powerlifting, crossfit, etc.
// For now we only wire olympic and endurance here and default to existing packs for others.
