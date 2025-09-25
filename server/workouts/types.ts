/**
 * Workout Generation v2 Types
 * 
 * Stable server interface for UI and future ML policy integration
 */

export interface WorkoutRequest {
  date: string;
  userId: string;
  goal: string;
  availableMinutes: number;
  equipment: string[];
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  injuries: string[];
  preferredDays: string[];
  recentHistory: WorkoutHistoryItem[];
  metricsSnapshot: MetricsSnapshot;
  intensityFeedback: IntensityFeedback[];
}

export interface WorkoutHistoryItem {
  date: string;
  workoutType: string;
  intensity: number;
  duration: number;
  notes?: string;
}

export interface MetricsSnapshot {
  vitality: number;
  performancePotential: number;
  circadianAlignment: number;
  fatigueScore: number;
  hrv?: number;
  rhr?: number;
  sleepScore?: number;
  steps?: number;
}

export interface IntensityFeedback {
  date: string;
  perceivedIntensity: number; // 1-10 scale
  workoutId: string;
}

export interface WorkoutPlan {
  focus: WorkoutFocus;
  targetIntensity: number; // 1-10 scale
  targetRPE: RPEZone;
  blocks: Block[];
  estimatedCalories: number;
  estimatedTSS: number;
  rationale: string[];
}

export type WorkoutFocus = 
  | 'Strength Upper'
  | 'Strength Lower' 
  | 'Hybrid MetCon'
  | 'Endurance Zone2'
  | 'Power Development'
  | 'Recovery Active'
  | 'Mobility Focus';

export interface RPEZone {
  min: number;
  max: number;
  target: number;
}

export interface Block {
  type: BlockType;
  energySystems: EnergySystem[];
  movements: Movement[];
  prescription: Prescription;
  rest: RestPrescription;
  notes: string;
  scaling: ScalingOptions;
}

export type BlockType = 
  | 'warmup'
  | 'primary'
  | 'accessory'
  | 'conditioning'
  | 'finisher'
  | 'cooldown';

export type EnergySystem = 
  | 'phosphocreatine'
  | 'glycolytic'
  | 'oxidative'
  | 'mixed';

export interface Movement {
  name: string;
  category: MovementCategory;
  primaryMuscles: string[];
  equipment: string[];
  complexity: 'simple' | 'moderate' | 'complex' | 'advanced';
}

export type MovementCategory =
  | 'squat'
  | 'hinge'
  | 'push'
  | 'pull'
  | 'carry'
  | 'locomotion'
  | 'power'
  | 'core';

export interface Prescription {
  reps?: number | string;
  sets?: number;
  time?: number; // seconds
  load: LoadPrescription;
}

export interface LoadPrescription {
  type: 'RPE' | '%1RM' | 'pace' | 'zone' | 'bodyweight' | 'time_based';
  value: number | string;
  unit?: string;
}

export interface RestPrescription {
  betweenSets?: number; // seconds
  betweenMovements?: number; // seconds
  betweenBlocks?: number; // seconds
  type: 'complete' | 'incomplete' | 'active';
}

export interface ScalingOptions {
  beginner?: string;
  intermediate?: string;
  advanced?: string;
  injury?: Record<string, string>; // injury type -> modification
}