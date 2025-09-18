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