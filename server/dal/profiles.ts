import { supabaseAdmin } from "../lib/supabaseAdmin";

// Helper function to map database fields (snake_case) to frontend fields (camelCase)
function mapProfileToFrontend(dbProfile: any) {
  if (!dbProfile) return null;
  
  return {
    id: dbProfile.id,
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
    updatedAt: dbProfile.updated_at ? new Date(dbProfile.updated_at) : undefined,
    // Include any other fields that might exist
    lastLat: dbProfile.last_lat,
    lastLon: dbProfile.last_lon,
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
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Profile not found
    }
    throw new Error(`Failed to get profile: ${error.message}`);
  }

  return mapProfileToFrontend(data);
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
  const updateData: any = {};
  
  // Map frontend field names to database column names
  if (updates.firstName !== undefined) updateData.first_name = updates.firstName;
  if (updates.lastName !== undefined) updateData.last_name = updates.lastName;
  if (updates.username !== undefined) updateData.username = updates.username;
  if (updates.dateOfBirth !== undefined) updateData.date_of_birth = updates.dateOfBirth;
  if (updates.avatarUrl !== undefined) updateData.avatar_url = updates.avatarUrl;
  if (updates.preferredUnit !== undefined) updateData.preferred_unit = updates.preferredUnit;
  if (updates.favoriteMovements !== undefined) updateData.favorite_movements = updates.favoriteMovements;

  // First try to update existing profile
  const { data: updateResult, error: updateError } = await supabaseAdmin
    .from('profiles')
    .update(updateData)
    .eq('user_id', userId)
    .select()
    .single();

  // If update succeeds, return the result
  if (!updateError && updateResult) {
    return mapProfileToFrontend(updateResult);
  }

  // If profile doesn't exist (PGRST116), create it with the provided data
  if (updateError && updateError.code === 'PGRST116') {
    const insertData = {
      user_id: userId,
      ...updateData,
    };

    const { data: insertResult, error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create profile: ${insertError.message}`);
    }

    return mapProfileToFrontend(insertResult);
  }

  // If other error, throw it
  if (updateError) {
    throw new Error(`Failed to update profile: ${updateError.message}`);
  }

  return mapProfileToFrontend(updateResult);
}