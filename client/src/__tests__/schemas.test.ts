import { describe, it, expect } from 'vitest';
import { WorkoutSchema, buildUserContextString, intensityGuidelines } from '../ai/schemas';
import { parseAndValidate, ensureValid } from '../ai/json';

describe('Workout Schema Validation', () => {
  it('should validate a complete valid CrossFit workout', () => {
    const validWorkout = {
      name: "Murph",
      category: "CrossFit/HIIT",
      format: "for_time",
      duration_min: 45,
      intensity_1_to_10: 8,
      description: "Hero WOD honoring Navy Lieutenant Michael Murphy",
      blocks: [
        {
          name: "Warmup",
          type: "warmup",
          estimated_duration_min: 10,
          warmup_steps: [
            {
              movement: "light_jog",
              duration_seconds: 300,
              intensity_percent: 50,
              notes: "Easy pace to warm up"
            }
          ]
        },
        {
          name: "Main WOD",
          type: "main",
          estimated_duration_min: 30,
          format: "for_time",
          sets: [
            {
              rounds: 1,
              movements: [
                {
                  name: "pull_up",
                  category: "CrossFit/HIIT",
                  reps: 100
                },
                {
                  name: "push_up",
                  category: "CrossFit/HIIT", 
                  reps: 200
                },
                {
                  name: "air_squat",
                  category: "CrossFit/HIIT",
                  reps: 300
                }
              ]
            }
          ]
        },
        {
          name: "Cooldown",
          type: "cooldown",
          estimated_duration_min: 5,
          cooldown_steps: [
            {
              movement: "static_stretch",
              duration_seconds: 300,
              notes: "Full body stretch"
            }
          ]
        }
      ],
      equipment_needed: ["pull_up_bar"],
      coaching_notes: "Scale reps as needed, focus on steady pace"
    };

    expect(() => WorkoutSchema.parse(validWorkout)).not.toThrow();
  });

  it('should validate a powerlifting workout with proper %1RM ranges', () => {
    const powerliftingWorkout = {
      name: "Heavy Squat Day",
      category: "Powerlifting",
      format: "complex",
      duration_min: 60,
      intensity_1_to_10: 8,
      description: "Heavy back squat training session",
      blocks: [
        {
          name: "Warmup",
          type: "warmup", 
          estimated_duration_min: 15,
          warmup_steps: [
            {
              movement: "bodyweight_squat",
              duration_seconds: 300,
              intensity_percent: 40
            }
          ]
        },
        {
          name: "Main Lifts",
          type: "main",
          estimated_duration_min: 40,
          format: "complex",
          sets: [
            {
              rounds: 5,
              movements: [
                {
                  name: "back_squat",
                  category: "Powerlifting",
                  sets: 3,
                  reps: 3,
                  weight_percent_1rm: 85,
                  rest_seconds: 180
                }
              ]
            }
          ]
        },
        {
          name: "Cooldown",
          type: "cooldown",
          estimated_duration_min: 5,
          cooldown_steps: [
            {
              movement: "hip_flexor_stretch",
              duration_seconds: 300
            }
          ]
        }
      ]
    };

    expect(() => WorkoutSchema.parse(powerliftingWorkout)).not.toThrow();
  });

  it('should reject workout with wrong category movement', () => {
    const invalidWorkout = {
      name: "Bad Workout",
      category: "Powerlifting",
      format: "complex", 
      duration_min: 30,
      intensity_1_to_10: 5,
      description: "This should fail",
      blocks: [
        {
          name: "Main",
          type: "main",
          estimated_duration_min: 25,
          sets: [
            {
              rounds: 1,
              movements: [
                {
                  name: "burpee", // CrossFit movement in Powerlifting workout
                  category: "Powerlifting", // Wrong!
                  reps: 10
                }
              ]
            }
          ]
        },
        {
          name: "Cooldown",
          type: "cooldown",
          estimated_duration_min: 5,
          cooldown_steps: [
            {
              movement: "stretch",
              duration_seconds: 300
            }
          ]
        }
      ]
    };

    expect(() => WorkoutSchema.parse(invalidWorkout)).toThrow(/Movement not allowed for this category/);
  });

  it('should reject workout with duration drift >10%', () => {
    const invalidWorkout = {
      name: "Bad Duration",
      category: "CrossFit/HIIT",
      format: "amrap",
      duration_min: 30, // Total should be around 30 min
      intensity_1_to_10: 6,
      description: "Duration mismatch test",
      blocks: [
        {
          name: "Main",
          type: "main",
          estimated_duration_min: 50, // Way too long - >10% tolerance
          sets: [
            {
              rounds: 5,
              movements: [
                {
                  name: "air_squat",
                  category: "CrossFit/HIIT",
                  reps: 10
                }
              ]
            }
          ]
        }
      ]
    };

    expect(() => WorkoutSchema.parse(invalidWorkout)).toThrow(/Block durations must sum to within ±10% of total workout duration/);
  });

  it('should reject out-of-range intensities', () => {
    const invalidWorkout = {
      name: "Bad Intensity",
      category: "CrossFit/HIIT",
      format: "amrap",
      duration_min: 20,
      intensity_1_to_10: 15, // Invalid - must be 1-10
      description: "Bad intensity test",
      blocks: [
        {
          name: "Main",
          type: "main",
          estimated_duration_min: 20,
          sets: [
            {
              rounds: 1,
              movements: [
                {
                  name: "air_squat",
                  category: "CrossFit/HIIT",
                  reps: 20
                }
              ]
            }
          ]
        }
      ]
    };

    expect(() => WorkoutSchema.parse(invalidWorkout)).toThrow();
  });

  it('should reject powerlifting workout with CrossFit movement even if movement category is set', () => {
    const invalidWorkout = {
      name: "Cross-Category Attempt",
      category: "Powerlifting",
      format: "complex",
      duration_min: 30,
      intensity_1_to_10: 5,
      description: "Should fail due to category mismatch",
      blocks: [
        {
          name: "Warmup",
          type: "warmup",
          estimated_duration_min: 5,
          warmup_steps: [
            {
              movement: "warmup",
              duration_seconds: 300,
              intensity_percent: 40
            }
          ]
        },
        {
          name: "Main",
          type: "main",
          estimated_duration_min: 25,
          sets: [
            {
              rounds: 3,
              movements: [
                {
                  name: "burpee", // CrossFit movement
                  category: "CrossFit/HIIT", // Trying to sneak in wrong category
                  reps: 10
                }
              ]
            }
          ]
        }
      ]
    };

    expect(() => WorkoutSchema.parse(invalidWorkout)).toThrow(/Movement parameters don't match category and intensity requirements/);
  });

  it('should reject movement with no concrete prescription', () => {
    const invalidWorkout = {
      name: "Empty Movement",
      category: "CrossFit/HIIT",
      format: "amrap",
      duration_min: 20,
      intensity_1_to_10: 5,
      description: "Movement with no reps/duration/distance",
      blocks: [
        {
          name: "Main",
          type: "main",
          estimated_duration_min: 20,
          sets: [
            {
              rounds: 1,
              movements: [
                {
                  name: "air_squat",
                  category: "CrossFit/HIIT"
                  // No reps, duration_seconds, or distance_meters!
                }
              ]
            }
          ]
        }
      ]
    };

    expect(() => WorkoutSchema.parse(invalidWorkout)).toThrow(/Movement parameters don't match category and intensity requirements/);
  });

  it('should reject powerlifting workout with invalid %1RM for intensity', () => {
    const invalidWorkout = {
      name: "Bad Powerlifting",
      category: "Powerlifting", 
      format: "complex",
      duration_min: 45,
      intensity_1_to_10: 3, // Light intensity (should be 55-70%)
      description: "Invalid %1RM test",
      blocks: [
        {
          name: "Warmup",
          type: "warmup",
          estimated_duration_min: 10,
          warmup_steps: [
            {
              movement: "warmup",
              duration_seconds: 600,
              intensity_percent: 40
            }
          ]
        },
        {
          name: "Main",
          type: "main", 
          estimated_duration_min: 35,
          sets: [
            {
              rounds: 3,
              movements: [
                {
                  name: "back_squat",
                  category: "Powerlifting",
                  reps: 5,
                  weight_percent_1rm: 85 // Too heavy for intensity 3 (should be 55-70%)
                }
              ]
            }
          ]
        }
      ]
    };

    expect(() => WorkoutSchema.parse(invalidWorkout)).toThrow(/Movement parameters don't match category and intensity requirements/);
  });
});

describe('User Context Builder', () => {
  it('should build comprehensive context string', () => {
    const input = {
      yesterday: {
        category: 'CrossFit/HIIT',
        duration: 30,
        intensity: 7
      },
      week_summary: {
        category_counts: { 'CrossFit/HIIT': 2, 'Powerlifting': 1 },
        total_volume: 180,
        last_heavy_lift: 'Back Squat 315lbs'
      },
      month_summary: {
        category_counts: { 'CrossFit/HIIT': 8, 'Powerlifting': 4, 'Aerobic': 3 },
        total_volume: 720
      },
      health_snapshot: {
        hrv: 65,
        resting_hr: 55,
        sleep_score: 85,
        stress_flag: false
      },
      equipment: ['barbell', 'dumbbells', 'pull_up_bar'],
      constraints: ['no running', 'lower back issue']
    };

    const context = buildUserContextString(input);
    
    expect(context).toContain('Yesterday: CrossFit/HIIT workout, 30min, intensity 7/10');
    expect(context).toContain('This week: CrossFit/HIIT: 2, Powerlifting: 1');
    expect(context).toContain('Last heavy lift: Back Squat 315lbs');
    expect(context).toContain('Health: HRV: good, Resting HR: good, Sleep: good');
    expect(context).toContain('Equipment: barbell, dumbbells, pull_up_bar');
    expect(context).toContain('Constraints: no running, lower back issue');
  });

  it('should handle health warnings correctly', () => {
    const input = {
      health_snapshot: {
        hrv: 25, // caution
        resting_hr: 85, // caution  
        sleep_score: 45, // caution
        stress_flag: true
      }
    };

    const context = buildUserContextString(input);
    expect(context).toContain('Health: HRV: caution, Resting HR: caution, Sleep: caution, Stress: caution');
  });
});

describe('Intensity Guidelines', () => {
  it('should provide correct powerlifting guidelines', () => {
    expect(intensityGuidelines('Powerlifting', 2)).toContain('40-55% 1RM');
    expect(intensityGuidelines('Powerlifting', 5)).toContain('65-80% 1RM');
    expect(intensityGuidelines('Powerlifting', 9)).toContain('85-100% 1RM');
  });

  it('should provide correct aerobic guidelines', () => {
    expect(intensityGuidelines('Aerobic', 2)).toContain('Zone 1');
    expect(intensityGuidelines('Aerobic', 5)).toContain('Zone 3');
    expect(intensityGuidelines('Aerobic', 9)).toContain('Zone 5');
  });

  it('should provide correct CrossFit guidelines', () => {
    expect(intensityGuidelines('CrossFit/HIIT', 3)).toContain('RPE 5-6');
    expect(intensityGuidelines('CrossFit/HIIT', 7)).toContain('RPE 7-8');
    expect(intensityGuidelines('CrossFit/HIIT', 10)).toContain('RPE 9-10');
  });
});

describe('JSON Parsing and Validation', () => {
  it('should parse valid JSON and validate against schema', () => {
    const validJson = `{
      "name": "Test Workout",
      "category": "CrossFit/HIIT",
      "format": "amrap",
      "duration_min": 20,
      "intensity_1_to_10": 6,
      "description": "Simple test workout",
      "blocks": [
        {
          "name": "Main",
          "type": "main",
          "estimated_duration_min": 20,
          "sets": [
            {
              "rounds": 5,
              "movements": [
                {
                  "name": "air_squat",
                  "category": "CrossFit/HIIT",
                  "reps": 10
                }
              ]
            }
          ]
        }
      ]
    }`;

    expect(() => parseAndValidate(WorkoutSchema, validJson)).not.toThrow();
  });

  it('should throw precise error for invalid JSON', () => {
    const invalidJson = `{ "name": "test" invalid }`;
    
    expect(() => parseAndValidate(WorkoutSchema, invalidJson)).toThrow(/Invalid JSON/);
  });

  it('should throw schema validation error for invalid structure', () => {
    const invalidStructure = `{
      "name": "",
      "category": "InvalidCategory",
      "format": "amrap",
      "duration_min": 20,
      "intensity_1_to_10": 6,
      "description": "Test",
      "blocks": []
    }`;

    expect(() => parseAndValidate(WorkoutSchema, invalidStructure)).toThrow(/Schema validation failed/);
  });
});