import { Workout } from '../schemas';

// Olympic lifting session with complexes and accessories
export const olympicTechnique: Workout = {
  title: "Power Development",
  category: "Olympic",
  duration_min: 60,
  intensity_1_to_10: 7,
  rationale: "Technical session focusing on power development and consistency. Work on speed under the bar.",
  blocks: [
    {
      kind: 'strength',
      movement: 'snatch',
      sets: 6,
      reps: 2,
      percent_1rm: 75,
      rest_sec: 180,
      note: "Focus on third pull timing"
    },
    {
      kind: 'strength', 
      movement: 'clean_and_jerk',
      sets: 5,
      complex: {
        parts: [
          { name: 'clean', reps: 1 },
          { name: 'front_squat', reps: 2 },
          { name: 'jerk', reps: 1 }
        ]
      },
      percent_1rm: 70,
      rest_sec: 240,
      note: "Pause 2s in front squat bottom"
    },
    {
      kind: 'strength',
      movement: 'back_squat',
      sets: 4,
      reps: 3,
      percent_1rm: 80,
      rest_sec: 180
    },
    {
      kind: 'accessory',
      items: [
        {
          name: 'snatch_pull',
          reps: 5,
          load: { unit: '%1RM', value: 90, ref_1rm_of: 'Snatch' },
          notes: 'Slow negative'
        },
        {
          name: 'overhead_squat',
          reps: 8,
          load: { unit: '%1RM', value: 60, ref_1rm_of: 'Snatch' }
        }
      ]
    },
    {
      kind: 'accessory',
      items: [
        {
          name: 'romanian_deadlift',
          reps: 10,
          load: { unit: 'kg', value: 100 }
        },
        {
          name: 'barbell_row',
          reps: 12,
          load: { unit: 'kg', value: 80 }
        }
      ]
    }
  ],
  cool_down: [
    { name: 'overhead stretch', seconds: 120 },
    { name: 'hip flexor stretch', seconds: 90 },
    { name: 'ankle mobility', seconds: 60 }
  ]
};

// Heavy competition prep session
export const competitionPrep: Workout = {
  title: "Competition Prep",
  category: "Olympic",
  duration_min: 90,
  intensity_1_to_10: 9,
  rationale: "Competition simulation with opener-second-third attempt progression.",
  blocks: [
    {
      kind: 'strength',
      movement: 'snatch',
      sets: 9,
      reps: 1,
      note: "Work up to competition third attempt. 3 openers, 3 seconds, 3 thirds."
    },
    {
      kind: 'strength',
      movement: 'clean_and_jerk', 
      sets: 9,
      reps: 1,
      note: "Work up to competition third attempt. 3 openers, 3 seconds, 3 thirds."
    },
    {
      kind: 'accessory',
      items: [
        {
          name: 'front_squat',
          reps: 3,
          load: { unit: '%1RM', value: 105, ref_1rm_of: 'Clean' },
          notes: 'Opener recovery strength'
        }
      ]
    }
  ]
};