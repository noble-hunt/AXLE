// Duration-aware pattern pack builders.
// Each builder returns the same shape as the old static pack.
export type PatternBlockSelect = {
  categories?: string[];
  patterns?: string[];
  modality?: string[];
  items: number;
  requireLoaded?: boolean;
};
export type PatternBlock = {
  pattern: string;        // e.g., "E2:00x", "EMOM", "Alt E1:30x"
  minutes: number;        // target minutes for this block
  select: PatternBlockSelect[];
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
          select: [
            { categories: ["olympic_weightlifting"], patterns: ["olympic_snatch"], items: 1, requireLoaded: true },
            { categories: ["olympic_weightlifting"], patterns: ["olympic_pull","overhead_squat"], items: 1, requireLoaded: true },
          ],
          title: "Every 2:00 — Snatch Complex",
        },
        {
          pattern: "E2:00x",
          minutes: clamp(per, 10, 16),
          select: [
            { categories: ["olympic_weightlifting"], patterns: ["olympic_cleanjerk"], items: 1, requireLoaded: true },
            { categories: ["olympic_weightlifting"], patterns: ["front_squat","olympic_pull"], items: 1, requireLoaded: true },
          ],
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
        pattern: "Alt E1:30x",    // alternating, snatch on odd, C&J on even
        minutes: altMin,          // ~10–16 min based on budget
        select: [
          { categories: ["olympic_weightlifting"], patterns: ["olympic_snatch"], items: 1, requireLoaded: true },
          { categories: ["olympic_weightlifting"], patterns: ["olympic_cleanjerk"], items: 1, requireLoaded: true },
        ],
        title: "Alt E1:30 — Snatch / Clean & Jerk",
      },
    ],
  };
}

// TODO: If needed later, create builders for powerlifting, crossfit, etc.
// For now we only wire olympic here and default to existing packs for others.
