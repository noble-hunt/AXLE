/**
 * Unified push notification system that handles both native and web push
 */

import { isNativeEnvironment } from './nativeNotifications';
import { registerPushToken, requestPushPermissions } from './nativeNotifications';
import { subscribeToWebPush, unsubscribeFromWebPush, requestWebPushPermissions, getWebPushSubscription } from './webpush';
import { httpJSON } from './http';

/**
 * Enable push notifications (unified for native and web)
 */
export async function enablePushNotifications(): Promise<boolean> {
  try {
    if (isNativeEnvironment()) {
      // Native iOS - use APNs
      const hasPermission = await requestPushPermissions();
      if (!hasPermission) {
        console.warn('Push notification permissions denied');
        return false;
      }

      return new Promise<boolean>((resolve) => {
        registerPushToken((token) => {
          console.log('Native push token registered:', token);
          resolve(true);
        });
        
        // Timeout after 10 seconds
        setTimeout(() => {
          console.warn('Native push token registration timeout');
          resolve(false);
        }, 10000);
      });
    } else {
      // Web browser - use Web Push
      const hasPermission = await requestWebPushPermissions();
      if (!hasPermission) {
        console.warn('Web push notification permissions denied');
        return false;
      }

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error('VITE_VAPID_PUBLIC_KEY not configured');
        return false;
      }

      const subscription = await subscribeToWebPush(vapidPublicKey);
      return subscription !== null;
    }
  } catch (error) {
    console.error('Error enabling push notifications:', error);
    return false;
  }
}

/**
 * Disable push notifications (unified for native and web)
 */
export async function disablePushNotifications(): Promise<boolean> {
  try {
    if (isNativeEnvironment()) {
      // For native, we'd need to unregister the device token from server
      // This requires the current token, which we'd need to store or retrieve
      console.log('Native push unregistration requires token - implement in settings UI');
      return true;
    } else {
      // Web browser - unsubscribe from web push
      return await unsubscribeFromWebPush();
    }
  } catch (error) {
    console.error('Error disabling push notifications:', error);
    return false;
  }
}

/**
 * Check if push notifications are currently enabled
 */
export async function isPushNotificationsEnabled(): Promise<boolean> {
  try {
    if (isNativeEnvironment()) {
      // For native, check if we have permission (simplified check)
      return Notification.permission === 'granted';
    } else {
      // For web, check if we have an active subscription
      const subscription = await getWebPushSubscription();
      return subscription !== null;
    }
  } catch (error) {
    console.error('Error checking push notification status:', error);
    return false;
  }
}

/**
 * Send a test push notification
 */
export async function sendTestPushNotification(): Promise<boolean> {
  try {
    const result = await httpJSON('/push/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('supabase-auth-token')}`,
      },
      body: JSON.stringify({
        title: 'Test Notification',
        body: 'This is a test push notification from AXLE!',
        data: { test: true },
      }),
    });
    return result.success || false;
  } catch (error) {
    console.error('Error sending test push notification:', error);
    return false;
  }
}

/**
 * Enable a notification topic (like weekly-report)
 */
export async function enableNotificationTopic(topic: string, enabled: boolean = true): Promise<boolean> {
  try {
    const result = await httpJSON('/notifications/topics/enable', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('supabase-auth-token')}`,
      },
      body: JSON.stringify({
        topic,
        enabled,
      }),
    });
    return result.ok || false;
  } catch (error) {
    console.error('Error updating notification topic:', error);
    return false;
  }
}