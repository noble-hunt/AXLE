import { Workout } from '../schemas';

// "Hardy Bacardi Party" style CrossFit workout
export const hardyBacardiParty: Workout = {
  title: "Hardy Bacardi Party",
  category: "CrossFit",
  duration_min: 20,
  intensity_1_to_10: 9,
  rationale: "High-intensity combination work with classic CrossFit movements. Scale loads and reps as needed.",
  blocks: [
    {
      kind: 'cf_for_time',
      reps_scheme: '27-21-15-9',
      time_cap_min: 17,
      items: [
        {
          name: 'thruster',
          load: { unit: 'lb', value: 95 }
        },
        {
          name: 'pull_up'
        }
      ]
    }
  ],
  cool_down: [
    { name: 'walking', seconds: 180 },
    { name: 'couch stretch', seconds: 60 },
    { name: 'shoulder stretch', seconds: 60 }
  ]
};

// "Slap Happy Samurai" style with AMRAP and intervals
export const slapHappySamurai: Workout = {
  title: "Slap Happy Samurai", 
  category: "CrossFit",
  duration_min: 25,
  intensity_1_to_10: 8,
  rationale: "Mixed modal workout combining strength, cardio, and gymnastics elements.",
  blocks: [
    {
      kind: 'cf_interval',
      rounds: 5,
      work_min: 3,
      rest_sec: 60,
      items: [
        {
          name: 'wall_ball',
          reps: 15,
          load: { unit: 'lb', value: 20 },
          height_in: 10
        },
        {
          name: 'box_jump',
          reps: 12,
          height_in: 24
        },
        {
          name: 'burpee',
          reps: 9
        }
      ]
    }
  ],
  cool_down: [
    { name: 'easy bike', seconds: 300 },
    { name: 'hip flexor stretch', seconds: 90 }
  ]
};

// Mixed workout with strength and AMRAP
export const battleAxe: Workout = {
  title: "Battle Axe",
  category: "CrossFit", 
  duration_min: 35,
  intensity_1_to_10: 7,
  rationale: "Build strength first, then test conditioning with bodyweight movements.",
  blocks: [
    {
      kind: 'strength',
      movement: 'deadlift',
      sets: 5,
      reps: 3,
      percent_1rm: 85,
      rest_sec: 180,
      note: "Focus on speed off the floor"
    },
    {
      kind: 'cf_amrap',
      minutes: 12,
      items: [
        {
          name: 'kettlebell_swing',
          reps: 20,
          load: { unit: 'lb', value: 53 }
        },
        {
          name: 'push_up',
          reps: 15
        },
        {
          name: 'air_squat', 
          reps: 25
        }
      ],
      note: "Maintain consistent pace throughout"
    }
  ]
};