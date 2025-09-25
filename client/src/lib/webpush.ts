/**
 * Web Push notifications for browser environments
 */

import { httpJSON } from './http';

export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Check if Web Push is supported in the current browser
 */
export function isWebPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Request notification permissions for web
 * @returns Promise<boolean> - true if permissions granted
 */
export async function requestWebPushPermissions(): Promise<boolean> {
  if (!isWebPushSupported()) {
    console.warn('Web Push not supported in this browser');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting web push permissions:', error);
    return false;
  }
}

/**
 * Subscribe to web push notifications and register with server
 * @param vapidPublicKey - VAPID public key from server
 * @returns Promise<WebPushSubscription | null>
 */
export async function subscribeToWebPush(vapidPublicKey: string): Promise<WebPushSubscription | null> {
  if (!isWebPushSupported()) {
    console.warn('Web Push not supported');
    return null;
  }

  try {
    // Register service worker if not already registered
    let registration = await navigator.serviceWorker.getRegistration();
    
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service worker registered');
    }

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    const subscriptionJson = subscription.toJSON();
    
    const webPushSub = {
      endpoint: subscriptionJson.endpoint!,
      keys: {
        p256dh: subscriptionJson.keys!.p256dh!,
        auth: subscriptionJson.keys!.auth!,
      },
    };

    // Register subscription with server
    try {
      await httpJSON('api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase-auth-token')}`,
        },
        body: JSON.stringify({
          endpoint: webPushSub.endpoint,
          p256dh: webPushSub.keys.p256dh,
          auth: webPushSub.keys.auth,
        }),
      });
    } catch (error) {
      console.error('Failed to register web push subscription with server:', error);
    }
    
    return webPushSub;
  } catch (error) {
    console.error('Error subscribing to web push:', error);
    return null;
  }
}

/**
 * Unsubscribe from web push notifications and unregister from server
 */
export async function unsubscribeFromWebPush(): Promise<boolean> {
  if (!isWebPushSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return true; // Already unsubscribed
    }

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      // Unregister from server first
      const subscriptionJson = subscription.toJSON();
      if (subscriptionJson.endpoint) {
        try {
          await httpJSON('api/push/unsubscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('supabase-auth-token')}`,
            },
            body: JSON.stringify({
              endpoint: subscriptionJson.endpoint,
            }),
          });
        } catch (error) {
          console.warn('Error unregistering from server:', error);
        }
      }

      // Then unsubscribe from browser
      await subscription.unsubscribe();
      console.log('Unsubscribed from web push');
    }
    
    return true;
  } catch (error) {
    console.error('Error unsubscribing from web push:', error);
    return false;
  }
}

/**
 * Get the current web push subscription
 */
export async function getWebPushSubscription(): Promise<WebPushSubscription | null> {
  if (!isWebPushSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return null;
    }

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return null;
    }

    const subscriptionJson = subscription.toJSON();
    
    return {
      endpoint: subscriptionJson.endpoint!,
      keys: {
        p256dh: subscriptionJson.keys!.p256dh!,
        auth: subscriptionJson.keys!.auth!,
      },
    };
  } catch (error) {
    console.error('Error getting web push subscription:', error);
    return null;
  }
}

/**
 * Schedule a notification on the server for web push
 */
export async function scheduleWebPushNotification(
  title: string,
  body: string,
  scheduledFor: Date,
  data?: Record<string, any>
): Promise<void> {
  // This will be handled by server-side scheduling via the notifications table
  // The server will dispatch web push notifications via cron
  console.log('Web push notification scheduled via server:', {
    title,
    body,
    scheduledFor,
    data,
  });
}

/**
 * Helper function to convert VAPID key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}