import type { FarmSnapshot } from "../domain/types";

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export const SNAPSHOT_KEY = "coopguard.demoSnapshot.v1";
const metrics = ["temperature", "humidity", "ammonia", "co2", "moisture"];
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Cache input is untrusted. Check every field used by a screen before restoring it. */
export function validSnapshot(value: unknown): value is FarmSnapshot {
  if (
    !record(value) ||
    !finite(value.sampledAt) ||
    !finite(value.syncedAt) ||
    value.sampledAt < 0 ||
    value.syncedAt < 0
  )
    return false;
  if (
    !["high", "full"].includes(String(value.fanStage)) ||
    value.request !== null
  )
    return false;
  if (
    !Array.isArray(value.sensors) ||
    value.sensors.length > 1000 ||
    !Array.isArray(value.alerts) ||
    value.alerts.length > 1000
  )
    return false;
  const sensorsValid = value.sensors.every(
    (sensor) =>
      record(sensor) &&
      typeof sensor.id === "string" &&
      typeof sensor.number === "string" &&
      ["A", "B", "C"].includes(String(sensor.section)) &&
      finite(sensor.x) &&
      sensor.x >= 0 &&
      sensor.x <= 1 &&
      finite(sensor.y) &&
      sensor.y >= 0 &&
      sensor.y <= 1 &&
      typeof sensor.online === "boolean" &&
      typeof sensor.control === "boolean" &&
      (sensor.battery === null ||
        (finite(sensor.battery) &&
          sensor.battery >= 0 &&
          sensor.battery <= 100)) &&
      ["strong", "ok", "weak"].includes(String(sensor.signal)) &&
      record(sensor.readings) &&
      record(sensor.conditions) &&
      metrics.every(
        (metric) =>
          finite((sensor.readings as Record<string, unknown>)[metric]) &&
          ["good", "watch", "urgent", "unavailable", "unclassified"].includes(
            String((sensor.conditions as Record<string, unknown>)[metric]),
          ),
      ),
  );
  const alertsValid = value.alerts.every(
    (alert) =>
      record(alert) &&
      typeof alert.id === "string" &&
      typeof alert.sensorId === "string" &&
      ["heatAlert", "sensorAlert", "sensorCheckAlert", "resolvedAlert"].includes(
        String(alert.titleKey),
      ) &&
      ["A", "B", "C"].includes(String(alert.section)) &&
      ["warning", "info"].includes(String(alert.severity)) &&
      ["active", "acknowledged", "resolved"].includes(String(alert.status)) &&
      finite(alert.detectedAt) &&
      (alert.acknowledgedAt === undefined || finite(alert.acknowledgedAt)) &&
      (alert.resolvedAt === undefined || finite(alert.resolvedAt)) &&
      (alert.metric === null || metrics.includes(String(alert.metric))) &&
      ["control_high", "none"].includes(String(alert.action)),
  );
  return sensorsValid && alertsValid;
}

/** Requests are deliberately excluded: opening a cache must never replay a command. */
export function cacheSnapshot(snapshot: FarmSnapshot): FarmSnapshot {
  return JSON.parse(JSON.stringify({ ...snapshot, request: null }));
}

export async function readSnapshot(
  storage: KeyValueStorage,
): Promise<FarmSnapshot | null> {
  const raw = await storage.getItem(SNAPSHOT_KEY);
  if (!raw || raw.length > 1_000_000) return null;
  try {
    const envelope: unknown = JSON.parse(raw);
    if (
      !record(envelope) ||
      envelope.version !== 1 ||
      !validSnapshot(envelope.snapshot)
    )
      return null;
    return cacheSnapshot(envelope.snapshot);
  } catch {
    return null;
  }
}

export async function writeSnapshot(
  storage: KeyValueStorage,
  snapshot: FarmSnapshot,
): Promise<void> {
  const saved = cacheSnapshot(snapshot);
  if (!validSnapshot(saved)) throw new Error("Invalid snapshot");
  await storage.setItem(
    SNAPSHOT_KEY,
    JSON.stringify({ version: 1, snapshot: saved }),
  );
}
