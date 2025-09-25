/**
 * Workout Generation Engine
 * 
 * Deterministically assembles workouts with progression, safety guardrails,
 * and biometric-driven adaptation.
 */

import { z } from 'zod';
import { WorkoutRequest, WorkoutPlan, Block } from '../types';
import { getBlocks, getBlockById, type WorkoutBlock, type BlockFilter } from './library/index';

// Engine-specific types
export interface WorkoutFocus {
  primary: 'strength' | 'conditioning' | 'technique' | 'recovery';
  energySystem: 'alactic' | 'phosphocreatine' | 'glycolytic' | 'aerobicZ1' | 'aerobicZ2' | 'aerobicZ3';
  movementPattern: 'squat' | 'hinge' | 'push' | 'pull' | 'carry' | 'locomotion' | 'power' | 'core';
  rationale: string;
}

export interface ProgressionState {
  progressionKey: string;
  weekNumber: number;
  microcycleDay: number;
  lastVolume?: number;
  lastIntensity?: number;
  cumulativeTSS?: number;
  lastPerformed?: string; // ISO date
}

export interface BiometricInputs {
  performancePotential?: number; // 0-100
  vitality?: number; // 0-100
  sleepScore?: number; // 0-100
  hrv?: number;
  restingHR?: number;
}

export interface WorkoutHistory {
  date: string;
  primaryPattern: string;
  energySystems: string[];
  estimatedTSS: number;
  intensityRating?: number; // 1-10 user feedback
}

export interface EngineConstraints {
  availableMinutes: number;
  equipment: string[];
  contraindications: string[];
  userGoal: string;
  dayOfWeek: number; // 0-6
}

export interface SelectionRationale {
  step: string;
  decision: string;
  factors: string[];
  metrics?: Record<string, number>;
}

// Main engine function
export function generateWorkoutPlan(
  request: WorkoutRequest,
  history: WorkoutHistory[] = [],
  progressionStates: ProgressionState[] = [],
  biometrics: BiometricInputs = {}
): WorkoutPlan {
  const rationale: SelectionRationale[] = [];
  
  // 1. Determine workout focus
  const focus = determineFocus(request, history, biometrics, rationale);
  
  // 2. Calculate target intensity
  const targetIntensity = calculateTargetIntensity(biometrics, history, rationale);
  
  // 3. Apply safety guardrails
  const safetyAdjustments = applySafetyGuardrails(focus, targetIntensity, biometrics, rationale);
  const adjustedFocus = safetyAdjustments.focus || focus;
  const adjustedIntensity = safetyAdjustments.intensity || targetIntensity;
  
  // 4. Compose workout blocks
  const selectedBlocks = composeWorkout(
    adjustedFocus,
    adjustedIntensity,
    request,
    history,
    rationale
  );
  
  // 5. Apply progression
  const blocksWithProgression = applyProgression(
    selectedBlocks,
    progressionStates,
    rationale
  );
  
  // 6. Build final workout plan
  const workoutPlan: WorkoutPlan = {
    id: generateWorkoutId(),
    title: generateWorkoutTitle(adjustedFocus, adjustedIntensity),
    estimatedDuration: blocksWithProgression.reduce((sum, block) => sum + block.durationMin, 0),
    targetIntensity: adjustedIntensity,
    blocks: blocksWithProgression,
    rationale: rationale.map(r => `${r.step}: ${r.decision} (${r.factors.join(', ')})`),
    progressionNotes: generateProgressionNotes(blocksWithProgression, progressionStates)
  };
  
  return workoutPlan;
}

