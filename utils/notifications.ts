import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_PERMISSION_KEY = 'tritrack_notification_permission_asked';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    console.log('[Notifications] Web platform - skipping native permission');
    return false;
  }

  try {
    const alreadyAsked = await AsyncStorage.getItem(NOTIFICATION_PERMISSION_KEY);
    if (alreadyAsked === 'true') {
      const { status } = await Notifications.getPermissionsAsync();
      console.log('[Notifications] Already asked, current status:', status);
      return status === 'granted';
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') {
      await AsyncStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'true');
      return true;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    await AsyncStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'true');
    console.log('[Notifications] Permission result:', status);
    return status === 'granted';
  } catch (err) {
    console.error('[Notifications] Permission request error:', err);
    return false;
  }
}

export async function getNotificationPermissionStatus(): Promise<string> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch {
    return 'unknown';
  }
}

export async function sendFriendRequestNotification(fromName: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New Friend Request',
        body: `${fromName} sent you a friend request`,
        data: { type: 'friend_request', screen: '/friends' },
      },
      trigger: null,
    });
    console.log('[Notifications] Friend request notification sent');
  } catch (err) {
    console.error('[Notifications] Failed to send friend request notification:', err);
  }
}

export async function sendActivitySyncNotification(
  discipline: string,
  count: number,
  source: string
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const disciplineLabel = discipline.charAt(0).toUpperCase() + discipline.slice(1);
    const body = count === 1
      ? `New ${disciplineLabel.toLowerCase()} synced from ${source}`
      : `${count} new activities synced from ${source}`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Activity Synced',
        body,
        data: { type: 'activity_sync', screen: '/(tabs)/(home)' },
      },
      trigger: null,
    });
    console.log('[Notifications] Activity sync notification sent:', count, 'from', source);
  } catch (err) {
    console.error('[Notifications] Failed to send activity sync notification:', err);
  }
}

export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  if (Platform.OS === 'web') return { remove: () => {} };
  return Notifications.addNotificationResponseReceivedListener(callback);
}
