import { Router } from "express";
import { z } from "zod";
export const workouts = Router();

const PreviewSchema = z.object({
  focus: z.enum(["strength","conditioning","mixed","endurance"]),
  durationMin: z.number().int().min(5).max(180),
  equipment: z.array(z.string()).default([]),
  intensity: z.number().min(1).max(10),
  seed: z.string().optional()
});

workouts.post("/preview", async (req, res) => {
  // If auth is required, wrap with requireAuth; for now keep public to simplify dev
  const parsed = PreviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok:false, error:"invalid_request", details:parsed.error.flatten() });
  }

  try {
    // TODO: replace with your real generator
    const { focus, durationMin, equipment, intensity, seed } = parsed.data;
    const preview = {
      seed: seed ?? crypto.randomUUID(),
      blocks: [
        { type:"warmup", minutes: Math.max(5, Math.round(durationMin/6)), notes:`${focus} warmup` },
        { type:"main", minutes: Math.round(durationMin*0.7), notes:`intensity ${intensity}/10`, equipment },
        { type:"cooldown", minutes: Math.max(3, Math.round(durationMin/10)), notes:"breathing / mobility" }
      ]
    };
    return res.json({ ok:true, preview, seed: preview.seed });
  } catch (err:any) {
    req.log?.error({ err }, "preview failed");
    return res.status(500).json({ ok:false, error:"preview_failed" });
  }
});

// Back-compat aliases so any old callers still work
workouts.post("/generate/preview", (req,res,next) => {
  (workouts as any).handle({ ...req, url: "/preview" }, res, next);
});