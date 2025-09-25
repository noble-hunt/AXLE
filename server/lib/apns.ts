import jwt from 'jsonwebtoken';

export interface APNsPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
}

export interface APNsConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  key: string; // P8 private key content
}

/**
 * Get APNs configuration from environment variables
 */
function getAPNsConfig(): APNsConfig | null {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID || 'com.axle.app';
  const key = process.env.APNS_KEY;

  if (!keyId || !teamId || !key) {
    console.warn('[APNS] Missing required environment variables:', {
      hasKeyId: !!keyId,
      hasTeamId: !!teamId,
      hasKey: !!key,
      hasBundleId: !!bundleId,
    });
    return null;
  }

  console.log(`[APNS] Configuration loaded for bundle: ${bundleId}`);
  return { keyId, teamId, bundleId, key };
}

/**
 * Generate JWT token for APNs authentication
 */
function generateJWT(config: APNsConfig): string {
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: config.teamId,
    iat: now,
  };

  const header = {
    alg: 'ES256',
    kid: config.keyId,
  };

  return jwt.sign(payload, config.key, {
    algorithm: 'ES256',
    header,
  });
}

/**
 * Send push notification via APNs HTTP/2 API
 * @param deviceToken - APNs device token
 * @param payload - Notification payload
 * @param config - APNs configuration (optional, will use env vars if not provided)
 */
export async function sendAPNs(
  deviceToken: string,
  payload: APNsPayload,
  config?: APNsConfig
): Promise<{ success: boolean; error?: string; apnsId?: string }> {
  const apnsConfig = config || getAPNsConfig();
  
  if (!apnsConfig) {
    return {
      success: false,
      error: 'APNs configuration not available - missing environment variables',
    };
  }

  try {
    const jwt = generateJWT(apnsConfig);
    
    // Build APNs notification payload
    const notification = {
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        badge: payload.badge,
        sound: payload.sound || 'default',
      },
      ...payload.data,
    };

    // APNs endpoint (use sandbox for development)
    const useSandbox = process.env.NODE_ENV !== 'production';
    const host = useSandbox 
      ? 'https://api.sandbox.push.apple.com'
      : 'https://api.push.apple.com';
    
    const url = `${host}/3/device/${deviceToken}`;
    
    console.log(`[APNS] Sending notification to ${deviceToken.substring(0, 10)}... via ${useSandbox ? 'sandbox' : 'production'} (${host})`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'apns-topic': apnsConfig.bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notification),
    });

    const responseText = await response.text();
    const apnsId = response.headers.get('apns-id');

    if (response.ok) {
      console.log(`[APNS] Successfully sent notification, apns-id: ${apnsId}`);
      return {
        success: true,
        apnsId: apnsId || undefined,
      };
    } else {
      console.error(`[APNS] Failed to send notification:`, {
        status: response.status,
        statusText: response.statusText,
        response: responseText,
        apnsId,
      });
      
      return {
        success: false,
        error: `APNs error ${response.status}: ${responseText || response.statusText}`,
      };
    }
  } catch (error) {
    console.error('[APNS] Error sending notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown APNs error',
    };
  }
}

/**
 * Send push notifications to multiple device tokens
 * @param tokens - Array of device tokens
 * @param payload - Notification payload
 * @param config - APNs configuration (optional)
 */
export async function sendAPNsBatch(
  tokens: string[],
  payload: APNsPayload,
  config?: APNsConfig
): Promise<Array<{ token: string; success: boolean; error?: string; apnsId?: string }>> {
  console.log(`[APNS] Sending batch notification to ${tokens.length} devices`);
  
  const results = await Promise.allSettled(
    tokens.map(async (token) => {
      const result = await sendAPNs(token, payload, config);
      return { token, ...result };
    })
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        token: tokens[index],
        success: false,
        error: result.reason instanceof Error ? result.reason.message : 'Promise rejected',
      };
    }
  });
}

/**
 * Test APNs configuration and connectivity
 */
export async function testAPNsConnection(): Promise<{ success: boolean; error?: string }> {
  const config = getAPNsConfig();
  
  if (!config) {
    return {
      success: false,
      error: 'APNs configuration not available',
    };
  }

  try {
    // Generate a test JWT to verify key parsing
    const jwt = generateJWT(config);
    
    if (!jwt) {
      return {
        success: false,
        error: 'Failed to generate JWT token',
      };
    }

    console.log('[APNS] Configuration test passed - JWT generation successful');
    return { success: true };
  } catch (error) {
    console.error('[APNS] Configuration test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown configuration error',
    };
  }
}

/**
 * Helper to determine if APNs is properly configured
 */
export function isAPNsConfigured(): boolean {
  return getAPNsConfig() !== null;
}