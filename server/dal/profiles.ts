import { supabaseAdmin } from "../lib/supabaseAdmin";

export async function updateProfileProviders(userId: string, provider: string) {
  // First, get the current profile to see existing providers
  const { data: currentProfile, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('providers')
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

      return data;
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

    return data;
  }

  // Provider already exists, return current profile
  return currentProfile;
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

  return data;
}

export async function updateProfile(userId: string, updates: {
  firstName?: string;
  lastName?: string;
  username?: string;
  dateOfBirth?: string;
  avatarUrl?: string;
}) {
  const updateData: any = {};
  
  // Map frontend field names to database column names
  if (updates.firstName !== undefined) updateData.first_name = updates.firstName;
  if (updates.lastName !== undefined) updateData.last_name = updates.lastName;
  if (updates.username !== undefined) updateData.username = updates.username;
  if (updates.dateOfBirth !== undefined) updateData.date_of_birth = updates.dateOfBirth;
  if (updates.avatarUrl !== undefined) updateData.avatar_url = updates.avatarUrl;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updateData)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  return data;
}