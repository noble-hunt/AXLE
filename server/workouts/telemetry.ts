import crypto from "crypto";
import * as Sentry from "@sentry/node";
import { storage } from "../storage.js";
import type { InsertWorkoutEvent } from "../../shared/schema.js";

// Interface for generation event data
export interface GenerationEventData {
  selectedFocus: string;
  targetIntensity: number;
  blockIds: string[];
  estimatedTSS: number;
  metricsSnapshot: {
    vitality?: number;
    performance?: number;
    circadian?: number;
    balance?: number;
    fatigue?: number;
    stress?: number;
    hrv?: number;
    sleepScore?: number;
    restingHR?: number;
    performancePotential?: number;
    energyBalance?: number;
    uvMax?: number;
  };
  workoutRequest: {
    category: string;
    duration: number;
    intensity: number;
    equipment?: string[];
  };
  v2Request?: any; // Full V2 request for analysis
}

// Interface for feedback event data
export interface FeedbackEventData {
  feedbackType: 'difficulty' | 'completion' | 'rpe' | 'overall';
  difficultyRating?: 'easy' | 'moderate' | 'hard'; // easy/hard rating
  rpe?: number; // Rate of Perceived Exertion (1-10)
  completionPercentage?: number; // 0-100%
  overallSatisfaction?: number; // 1-10 satisfaction rating
  comments?: string;
  sessionDuration?: number; // actual workout duration in minutes
}

// Create hash of request for deduplication
export function createRequestHash(data: any): string {
  const hash = crypto.createHash('sha256');
  // Normalize the data by sorting keys to ensure consistent hashing
  const normalizedData = JSON.stringify(data, Object.keys(data).sort());
  hash.update(normalizedData);
  return hash.digest('hex');
}

// Log workout generation event
export async function logGenerationEvent(
  userId: string,
  eventData: GenerationEventData,
  responseTimeMs: number,
  generationId?: string
): Promise<void> {
  try {
    const requestHash = createRequestHash(eventData.workoutRequest);
    
    // Add Sentry breadcrumb for monitoring
    Sentry.addBreadcrumb({
      category: 'workout.generate',
      message: 'Workout generation event logged',
      level: 'info',
      data: {
        userId,
        generationId,
        requestHash,
        targetIntensity: eventData.targetIntensity,
        selectedFocus: eventData.selectedFocus,
        blockCount: eventData.blockIds.length,
        estimatedTSS: eventData.estimatedTSS,
        responseTimeMs,
        hasMetrics: Object.keys(eventData.metricsSnapshot).length > 0
      }
    });

    const workoutEvent: InsertWorkoutEvent = {
      userId,
      event: 'generate',
      generationId,
      requestHash,
      payload: eventData,
      responseTimeMs,
    };

    await storage.createWorkoutEvent(workoutEvent);
    
    console.log(`🎯 [TELEMETRY] Generation event logged for user ${userId}, generation ${generationId}, hash ${requestHash.substring(0, 8)}`);
  } catch (error) {
    console.error('❌ [TELEMETRY] Failed to log generation event:', error);
    Sentry.captureException(error, {
      tags: { eventType: 'generation_telemetry_error' },
      extra: { userId, generationId }
    });
  }
}

// Log workout feedback event
export async function logFeedbackEvent(
  userId: string,
  workoutId: string,
  generationId: string,
  eventData: FeedbackEventData
): Promise<void> {
  try {
    // Add Sentry breadcrumb for monitoring
    Sentry.addBreadcrumb({
      category: 'workout.feedback',
      message: 'Workout feedback event logged',
      level: 'info',
      data: {
        userId,
        workoutId,
        generationId,
        feedbackType: eventData.feedbackType,
        difficultyRating: eventData.difficultyRating,
        rpe: eventData.rpe,
        completionPercentage: eventData.completionPercentage,
        overallSatisfaction: eventData.overallSatisfaction
      }
    });

    const workoutEvent: InsertWorkoutEvent = {
      userId,
      event: 'feedback',
      workoutId,
      generationId,
      payload: eventData,
    };

    await storage.createWorkoutEvent(workoutEvent);
    
    console.log(`💭 [TELEMETRY] Feedback event logged for user ${userId}, workout ${workoutId}, generation ${generationId}`);
  } catch (error) {
    console.error('❌ [TELEMETRY] Failed to log feedback event:', error);
    Sentry.captureException(error, {
      tags: { eventType: 'feedback_telemetry_error' },
      extra: { userId, workoutId, generationId }
    });
  }
}

// Utility function to get telemetry stats (for monitoring)
export async function getTelemetryStats(userId?: string): Promise<{
  totalGenerationEvents: number;
  totalFeedbackEvents: number;
  recentGenerations: number;
  recentFeedback: number;
}> {
  try {
    const stats = await storage.getWorkoutEventStats(userId);
    return stats;
  } catch (error) {
    console.error('❌ [TELEMETRY] Failed to get telemetry stats:', error);
    return {
      totalGenerationEvents: 0,
      totalFeedbackEvents: 0,
      recentGenerations: 0,
      recentFeedback: 0
    };
  }
}

// Utility to extract metrics snapshot from available health data
export function extractMetricsSnapshot(healthData?: any): GenerationEventData['metricsSnapshot'] {
  if (!healthData) return {};
  
  return {
    vitality: healthData.vitality || undefined,
    performance: healthData.performance || undefined,
    circadian: healthData.circadian || undefined,
    balance: healthData.balance || undefined,
    fatigue: healthData.fatigue || healthData.fatigueScore || undefined,
    stress: healthData.stress || undefined,
    hrv: healthData.hrv || undefined,
    sleepScore: healthData.sleepScore || undefined,
    restingHR: healthData.restingHR || healthData.restingHeartRate || undefined,
    performancePotential: healthData.performancePotential || undefined,
    energyBalance: healthData.energyBalance || undefined,
    uvMax: healthData.uvMax || undefined,
  };
}