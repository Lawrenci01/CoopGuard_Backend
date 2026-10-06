import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app";
import { createFarm, farmCode, openDatabase } from "../src/database";
import { hashPassword } from "../src/passwords";
import { seedLocalFarm } from "../src/shared/services/localFarmRepository";
import { provisionTelemetryGateway } from "../src/telemetry";

test("authenticated telemetry is stored, deduplicated and served to the app", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "coopguard-telemetry-"));
  const db = await openDatabase(join(directory, "test.sqlite"));
  let clock = Date.UTC(2026, 9, 6, 2, 0, 0);
  const farmId = await createFarm(db, "Telemetry farm", clock);
  const code = farmCode(farmId);
  const state = seedLocalFarm(clock);
  state.deviceSimulation = {
    enabled: true,
    hub: {
      id: "HUB-ABCDEF12",
      farmCode: code,
      pairingCode: "PAIRHUB1234",
      status: "reporting",
      createdAt: clock,
      pairedAt: clock,
    },
    nodes: [
      {
        id: "NODE-ABCDEF01",
        farmCode: code,
        pairingCode: "PAIRNODE001",
        section: "A",
        status: "reporting",
        createdAt: clock,
        pairedAt: clock,
        hubId: "HUB-ABCDEF12",
        x: 0.2,
        y: 0.5,
      },
      {
        id: "NODE-ABCDEF02",
        farmCode: code,
        pairingCode: "PAIRNODE002",
        section: "B",
        status: "reporting",
        createdAt: clock,
        pairedAt: clock,
        hubId: "HUB-ABCDEF12",
        x: 0.5,
        y: 0.5,
      },
    ],
    history: [],
  };
  await db.prepare("UPDATE farms SET state=? WHERE id=?").run(JSON.stringify(state), farmId);
  const credentials = await provisionTelemetryGateway(db, code, clock);
  const password = "Telemetry test password 123!";
  await db
    .prepare(
      "INSERT INTO users(id,username,name,role,password_hash,must_change,created_at) VALUES(?,?,?,?,?,0,?)",
    )
    .run(
      "telemetry-tech",
      "telemetry.tech",
      "Telemetry technician",
      "technician",
      await hashPassword(password),
      clock,
    );
  const app = await createApp(db, { clock: () => clock });
  t.after(async () => {
    await app.close();
    await db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { username: "telemetry.tech", password },
  });
  assert.equal(login.statusCode, 200, login.body);
  const token = login.json().token as string;
  const reading = (nodeId: string, section: "A" | "B", sequence: number) => ({
    messageId: randomUUID(),
    nodeId,
    sequence,
    section,
    sampledAt: new Date(clock).toISOString(),
    firmwareVersion: "simulator-0.7.0",
    configVersion: "reading-only-v1",
    readings: {
      temperatureC: section === "A" ? 28.4 : 29.2,
      humidityPercent: 67,
      ammoniaPpm: 8.2,
      co2Ppm: 920,
      litterMoisturePercent: 25,
    },
    quality: { calibrated: true, warmingUp: false, sensorsValid: true },
    power: { batteryPercent: null },
    radio: { rssiDbm: -78, snrDb: 7.5 },
  });
  const batch = {
    schemaVersion: 1,
    farmCode: code,
    hubId: credentials.hubId,
    sentAt: new Date(clock).toISOString(),
    readings: [
      reading("NODE-ABCDEF01", "A", 0),
      reading("NODE-ABCDEF02", "B", 0),
    ],
  };
  const ingest = (payload: object, secret = credentials.hubSecret) =>
    app.inject({
      method: "POST",
      url: "/v1/telemetry/ingest",
      headers: {
        "x-coopguard-hub-id": credentials.hubId,
        "x-coopguard-hub-token": secret,
      },
      payload,
    });

  assert.equal((await ingest(batch, "wrong-secret-that-is-long-enough-000000")).statusCode, 401);
  const first = await ingest(batch);
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(first.json().accepted, 2);
  assert.equal(first.json().duplicates, 0);
  const duplicate = await ingest(batch);
  assert.equal(duplicate.statusCode, 200, duplicate.body);
  assert.equal(duplicate.json().accepted, 0);
  assert.equal(duplicate.json().duplicates, 2);
  assert.equal(
    Number((await db.prepare("SELECT COUNT(*) count FROM sensor_readings").get())?.count),
    2,
  );

  const farm = await app.inject({
    method: "GET",
    url: `/v1/farms/${farmId}`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(farm.statusCode, 200, farm.body);
  assert.equal(farm.json().readings, "telemetry");
  assert.equal(farm.json().state.snapshot.sensors.length, 2);
  assert.equal(farm.json().state.snapshot.sensors[0].readings.temperature, 28.4);
  assert.equal(farm.json().state.snapshot.sensors[0].conditions.temperature, "unclassified");
  assert.deepEqual(farm.json().state.snapshot.alerts, []);

  const latest = await app.inject({
    method: "GET",
    url: `/v1/farms/${farmId}/telemetry/latest`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(latest.statusCode, 200, latest.body);
  assert.equal(latest.json().classification, "reading_only");
  assert.equal(latest.json().thresholdProfile, null);
  assert.equal(latest.json().nodes[1].readings.temperature, 29.2);

  const history = await app.inject({
    method: "GET",
    url: `/v1/farms/${farmId}/telemetry/history?nodeId=NODE-ABCDEF01&metric=temperature&from=${clock - 1}&to=${clock + 1}`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(history.statusCode, 200, history.body);
  assert.deepEqual(
    history.json().points.map((point: { value: number }) => point.value),
    [28.4],
  );

  const replay = {
    ...batch,
    readings: [reading("NODE-ABCDEF01", "A", 0)],
  };
  const replayResponse = await ingest(replay);
  assert.equal(replayResponse.statusCode, 200, replayResponse.body);
  assert.equal(replayResponse.json().rejected[0].reason, "identity_conflict");

  const invalid = structuredClone(batch);
  invalid.readings[0]!.readings.temperatureC = 100;
  assert.equal((await ingest(invalid)).statusCode, 400);

  clock += 181_000;
  const staleFarm = await app.inject({
    method: "GET",
    url: `/v1/farms/${farmId}`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(staleFarm.statusCode, 200, staleFarm.body);
  assert.equal(staleFarm.json().state.snapshot.sensors[0].online, false);
  assert.equal(staleFarm.json().state.snapshot.alerts[0].titleKey, "sensorAlert");
});
