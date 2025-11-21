import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { pool } from '../db.js';

// Helper function to map database fields (snake_case) to frontend fields (camelCase)
function mapProfileToFrontend(dbProfile: any) {
  if (!dbProfile) return null;
  
  return {
    userId: dbProfile.user_id,
    firstName: dbProfile.first_name,
    lastName: dbProfile.last_name,
    username: dbProfile.username,
    dateOfBirth: dbProfile.date_of_birth,
    avatarUrl: dbProfile.avatar_url,
    preferredUnit: dbProfile.preferred_unit,
    favoriteMovements: dbProfile.favorite_movements || [],
    providers: dbProfile.providers,
    // Convert timestamp strings to Date objects for frontend
    createdAt: dbProfile.created_at ? new Date(dbProfile.created_at) : undefined,
    // Include any other fields that might exist
    latitude: dbProfile.latitude,
    longitude: dbProfile.longitude,
    timezone: dbProfile.timezone,
  };
}

export async function updateProfileProviders(userId: string, provider: string) {
  // First, get the current profile to see existing providers
  const { data: currentProfile, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (fetchError) {
    // If profile doesn't exist, create one with the provider
    if (fetchError.code === 'PGRST116') {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: userId,
          providers: [provider]
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create profile with provider: ${error.message}`);
      }

      return mapProfileToFrontend(data);
    } else {
      throw new Error(`Failed to fetch profile: ${fetchError.message}`);
    }
  }

  // If profile exists, update the providers array
  const currentProviders = currentProfile.providers || [];
  
  // Add the provider if it's not already there
  if (!currentProviders.includes(provider)) {
    const updatedProviders = [...currentProviders, provider];
    
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ providers: updatedProviders })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update profile providers: ${error.message}`);
    }

    return mapProfileToFrontend(data);
  }

  // Provider already exists, return current profile
  return mapProfileToFrontend(currentProfile);
}

