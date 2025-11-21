import { db } from "../db.js";
import { healthReports } from "../../shared/schema.js";
import { eq, and, gte } from "drizzle-orm";
import { computeAxleScores } from "../metrics/axle.js";
/**
 * Backfill Axle scores for a user's health reports
 * @param userId - User ID to backfill scores for
 * @param days - Number of days to backfill (default 30)
 * @param force - Force recomputation even if Axle scores already exist
 */
export async function backfillAxleScores(userId, days = 30, force = false) {
    console.log(`[AXLE_BACKFILL] Starting backfill for user ${userId}, ${days} days, force=${force}`);
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];
    try {
        // Fetch health reports in the date range
        const reports = await db
            .select()
            .from(healthReports)
            .where(and(eq(healthReports.userId, userId), gte(healthReports.date, startDateStr)))
            .orderBy(healthReports.date);
        console.log(`[AXLE_BACKFILL] Found ${reports.length} health reports to process`);
        const results = [];
        let updated = 0;
        let skipped = 0;
        let failed = 0;
        for (const report of reports) {
            const dateStr = report.date;
            try {
                const currentMetrics = report.metrics || {};
                // Check if Axle scores already exist and force is not enabled
                if (!force && currentMetrics.axle && Object.keys(currentMetrics.axle).length > 0) {
                    console.log(`[AXLE_BACKFILL] Skipping ${dateStr} - Axle scores already exist`);
                    results.push({
                        date: dateStr,
                        success: true,
                        action: 'skipped',
                    });
                    skipped++;
                    continue;
                }
                // Check if we have sufficient provider data to compute Axle scores
                if (!currentMetrics.provider) {
                    console.log(`[AXLE_BACKFILL] Skipping ${dateStr} - No provider data available`);
                    results.push({
                        date: dateStr,
                        success: true,
                        action: 'skipped',
                    });
                    skipped++;
                    continue;
                }
                // Prepare metrics envelope for Axle computation
                const metricsEnvelope = {
                    provider: currentMetrics.provider || {},
                    weather: currentMetrics.weather || {},
                    axle: currentMetrics.axle || {} // This will be overwritten
                };
                console.log(`[AXLE_BACKFILL] Computing Axle scores for ${dateStr}`);
                // Compute new Axle scores
                const axleScores = await computeAxleScores({
                    userId,
                    dateISO: dateStr,
                    metrics: metricsEnvelope
                });
                // Update the health report with new Axle scores
                const updatedMetrics = {
                    ...currentMetrics,
                    axle: axleScores
                };
                await db
                    .update(healthReports)
                    .set({
                    metrics: updatedMetrics
                })
                    .where(and(eq(healthReports.userId, userId), eq(healthReports.date, dateStr)));
                console.log(`[AXLE_BACKFILL] Successfully updated ${dateStr}`, axleScores);
                results.push({
                    date: dateStr,
                    success: true,
                    action: 'updated',
                    scores: axleScores,
                });
                updated++;
            }
            catch (error) {
                console.error(`[AXLE_BACKFILL] Failed to process ${dateStr}:`, error);
                results.push({
                    date: dateStr,
                    success: false,
                    action: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                failed++;
            }
        }
        console.log(`[AXLE_BACKFILL] Completed: ${updated} updated, ${skipped} skipped, ${failed} failed`);
        return {
            processed: reports.length,
            updated,
            skipped,
            failed,
            results,
        };
    }
    catch (error) {
        console.error('[AXLE_BACKFILL] Critical error during backfill:', error);
        throw error;
    }
}
