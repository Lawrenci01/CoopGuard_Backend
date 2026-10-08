import { normalizeServer } from '../services/api';

export interface LaptopHubQr {
  type: 'coopguard-hub';
  version: 1;
  hubId: string;
  token: string;
  wifiUrl: string;
  usbUrl: string;
  expiresAt: number;
}

export function parseLaptopHubQr(value: string): LaptopHubQr {
  let parsed: Partial<LaptopHubQr>;
  try {
    parsed = JSON.parse(value) as Partial<LaptopHubQr>;
  } catch {
    throw new Error('This is not a CoopGuard laptop hub QR code.');
  }
  if (
    parsed.type !== 'coopguard-hub' ||
    parsed.version !== 1 ||
    typeof parsed.hubId !== 'string' ||
    !/^HUB-[A-Z0-9-]{6,48}$/.test(parsed.hubId) ||
    typeof parsed.token !== 'string' ||
    parsed.token.length < 32 ||
    typeof parsed.wifiUrl !== 'string' ||
    typeof parsed.usbUrl !== 'string' ||
    !Number.isFinite(parsed.expiresAt)
  )
    throw new Error('This CoopGuard laptop hub QR code is incomplete or invalid.');
  if (parsed.expiresAt! < Date.now())
    throw new Error('This hub pairing QR has expired. Create a new QR on the laptop.');
  return {
    type: 'coopguard-hub',
    version: 1,
    hubId: parsed.hubId,
    token: parsed.token,
    wifiUrl: normalizeServer(parsed.wifiUrl),
    usbUrl: normalizeServer(parsed.usbUrl),
    expiresAt: parsed.expiresAt!,
  };
}

export function hubServerFromQr(value: string, transport: 'wifi' | 'usb') {
  const qr = parseLaptopHubQr(value);
  return { qr, server: transport === 'wifi' ? qr.wifiUrl : qr.usbUrl };
}
