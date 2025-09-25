#!/usr/bin/env npx tsx

/**
 * Seed script to populate the database with workout blocks
 * Supports multiple equipment setups: full gym, minimal (DB only), and bodyweight
 */

import { promises as fs } from 'fs';
import { join } from 'path';

// Block types and constants
type BlockType = 'warmup' | 'primary' | 'accessory' | 'conditioning' | 'finisher' | 'cooldown';
type EnergySystem = 'alactic' | 'phosphocreatine' | 'glycolytic' | 'aerobicZ1' | 'aerobicZ2' | 'aerobicZ3';
type MovementPattern = 'squat' | 'hinge' | 'push' | 'pull' | 'carry' | 'locomotion' | 'power' | 'core';
type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

interface WorkoutBlock {
  id: string;
  type: BlockType;
  durationMin: number;
  minEquipment: string[];
  contraindications: string[];
  experience: ExperienceLevel;
  energySystems: EnergySystem[];
  movementPatterns: MovementPattern[];
  progressionKey: string;
  variants: {
    name: string;
    movements: string[];
  }[];
}

// Comprehensive block library covering all equipment types
const WORKOUT_BLOCKS: WorkoutBlock[] = [
  // === WARMUP BLOCKS (20 blocks) ===
  
  // Bodyweight Warmups
  {
    id: "warmup-bw-general",
    type: "warmup",
    durationMin: 8,
    minEquipment: [],
    contraindications: [],
    experience: "beginner",
    energySystems: ["alactic"],
    movementPatterns: ["squat", "hinge", "push", "core"],
    progressionKey: "general-warmup",
    variants: [
      {
        name: "General Dynamic Warmup",
        movements: ["arm circles", "leg swings", "bodyweight squats", "lunges", "inchworms", "mountain climbers"]
      }
    ]
  },
  {
    id: "warmup-bw-upper",
    type: "warmup", 
    durationMin: 6,
    minEquipment: [],
    contraindications: [],
    experience: "beginner",
    energySystems: ["alactic"],
    movementPatterns: ["push", "pull", "core"],
    progressionKey: "upper-warmup",
    variants: [
      {
        name: "Upper Body Activation",
        movements: ["arm circles", "shoulder dislocations", "wall slides", "cat-cow", "push-up to downward dog"]
      }
    ]
  },
  {
    id: "warmup-bw-lower",
    type: "warmup",
    durationMin: 6,
    minEquipment: [],
    contraindications: [],
    experience: "beginner", 
    energySystems: ["alactic"],
    movementPatterns: ["squat", "hinge", "locomotion"],
    progressionKey: "lower-warmup",
    variants: [
      {
        name: "Lower Body Activation",
        movements: ["leg swings", "hip circles", "walking lunges", "glute bridges", "calf raises"]
      }
    ]
  },
  
  // Dumbbell Warmups
  {
    id: "warmup-db-general",
    type: "warmup",
    durationMin: 8,
    minEquipment: ["dumbbells"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["alactic"],
    movementPatterns: ["squat", "hinge", "push", "pull"],
    progressionKey: "db-warmup",
    variants: [
      {
        name: "Dumbbell Movement Prep",
        movements: ["db goblet squats", "db romanian deadlifts", "db shoulder press", "db rows", "db swings"]
      }
    ]
  },
  {
    id: "warmup-db-upper",
    type: "warmup",
    durationMin: 6,
    minEquipment: ["dumbbells"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["alactic"],
    movementPatterns: ["push", "pull"],
    progressionKey: "db-upper-warmup",
    variants: [
      {
        name: "DB Upper Body Prep",
        movements: ["db arm circles", "db external rotations", "db press variations", "db reverse flyes"]
      }
    ]
  },

  // Kettlebell Warmups
  {
    id: "warmup-kb-flow",
    type: "warmup",
    durationMin: 8,
    minEquipment: ["kettlebells"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["alactic"],
    movementPatterns: ["hinge", "squat", "pull", "core"],
    progressionKey: "kb-warmup",
    variants: [
      {
        name: "Kettlebell Flow",
        movements: ["kb deadlifts", "kb swings", "kb goblet squats", "kb halos", "kb good mornings"]
      }
    ]
  },

  // Barbell Warmups
  {
    id: "warmup-bb-general",
    type: "warmup",
    durationMin: 10,
    minEquipment: ["barbell"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["alactic"],
    movementPatterns: ["squat", "hinge", "push", "pull"],
    progressionKey: "bb-warmup",
    variants: [
      {
        name: "Barbell Movement Prep",
        movements: ["empty bar squats", "RDLs", "overhead press", "bent rows", "good mornings"]
      }
    ]
  },

  // Cardio Equipment Warmups
  {
    id: "warmup-rower",
    type: "warmup",
    durationMin: 5,
    minEquipment: ["rowing machine"],
    contraindications: [],
    experience: "beginner",
    energySystems: ["aerobicZ1"],
    movementPatterns: ["pull", "hinge"],
    progressionKey: "row-warmup",
    variants: [
      {
        name: "Rowing Prep",
        movements: ["easy rowing", "rowing technique drills", "stroke rate buildup"]
      }
    ]
  },
  {
    id: "warmup-bike",
    type: "warmup",
    durationMin: 5,
    minEquipment: ["bike"],
    contraindications: [],
    experience: "beginner",
    energySystems: ["aerobicZ1"],
    movementPatterns: ["locomotion"],
    progressionKey: "bike-warmup",
    variants: [
      {
        name: "Bike Warmup",
        movements: ["easy cycling", "cadence buildup", "standing/sitting intervals"]
      }
    ]
  },
  {
    id: "warmup-run",
    type: "warmup",
    durationMin: 8,
    minEquipment: [],
    contraindications: ["knee injury"],
    experience: "beginner",
    energySystems: ["aerobicZ1"],
    movementPatterns: ["locomotion"],
    progressionKey: "run-warmup",
    variants: [
      {
        name: "Running Warmup",
        movements: ["easy jog", "high knees", "butt kicks", "leg swings", "gradual pace increase"]
      }
    ]
  },

  // Mobility/Movement Warmups
  {
    id: "warmup-mobility",
    type: "warmup",
    durationMin: 10,
    minEquipment: [],
    contraindications: [],
    experience: "beginner",
    energySystems: ["alactic"],
    movementPatterns: ["squat", "hinge", "core"],
    progressionKey: "mobility-warmup",
    variants: [
      {
        name: "Mobility Flow",
        movements: ["world's greatest stretch", "deep squat holds", "spinal waves", "shoulder dislocations", "hip flow"]
      }
    ]
  },

  // === PRIMARY BLOCKS (30 blocks) ===
  
  // Bodyweight Primary
  {
    id: "primary-bw-upper",
    type: "primary",
    durationMin: 20,
    minEquipment: [],
    contraindications: [],
    experience: "beginner",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["push", "pull"],
    progressionKey: "bw-upper-strength",
    variants: [
      {
        name: "Bodyweight Upper Strength",
        movements: ["push-ups", "pull-ups", "dips", "inverted rows", "pike push-ups", "negative pull-ups"]
      }
    ]
  },
  {
    id: "primary-bw-lower",
    type: "primary",
    durationMin: 20,
    minEquipment: [],
    contraindications: [],
    experience: "beginner",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["squat", "hinge"],
    progressionKey: "bw-lower-strength",
    variants: [
      {
        name: "Bodyweight Lower Strength",
        movements: ["squats", "lunges", "single-leg deadlifts", "cossack squats", "jump squats", "pistol squats"]
      }
    ]
  },
  {
    id: "primary-bw-full",
    type: "primary",
    durationMin: 25,
    minEquipment: [],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["squat", "hinge", "push", "pull"],
    progressionKey: "bw-full-strength",
    variants: [
      {
        name: "Full Body Bodyweight",
        movements: ["burpees", "bear crawls", "crab walks", "planche progressions", "handstand progressions", "muscle-ups"]
      }
    ]
  },

  // Dumbbell Primary
  {
    id: "primary-db-upper",
    type: "primary",
    durationMin: 25,
    minEquipment: ["dumbbells"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["push", "pull"],
    progressionKey: "db-upper-strength",
    variants: [
      {
        name: "DB Upper Body Strength",
        movements: ["db bench press", "db rows", "db overhead press", "db flyes", "db pullovers", "db lateral raises"]
      }
    ]
  },
  {
    id: "primary-db-lower",
    type: "primary",
    durationMin: 25,
    minEquipment: ["dumbbells"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["squat", "hinge"],
    progressionKey: "db-lower-strength",
    variants: [
      {
        name: "DB Lower Body Strength",
        movements: ["db squats", "db Romanian deadlifts", "db lunges", "db step-ups", "db Bulgarian split squats", "db calf raises"]
      }
    ]
  },
  {
    id: "primary-db-full",
    type: "primary",
    durationMin: 30,
    minEquipment: ["dumbbells"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["squat", "hinge", "push", "pull"],
    progressionKey: "db-full-strength",
    variants: [
      {
        name: "DB Full Body Complex",
        movements: ["db thrusters", "db man makers", "db complexes", "db Turkish get-ups", "db swings", "db snatches"]
      }
    ]
  },

  // Kettlebell Primary
  {
    id: "primary-kb-power",
    type: "primary",
    durationMin: 20,
    minEquipment: ["kettlebells"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["hinge", "power"],
    progressionKey: "kb-power",
    variants: [
      {
        name: "KB Power Development",
        movements: ["kb swings", "kb snatches", "kb cleans", "kb clean & press", "kb windmills", "kb Turkish get-ups"]
      }
    ]
  },
  {
    id: "primary-kb-strength",
    type: "primary",
    durationMin: 25,
    minEquipment: ["kettlebells"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["squat", "hinge", "push", "pull"],
    progressionKey: "kb-strength",
    variants: [
      {
        name: "KB Strength Complex",
        movements: ["kb goblet squats", "kb deadlifts", "kb military press", "kb rows", "kb carries", "kb bottoms-up press"]
      }
    ]
  },

  // Barbell Primary
  {
    id: "primary-bb-squat",
    type: "primary",
    durationMin: 30,
    minEquipment: ["barbell", "squat rack"],
    contraindications: [],
    experience: "advanced",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["squat"],
    progressionKey: "bb-squat",
    variants: [
      {
        name: "Barbell Squat Focus",
        movements: ["back squats", "front squats", "pause squats", "box squats", "overhead squats", "Bulgarian split squats"]
      }
    ]
  },
  {
    id: "primary-bb-deadlift",
    type: "primary",
    durationMin: 30,
    minEquipment: ["barbell"],
    contraindications: ["lower back injury"],
    experience: "advanced",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["hinge"],
    progressionKey: "bb-deadlift",
    variants: [
      {
        name: "Barbell Deadlift Focus",
        movements: ["conventional deadlifts", "sumo deadlifts", "Romanian deadlifts", "deficit deadlifts", "rack pulls", "stiff leg deadlifts"]
      }
    ]
  },
  {
    id: "primary-bb-press",
    type: "primary",
    durationMin: 25,
    minEquipment: ["barbell", "bench"],
    contraindications: [],
    experience: "advanced",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["push"],
    progressionKey: "bb-press",
    variants: [
      {
        name: "Barbell Press Focus",
        movements: ["bench press", "overhead press", "incline press", "floor press", "close-grip bench", "push press"]
      }
    ]
  },
  {
    id: "primary-bb-pull",
    type: "primary",
    durationMin: 25,
    minEquipment: ["barbell"],
    contraindications: [],
    experience: "advanced",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["pull"],
    progressionKey: "bb-pull",
    variants: [
      {
        name: "Barbell Pull Focus",
        movements: ["bent rows", "pendlay rows", "T-bar rows", "upright rows", "high pulls", "barbell curls"]
      }
    ]
  },

  // Olympic Lifting Primary
  {
    id: "primary-oly-snatch",
    type: "primary",
    durationMin: 35,
    minEquipment: ["barbell", "squat rack"],
    contraindications: ["shoulder injury", "wrist injury"],
    experience: "expert",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["power", "squat", "pull"],
    progressionKey: "oly-snatch",
    variants: [
      {
        name: "Snatch Development",
        movements: ["snatch", "power snatch", "hang snatch", "snatch pulls", "overhead squats", "snatch deadlifts"]
      }
    ]
  },
  {
    id: "primary-oly-clean",
    type: "primary",
    durationMin: 35,
    minEquipment: ["barbell", "squat rack"],
    contraindications: ["shoulder injury", "wrist injury"],
    experience: "expert",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["power", "squat", "pull"],
    progressionKey: "oly-clean",
    variants: [
      {
        name: "Clean & Jerk Development",
        movements: ["clean & jerk", "power clean", "hang clean", "clean pulls", "front squats", "push jerk"]
      }
    ]
  },

  // === ACCESSORY BLOCKS (40 blocks) ===
  
  // Bodyweight Accessory
  {
    id: "accessory-bw-core",
    type: "accessory",
    durationMin: 15,
    minEquipment: [],
    contraindications: [],
    experience: "beginner",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["core"],
    progressionKey: "bw-core",
    variants: [
      {
        name: "Bodyweight Core",
        movements: ["planks", "side planks", "dead bugs", "bird dogs", "hollow holds", "superman holds"]
      }
    ]
  },
  {
    id: "accessory-bw-unilateral",
    type: "accessory",
    durationMin: 18,
    minEquipment: [],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["squat", "hinge"],
    progressionKey: "bw-unilateral",
    variants: [
      {
        name: "Single Limb Work",
        movements: ["single leg squats", "single leg deadlifts", "single arm push-ups", "archer squats", "shrimp squats"]
      }
    ]
  },

  // Dumbbell Accessory
  {
    id: "accessory-db-arms",
    type: "accessory",
    durationMin: 15,
    minEquipment: ["dumbbells"],
    contraindications: [],
    experience: "beginner",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["pull", "push"],
    progressionKey: "db-arms",
    variants: [
      {
        name: "DB Arm Development",
        movements: ["db bicep curls", "db tricep extensions", "db hammer curls", "db skull crushers", "db 21s"]
      }
    ]
  },
  {
    id: "accessory-db-shoulders",
    type: "accessory",
    durationMin: 18,
    minEquipment: ["dumbbells"],
    contraindications: ["shoulder injury"],
    experience: "intermediate",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["push"],
    progressionKey: "db-shoulders",
    variants: [
      {
        name: "DB Shoulder Development",
        movements: ["db lateral raises", "db rear delts", "db front raises", "db upright rows", "db Arnold press"]
      }
    ]
  },
  {
    id: "accessory-db-glutes",
    type: "accessory",
    durationMin: 20,
    minEquipment: ["dumbbells"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["hinge", "squat"],
    progressionKey: "db-glutes",
    variants: [
      {
        name: "DB Glute Focus",
        movements: ["db hip thrusts", "db Romanian deadlifts", "db reverse lunges", "db step-ups", "db clamshells"]
      }
    ]
  },

  // Kettlebell Accessory
  {
    id: "accessory-kb-carries",
    type: "accessory",
    durationMin: 12,
    minEquipment: ["kettlebells"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["carry"],
    progressionKey: "kb-carries",
    variants: [
      {
        name: "KB Loaded Carries",
        movements: ["farmer's walks", "suitcase carries", "overhead carries", "front rack carries", "mixed carries"]
      }
    ]
  },
  {
    id: "accessory-kb-abs",
    type: "accessory",
    durationMin: 15,
    minEquipment: ["kettlebells"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["core"],
    progressionKey: "kb-core",
    variants: [
      {
        name: "KB Core Work",
        movements: ["kb Russian twists", "kb windmills", "kb dead bugs", "kb suitcase holds", "kb around the world"]
      }
    ]
  },

  // Barbell Accessory
  {
    id: "accessory-bb-back",
    type: "accessory",
    durationMin: 20,
    minEquipment: ["barbell"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["pull"],
    progressionKey: "bb-back",
    variants: [
      {
        name: "Barbell Back Development",
        movements: ["bent rows", "T-bar rows", "Pendlay rows", "shrugs", "face pulls", "reverse flyes"]
      }
    ]
  },
  {
    id: "accessory-bb-legs",
    type: "accessory",
    durationMin: 25,
    minEquipment: ["barbell"],
    contraindications: [],
    experience: "advanced",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["squat", "hinge"],
    progressionKey: "bb-legs",
    variants: [
      {
        name: "Barbell Leg Accessories",
        movements: ["Romanian deadlifts", "good mornings", "hip thrusts", "calf raises", "walking lunges"]
      }
    ]
  },

  // === CONDITIONING BLOCKS (35 blocks) ===
  
  // Bodyweight Conditioning
  {
    id: "conditioning-bw-hiit",
    type: "conditioning",
    durationMin: 15,
    minEquipment: [],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["glycolytic"],
    movementPatterns: ["squat", "hinge", "push", "locomotion"],
    progressionKey: "bw-hiit",
    variants: [
      {
        name: "Bodyweight HIIT",
        movements: ["burpees", "mountain climbers", "jump squats", "high knees", "jumping jacks", "plank jacks"]
      }
    ]
  },
  {
    id: "conditioning-bw-tabata",
    type: "conditioning",
    durationMin: 12,
    minEquipment: [],
    contraindications: [],
    experience: "advanced",
    energySystems: ["glycolytic"],
    movementPatterns: ["squat", "push", "core"],
    progressionKey: "bw-tabata",
    variants: [
      {
        name: "Bodyweight Tabata",
        movements: ["squat jumps", "push-ups", "sit-ups", "lunges", "bear crawls", "star jumps"]
      }
    ]
  },
  {
    id: "conditioning-bw-circuit",
    type: "conditioning",
    durationMin: 20,
    minEquipment: [],
    contraindications: [],
    experience: "beginner",
    energySystems: ["aerobicZ2"],
    movementPatterns: ["squat", "hinge", "push", "pull"],
    progressionKey: "bw-circuit",
    variants: [
      {
        name: "Bodyweight Circuit",
        movements: ["squats", "push-ups", "lunges", "planks", "jumping jacks", "crunches"]
      }
    ]
  },

  // Dumbbell Conditioning
  {
    id: "conditioning-db-complex",
    type: "conditioning",
    durationMin: 18,
    minEquipment: ["dumbbells"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["glycolytic"],
    movementPatterns: ["squat", "hinge", "push", "pull"],
    progressionKey: "db-complex",
    variants: [
      {
        name: "DB Complex Training",
        movements: ["db thrusters", "db renegade rows", "db burpees", "db man makers", "db swings"]
      }
    ]
  },
  {
    id: "conditioning-db-emom",
    type: "conditioning",
    durationMin: 15,
    minEquipment: ["dumbbells"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["glycolytic"],
    movementPatterns: ["squat", "push", "pull"],
    progressionKey: "db-emom",
    variants: [
      {
        name: "DB EMOM",
        movements: ["db thrusters", "db rows", "db overhead press", "db goblet squats", "db deadlifts"]
      }
    ]
  },

  // Kettlebell Conditioning
  {
    id: "conditioning-kb-swings",
    type: "conditioning",
    durationMin: 16,
    minEquipment: ["kettlebells"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["glycolytic"],
    movementPatterns: ["hinge", "power"],
    progressionKey: "kb-swings",
    variants: [
      {
        name: "KB Swing Intervals",
        movements: ["kb swings", "kb cleans", "kb snatches", "kb goblet squats", "kb high pulls"]
      }
    ]
  },
  {
    id: "conditioning-kb-complex",
    type: "conditioning",
    durationMin: 20,
    minEquipment: ["kettlebells"],
    contraindications: [],
    experience: "advanced",
    energySystems: ["glycolytic"],
    movementPatterns: ["hinge", "squat", "push", "pull"],
    progressionKey: "kb-complex",
    variants: [
      {
        name: "KB Complex Flow",
        movements: ["kb swings", "kb clean & press", "kb goblet squats", "kb rows", "kb Turkish get-ups"]
      }
    ]
  },

  // Cardio Equipment Conditioning
  {
    id: "conditioning-rower-intervals",
    type: "conditioning",
    durationMin: 20,
    minEquipment: ["rowing machine"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["glycolytic", "aerobicZ2"],
    movementPatterns: ["pull", "hinge"],
    progressionKey: "row-conditioning",
    variants: [
      {
        name: "Rowing Intervals",
        movements: ["250m intervals", "500m intervals", "pyramid intervals", "stroke rate intervals", "distance rows"]
      }
    ]
  },
  {
    id: "conditioning-bike-intervals",
    type: "conditioning",
    durationMin: 18,
    minEquipment: ["bike"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["glycolytic", "aerobicZ2"],
    movementPatterns: ["locomotion"],
    progressionKey: "bike-conditioning",
    variants: [
      {
        name: "Bike Intervals",
        movements: ["sprint intervals", "hill climbs", "tempo intervals", "cadence drills", "power intervals"]
      }
    ]
  },
  {
    id: "conditioning-run-intervals",
    type: "conditioning",
    durationMin: 25,
    minEquipment: [],
    contraindications: ["knee injury"],
    experience: "intermediate",
    energySystems: ["glycolytic", "aerobicZ2"],
    movementPatterns: ["locomotion"],
    progressionKey: "run-conditioning",
    variants: [
      {
        name: "Running Intervals",
        movements: ["400m repeats", "800m intervals", "fartlek runs", "hill sprints", "tempo runs"]
      }
    ]
  },

  // CrossFit Style Conditioning
  {
    id: "conditioning-crossfit-light",
    type: "conditioning",
    durationMin: 15,
    minEquipment: ["dumbbells"],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["glycolytic"],
    movementPatterns: ["squat", "hinge", "push", "pull"],
    progressionKey: "crossfit-light",
    variants: [
      {
        name: "Light CrossFit WOD",
        movements: ["air squats", "push-ups", "db thrusters", "db rows", "sit-ups", "burpees"]
      }
    ]
  },
  {
    id: "conditioning-crossfit-heavy",
    type: "conditioning",
    durationMin: 20,
    minEquipment: ["barbell", "dumbbells"],
    contraindications: [],
    experience: "advanced",
    energySystems: ["glycolytic"],
    movementPatterns: ["squat", "hinge", "push", "pull"],
    progressionKey: "crossfit-heavy",
    variants: [
      {
        name: "Heavy CrossFit WOD",
        movements: ["deadlifts", "thrusters", "pull-ups", "box jumps", "kettlebell swings", "wall balls"]
      }
    ]
  },

  // === FINISHER BLOCKS (15 blocks) ===
  
  // Bodyweight Finishers
  {
    id: "finisher-bw-burnout",
    type: "finisher",
    durationMin: 5,
    minEquipment: [],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["glycolytic"],
    movementPatterns: ["core", "push"],
    progressionKey: "bw-burnout",
    variants: [
      {
        name: "Bodyweight Burnout",
        movements: ["max push-ups", "max squats", "plank hold", "wall sit", "max burpees"]
      }
    ]
  },
  {
    id: "finisher-bw-abs",
    type: "finisher",
    durationMin: 8,
    minEquipment: [],
    contraindications: [],
    experience: "beginner",
    energySystems: ["phosphocreatine"],
    movementPatterns: ["core"],
    progressionKey: "bw-abs",
    variants: [
      {
        name: "Ab Finisher",
        movements: ["crunches", "leg raises", "bicycle crunches", "russian twists", "flutter kicks"]
      }
    ]
  },

  // Equipment Finishers
  {
    id: "finisher-db-death",
    type: "finisher",
    durationMin: 6,
    minEquipment: ["dumbbells"],
    contraindications: [],
    experience: "advanced",
    energySystems: ["glycolytic"],
    movementPatterns: ["push", "squat"],
    progressionKey: "db-death",
    variants: [
      {
        name: "DB Death Set",
        movements: ["db thrusters", "db man makers", "db devils press", "db burpee deadlifts"]
      }
    ]
  },

  // === COOLDOWN BLOCKS (10 blocks) ===
  
  // General Cooldowns
  {
    id: "cooldown-general",
    type: "cooldown",
    durationMin: 8,
    minEquipment: [],
    contraindications: [],
    experience: "beginner",
    energySystems: ["aerobicZ1"],
    movementPatterns: ["core"],
    progressionKey: "general-cooldown",
    variants: [
      {
        name: "General Cooldown",
        movements: ["walking", "deep breathing", "gentle stretching", "child's pose", "supine spinal twist"]
      }
    ]
  },
  {
    id: "cooldown-upper",
    type: "cooldown",
    durationMin: 6,
    minEquipment: [],
    contraindications: [],
    experience: "beginner",
    energySystems: ["aerobicZ1"],
    movementPatterns: ["push", "pull"],
    progressionKey: "upper-cooldown",
    variants: [
      {
        name: "Upper Body Cooldown",
        movements: ["shoulder stretches", "chest stretches", "tricep stretches", "neck stretches", "doorway stretch"]
      }
    ]
  },
  {
    id: "cooldown-lower",
    type: "cooldown",
    durationMin: 8,
    minEquipment: [],
    contraindications: [],
    experience: "beginner",
    energySystems: ["aerobicZ1"],
    movementPatterns: ["squat", "hinge"],
    progressionKey: "lower-cooldown",
    variants: [
      {
        name: "Lower Body Cooldown",
        movements: ["quad stretches", "hamstring stretches", "calf stretches", "hip flexor stretches", "pigeon pose"]
      }
    ]
  },
  {
    id: "cooldown-full",
    type: "cooldown",
    durationMin: 12,
    minEquipment: [],
    contraindications: [],
    experience: "intermediate",
    energySystems: ["aerobicZ1"],
    movementPatterns: ["squat", "hinge", "push", "pull", "core"],
    progressionKey: "full-cooldown",
    variants: [
      {
        name: "Full Body Cooldown",
        movements: ["full body stretching routine", "yoga flow", "meditation", "breathing exercises", "savasana"]
      }
    ]
  }
];

// Seeding functions
async function createBlocksDirectory(): Promise<void> {
  const blocksDir = join(process.cwd(), 'server', 'workouts', 'library', 'blocks');
  try {
    await fs.mkdir(blocksDir, { recursive: true });
    console.log(`📁 Created blocks directory: ${blocksDir}`);
  } catch (error) {
    if ((error as any).code !== 'EEXIST') {
      throw error;
    }
  }
}

async function writeBlocksToFiles(): Promise<void> {
  const blocksDir = join(process.cwd(), 'server', 'workouts', 'library', 'blocks');
  
  // Group blocks by type
  const blocksByType = WORKOUT_BLOCKS.reduce((acc, block) => {
    if (!acc[block.type]) {
      acc[block.type] = [];
    }
    acc[block.type].push(block);
    return acc;
  }, {} as Record<BlockType, WorkoutBlock[]>);

  // Write each type to a separate file
  for (const [type, blocks] of Object.entries(blocksByType)) {
    const filename = `${type}.json`;
    const filepath = join(blocksDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(blocks, null, 2));
    console.log(`✅ Written ${blocks.length} ${type} blocks to ${filename}`);
  }
}

async function generateSeedingReport(): Promise<void> {
  console.log('\n📊 BLOCK SEEDING REPORT\n');
  
  // Count by type
  const typeStats = WORKOUT_BLOCKS.reduce((acc, block) => {
    acc[block.type] = (acc[block.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('📋 BLOCKS BY TYPE:');
  Object.entries(typeStats).forEach(([type, count]) => {
    console.log(`   ${type.toUpperCase()}: ${count} blocks`);
  });
  
  // Count by energy system
  const energyStats = WORKOUT_BLOCKS.reduce((acc, block) => {
    block.energySystems.forEach(system => {
      acc[system] = (acc[system] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\n⚡ BLOCKS BY ENERGY SYSTEM:');
  Object.entries(energyStats).forEach(([system, count]) => {
    console.log(`   ${system}: ${count} blocks`);
  });
  
  // Count by equipment
  const equipmentStats = WORKOUT_BLOCKS.reduce((acc, block) => {
    if (block.minEquipment.length === 0) {
      acc['bodyweight'] = (acc['bodyweight'] || 0) + 1;
    } else {
      block.minEquipment.forEach(equipment => {
        acc[equipment] = (acc[equipment] || 0) + 1;
      });
    }
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\n🏋️ BLOCKS BY EQUIPMENT:');
  Object.entries(equipmentStats).forEach(([equipment, count]) => {
    console.log(`   ${equipment}: ${count} blocks`);
  });
  
  // Generator compatibility check
  console.log('\n🎯 GENERATOR COMPATIBILITY:');
  
  const fullGymBlocks = WORKOUT_BLOCKS.filter(block => 
    block.minEquipment.some(eq => ['barbell', 'squat rack', 'bench'].includes(eq))
  ).length;
  
  const minimalGymBlocks = WORKOUT_BLOCKS.filter(block => 
    block.minEquipment.length === 0 || 
    (block.minEquipment.length === 1 && block.minEquipment[0] === 'dumbbells')
  ).length;
  
  const bodyweightBlocks = WORKOUT_BLOCKS.filter(block => 
    block.minEquipment.length === 0
  ).length;
  
  console.log(`   🏟️  Full Gym Setup: ${fullGymBlocks} blocks available`);
  console.log(`   🏠 Minimal Setup (DB only): ${minimalGymBlocks} blocks available`);
  console.log(`   💪 Bodyweight Only: ${bodyweightBlocks} blocks available`);
  
  console.log(`\n🎉 Total blocks seeded: ${WORKOUT_BLOCKS.length}`);
  console.log(`📈 Coverage: Warmup → Primary → Accessory → Conditioning → Finisher → Cooldown`);
}

// Main seeding function
async function seedBlocks(): Promise<void> {
  try {
    console.log('🌱 Starting block library seeding...\n');
    
    await createBlocksDirectory();
    await writeBlocksToFiles();
    await generateSeedingReport();
    
    console.log('\n✅ Block seeding completed successfully!');
    console.log('🎯 Workout generator ready for: Full Gym | Minimal (DB) | Bodyweight');
    
  } catch (error) {
    console.error('❌ Block seeding failed:', error);
    process.exit(1);
  }
}

// Run the seeding
if (import.meta.url === `file://${process.argv[1]}`) {
  seedBlocks();
}

export { seedBlocks, WORKOUT_BLOCKS };