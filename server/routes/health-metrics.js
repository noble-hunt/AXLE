import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db.js";
import { healthReports } from "../../shared/schema.js";
import { eq, gte, and } from "drizzle-orm";
const router = Router();
/** GET /api/health/metrics?days=14 */
router.get("/metrics", requireAuth, async (req, res) => {
    try {
        const authReq = req;
        const userId = authReq.user.id;
        const days = Math.min(60, Math.max(1, parseInt(String(req.query.days ?? "14"), 10)));
        // Calculate cutoff date
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const cutoffDateStr = cutoffDate.toISOString().slice(0, 10); // YYYY-MM-DD
        const data = await db
            .select({
            date: healthReports.date,
            metrics: healthReports.metrics
        })
            .from(healthReports)
            .where(and(eq(healthReports.userId, userId), gte(healthReports.date, cutoffDateStr)))
            .orderBy(healthReports.date);
        const out = data.map((r) => ({
            date: r.date,
            // provider
            hrv: r.metrics?.provider?.hrv ?? null,
            resting_hr: r.metrics?.provider?.resting_hr ?? null,
            sleep_score: r.metrics?.provider?.sleep_score ?? null,
            fatigue_score: r.metrics?.provider?.fatigue_score ?? null,
            // axle
            axle_health_score: r.metrics?.axle?.axle_health_score ?? null,
            vitality_score: r.metrics?.axle?.vitality_score ?? null,
            performance_potential: r.metrics?.axle?.performance_potential ?? null,
            circadian_alignment: r.metrics?.axle?.circadian_alignment ?? null,
            energy_systems_balance: r.metrics?.axle?.energy_systems_balance ?? null,
        }));
        res.json({ days, points: out });
    }
    catch (error) {
        console.error('Error fetching health metrics:', error);
        res.status(500).json({ error: 'Failed to fetch health metrics' });
    }
});
export default router;
