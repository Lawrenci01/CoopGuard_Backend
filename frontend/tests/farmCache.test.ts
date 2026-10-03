import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  cacheKey,
  readFarmCache,
  writeFarmCache,
  visibleFarm,
  type FarmCache,
} from '../src/services/farmCache';
import { seedLocalFarm } from '../src/services/localFarmRepository';
import { connectionModeForServer, normalizeServer } from '../src/services/api';

test('account-scoped offline notes survive restart without changing sensor time or queuing equipment', async () => {
  const records = new Map<string, string>();
  const storage = {
    getItem: async (k: string) => records.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      records.set(k, v);
    },
  };
  const key = cacheKey('https://localhost:8443', 'worker', 'farm');
  const data: FarmCache = {
    version: 1,
    state: seedLocalFarm(Date.parse('2026-10-01T00:00:00Z')),
    revision: 3,
    syncedAt: 200000,
    pending: [{ key: randomUUID(), kind: 'sound', text: 'Birds settled.', createdAt: 200001 }],
  };
  await writeFarmCache(storage, key, data);
  const restored = await readFarmCache(storage, key);
  assert.ok(restored);
  const view = visibleFarm(restored, { id: 'worker', name: 'Worker', role: 'worker' }, 'offline');
  assert.equal(view.context.role, 'worker');
  assert.equal(view.context.connection, 'offline');
  assert.equal(view.inspections[0]!.pending, true);
  assert.equal(view.inspections[0]!.authorId, 'worker');
  assert.deepEqual(view.snapshot, data.state.snapshot);
  for (const other of [
    cacheKey('https://localhost:8443', 'owner', 'farm'),
    cacheKey('https://localhost:8443', 'worker', 'other'),
    cacheKey('https://example.com', 'worker', 'farm'),
  ])
    assert.equal(await readFarmCache(storage, other), null);
});
test('corrupt caches are preserved and storage failures cannot report a successful save', async () => {
  let saved = '{"version":1,"pending":[null]}';
  const storage = {
    getItem: async () => saved,
    setItem: async () => {
      throw new Error('Disk full');
    },
  };
  await assert.rejects(() => readFarmCache(storage, 'key'), /could not be read/);
  assert.equal(saved, '{"version":1,"pending":[null]}');
  saved = JSON.stringify({
    ...{ version: 1, state: seedLocalFarm(), revision: 0, syncedAt: 0 },
    pending: [null],
  });
  await assert.rejects(() => readFarmCache(storage, 'key'), /could not be read/);
  await assert.rejects(
    () =>
      writeFarmCache(storage, 'key', {
        version: 1,
        state: seedLocalFarm(),
        revision: 0,
        syncedAt: 0,
        pending: [],
      }),
    /Disk full/,
  );
});
test('server settings accept HTTPS roots and reject credentials, paths and cleartext', () => {
  assert.equal(normalizeServer(' https://192.168.8.36:8443/ '), 'https://192.168.8.36:8443');
  for (const url of [
    'http://localhost:8443',
    'https://name:password@example.com',
    'https://example.com/api',
    'https://example.com?token=secret',
    'https://example.com/#x',
  ])
    assert.throws(() => normalizeServer(url));
});
test('private farm addresses are local while public HTTPS addresses are remote', () => {
  assert.equal(connectionModeForServer('https://192.168.8.36:8443', true), 'local');
  assert.equal(connectionModeForServer('https://localhost:8443', true), 'local');
  assert.equal(connectionModeForServer('https://172.31.5.2:8443', true), 'local');
  assert.equal(
    connectionModeForServer('https://coopguard-example.trycloudflare.com', true),
    'cloud',
  );
  assert.equal(connectionModeForServer('https://coopguard.example.com', false), 'offline');
});
