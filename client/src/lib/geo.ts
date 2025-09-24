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
 * Quantize coordinates to 3 decimal places for privacy (~110m precision)
 */
function quantizeCoordinates(lat: number, lon: number) {
  return {
    lat: Math.round(lat * 1000) / 1000,
    lon: Math.round(lon * 1000) / 1000
  };
}

/**
 * Save user location to profile via API (with client-side quantization for privacy)
 */
export async function saveLocationToProfile(location: LocationData): Promise<LocationData> {
  try {
    // Quantize coordinates on client-side for privacy before transmission
    const quantized = quantizeCoordinates(location.lat, location.lon);
    const payload = {
      lat: quantized.lat,
      lon: quantized.lon,
      timezone: location.timezone
    };
    
    console.log(`🔒 Quantizing coordinates: ${location.lat.toFixed(6)}, ${location.lon.toFixed(6)} → ${quantized.lat.toFixed(3)}, ${quantized.lon.toFixed(3)}`);
    
    await apiRequest('POST', '/api/me/location', payload);
    
    // Return quantized location for consistency
    return {
      lat: quantized.lat,
      lon: quantized.lon,
      timezone: location.timezone
    };
  } catch (error) {
    console.error('Failed to save location to profile:', error);
    throw error;
  }
}

/**
 * Request location permission and save to profile
 * Returns quantized location data if successful, null if permission denied or error
 */
export async function requestAndSaveLocation(): Promise<LocationData | null> {
  try {
    console.log('🌍 Requesting user location for daylight/UV insights...');
    
    const location = await requestLocationOnce();
    console.log(`📍 Got location: ${location.lat.toFixed(6)}, ${location.lon.toFixed(6)} (${location.timezone})`);
    
    const quantizedLocation = await saveLocationToProfile(location);
    console.log(`✅ Location saved to profile (quantized): ${quantizedLocation.lat}, ${quantizedLocation.lon} (${quantizedLocation.timezone})`);
    
    return quantizedLocation;
  } catch (error) {
    console.warn('❌ Failed to get/save location:', error);
    return null;
  }
}