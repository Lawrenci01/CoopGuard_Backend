import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DemoFarmService } from '../src/services/demoFarmService';
import { DEMO_REQUEST_TTL_MS, OVERRIDE_DURATION_MS, canManageSensors } from '../src/domain/policy';
import type { PreviewContext } from '../src/domain/types';
import { createDemoSnapshot } from '../src/data/fixtures';
import { summarizeReadings } from '../src/domain/readings';

const local: PreviewContext = { connection: 'local', role: 'owner', controlMode: 'full' };
const cloud: PreviewContext = { ...local, connection: 'cloud' };

test('offline and monitor-only requests cannot change equipment', async () => {
  const farm = new DemoFarmService();
  for (const context of [
    { ...local, connection: 'offline' as const },
    { ...local, controlMode: 'monitor' as const },
  ]) {
    await assert.rejects(farm.requestFullPower(context), /controlUnavailable/);
    assert.equal((await farm.getSnapshot()).fanStage, 'high');
    assert.equal((await farm.getSnapshot()).request, null);
  }
});

test('a local increase is acknowledged, and repeated taps do not extend its two-hour deadline', async () => {
  let now = 1_000_000;
  const farm = new DemoFarmService(() => now);
  const first = await farm.requestFullPower({ ...local, role: 'worker' });
  assert.equal(first.request?.status, 'applied');
  assert.equal(first.fanStage, 'full');
  assert.equal(first.request?.overrideExpiresAt, now + OVERRIDE_DURATION_MS);
  now += 10_000;
  assert.deepEqual((await farm.requestFullPower(local)).request, first.request);
  now = first.request!.overrideExpiresAt!;
  assert.equal(farm.tick().fanStage, 'high');
  // Reconnecting later must not resurrect an expired override.
  assert.equal((await farm.simulateReconnect(local)).fanStage, 'high');
});

test('cloud request stays pending without changing output until a valid local acknowledgment', async () => {
  let now = 1_000_000;
  const farm = new DemoFarmService(() => now);
  const pending = await farm.requestFullPower(cloud);
  assert.equal(pending.request?.status, 'pending');
  assert.equal(pending.fanStage, 'high');
  now += 10_000;
  assert.equal((await farm.simulateReconnect(cloud)).request?.status, 'pending');
  const accepted = await farm.simulateReconnect(local);
  assert.equal(accepted.request?.status, 'applied');
  assert.equal(accepted.request?.appliedAt, now);
  assert.equal(accepted.request?.overrideExpiresAt, now + OVERRIDE_DURATION_MS);
});

test('a request arriving at its expiry is never applied, including after further reconnects', async () => {
  let now = 1_000_000;
  const farm = new DemoFarmService(() => now);
  await farm.requestFullPower(cloud);
  now += DEMO_REQUEST_TTL_MS;
  const expired = await farm.simulateReconnect(local);
  assert.equal(expired.request?.status, 'expired');
  assert.equal(expired.fanStage, 'high');
  now += 1_000;
  assert.equal((await farm.simulateReconnect(local)).request?.status, 'expired');
  assert.equal((await farm.requestFullPower(local)).request?.status, 'applied');
});

test('pending request is rejected if the house changes to monitor-only before delivery', async () => {
  const farm = new DemoFarmService();
  await farm.requestFullPower(cloud);
  const rejected = await farm.simulateReconnect({ ...local, controlMode: 'monitor' });
  assert.equal(rejected.request?.status, 'rejected');
  assert.equal(rejected.fanStage, 'high');
  assert.equal((await farm.simulateReconnect(local)).request?.status, 'rejected');
});

test('alert acknowledgment is local-only and does not resolve the underlying condition', async () => {
  const farm = new DemoFarmService();
  await assert.rejects(farm.acknowledge('heat-b', cloud), /localRequired/);
  await assert.rejects(farm.acknowledge('heat-b', { ...local, connection: 'offline' }), /offline/);
  const result = await farm.acknowledge('heat-b', local);
  assert.equal(result.alerts.find((alert) => alert.id === 'heat-b')?.status, 'acknowledged');
  assert.equal(result.alerts.find((alert) => alert.id === 'heat-b')?.resolvedAt, undefined);
});

test('installation walkthrough requires a technician connected to the local farm', () => {
  assert.equal(canManageSensors(local), false);
  assert.equal(canManageSensors({ ...cloud, role: 'technician' }), false);
  assert.equal(canManageSensors({ ...local, role: 'technician' }), true);
});

test('returned snapshots cannot mutate service state', async () => {
  const farm = new DemoFarmService();
  const snapshot = await farm.getSnapshot();
  snapshot.sensors[0]!.readings.temperature = 99;
  snapshot.alerts.length = 0;
  const actual = await farm.getSnapshot();
  assert.notEqual(actual.sensors[0]!.readings.temperature, 99);
  assert.equal(actual.alerts.length, 3);
});

test('readings exclude missing sensors and do not mark incomplete coverage as good', () => {
  const sensors = createDemoSnapshot().sensors;
  const sectionC = sensors.filter((sensor) => sensor.section === 'C');
  const result = summarizeReadings(sectionC, 'temperature');
  assert.equal(result.reporting, 3);
  assert.equal(result.total, 4);
  assert.equal(result.condition, 'unavailable');
  assert.equal(result.value, (29.1 + 28.8 + 29.2) / 3);
  assert.equal(
    summarizeReadings(
      sensors.filter((sensor) => sensor.section === 'B'),
      'temperature',
    ).condition,
    'watch',
  );
  assert.equal(summarizeReadings([], 'temperature').value, null);
  assert.equal(
    summarizeReadings(
      sectionC.map((sensor) => ({ ...sensor, online: false })),
      'temperature',
    ).condition,
    'unavailable',
  );
});
