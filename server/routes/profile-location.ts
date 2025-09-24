import { Router } from "express";
import { supabaseFromReq } from "../lib/supabaseFromReq";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

/** Read current location consent + cache */
router.get("/api/me/location", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const supabase = supabaseFromReq(req);
    const userId = authReq.user.id;
    
    const { data, error } = await supabase
      .from("profiles")
      .select("location_opt_in, location_consent_at, last_lat, last_lon, timezone")
      .eq("user_id", userId)
      .single();
      
    if (error) {
      console.error("Error fetching location consent:", error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json({
      optIn: data?.location_opt_in ?? false,
      consentAt: data?.location_consent_at ?? null,
      lat: data?.last_lat ?? null,
      lon: data?.last_lon ?? null,
      timezone: data?.timezone ?? null,
    });
  } catch (error) {
    console.error("Error in GET /api/me/location:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Update consent; optionally refresh cached coords + tz */
router.post("/api/me/location", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const supabase = supabaseFromReq(req);
    const userId = authReq.user.id;
    
    const { optIn, lat, lon, tz } = req.body as {
      optIn: boolean; 
      lat?: number; 
      lon?: number; 
      tz?: string;
    };

    const updates: any = {
      user_id: userId,
      location_opt_in: !!optIn,
      location_consent_at: new Date().toISOString(),
    };

    if (optIn) {
      if (typeof lat === "number" && typeof lon === "number") {
        updates.last_lat = lat;
        updates.last_lon = lon;
      }
      if (tz) updates.timezone = tz;
    } else {
      // Clear cached coords on opt-out
      updates.last_lat = null;
      updates.last_lon = null;
    }

    const { error } = await supabase.from("profiles").upsert(updates);
    
    if (error) {
      console.error("Error updating location consent:", error);
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error("Error in POST /api/me/location:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;