import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LOCAL_FARM_KEY,
  LocalFarmRepository,
  dateText,
  seedLocalFarm,
} from '../src/services/localFarmRepository';
import type { KeyValueStorage } from '../src/services/snapshotCache';
import { commissionSiteForControl } from './siteTestFixture';

function fixture() {
  const values = new Map<string, string>();
  const storage: KeyValueStorage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
  };
  let now = new Date('2026-09-30T12:00:00').getTime();
  const repo = new LocalFarmRepository(storage, () => now);
  return {
    repo,
    storage,
    values,
    clock: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

test('local changes survive restart without any network and do not reset the fan timer', async () => {
  const f = fixture();
  await f.repo.load();
  await f.repo.dispatch({ type: 'start' });
  await commissionSiteForControl(f.repo);
  const currentAlert = (await f.repo.dispatch({ type: 'refresh' })).snapshot.alerts[0]!;
  await f.repo.dispatch({ type: 'ack', id: currentAlert.id });
  const applied = await f.repo.dispatch({ type: 'fullPower' });
  f.advance(30_000);
  const restored = new LocalFarmRepository(f.storage, f.clock);
  const saved = await restored.load();
  assert.equal(saved.started, true);
  assert.equal(saved.context.connection, 'local');
  assert.equal(saved.snapshot.alerts[0]?.status, 'acknowledged');
  assert.equal(
    saved.snapshot.request?.overrideExpiresAt,
    applied.snapshot.request?.overrideExpiresAt,
  );
  f.advance(2 * 60 * 60_000);
  assert.equal((await restored.dispatch({ type: 'tick' })).snapshot.fanStage, 'high');
});

test('sensor add, move and retirement persist and role checks run in the data layer', async () => {
  const f = fixture();
  await assert.rejects(
    f.repo.dispatch({
      type: 'addSensor',
      section: 'B',
      control: false,
      tested: false,
      calibrated: true,
    }),
    /Technician/,
  );
  const legacy = fixture();
  await legacy.repo.dispatch({ type: 'context', patch: { role: 'technician' } });
  let state = await legacy.repo.dispatch({
    type: 'addSensor',
    section: 'B',
    control: false,
    tested: false,
    calibrated: true,
  });
  assert.equal(state.snapshot.sensors.length, 13);
  await legacy.repo.dispatch({
    type: 'moveSensor',
    id: 'sensor-13',
    section: 'C',
    x: 0.83,
    y: 0.75,
  });
  state = await new LocalFarmRepository(legacy.storage, legacy.clock).load();
  assert.equal(state.snapshot.sensors.at(-1)?.section, 'C');
  state = await legacy.repo.dispatch({ type: 'retireSensor', id: 'sensor-13' });
  assert.equal(state.snapshot.sensors.length, 12);
  assert.equal(state.retired[0]?.number, '13');
  state = await legacy.repo.dispatch({
    type: 'addSensor',
    section: 'A',
    control: false,
    tested: false,
    calibrated: true,
  });
  assert.equal(state.snapshot.sensors.at(-1)?.number, '14');
});

test('existing controller locks the saved house to monitor mode and rejects outputs', async () => {
  const f = fixture();
  const house = {
    farmName: 'Local farm',
    houseName: 'East house',
    houseType: 'open' as const,
    controller: 'present' as const,
    flock: 'broiler' as const,
    lengthMetres: 90,
    widthMetres: 12,
  };
  await f.repo.dispatch({ type: 'house', value: house });
  const state = await f.repo.dispatch({ type: 'context', patch: { controlMode: 'full' } });
  assert.equal(state.context.controlMode, 'monitor');
  await assert.rejects(f.repo.dispatch({ type: 'fullPower' }));
  assert.equal(
    (await new LocalFarmRepository(f.storage, f.clock).load()).house?.houseName,
    'East house',
  );
});

test('first house replaces only the seed flock and saves the dashboard handoff atomically', async () => {
  const f = fixture();
  const house = {
    farmName: 'Farm',
    houseName: 'West',
    houseType: 'open' as const,
    controller: 'absent' as const,
    flock: 'broiler' as const,
    lengthMetres: 90,
    widthMetres: 12,
  };
  const write = f.storage.setItem;
  f.storage.setItem = async () => {
    throw new Error('Disk full');
  };
  await assert.rejects(f.repo.dispatch({ type: 'house', value: house, open: true }), /Disk full/);
  let state = await f.repo.dispatch({ type: 'tick' });
  assert.equal(state.started, false);
  assert.equal(state.house, null);
  assert.equal(state.flock?.id, 'flock-1');
  f.storage.setItem = write;
  await f.repo.dispatch({ type: 'house', value: house, open: true });
  state = await new LocalFarmRepository(f.storage, f.clock).load();
  assert.equal(state.started, true);
  assert.equal(state.house?.houseName, 'West');
  assert.equal(state.flock, null);
  state = await f.repo.dispatch({
    type: 'startFlock',
    startDate: dateText(f.clock()),
    days: 42,
    birds: 500,
  });
  const flock = state.flock;
  state = await f.repo.dispatch({ type: 'house', value: { ...house, houseName: 'East' } });
  assert.deepEqual(state.flock, flock);
  assert.equal(state.started, true);
});

test('a user-created flock is retained when saving a first house', async () => {
  const f = fixture();
  await f.repo.dispatch({ type: 'endFlock' });
  const before = await f.repo.dispatch({
    type: 'startFlock',
    startDate: dateText(f.clock()),
    days: 35,
    birds: 200,
  });
  const after = await f.repo.dispatch({
    type: 'house',
    value: {
      farmName: 'Farm',
      houseName: 'West',
      houseType: 'open',
      controller: 'absent',
      flock: 'broiler',
      lengthMetres: 90,
      widthMetres: 12,
    },
    open: true,
  });
  assert.deepEqual(after.flock, before.flock);
  assert.deepEqual(after.pastFlocks, before.pastFlocks);
});

test('upgrading a 0.1.0 house removes only its untouched seed flock and keeps saved records', async () => {
  const f = fixture();
  const previous = seedLocalFarm(f.clock());
  previous.started = true;
  previous.house = {
    farmName: 'Farm',
    houseName: 'West',
    houseType: 'open',
    controller: 'absent',
    flock: 'broiler',
    lengthMetres: 90,
    widthMetres: 12,
  };
  previous.inspections = [
    { id: 'saved-note', kind: 'sound', text: 'My observation', createdAt: f.clock() },
  ];
  previous.snapshot.alerts[0]!.status = 'acknowledged';
  f.values.set(LOCAL_FARM_KEY, JSON.stringify(previous));
  const loaded = await f.repo.load();
  assert.deepEqual(loaded, { ...previous, flock: null });
  assert.deepEqual(await new LocalFarmRepository(f.storage, f.clock).load(), loaded);
  const real = await f.repo.dispatch({
    type: 'startFlock',
    startDate: dateText(f.clock()),
    days: 35,
    birds: 500,
  });
  assert.deepEqual(await new LocalFarmRepository(f.storage, f.clock).load(), real);
});

test('notes support create, edit and delete while sample link is disconnected', async () => {
  const f = fixture();
  await f.repo.dispatch({ type: 'context', patch: { connection: 'offline' } });
  let state = await f.repo.dispatch({
    type: 'saveInspection',
    kind: 'sound',
    text: 'Flock became louder near feeding.',
  });
  const id = state.inspections[0]!.id;
  await f.repo.dispatch({
    type: 'saveInspection',
    id,
    kind: 'sound',
    text: 'Quiet again after feeding.',
  });
  state = await new LocalFarmRepository(f.storage, f.clock).load();
  assert.equal(state.inspections[0]?.text, 'Quiet again after feeding.');
  state = await f.repo.dispatch({ type: 'deleteInspection', id });
  assert.equal(state.inspections.length, 0);
});

test('flock lifecycle validates dates, archives the cycle and updates the current record', async () => {
  const f = fixture();
  await assert.rejects(
    f.repo.dispatch({ type: 'startFlock', startDate: dateText(f.clock()), days: 42, birds: 500 }),
    /End/,
  );
  let state = await f.repo.dispatch({ type: 'endFlock' });
  assert.equal(state.flock, null);
  assert.equal(state.pastFlocks.length, 1);
  await assert.rejects(
    f.repo.dispatch({ type: 'startFlock', startDate: '2026-02-30', days: 42, birds: 500 }),
    /date/,
  );
  await f.repo.dispatch({
    type: 'startFlock',
    startDate: dateText(f.clock()),
    days: 35,
    birds: 500,
  });
  state = await new LocalFarmRepository(f.storage, f.clock).load();
  assert.equal(state.flock?.birds, 500);
  assert.equal(state.pastFlocks.length, 1);
});

test('concurrent writes serialize; a disk failure does not report unsaved changes as saved', async () => {
  const f = fixture();
  await Promise.all([
    f.repo.dispatch({ type: 'saveInspection', kind: 'sound', text: 'First' }),
    f.repo.dispatch({ type: 'saveInspection', kind: 'environment', text: 'Second' }),
  ]);
  assert.equal((await new LocalFarmRepository(f.storage, f.clock).load()).inspections.length, 2);
  const original = f.storage.setItem;
  f.storage.setItem = async () => {
    throw new Error('Disk full');
  };
  await assert.rejects(f.repo.dispatch({ type: 'notifications', value: false }), /Disk full/);
  f.storage.setItem = original;
  assert.equal((await f.repo.dispatch({ type: 'tick' })).notifications, true);
});

test('corrupt saved data is preserved and produces a load error', async () => {
  const f = fixture();
  f.values.set(LOCAL_FARM_KEY, '{bad json');
  await assert.rejects(f.repo.load(), /not been overwritten/);
  assert.equal(f.values.get(LOCAL_FARM_KEY), '{bad json');
});

test('team changes retain an owner and worker role cannot manage the directory', async () => {
  const f = fixture();
  await assert.rejects(f.repo.dispatch({ type: 'deletePerson', id: 'owner' }));
  await f.repo.dispatch({ type: 'savePerson', name: 'Worker A', role: 'worker' });
  assert.equal((await new LocalFarmRepository(f.storage, f.clock).load()).people.length, 2);
  await f.repo.dispatch({ type: 'context', patch: { role: 'worker' } });
  await assert.rejects(
    f.repo.dispatch({ type: 'savePerson', name: 'Worker B', role: 'worker' }),
    /owner/,
  );
});
