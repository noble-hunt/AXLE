import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Pool and DB are only initialized if DATABASE_URL is present
// This allows the app to start without DATABASE_URL (for basic features)
// Advanced features like Groups require DATABASE_URL to be set
let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

if (process.env.DATABASE_URL) {
  // Configure pool with SSL for production (Vercel + Supabase)
  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    // Connection pooling configuration for serverless
    max: 10, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Timeout after 10 seconds when acquiring a client
  });
  
  db = drizzle({ client: pool, schema });
} else {
  console.warn('[DB] DATABASE_URL not set - database features (groups, analytics) will be unavailable');
}

// Export non-null assertions for backwards compatibility
// Consumers should check if pool/db are null before using
export { pool, db };
