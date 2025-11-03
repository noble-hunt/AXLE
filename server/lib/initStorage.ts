// server/lib/initStorage.ts
import { supabaseAdmin } from './supabaseAdmin';

export async function ensureStorageBuckets() {
  try {
    // Check if profile-photos bucket exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      console.error('[Storage] Failed to list buckets:', listError);
      return;
    }

    const profilePhotosBucket = buckets?.find(b => b.name === 'profile-photos');
    
    if (!profilePhotosBucket) {
      console.log('[Storage] Creating profile-photos bucket...');
      const { error: createError } = await supabaseAdmin.storage.createBucket('profile-photos', {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      });

      if (createError) {
        console.error('[Storage] Failed to create profile-photos bucket:', createError);
      } else {
        console.log('[Storage] ✅ profile-photos bucket created successfully');
      }
    } else {
      console.log('[Storage] ✅ profile-photos bucket already exists');
    }
  } catch (error) {
    console.error('[Storage] Error initializing storage:', error);
  }
}
