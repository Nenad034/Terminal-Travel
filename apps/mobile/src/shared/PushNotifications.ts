import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiFetch } from '../lib/api-client';

// M9 spec §5 v1.4 — registruje Expo push token uređaja i šalje ga na POST /mobile/push-token
// (backend čuva u User.push_token, PushSenderService ga koristi za slanje). Napomena: Expo Go
// od SDK 53 više ne podržava REMOTE push notifikacije — ova funkcija radi u development/
// production build-u (EAS), u Expo Go samo tiho preskače (van obima ovog prolaza, spec §9).
export async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    await apiFetch('/mobile/push-token', { method: 'POST', body: { pushToken: token.data } });
  } catch {
    // Expo Go ili emulator bez Google/Apple push servisa — tih neuspeh, ne blokira ostatak aplikacije.
  }
}
