import { validLocalFarm, type LocalFarmState } from './localFarmRepository';
import type { KeyValueStorage } from './snapshotCache';
import type { FarmResponse } from './apiTypes';
import { validSiteSurvey, type SiteSurvey } from '../domain/siteWorkflow';
import type { ConnectionMode } from '../domain/types';
export interface PendingNote {
  key: string;
  kind: 'environment' | 'sound';
  text: string;
  createdAt: number;
}
export interface FarmCache extends FarmResponse {
  version: 1;
  pending: PendingNote[];
  syncedAt: number;
  pendingSurvey?: { key: string; value: SiteSurvey; createdAt: number };
}
export function cacheKey(server: string, userId: string, farmId: string) {
  return `coopguard.farm.v2:${encodeURIComponent(server)}:${userId}:${farmId}`;
}
export function validFarmCache(value: unknown): value is FarmCache {
  try {
    const v = value as FarmCache;
    return (
      !!v &&
      v.version === 1 &&
      validLocalFarm(v.state) &&
      Number.isInteger(v.revision) &&
      v.revision >= 0 &&
      (v.readings === undefined || ['sample', 'telemetry'].includes(v.readings)) &&
      Number.isFinite(v.syncedAt) &&
      Array.isArray(v.pending) &&
      v.pending.length <= 1000 &&
      v.pending.every(
        (n) =>
          /^[a-f0-9-]{36}$/.test(n.key) &&
          ['sound', 'environment'].includes(n.kind) &&
          typeof n.text === 'string' &&
          n.text.trim().length > 0 &&
          n.text.length <= 2000 &&
          Number.isFinite(n.createdAt),
      ) &&
      (v.pendingSurvey === undefined ||
        (/^[a-f0-9-]{36}$/.test(v.pendingSurvey.key) &&
          Number.isFinite(v.pendingSurvey.createdAt) &&
          validSiteSurvey(v.pendingSurvey.value)))
    );
  } catch {
    return false;
  }
}
export async function readFarmCache(storage: KeyValueStorage, key: string) {
  const raw = await storage.getItem(key);
  if (!raw) return null;
  let value: unknown;
  try {
    value = raw.length <= 4_000_000 ? JSON.parse(raw) : null;
  } catch {
    value = null;
  }
  if (!validFarmCache(value))
    throw new Error('Saved farm records could not be read. They have not been overwritten.');
  return value;
}
export async function writeFarmCache(storage: KeyValueStorage, key: string, value: FarmCache) {
  if (!validFarmCache(value)) throw new Error('Invalid farm records.');
  const encoded = JSON.stringify(value);
  if (encoded.length > 4_000_000)
    throw new Error('Local storage limit reached. Sync your pending notes before adding more.');
  await storage.setItem(key, encoded);
}
export function visibleFarm(
  cache: FarmCache,
  user: { id: string; name: string; role: LocalFarmState['context']['role'] },
  connection: ConnectionMode,
): LocalFarmState {
  return {
    ...cache.state,
    started: true,
    context: {
      ...cache.state.context,
      role: user.role,
      connection,
    },
    inspections: [
      ...cache.pending.map((n) => ({
        id: `pending-${n.key}`,
        kind: n.kind,
        text: n.text,
        createdAt: n.createdAt,
        authorId: user.id,
        authorName: user.name,
        pending: true,
      })),
      ...cache.state.inspections,
    ],
  };
}