// Focus determination based on goals, scheduling, and biometrics
function determineFocus(
  request: WorkoutRequest,
  history: WorkoutHistory[],
  biometrics: BiometricInputs,
  rationale: SelectionRationale[]
): WorkoutFocus {
  const factors: string[] = [];
  let primary: WorkoutFocus['primary'] = 'conditioning';
  let energySystem: WorkoutFocus['energySystem'] = 'aerobicZ2';
  let movementPattern: WorkoutFocus['movementPattern'] = 'squat';
  
  // Analyze recent history (last 7 days)
  const recentHistory = history.filter(h => 
    new Date(h.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );
  
  // Check for 48h pattern avoidance
  const last48h = history.filter(h => 
    new Date(h.date) > new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  );
  const recentPatterns = last48h.map(h => h.primaryPattern);
  
  // Biometric-driven decisions
  const performancePotential = biometrics.performancePotential || 50;
  const vitality = biometrics.vitality || 50;
  const sleepScore = biometrics.sleepScore || 70;
  
  if (performancePotential >= 70 && vitality >= 60) {
    primary = 'strength';
    energySystem = 'phosphocreatine';
    factors.push(`High performance potential (${performancePotential}) and vitality (${vitality})`);
  } else if (vitality < 40 || sleepScore < 60) {
    primary = 'recovery';
    energySystem = 'aerobicZ2';
    factors.push(`Low vitality (${vitality}) or poor sleep (${sleepScore})`);
  } else {
    // Default to conditioning
    primary = 'conditioning';
    energySystem = 'glycolytic';
    factors.push('Moderate biometrics, defaulting to conditioning');
  }
  
  // Movement pattern selection based on history
  const movementPatterns: WorkoutFocus['movementPattern'][] = ['squat', 'hinge', 'push', 'pull'];
  const patternCounts = movementPatterns.map(pattern => ({
    pattern,
    count: recentHistory.filter(h => h.primaryPattern === pattern).length
  }));
  
  // Select least used pattern, avoiding 48h repeats
  const availablePatterns = movementPatterns.filter(p => !recentPatterns.includes(p));
  if (availablePatterns.length > 0) {
    const leastUsed = patternCounts
      .filter(pc => availablePatterns.includes(pc.pattern))
      .sort((a, b) => a.count - b.count)[0];
    movementPattern = leastUsed.pattern;
    factors.push(`Selected ${movementPattern} (least used, no 48h conflict)`);
  } else {
    // All patterns used recently, pick least used overall
    movementPattern = patternCounts.sort((a, b) => a.count - b.count)[0].pattern;
    factors.push(`Selected ${movementPattern} (least used overall)`);
  }
  
  // Energy system balance over 7 days
  const energySystemCounts = recentHistory.reduce((acc, h) => {
    h.energySystems.forEach(es => {
      acc[es] = (acc[es] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);
  
  // Adjust energy system for balance
  const allEnergySystems: WorkoutFocus['energySystem'][] = [
    'alactic', 'phosphocreatine', 'glycolytic', 'aerobicZ1', 'aerobicZ2', 'aerobicZ3'
  ];
  const leastUsedEnergySystem = allEnergySystems
    .map(es => ({ es, count: energySystemCounts[es] || 0 }))
    .sort((a, b) => a.count - b.count)[0];
  
  if (primary !== 'recovery') {
    energySystem = leastUsedEnergySystem.es;
    factors.push(`Energy system balance: ${energySystem} least used`);
  }
  
  rationale.push({
    step: 'Focus Determination',
    decision: `Primary: ${primary}, Energy: ${energySystem}, Pattern: ${movementPattern}`,
    factors,
    metrics: { performancePotential, vitality, sleepScore }
  });
  
  return {
    primary,
    energySystem,
    movementPattern,
    rationale: factors.join('; ')
  };
}

// Target intensity calculation
function calculateTargetIntensity(
  biometrics: BiometricInputs,
  history: WorkoutHistory[],
  rationale: SelectionRationale[]
): number {
  const factors: string[] = [];
  let intensity = 5; // Base intensity
  
  const performancePotential = biometrics.performancePotential || 50;
  const vitality = biometrics.vitality || 50;
  
  // Primary factor: Performance Potential
  intensity = Math.round(performancePotential / 10);
  factors.push(`Base from performance potential: ${intensity}`);
  
  // Modifier: Vitality
  const vitalityModifier = (vitality - 50) / 50; // -1 to 1
  intensity += Math.round(vitalityModifier * 2);
  factors.push(`Vitality modifier: ${vitalityModifier.toFixed(2)} (${vitality})`);
  
  // Recent feedback modifier
  const recentWorkouts = history.slice(-3);
  const highIntensityFeedback = recentWorkouts.filter(w => w.intensityRating && w.intensityRating >= 9);
  
  if (highIntensityFeedback.length >= 2) {
    intensity -= 1;
    factors.push('Recent high intensity feedback - reducing');
  }
  
  // Microcycle deload check
  const microcycleDay = (new Date().getDay() + 1) % 7; // Assuming Monday = day 1
  if (microcycleDay === 0) { // Every 4th microcycle (simplified to weekly)
    const weeklyTSS = history
      .filter(h => new Date(h.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .reduce((sum, h) => sum + h.estimatedTSS, 0);
    
    if (weeklyTSS > 300) { // TSS threshold
      intensity = Math.min(intensity, 4);
      factors.push(`Deload: Weekly TSS (${weeklyTSS}) exceeds threshold`);
    }
  }
  
  // Clamp to valid range
  intensity = Math.max(1, Math.min(10, intensity));
  
  rationale.push({
    step: 'Intensity Calculation',
    decision: `Target intensity: ${intensity}/10`,
    factors,
    metrics: { performancePotential, vitality, intensity }
  });
  
  return intensity;
}

// Safety guardrails and adjustments
function applySafetyGuardrails(
  focus: WorkoutFocus,
  intensity: number,
  biometrics: BiometricInputs,
  rationale: SelectionRationale[]
): { focus?: WorkoutFocus; intensity?: number } {
  const adjustments: { focus?: WorkoutFocus; intensity?: number } = {};
  const factors: string[] = [];
  
  const vitality = biometrics.vitality || 50;
  const sleepScore = biometrics.sleepScore || 70;
  
  // Force recovery mode for very low vitality
  if (vitality < 40) {
    adjustments.focus = {
      ...focus,
      primary: 'recovery',
      energySystem: 'aerobicZ2'
    };
    adjustments.intensity = Math.min(intensity, 4);
    factors.push(`Vitality ${vitality} < 40: Forced recovery mode`);
  }
  
  // Reduce intensity for poor sleep
  if (sleepScore < 60) {
    adjustments.intensity = Math.min(intensity, 6);
    factors.push(`Sleep score ${sleepScore} < 60: Capped intensity at 6`);
  }
  
  if (factors.length > 0) {
    rationale.push({
      step: 'Safety Guardrails',
      decision: 'Applied safety adjustments',
      factors,
      metrics: { vitality, sleepScore }
    });
  }
  
  return adjustments;
}

// Workout composition
function composeWorkout(
  focus: WorkoutFocus,
  intensity: number,
  request: WorkoutRequest,
  history: WorkoutHistory[],
  rationale: SelectionRationale[]
): Block[] {
  const blocks: Block[] = [];
  const factors: string[] = [];
  let remainingMinutes = request.availableMinutes || 45;
  
  // 1. Warm-up (6-10 min)
  const warmupBlocks = getBlocks({
    type: 'warmup',
    movementPattern: focus.movementPattern,
    maxDuration: Math.min(10, remainingMinutes * 0.2)
  });
  
  if (warmupBlocks.length > 0) {
    const warmup = selectBestBlock(warmupBlocks, 'warmup', intensity);
    blocks.push(convertToBlock(warmup));
    remainingMinutes -= warmup.durationMin;
    factors.push(`Warmup: ${warmup.id} (${warmup.durationMin}min)`);
  }
  
  // 2. Primary block
  const primaryBlocks = getBlocks({
    type: 'primary',
    movementPattern: focus.movementPattern,
    energySystem: focus.energySystem,
    equipment: request.equipment,
    contraindications: request.contraindications,
    maxDuration: remainingMinutes * 0.6
  });
  
  if (primaryBlocks.length > 0) {
    const primary = selectBestBlock(primaryBlocks, 'primary', intensity);
    blocks.push(convertToBlock(primary));
    remainingMinutes -= primary.durationMin;
    factors.push(`Primary: ${primary.id} (${primary.durationMin}min)`);
  }
  
  // 3. Accessory (if time allows)
  if (remainingMinutes > 15) {
    const accessoryBlocks = getBlocks({
      type: 'accessory',
      equipment: request.equipment,
      contraindications: request.contraindications,
      maxDuration: Math.min(12, remainingMinutes * 0.4)
    });
    
    if (accessoryBlocks.length > 0) {
      const accessory = selectBestBlock(accessoryBlocks, 'accessory', intensity);
      blocks.push(convertToBlock(accessory));
      remainingMinutes -= accessory.durationMin;
      factors.push(`Accessory: ${accessory.id} (${accessory.durationMin}min)`);
    }
  }
  
  // 4. Conditioning/Finisher
  if (remainingMinutes > 8 && focus.primary !== 'recovery') {
    const conditioningBlocks = getBlocks({
      type: intensity >= 7 ? 'conditioning' : 'finisher',
      energySystem: focus.energySystem,
      equipment: request.equipment,
      contraindications: request.contraindications,
      maxDuration: remainingMinutes - 5 // Save time for cooldown
    });
    
    if (conditioningBlocks.length > 0) {
      const conditioning = selectBestBlock(conditioningBlocks, 'conditioning', intensity);
      blocks.push(convertToBlock(conditioning));
      remainingMinutes -= conditioning.durationMin;
      factors.push(`Conditioning: ${conditioning.id} (${conditioning.durationMin}min)`);
    }
  }
  
  // 5. Cooldown (3-6 min)
  if (remainingMinutes >= 3) {
    const cooldownBlocks = getBlocks({
      type: 'cooldown',
      maxDuration: Math.min(6, remainingMinutes)
    });
    
    if (cooldownBlocks.length > 0) {
      const cooldown = selectBestBlock(cooldownBlocks, 'cooldown', intensity);
      blocks.push(convertToBlock(cooldown));
      factors.push(`Cooldown: ${cooldown.id} (${cooldown.durationMin}min)`);
    }
  }
  
  // Fallback for no equipment/tight time
  if (blocks.length === 0 || (!request.equipment?.length && request.availableMinutes && request.availableMinutes < 20)) {
    return createBodyweightFallback(request.availableMinutes || 15);
  }
  
  rationale.push({
    step: 'Block Composition',
    decision: `Selected ${blocks.length} blocks`,
    factors
  });
  
  return blocks;
}

// Block selection scoring
function selectBestBlock(candidates: WorkoutBlock[], blockType: string, targetIntensity: number): WorkoutBlock {
  if (candidates.length === 1) return candidates[0];
  
  return candidates.reduce((best, candidate) => {
    const bestScore = scoreBlock(best, blockType, targetIntensity);
    const candidateScore = scoreBlock(candidate, blockType, targetIntensity);
    return candidateScore > bestScore ? candidate : best;
  });
}

function scoreBlock(block: WorkoutBlock, blockType: string, targetIntensity: number): number {
  let score = 0;
  
  // Base score for experience level match
  const experienceScores = { beginner: 6, intermediate: 8, advanced: 10, expert: 9 };
  score += experienceScores[block.experience] || 5;
  
  // Intensity alignment (simplified)
  const blockIntensity = estimateBlockIntensity(block);
  const intensityDiff = Math.abs(blockIntensity - targetIntensity);
  score += Math.max(0, 10 - intensityDiff);
  
  // Variety bonus (more variants = better)
  score += Math.min(5, block.variants.length);
  
  return score;
}

function estimateBlockIntensity(block: WorkoutBlock): number {
  // Simplified intensity estimation based on energy systems and type
  if (block.energySystems.includes('phosphocreatine')) return 8;
  if (block.energySystems.includes('glycolytic')) return 7;
  if (block.energySystems.includes('aerobicZ3')) return 6;
  if (block.energySystems.includes('aerobicZ2')) return 4;
  if (block.energySystems.includes('aerobicZ1')) return 3;
  return 5;
}

// Progression application
function applyProgression(
  blocks: Block[],
  progressionStates: ProgressionState[],
  rationale: SelectionRationale[]
): Block[] {
  const factors: string[] = [];
  
  return blocks.map(block => {
    const progressionState = progressionStates.find(ps => ps.progressionKey === block.progressionKey);
    
    if (progressionState) {
      // Apply week-based progression
      const weekNumber = progressionState.weekNumber || 1;
      const progressedBlock = { ...block };
      
      // Simple progression example - adjust load/volume based on week
      if (block.type === 'primary') {
        const baseLoad = 70; // Base percentage
        const weeklyIncrease = 5;
        const newLoad = Math.min(90, baseLoad + (weekNumber - 1) * weeklyIncrease);
        
        progressedBlock.notes = `Week ${weekNumber}: ${newLoad}% intensity`;
        factors.push(`${block.id}: Week ${weekNumber} progression (${newLoad}%)`);
      }
      
      return progressedBlock;
    }
    
    return block;
  });
}

// Helper functions
function generateWorkoutId(): string {
  return `wkt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateWorkoutTitle(focus: WorkoutFocus, intensity: number): string {
  const focusNames = {
    strength: 'Strength',
    conditioning: 'Conditioning', 
    technique: 'Technique',
    recovery: 'Recovery'
  };
  
  const intensityNames = ['', 'Easy', 'Light', 'Moderate', 'Moderate+', 'Challenging', 
                         'Hard', 'Very Hard', 'Intense', 'Max', 'All-Out'];
  
  return `${focusNames[focus.primary]} - ${intensityNames[intensity] || 'Moderate'}`;
}

function generateProgressionNotes(blocks: Block[], progressionStates: ProgressionState[]): string[] {
  return blocks
    .filter(block => block.progressionKey)
    .map(block => {
      const state = progressionStates.find(ps => ps.progressionKey === block.progressionKey);
      return state 
        ? `${block.id}: Week ${state.weekNumber || 1} of progression`
        : `${block.id}: Starting new progression`;
    });
}

function convertToBlock(workoutBlock: WorkoutBlock): Block {
  // Select a variant (simplified - could be more sophisticated)
  const variant = workoutBlock.variants[0];
  
  return {
    id: workoutBlock.id,
    type: workoutBlock.type,
    title: variant.name,
    durationMin: workoutBlock.durationMin,
    exercises: variant.movements.map(movement => ({
      name: movement,
      sets: 1,
      reps: undefined,
      weight: undefined,
      notes: undefined
    })),
    progressionKey: workoutBlock.progressionKey,
    notes: undefined
  };
}

function createBodyweightFallback(availableMinutes: number): Block[] {
  const duration = Math.max(10, availableMinutes);
  
  return [{
    id: 'bodyweight-fallback',
    type: 'primary',
    title: 'Bodyweight Circuit',
    durationMin: duration,
    exercises: [
      { name: 'Bodyweight squats', sets: 3, reps: 15 },
      { name: 'Push-ups', sets: 3, reps: 10 },
      { name: 'Walking/jogging', sets: 1, reps: undefined, notes: `${Math.max(5, Math.floor(duration/2))} minutes` }
    ],
    progressionKey: 'bodyweight-basic',
    notes: 'Equipment-free workout'
  }];
}