import { apiRequest } from './queryClient';

export interface LocationData {
  lat: number;
  lon: number;
  timezone: string;
}

/**
 * Request user's current location using browser geolocation API
 * Returns promise with location data including timezone
 */
export async function requestLocationOnce(): Promise<LocationData> {
  return new Promise((resolve, reject) => {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000, // 10 seconds
      maximumAge: 300000 // 5 minutes cache
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        try {
          const { latitude: lat, longitude: lon } = position.coords;
          
          // Get user's timezone
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          
          resolve({ lat, lon, timezone });
        } catch (error) {
          reject(new Error(`Failed to process location: ${error}`));
        }
      },
      (error) => {
        let message = 'Failed to get location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location permission denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out';
            break;
        }
        
        reject(new Error(message));
      },
      options
    );
  });
}

/**
 * Save user location to profile via API
 */
export async function saveLocationToProfile(location: LocationData): Promise<void> {
  try {
    await apiRequest('POST', '/api/me/location', location);
  } catch (error) {
    console.error('Failed to save location to profile:', error);
    throw error;
  }
}

/**
 * Request location permission and save to profile
 * Returns true if successful, false if permission denied or error
 */
export async function requestAndSaveLocation(): Promise<boolean> {
  try {
    console.log('🌍 Requesting user location for daylight/UV insights...');
    
    const location = await requestLocationOnce();
    console.log(`📍 Got location: ${location.lat.toFixed(3)}, ${location.lon.toFixed(3)} (${location.timezone})`);
    
    await saveLocationToProfile(location);
    console.log('✅ Location saved to profile');
    
    return true;
  } catch (error) {
    console.warn('❌ Failed to get/save location:', error);
    return false;
  }
}