export async function getProfile(userId: string) {
  if (!process.env.DATABASE_URL) {
    console.error('[DAL:profiles:getProfile] FATAL: DATABASE_URL environment variable is not set');
    throw new Error('Database connection not configured. DATABASE_URL environment variable is missing.');
  }

  let client;
  try {
    // Use pool to get a client (automatic connection management)
    client = await pool.connect();
    
    // Query with explicit column selection to ensure PostgreSQL arrays are returned correctly
    const result = await client.query(
      `SELECT 
        user_id, first_name, last_name, username, date_of_birth, avatar_url, 
        preferred_unit, favorite_movements, providers, created_at,
        latitude, longitude, timezone
       FROM profiles 
       WHERE user_id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return null; // Profile not found
    }
    
    return mapProfileToFrontend(result.rows[0]);
  } catch (error: any) {
    console.error('[DAL:profiles:getProfile] Failed to fetch profile:', {
      userId,
      error: error.message,
      code: error.code,
      hint: 'Check DATABASE_URL environment variable and database connection. Ensure SSL is configured for production.',
      stack: error.stack
    });
    throw new Error(`Failed to get profile: ${error.message}`);
  } finally {
    if (client) client.release(); // Release client back to pool
  }
}

export async function updateProfile(userId: string, updates: {
  firstName?: string;
  lastName?: string;
  username?: string;
  dateOfBirth?: string | null;
  avatarUrl?: string;
  preferredUnit?: string;
  favoriteMovements?: string[];
}) {
  if (!process.env.DATABASE_URL) {
    console.error('[DAL:profiles:updateProfile] FATAL: DATABASE_URL environment variable is not set');
    throw new Error('Database connection not configured. DATABASE_URL environment variable is missing.');
  }

  // Build SET clauses for SQL update
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.firstName !== undefined) {
    setClauses.push(`first_name = $${paramIndex++}`);
    values.push(updates.firstName);
  }
  if (updates.lastName !== undefined) {
    setClauses.push(`last_name = $${paramIndex++}`);
    values.push(updates.lastName);
  }
  if (updates.username !== undefined) {
    setClauses.push(`username = $${paramIndex++}`);
    values.push(updates.username);
  }
  if (updates.dateOfBirth !== undefined) {
    setClauses.push(`date_of_birth = $${paramIndex++}`);
    values.push(updates.dateOfBirth);
  }
  if (updates.avatarUrl !== undefined) {
    setClauses.push(`avatar_url = $${paramIndex++}`);
    values.push(updates.avatarUrl);
  }
  if (updates.preferredUnit !== undefined) {
    setClauses.push(`preferred_unit = $${paramIndex++}`);
    values.push(updates.preferredUnit);
  }
  if (updates.favoriteMovements !== undefined) {
    setClauses.push(`favorite_movements = $${paramIndex++}`);
    values.push(updates.favoriteMovements);
  }

  if (setClauses.length === 0) {
    // No updates, just fetch and return current profile
    return await getProfile(userId);
  }

  // Add userId to values
  values.push(userId);

  // Build the UPDATE query using raw SQL
  const updateQuery = `
    UPDATE profiles
    SET ${setClauses.join(', ')}
    WHERE user_id = $${paramIndex}
    RETURNING *;
  `;

  try {
    const { data, error } = await supabaseAdmin.rpc('exec_sql', {
      sql_query: updateQuery,
      params: values
    });

    if (error) {
      // If update didn't find the row, try to insert
      if (error.message?.includes('0 rows') || error.code === 'PGRST116') {
        // Build INSERT query
        const insertCols = ['user_id', ...Object.keys(updates).map(k => {
          if (k === 'firstName') return 'first_name';
          if (k === 'lastName') return 'last_name';
          if (k === 'dateOfBirth') return 'date_of_birth';
          if (k === 'avatarUrl') return 'avatar_url';
          if (k === 'preferredUnit') return 'preferred_unit';
          if (k === 'favoriteMovements') return 'favorite_movements';
          return k;
        })];
        
        const insertVals = [userId, ...Object.values(updates)];
        const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(', ');
        
        const insertQuery = `
          INSERT INTO profiles (${insertCols.join(', ')})
          VALUES (${placeholders})
          RETURNING *;
        `;
        
        const { data: insertData, error: insertError } = await supabaseAdmin.rpc('exec_sql', {
          sql_query: insertQuery,
          params: insertVals
        });
        
        if (insertError) {
          throw new Error(`Failed to create profile: ${insertError.message}`);
        }
        
        return mapProfileToFrontend(insertData[0]);
      }
      
      throw new Error(`Failed to update profile: ${error.message}`);
    }

    return mapProfileToFrontend(data[0]);
  } catch (error: any) {
    // If RPC doesn't exist, fall back to direct query
    const { data: queryData, error: queryError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (queryError && queryError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch profile for update: ${queryError.message}`);
    }

    // Try direct SQL via pool
    const client = await pool.connect();

    try {
      const result = await client.query(updateQuery, values);
      
      if (result.rowCount === 0) {
        // No rows updated, try insert
        const insertCols = ['user_id'];
        const insertVals: any[] = [userId];
        let idx = 1;
        
        if (updates.firstName !== undefined) { insertCols.push('first_name'); insertVals.push(updates.firstName); }
        if (updates.lastName !== undefined) { insertCols.push('last_name'); insertVals.push(updates.lastName); }
        if (updates.username !== undefined) { insertCols.push('username'); insertVals.push(updates.username); }
        if (updates.dateOfBirth !== undefined) { insertCols.push('date_of_birth'); insertVals.push(updates.dateOfBirth); }
        if (updates.avatarUrl !== undefined) { insertCols.push('avatar_url'); insertVals.push(updates.avatarUrl); }
        if (updates.preferredUnit !== undefined) { insertCols.push('preferred_unit'); insertVals.push(updates.preferredUnit); }
        if (updates.favoriteMovements !== undefined) { insertCols.push('favorite_movements'); insertVals.push(updates.favoriteMovements); }
        
        const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(', ');
        const insertQuery = `INSERT INTO profiles (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING *;`;
        
        const insertResult = await client.query(insertQuery, insertVals);
        client.release();
        return mapProfileToFrontend(insertResult.rows[0]);
      }

      client.release();
      return mapProfileToFrontend(result.rows[0]);
    } catch (pgError: any) {
      client.release();
      throw new Error(`Failed to update profile via direct connection: ${pgError.message}`);
    }
  }
}