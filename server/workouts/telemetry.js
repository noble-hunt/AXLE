import crypto from "crypto";
import * as Sentry from "@sentry/node";
import { storage } from "../storage.js";
// Create hash of request for deduplication
export function createRequestHash(data) {
    const hash = crypto.createHash('sha256');
    // Normalize the data by sorting keys to ensure consistent hashing
    const normalizedData = JSON.stringify(data, Object.keys(data).sort());
    hash.update(normalizedData);
    return hash.digest('hex');
}
// Log workout generation event
export async function logGenerationEvent(userId, eventData, responseTimeMs, generationId) {
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
        const workoutEvent = {
            userId,
            event: 'generate',
            generationId,
            requestHash,
            payload: eventData,
            responseTimeMs,
        };
        await storage.createWorkoutEvent(workoutEvent);
        console.log(`🎯 [TELEMETRY] Generation event logged for user ${userId}, generation ${generationId}, hash ${requestHash.substring(0, 8)}`);
    }
    catch (error) {
        console.error('❌ [TELEMETRY] Failed to log generation event:', error);
        Sentry.captureException(error, {
            tags: { eventType: 'generation_telemetry_error' },
            extra: { userId, generationId }
        });
    }
}
// Log workout feedback event
export async function logFeedbackEvent(userId, workoutId, generationId, eventData) {
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
        const workoutEvent = {
            userId,
            event: 'feedback',
            workoutId,
            generationId,
            payload: eventData,
        };
        await storage.createWorkoutEvent(workoutEvent);
        console.log(`💭 [TELEMETRY] Feedback event logged for user ${userId}, workout ${workoutId}, generation ${generationId}`);
    }
    catch (error) {
        console.error('❌ [TELEMETRY] Failed to log feedback event:', error);
        Sentry.captureException(error, {
            tags: { eventType: 'feedback_telemetry_error' },
            extra: { userId, workoutId, generationId }
        });
    }
}
// Utility function to get telemetry stats (for monitoring)
export async function getTelemetryStats(userId) {
    try {
        const stats = await storage.getWorkoutEventStats(userId);
        return stats;
    }
    catch (error) {
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
export function extractMetricsSnapshot(healthData) {
    if (!healthData)
        return {};
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
