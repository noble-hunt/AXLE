import { Router } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { db } from "../db";
import { notificationTopics } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const r = Router();

r.post("/api/notifications/topics/enable", requireAuth, async (req, res) => {
  const { topic, enabled } = req.body ?? {};
  if (!topic || typeof enabled !== "boolean") {
    return res.status(400).json({ error: "bad_request" });
  }
  
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    
    await db
      .insert(notificationTopics)
      .values({
        userId,
        topic,
        enabled,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [notificationTopics.userId, notificationTopics.topic],
        set: {
          enabled,
          updatedAt: new Date(),
        },
      });
    
    res.json({ ok: true });
  } catch (error) {
    console.error("Error updating notification topic:", error);
    res.status(500).json({ error: "Failed to update topic preference" });
  }
});

r.get("/api/notifications/topics", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user.id;
    
    const topics = await db
      .select()
      .from(notificationTopics)
      .where(eq(notificationTopics.userId, userId));
    
    res.json({ topics: topics ?? [] });
  } catch (error) {
    console.error("Error fetching notification topics:", error);
    res.status(500).json({ error: "Failed to fetch topics" });
  }
});

export default r;