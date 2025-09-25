import { db } from "../db";
import { healthReports } from "@shared/schema";
import { eq, gte, and } from "drizzle-orm";
import { sendEmail } from "./email";

export async function buildWeeklyReportHtml(userId: string) {
  // Get last 7 days health_reports
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const dateString = sevenDaysAgo.toISOString().slice(0, 10);
  
  const reports = await db
    .select()
    .from(healthReports)
    .where(
      and(
        eq(healthReports.userId, userId),
        gte(healthReports.date, dateString)
      )
    )
    .orderBy(healthReports.date);

  const pts = reports ?? [];
  const avg = (k: string) => {
    const arr = pts.map((p: any) => p.metrics?.axle?.[k] ?? null).filter((v: any) => v != null);
    if (arr.length === 0) return null;
    return Math.round(arr.reduce((a: number, b: number) => a + b, 0) / arr.length);
  };

  const axle = avg("axle_health_score");
  const vit = avg("vitality_score");
  const perf = avg("performance_potential");
  const circ = avg("circadian_alignment");
  const ener = avg("energy_systems_balance");

  // tiny HTML (can replace with MJML later)
  return `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:16px auto;padding:16px;border:1px solid #eee;border-radius:12px">
    <h2 style="margin:0 0 12px">Your AXLE Weekly Report</h2>
    <p style="color:#444">Here's your average for the past 7 days:</p>
    <ul style="line-height:1.8;color:#222">
      <li><b>AXLE Health Score:</b> ${axle ?? "--"}</li>
      <li><b>Vitality:</b> ${vit ?? "--"} &middot; <b>Performance:</b> ${perf ?? "--"}</li>
      <li><b>Circadian Alignment:</b> ${circ ?? "--"} &middot; <b>Energy Systems:</b> ${ener ?? "--"}</li>
    </ul>
    <p style="color:#666">Tip: If Performance is high but Energy Systems is low, mix in an under-trained zone this week.</p>
  </div>`;
}

export async function sendWeeklyReport(userId: string, email: string) {
  const html = await buildWeeklyReportHtml(userId);
  await sendEmail(email, "Your AXLE Weekly Report", html);
}