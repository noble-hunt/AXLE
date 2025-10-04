export type PatternPack = {
  name: string;
  mainBlocks: Array<{
    pattern: 'E2:00x'|'E2:30x'|'E3:00x'|'EMOM'|'AMRAP'|'FOR_TIME_21_15_9'|'CHIPPER_40_30_20_10'|'INTERVALS'|'STEADY'|'MOBILITY_QUALITY';
    minutes: number;          // approximate block time
    select: {
      categories: string[];   // movement categories to draw from
      patterns: string[];     // movement patterns to draw from
      modality: ('strength'|'conditioning'|'skill'|'aerobic'|'mobility')[];
      items: number;          // how many unique movements to pick
      requireLoaded?: boolean;// at least N loaded when equipment present
    };
  }>;
  warmupMin: number;
  cooldownMin: number;
  hardnessFloor: number;      // default floor for this style when equipment exists
};

export const PACKS: Record<string, PatternPack> = {
  crossfit: {
    name: 'CrossFit',
    warmupMin: 8,
    cooldownMin: 6,
    hardnessFloor: 0.85,
    mainBlocks: [
      { pattern: 'E2:30x', minutes: 12, select: { categories:['crossfit','powerlifting','olympic_weightlifting'], patterns:['squat','press','hinge','olympic_snatch','olympic_cleanjerk'], modality:['strength'], items: 2, requireLoaded: true } },
      { pattern: 'EMOM',   minutes: 14, select: { categories:['crossfit'], patterns:['cardio','hinge','squat','press'], modality:['conditioning'], items: 2, requireLoaded: true } },
    ]
  },
  olympic_weightlifting: {
    name: 'Olympic Weightlifting',
    warmupMin: 8, cooldownMin: 6, hardnessFloor: 0.85,
    mainBlocks: [
      { pattern: 'E2:00x', minutes: 16, select: { categories:['olympic_weightlifting'], patterns:['olympic_snatch'], modality:['strength','skill'], items: 1, requireLoaded: true } },
      { pattern: 'E2:00x', minutes: 16, select: { categories:['olympic_weightlifting'], patterns:['olympic_cleanjerk'], modality:['strength','skill'], items: 1, requireLoaded: true } }
    ]
  },
  powerlifting: {
    name: 'Powerlifting',
    warmupMin: 8, cooldownMin: 6, hardnessFloor: 0.85,
    mainBlocks: [
      { pattern: 'E3:00x', minutes: 15, select: { categories:['powerlifting'], patterns:['squat','bench','hinge'], modality:['strength'], items: 1, requireLoaded: true } },
      { pattern: 'E2:30x', minutes: 12, select: { categories:['powerlifting'], patterns:['squat','bench','hinge'], modality:['strength'], items: 1, requireLoaded: true } },
      { pattern: 'EMOM',   minutes: 10, select: { categories:['powerlifting'], patterns:['pull','hinge'], modality:['strength','conditioning'], items: 2, requireLoaded: true } }
    ]
  },
  bb_full_body: {
    name: 'Bodybuilding — Full Body',
    warmupMin: 6, cooldownMin: 6, hardnessFloor: 0.80,
    mainBlocks: [
      { pattern: 'E2:30x', minutes: 12, select: { categories:['bb_full_body'], patterns:['squat','hinge'], modality:['strength'], items: 2, requireLoaded: true } },
      { pattern: 'E2:00x', minutes: 12, select: { categories:['bb_full_body'], patterns:['press','pull'], modality:['strength'], items: 2, requireLoaded: true } },
      { pattern: 'EMOM',   minutes: 10, select: { categories:['bb_full_body'], patterns:['arms','shoulders','core'], modality:['strength','skill'], items: 2 } }
    ]
  },
  bb_upper: {
    name: 'Bodybuilding — Upper',
    warmupMin: 6, cooldownMin: 6, hardnessFloor: 0.80,
    mainBlocks: [
      { pattern: 'E2:00x', minutes: 12, select: { categories:['bb_upper'], patterns:['press','pull'], modality:['strength'], items: 2, requireLoaded: true } },
      { pattern: 'EMOM',   minutes: 12, select: { categories:['bb_upper'], patterns:['shoulders','arms','pull'], modality:['strength'], items: 2 } }
    ]
  },
  bb_lower: {
    name: 'Bodybuilding — Lower',
    warmupMin: 6, cooldownMin: 6, hardnessFloor: 0.80,
    mainBlocks: [
      { pattern: 'E2:00x', minutes: 12, select: { categories:['bb_lower'], patterns:['squat','lunge'], modality:['strength'], items: 2, requireLoaded: true } },
      { pattern: 'E2:00x', minutes: 12, select: { categories:['bb_lower'], patterns:['hinge','glute','calf'], modality:['strength'], items: 2, requireLoaded: true } }
    ]
  },
  aerobic: {
    name: 'Aerobic (Cardio)',
    warmupMin: 6, cooldownMin: 6, hardnessFloor: 0.70,
    mainBlocks: [
      { pattern: 'INTERVALS', minutes: 16, select: { categories:['aerobic'], patterns:['cardio'], modality:['aerobic'], items: 1 } },
      { pattern: 'INTERVALS', minutes: 12, select: { categories:['aerobic'], patterns:['cardio'], modality:['aerobic'], items: 1 } }
    ]
  },
  gymnastics: {
    name: 'Gymnastics Work',
    warmupMin: 6, cooldownMin: 6, hardnessFloor: 0.75,
    mainBlocks: [
      { pattern: 'EMOM',  minutes: 12, select: { categories:['gymnastics'], patterns:['gym_pull','gym_push','inversion'], modality:['skill','strength'], items: 2 } },
      { pattern: 'AMRAP', minutes: 10, select: { categories:['gymnastics'], patterns:['core','gym_pull'], modality:['skill','strength'], items: 2 } }
    ]
  },
  mobility: {
    name: 'Mobility Session',
    warmupMin: 4, cooldownMin: 4, hardnessFloor: 0.40,
    mainBlocks: [
      { pattern: 'MOBILITY_QUALITY', minutes: 12, select: { categories:['mobility'], patterns:['mobility_dynamic','mobility_static'], modality:['mobility'], items: 4 } },
      { pattern: 'MOBILITY_QUALITY', minutes: 10, select: { categories:['mobility'], patterns:['mobility_static','core'], modality:['mobility'], items: 4 } }
    ]
  }
};
