/**
 * usePushNotifications
 *
 * 1. Requests push-notification permissions (iOS prompt / Android 13+)
 * 2. Fetches the Expo push token from the EAS push service
 * 3. Returns the token so the caller can register it with the Tycoon backend
 *
 * NOTE: Expo push tokens only work on physical devices and in EAS-managed
 * builds. In Expo Go / simulators this hook will return null.
 */

import { useEffect, useRef, useState } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Foreground notification behaviour: show a banner with sound + badge
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type PushNotificationState = {
  /** Expo push token – null until permissions granted + token fetched */
  expoPushToken: string | null;
  /** Last received notification (foreground) */
  notification: Notifications.Notification | null;
  /** Last tapped notification response */
  notificationResponse: Notifications.NotificationResponse | null;
};

export function usePushNotifications(): PushNotificationState {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] =
    useState<Notifications.Notification | null>(null);
  const [notificationResponse, setNotificationResponse] =
    useState<Notifications.NotificationResponse | null>(null);

  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    // Register for push notifications on mount
    registerForPushNotificationsAsync().then((token) => {
      if (token) setExpoPushToken(token);
    });

    // Fires when a notification is received while the app is in the foreground
    notificationListener.current =
      Notifications.addNotificationReceivedListener((n) => {
        setNotification(n);
      });

    // Fires when the user taps a notification (foreground or background)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((r) => {
        setNotificationResponse(r);
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return { expoPushToken, notification, notificationResponse };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push tokens only work on real devices
  if (!Device.isDevice) {
    console.info('[push] Skipping: not a physical device');
    return null;
  }

  // Android 8+ requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFFFFF',
    });
  }

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.info('[push] Permission not granted');
    return null;
  }

  try {
    // NOTE: projectId must be set in app.json → extra.eas.projectId for
    // production. Without it, getExpoPushTokenAsync() throws in bare
    // native builds but works in Expo Go preview mode.
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'YOUR_EAS_PROJECT_ID', // replace with real EAS projectId
    });
    return token.data;
  } catch (err) {
    console.warn('[push] Failed to get token:', err);
    return null;
  }
}
