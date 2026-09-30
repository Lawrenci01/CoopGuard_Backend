import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDemoSnapshot } from '../src/data/fixtures';
import {
  readSnapshot,
  writeSnapshot,
  SNAPSHOT_KEY,
  type KeyValueStorage,
} from '../src/services/snapshotCache';
import {
  validSurvey,
  surveyRecommendation,
  suggestedSections,
  type HouseSurveyDraft,
} from '../src/domain/setup';

function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
  };
}
const observedAt = 1_800_000_000_000;

test('saved readings survive a new cache reader without becoming freshly sampled', async () => {
  const storage = memoryStorage();
  const snapshot = createDemoSnapshot(observedAt);
  await writeSnapshot(storage, snapshot);
  const restored = await readSnapshot(storage);
  assert.deepEqual(restored, snapshot);
  assert.equal(restored?.sampledAt, observedAt);
  assert.equal(restored?.syncedAt, observedAt - 25 * 60_000);
});

test('pending and applied commands are never restored from a reading cache', async () => {
  for (const status of ['pending', 'applied'] as const) {
    const storage = memoryStorage();
    const snapshot = createDemoSnapshot(observedAt);
    snapshot.request = {
      id: 'do-not-replay',
      requestedAt: observedAt,
      expiresAt: observedAt + 60_000,
      status,
    };
    await writeSnapshot(storage, snapshot);
    assert.equal((await readSnapshot(storage))?.request, null);
    assert.equal(snapshot.request.status, status);
  }
});

test('invalid cache schema, corrupt JSON, and non-finite readings are rejected', async () => {
  const storage = memoryStorage();
  for (const data of ['{broken', '{"version": 99}', '{"version":1,"snapshot":{"sensors":[]}}']) {
    await storage.setItem(SNAPSHOT_KEY, data);
    assert.equal(await readSnapshot(storage), null);
  }
  const snapshot = createDemoSnapshot(observedAt);
  snapshot.sensors[0]!.readings.temperature = Number.NaN;
  await assert.rejects(writeSnapshot(storage, snapshot), /Invalid snapshot/);
});

test('storage failures remain visible to the caller', async () => {
  const storage: KeyValueStorage = {
    getItem: async () => {
      throw new Error('disk');
    },
    setItem: async () => {
      throw new Error('disk');
    },
  };
  await assert.rejects(readSnapshot(storage), /disk/);
  await assert.rejects(writeSnapshot(storage, createDemoSnapshot(observedAt)), /disk/);
});

const survey: HouseSurveyDraft = {
  farmName: 'Test farm',
  houseName: 'House 1',
  houseType: 'open',
  controller: 'absent',
  flock: 'broiler',
  lengthMetres: 90,
  widthMetres: 12,
};

test('a setup draft validates dimensions and preserves undecided survey answers', () => {
  assert.equal(validSurvey(survey), true);
  assert.equal(
    validSurvey({ ...survey, houseType: 'unknown', controller: 'unknown', flock: 'unknown' }),
    true,
  );
  assert.equal(validSurvey({ ...survey, lengthMetres: 0 }), false);
  assert.equal(validSurvey({ ...survey, widthMetres: Number.POSITIVE_INFINITY }), false);
  assert.equal(validSurvey({ ...survey, farmName: '   ' }), false);
  assert.equal(validSurvey({ ...survey, controller: 'made-up' }), false);
  assert.equal(suggestedSections(survey), 3);
  assert.equal(suggestedSections({ ...survey, lengthMetres: 15 }), 1);
});

test('existing controllers and unknown site conditions cannot recommend immediate full control', () => {
  assert.equal(surveyRecommendation({ ...survey, controller: 'present' }), 'monitor');
  assert.equal(surveyRecommendation({ ...survey, controller: 'unknown' }), 'review');
  assert.equal(surveyRecommendation({ ...survey, houseType: 'tunnel' }), 'review');
  assert.equal(surveyRecommendation({ ...survey, houseType: 'unknown' }), 'review');
  assert.equal(surveyRecommendation(survey), 'eligible');
});
