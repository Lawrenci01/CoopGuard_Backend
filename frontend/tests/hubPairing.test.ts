import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubServerFromQr, parseLaptopHubQr } from '../src/domain/hubPairing';

const qr = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: 'coopguard-hub',
    version: 1,
    hubId: 'HUB-ABCDEF123456',
    token: 'a'.repeat(43),
    wifiUrl: 'https://192.168.1.20:8443',
    usbUrl: 'https://localhost:8443',
    expiresAt: Date.now() + 60_000,
    ...overrides,
  });

test('laptop hub QR selects WiFi or USB without manual address entry', () => {
  assert.equal(hubServerFromQr(qr(), 'wifi').server, 'https://192.168.1.20:8443');
  assert.equal(hubServerFromQr(qr(), 'usb').server, 'https://localhost:8443');
  assert.equal(parseLaptopHubQr(qr()).hubId, 'HUB-ABCDEF123456');
  assert.deepEqual(
    parseLaptopHubQr(
      qr({ hotspot: { ssid: 'CoopGuard-Hub-ABC123', passphrase: 'safe-test-password' } }),
    ).hotspot,
    { ssid: 'CoopGuard-Hub-ABC123', passphrase: 'safe-test-password' },
  );
});

test('invalid and expired laptop hub QR codes are rejected', () => {
  assert.throws(() => parseLaptopHubQr('not-json'), /not a CoopGuard laptop hub QR/i);
  assert.throws(() => parseLaptopHubQr(qr({ expiresAt: Date.now() - 1 })), /expired/i);
  assert.throws(() => parseLaptopHubQr(qr({ wifiUrl: 'http://192.168.1.20:8443' })), /HTTPS/i);
  assert.throws(
    () => parseLaptopHubQr(qr({ hotspot: { ssid: 'CoopGuard', passphrase: 'short' } })),
    /incomplete or invalid/i,
  );
});
