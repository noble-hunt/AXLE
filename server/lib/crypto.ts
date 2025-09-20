import crypto from "crypto";

// Validate encryption key at startup
let ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  console.warn("⚠️  ENCRYPTION_KEY should be at least 32 characters for secure AES-256-GCM encryption");
  console.warn("⚠️  Current length:", ENCRYPTION_KEY?.length || 0);
  
  if (process.env.NODE_ENV === 'production') {
    throw new Error("ENCRYPTION_KEY must be at least 32 characters long for secure AES-256-GCM encryption");
  } else {
    // Use a default development key
    ENCRYPTION_KEY = "axle_fitness_tracker_encryption_key_32_chars_long";
    console.warn("⚠️  Using default development encryption key");
  }
}

const KEY = Buffer.from(ENCRYPTION_KEY, "utf8");

export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", crypto.scryptSync(KEY, "axle", 32), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function open(b64: string): string {
  const raw = Buffer.from(b64, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", crypto.scryptSync(KEY, "axle", 32), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}