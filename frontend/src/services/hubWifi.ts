import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import type { LaptopHubQr } from '../domain/hubPairing';

type CoopGuardWifiModule = {
  connect: (ssid: string, passphrase: string) => Promise<boolean>;
  disconnect: () => Promise<boolean>;
};

const nativeWifi = NativeModules.CoopGuardWifi as CoopGuardWifiModule | undefined;

export async function connectToHubHotspot(qr: LaptopHubQr) {
  if (!qr.hotspot) return false;
  if (Platform.OS !== 'android')
    throw new Error('Automatic hub WiFi connection is currently available on Android only.');
  if (!nativeWifi)
    throw new Error('This CoopGuard installation does not include hub WiFi support.');

  const apiLevel = Number(Platform.Version);
  const permission =
    apiLevel >= 33
      ? PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES
      : PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const granted = await PermissionsAndroid.request(permission, {
    title: 'Connect to CoopGuard hub',
    message:
      'Allow CoopGuard to find and connect to the farm hub WiFi. CoopGuard does not use this permission to determine your location.',
    buttonPositive: 'Allow',
    buttonNegative: 'Cancel',
  });
  if (granted !== PermissionsAndroid.RESULTS.GRANTED)
    throw new Error('Nearby WiFi permission is required to connect to the farm hub.');

  await nativeWifi.connect(qr.hotspot.ssid, qr.hotspot.passphrase);
  return true;
}

export async function disconnectHubHotspot() {
  if (Platform.OS === 'android' && nativeWifi) await nativeWifi.disconnect();
}
