import assert from 'node:assert/strict';
import test from 'node:test';
import { houseAttention } from '../src/domain/attention';
import { createDemoSnapshot } from '../src/data/fixtures';

test('acknowledged alerts stay on the home priority until resolved', () => {
  const snapshot = createDemoSnapshot();
  snapshot.alerts[0]!.status = 'acknowledged';
  const priority = houseAttention(snapshot);
  assert.equal(priority.kind, 'alert');
  if (priority.kind === 'alert') {
    assert.equal(priority.alert.id, 'heat-b');
    assert.equal(priority.count, 2);
  }
});

test('a critical reading outranks informational alerts', () => {
  const snapshot = createDemoSnapshot();
  snapshot.alerts[0]!.status = 'resolved';
  snapshot.sensors[0]!.conditions.ammonia = 'urgent';
  assert.deepEqual(houseAttention(snapshot), { kind: 'reading', metric: 'ammonia' });
});

test('missing coverage cannot become an all-clear after alerts are resolved', () => {
  const snapshot = createDemoSnapshot();
  snapshot.alerts.forEach((a) => (a.status = 'resolved'));
  snapshot.sensors.forEach((s) => (s.conditions.temperature = 'good'));
  assert.equal(houseAttention(snapshot).kind, 'incomplete');
  snapshot.sensors.forEach((s) => (s.online = true));
  assert.equal(houseAttention(snapshot).kind, 'clear');
  snapshot.sensors = [];
  assert.equal(houseAttention(snapshot).kind, 'incomplete');
});
