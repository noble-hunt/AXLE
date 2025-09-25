import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Check if we're running in a native environment (not web)
 */
export function isNativeEnvironment(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Request push notification permissions
 * @returns Promise<boolean> - true if permissions granted
 */
export async function requestPushPermissions(): Promise<boolean> {
  if (!isNativeEnvironment()) {
    console.warn('Push notifications not available in web environment');
    return false;
  }

  try {
    // Check current permissions
    const status = await PushNotifications.checkPermissions();
    
    if (status.receive === 'granted') {
      return true;
    }

    // Request permissions if not granted
    const request = await PushNotifications.requestPermissions();
    return request.receive === 'granted';
  } catch (error) {
    console.error('Error requesting push permissions:', error);
    return false;
  }
}

/**
 * Register for push notifications and get device token
 * @param onToken - Callback function to handle the device token
 */
export async function registerPushToken(onToken: (token: string) => void): Promise<void> {
  if (!isNativeEnvironment()) {
    console.warn('Push token registration not available in web environment');
    return;
  }

  try {
    // Clear existing listeners to avoid duplicates
    await PushNotifications.removeAllListeners();

    // Add listeners for token registration
    await PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push registration success, token:', token.value);
      onToken(token.value);
    });

    await PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Error on registration:', error);
    });

    // Add listener for when user taps on notification
    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification: ActionPerformed) => {
        console.log('Push notification action performed:', notification);
        // TODO: Handle deep links later
      }
    );

    // Register with APNs
    await PushNotifications.register();
  } catch (error) {
    console.error('Error registering for push notifications:', error);
  }
}

/**
 * Schedule a local notification
 * @param id - Unique notification ID
 * @param title - Notification title
 * @param body - Notification body
 * @param at - Date to trigger the notification
 */
export async function scheduleLocal(
  id: number,
  title: string,
  body: string,
  at: Date
): Promise<void> {
  if (!isNativeEnvironment()) {
    console.warn('Local notifications not available in web environment');
    return;
  }

  try {
    // Request permissions for local notifications
    const permissions = await LocalNotifications.requestPermissions();
    
    if (permissions.display !== 'granted') {
      console.warn('Local notification permissions not granted');
      return;
    }

    // Schedule the notification
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          schedule: { at },
          smallIcon: 'ic_stat_icon',
          iconColor: '#48BB78', // Green color for AXLE brand
          sound: 'default',
        }
      ]
    });

    console.log(`Scheduled local notification ${id} for ${at.toISOString()}`);
  } catch (error) {
    console.error('Error scheduling local notification:', error);
  }
}

/**
 * Cancel a specific local notification
 * @param id - Notification ID to cancel
 */
export async function cancelLocalNotification(id: number): Promise<void> {
  if (!isNativeEnvironment()) {
    return;
  }

  try {
    await LocalNotifications.cancel({
      notifications: [{ id }]
    });
    console.log(`Cancelled local notification ${id}`);
  } catch (error) {
    console.error('Error cancelling local notification:', error);
  }
}

/**
 * Cancel all pending local notifications
 */
export async function cancelAllLocalNotifications(): Promise<void> {
  if (!isNativeEnvironment()) {
    return;
  }

  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map(n => ({ id: n.id }))
      });
      console.log(`Cancelled ${pending.notifications.length} local notifications`);
    }
  } catch (error) {
    console.error('Error cancelling all local notifications:', error);
  }
}

/**
 * Get the next day at a specific time
 * @param hours - Hour (0-23)
 * @param minutes - Minutes (0-59)
 * @returns Date object for tomorrow at the specified time
 */
export function getNextDayAt(hours: number, minutes: number): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(hours, minutes, 0, 0);
  return tomorrow;
}

/**
 * Schedule daily workout reminder
 * @param hours - Hour to remind (0-23)
 * @param minutes - Minutes to remind (0-59)
 */
export async function scheduleDailyWorkoutReminder(hours: number, minutes: number): Promise<void> {
  // Cancel existing daily reminders (using ID 1000 for daily workout reminder)
  await cancelLocalNotification(1000);
  
  // Schedule new reminder for tomorrow
  const reminderTime = getNextDayAt(hours, minutes);
  await scheduleLocal(
    1000,
    'Time to Workout! 💪',
    'Your daily fitness journey awaits. Let\'s get moving!',
    reminderTime
  );
}