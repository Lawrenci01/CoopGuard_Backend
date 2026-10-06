import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { CoopDatabase, SqlRow } from "./database";
import type {
  Condition,
  FarmAlert,
  MetricKey,
  Section,
  Sensor,
} from "./shared/domain/types";
import type { LocalFarmState } from "./shared/services/localFarmRepository";

const deviceId = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, underscores and hyphens.");
const finite = (minimum: number, maximum: number) =>
  z.number().finite().min(minimum).max(maximum);

export const telemetryBatchSchema = z
  .object({
    schemaVersion: z.literal(1),
    farmCode: z.string().trim().regex(/^CG-[A-Z0-9-]{4,32}$/),
    hubId: deviceId,
    sentAt: z.iso.datetime({ offset: true }),
    readings: z
      .array(
        z
          .object({
            messageId: z.uuid(),
            nodeId: deviceId,
            sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
            section: z.enum(["A", "B", "C"]),
            sampledAt: z.iso.datetime({ offset: true }),
            firmwareVersion: z.string().trim().min(1).max(40).optional(),
            configVersion: z.string().trim().min(1).max(40).optional(),
            readings: z
              .object({
                temperatureC: finite(-20, 70),
                humidityPercent: finite(0, 100),
                ammoniaPpm: finite(0, 500),
                co2Ppm: finite(0, 20_000),
                litterMoisturePercent: finite(0, 100),
              })
              .strict(),
            quality: z
              .object({
                calibrated: z.boolean(),
                warmingUp: z.boolean(),
                sensorsValid: z.boolean(),
              })
              .strict(),
            power: z
              .object({ batteryPercent: finite(0, 100).nullable() })
              .strict(),
            radio: z
              .object({
                rssiDbm: finite(-200, 0),
                snrDb: finite(-30, 30),
              })
              .strict(),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();

export type TelemetryBatch = z.infer<typeof telemetryBatchSchema>;
export type TelemetryReading = TelemetryBatch["readings"][number];

export const telemetrySecretDigest = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");

export function validTelemetrySecret(secret: string, expectedDigest: string) {
  const actual = Buffer.from(telemetrySecretDigest(secret), "hex");
  const expected = Buffer.from(expectedDigest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export interface TelemetryHubCredentials {
  farmId: string;
  farmCode: string;
  hubId: string;
  hubSecret: string;
  nodes: { id: string; number: string; section: Section }[];
}

/**
 * Turns the already reviewed virtual pairing plan into credentials for the
 * gateway simulator. The secret is returned once and only its digest is stored.
 */
export async function provisionTelemetryGateway(
  db: CoopDatabase,
  farmCode: string,
  now = Date.now(),
): Promise<TelemetryHubCredentials> {
  const farm = (await db
    .prepare(
      "SELECT f.id,f.state FROM farms f JOIN farm_codes c ON c.farm_id=f.id WHERE c.code=?",
    )
    .get(farmCode)) as { id: string; state: string } | undefined;
  if (!farm) throw new Error("Farm ID not found.");
  const state = JSON.parse(farm.state) as LocalFarmState;
  const virtualHub = state.deviceSimulation?.hub;
  const virtualNodes = state.deviceSimulation?.nodes ?? [];
  if (!virtualHub || virtualHub.status !== "reporting")
    throw new Error("Pair the virtual farm hub and confirm its heartbeat first.");
  if (!virtualNodes.length || virtualNodes.some((node) => node.status !== "reporting"))
    throw new Error("Pair every planned virtual node and confirm its heartbeat first.");
  const existing = await db
    .prepare("SELECT 1 FROM telemetry_hubs WHERE id=? OR farm_id=?")
    .get(virtualHub.id, farm.id);
  if (existing)
    throw new Error(
      "Telemetry credentials already exist for this farm. Revoke them before provisioning replacements.",
    );
  const secret = randomBytes(32).toString("base64url");
  const statements = [
    {
      sql: "INSERT INTO telemetry_hubs(id,farm_id,secret_digest,active,created_at,last_seen_at) VALUES(?,?,?,1,?,NULL)",
      args: [virtualHub.id, farm.id, telemetrySecretDigest(secret), now],
    },
    ...virtualNodes.map((node, index) => ({
      sql: "INSERT INTO telemetry_nodes(id,farm_id,hub_id,number,section,x,y,control,active,created_at) VALUES(?,?,?,?,?,?,?,?,1,?)",
      args: [
        node.id,
        farm.id,
        virtualHub.id,
        String(index + 1).padStart(2, "0"),
        node.section,
        node.x ?? ((["A", "B", "C"] as Section[]).indexOf(node.section) + 0.5) / 3,
        node.y ?? 0.5,
        0,
        now,
      ],
    })),
  ];
  await db.batch(statements);
  return {
    farmId: farm.id,
    farmCode,
    hubId: virtualHub.id,
    hubSecret: secret,
    nodes: virtualNodes.map((node, index) => ({
      id: node.id,
      number: String(index + 1).padStart(2, "0"),
      section: node.section,
    })),
  };
}

export interface TelemetryNodeLatest {
  nodeId: string;
  number: string;
  section: Section;
  x: number;
  y: number;
  control: boolean;
  sampledAt: number | null;
  receivedAt: number | null;
  sequence: number | null;
  firmwareVersion: string | null;
  configVersion: string | null;
  calibrated: boolean | null;
  warmingUp: boolean | null;
  sensorsValid: boolean | null;
  batteryPercent: number | null;
  rssiDbm: number | null;
  snrDb: number | null;
  readings: Record<MetricKey, number> | null;
}

const nullableNumber = (value: unknown) =>
  value === null || value === undefined ? null : Number(value);

export async function latestTelemetry(
  db: CoopDatabase,
  farmId: string,
): Promise<TelemetryNodeLatest[]> {
  const rows = await db
    .prepare(
      `SELECT n.id node_id,n.number,n.section,n.x,n.y,n.control,
        r.sequence,r.sampled_at,r.received_at,r.firmware_version,r.config_version,
        r.calibrated,r.warming_up,r.sensors_valid,r.battery_percent,r.rssi_dbm,r.snr_db,
        r.temperature_c,r.humidity_percent,r.ammonia_ppm,r.co2_ppm,r.litter_moisture_percent
       FROM telemetry_nodes n
       LEFT JOIN sensor_readings r ON r.id=(
         SELECT r2.id FROM sensor_readings r2 WHERE r2.node_id=n.id
         ORDER BY r2.sampled_at DESC,r2.received_at DESC LIMIT 1
       )
       WHERE n.farm_id=? AND n.active=1 ORDER BY n.created_at,n.id`,
    )
    .all(farmId);
  return rows.map((row) => telemetryNodeFromRow(row));
}

function telemetryNodeFromRow(row: SqlRow): TelemetryNodeLatest {
  const hasReading = row.sampled_at !== null && row.sampled_at !== undefined;
  return {
    nodeId: String(row.node_id),
    number: String(row.number),
    section: String(row.section) as Section,
    x: Number(row.x),
    y: Number(row.y),
    control: !!row.control,
    sampledAt: nullableNumber(row.sampled_at),
    receivedAt: nullableNumber(row.received_at),
    sequence: nullableNumber(row.sequence),
    firmwareVersion: row.firmware_version == null ? null : String(row.firmware_version),
    configVersion: row.config_version == null ? null : String(row.config_version),
    calibrated: row.calibrated == null ? null : !!row.calibrated,
    warmingUp: row.warming_up == null ? null : !!row.warming_up,
    sensorsValid: row.sensors_valid == null ? null : !!row.sensors_valid,
    batteryPercent: nullableNumber(row.battery_percent),
    rssiDbm: nullableNumber(row.rssi_dbm),
    snrDb: nullableNumber(row.snr_db),
    readings: hasReading
      ? {
          temperature: Number(row.temperature_c),
          humidity: Number(row.humidity_percent),
          ammonia: Number(row.ammonia_ppm),
          co2: Number(row.co2_ppm),
          moisture: Number(row.litter_moisture_percent),
        }
      : null,
  };
}

const conditionMap = (condition: Condition): Record<MetricKey, Condition> => ({
  temperature: condition,
  humidity: condition,
  ammonia: condition,
  co2: condition,
  moisture: condition,
});

function telemetrySensor(node: TelemetryNodeLatest, currentTime: number): Sensor | null {
  if (!node.readings || node.sampledAt === null || node.receivedAt === null) return null;
  const online = currentTime - node.receivedAt <= 180_000;
  const readingsUsable =
    online && node.calibrated === true && node.warmingUp === false && node.sensorsValid === true;
  return {
    id: node.nodeId,
    number: node.number,
    section: node.section,
    x: node.x,
    y: node.y,
    online,
    control: node.control,
    battery: node.batteryPercent,
    signal:
      node.rssiDbm === null || node.rssiDbm < -110
        ? "weak"
        : node.rssiDbm < -90
          ? "ok"
          : "strong",
    readings: node.readings,
    // Site-specific thresholds remain open. Valid live values are observable,
    // but they are not classified as safe/watch/urgent without an approved profile.
    conditions: conditionMap(readingsUsable ? "unclassified" : "unavailable"),
  };
}

function priorAlert(state: LocalFarmState, id: string) {
  return state.snapshot.alerts.find((alert) => alert.id === id);
}

function technicalAlerts(
  state: LocalFarmState,
  nodes: TelemetryNodeLatest[],
  currentTime: number,
): FarmAlert[] {
  return nodes.flatMap((node): FarmAlert[] => {
    if (node.receivedAt === null) return [];
    const stale = currentTime - node.receivedAt > 180_000;
    const qualityProblem =
      !stale &&
      (node.calibrated !== true || node.warmingUp === true || node.sensorsValid !== true);
    if (!stale && !qualityProblem) return [];
    const id = stale ? `telemetry-stale-${node.nodeId}` : `telemetry-quality-${node.nodeId}`;
    const previous = priorAlert(state, id);
    return [
      {
        id,
        titleKey: stale ? "sensorAlert" : "sensorCheckAlert",
        section: node.section,
        severity: stale ? "warning" : "info",
        status: previous?.status === "acknowledged" ? "acknowledged" : "active",
        detectedAt: previous?.detectedAt ?? node.receivedAt,
        acknowledgedAt: previous?.acknowledgedAt,
        metric: null,
        sensorId: node.nodeId,
        action: "none",
      },
    ];
  });
}

/** Replaces sample readings only after at least one physical/simulated packet arrives. */
export async function applyTelemetryToState(
  db: CoopDatabase,
  farmId: string,
  state: LocalFarmState,
  currentTime: number,
  suppliedNodes?: TelemetryNodeLatest[],
): Promise<LocalFarmState> {
  const nodes = suppliedNodes ?? (await latestTelemetry(db, farmId));
  const sensors = nodes
    .map((node) => telemetrySensor(node, currentTime))
    .filter((sensor): sensor is Sensor => sensor !== null);
  if (!sensors.length) return state;
  const sampledAt = Math.max(
    ...nodes.map((node) => node.sampledAt ?? 0),
    state.snapshot.sampledAt,
  );
  const receivedAt = Math.max(...nodes.map((node) => node.receivedAt ?? 0));
  return {
    ...state,
    snapshot: {
      ...state.snapshot,
      sampledAt,
      syncedAt: receivedAt,
      sensors,
      alerts: technicalAlerts(state, nodes, currentTime),
      request: null,
    },
  };
}

export interface TelemetryHistoryPoint {
  id: string;
  nodeId: string;
  sampledAt: number;
  receivedAt: number;
  sequence: number;
  value: number;
}

const metricColumn: Record<MetricKey, string> = {
  temperature: "temperature_c",
  humidity: "humidity_percent",
  ammonia: "ammonia_ppm",
  co2: "co2_ppm",
  moisture: "litter_moisture_percent",
};

export async function telemetryHistory(
  db: CoopDatabase,
  farmId: string,
  nodeId: string,
  metric: MetricKey,
  from: number,
  to: number,
  limit: number,
): Promise<TelemetryHistoryPoint[]> {
  const column = metricColumn[metric];
  const rows = await db
    .prepare(
      `SELECT id,node_id,sampled_at,received_at,sequence,${column} value
       FROM sensor_readings
       WHERE farm_id=? AND node_id=? AND sampled_at BETWEEN ? AND ?
       ORDER BY sampled_at DESC LIMIT ?`,
    )
    .all(farmId, nodeId, from, to, limit);
  return rows.map((row) => ({
    id: String(row.id),
    nodeId: String(row.node_id),
    sampledAt: Number(row.sampled_at),
    receivedAt: Number(row.received_at),
    sequence: Number(row.sequence),
    value: Number(row.value),
  }));
}

export const readingInsert = (
  farmId: string,
  hubId: string,
  reading: TelemetryReading,
  receivedAt: number,
) => ({
  sql: `INSERT INTO sensor_readings(
    id,message_id,farm_id,hub_id,node_id,sequence,sampled_at,received_at,
    temperature_c,humidity_percent,ammonia_ppm,co2_ppm,litter_moisture_percent,
    calibrated,warming_up,sensors_valid,battery_percent,rssi_dbm,snr_db,
    firmware_version,config_version
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  args: [
    randomUUID(),
    reading.messageId,
    farmId,
    hubId,
    reading.nodeId,
    reading.sequence,
    Date.parse(reading.sampledAt),
    receivedAt,
    reading.readings.temperatureC,
    reading.readings.humidityPercent,
    reading.readings.ammoniaPpm,
    reading.readings.co2Ppm,
    reading.readings.litterMoisturePercent,
    reading.quality.calibrated ? 1 : 0,
    reading.quality.warmingUp ? 1 : 0,
    reading.quality.sensorsValid ? 1 : 0,
    reading.power.batteryPercent,
    reading.radio.rssiDbm,
    reading.radio.snrDb,
    reading.firmwareVersion ?? null,
    reading.configVersion ?? null,
  ],
});
