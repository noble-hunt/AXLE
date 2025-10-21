// api/profiles.ts - Profile management handler (action-based routing)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin, userClient, bearer, validateEnvForUser } from '../lib/api-helpers/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  
  try {
    validateEnvForUser();
    
    const adminClient = admin();
    const token = bearer(req);
    const { data: userData, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !userData?.user) return res.status(401).json({ message: 'Unauthorized' });
    const userId = userData.user.id;
    const supa = userClient(token);

    // Action-based routing - support both body and query parameter
    const action = req.body?.action || (req.query?.action as string) || (req.method === 'GET' ? 'get' : 'update');

    // ACTION: get - Get profile data
    if (action === 'get') {
      const { data: profile, error } = await supa
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Failed to fetch profile:', error);
        return res.status(404).json({ message: 'Profile not found' });
      }

      return res.status(200).json({ profile });
    }

    // ACTION: providers - Get or update auth providers
    if (action === 'providers') {
      const { provider } = req.body;

      // Get providers if no provider specified
      if (!provider) {
        const { data: profile } = await supa
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single();

        return res.status(200).json({ profile: profile || { providers: [] } });
      }

      // Link new provider
      const { data: profile } = await supa
        .from('profiles')
        .select('providers')
        .eq('user_id', userId)
        .single();

      const currentProviders = profile?.providers || [];
      if (!currentProviders.includes(provider)) {
        const { data, error } = await supa
          .from('profiles')
          .update({ providers: [...currentProviders, provider] })
          .eq('user_id', userId)
          .select()
          .single();

        if (error) return res.status(500).json({ message: 'Failed to link provider' });
        return res.status(200).json({ profile: data });
      }

      return res.status(200).json({ profile });
    }

    // ACTION: upsert - Upsert profile
    if (action === 'upsert') {
      const profileData: any = {
        user_id: userId
      };

      if (req.body.username) profileData.username = req.body.username;
      if (req.body.firstName) profileData.first_name = req.body.firstName;
      if (req.body.lastName) profileData.last_name = req.body.lastName;
      if (req.body.avatarUrl) profileData.avatar_url = req.body.avatarUrl;
      if (req.body.dateOfBirth) profileData.date_of_birth = req.body.dateOfBirth;
      if (req.body.providers) profileData.providers = req.body.providers;

      const { data, error } = await supa
        .from('profiles')
        .upsert(profileData)
        .select()
        .single();

      if (error) {
        console.error('Failed to upsert profile:', error);
        return res.status(500).json({ message: 'Failed to save profile' });
      }

      return res.status(200).json({ profile: data });
    }

    // ACTION: update - Update profile (default)
    if (action === 'update') {
      const updates: any = {};
      
      if (req.body.username) updates.username = req.body.username;
      if (req.body.firstName) updates.first_name = req.body.firstName;
      if (req.body.lastName) updates.last_name = req.body.lastName;
      if (req.body.avatarUrl) updates.avatar_url = req.body.avatarUrl;
      if (req.body.dateOfBirth) updates.date_of_birth = req.body.dateOfBirth;
      if (req.body.latitude !== undefined) updates.latitude = req.body.latitude;
      if (req.body.longitude !== undefined) updates.longitude = req.body.longitude;
      if (req.body.timezone) updates.timezone = req.body.timezone;

      const { data, error } = await supa
        .from('profiles')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Failed to update profile:', error);
        return res.status(500).json({ message: 'Failed to update profile' });
      }

      return res.status(200).json({ profile: data });
    }

    return res.status(400).json({ message: 'Invalid action' });
  } catch (error: any) {
    console.error('Profiles error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
