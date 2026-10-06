import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";

const { values } = parseArgs({
  options: {
    config: { type: "string" },
    api: { type: "string" },
    once: { type: "boolean" },
    interval: { type: "string", default: "60" },
  },
});
if (!values.config)
  throw new Error("Use --config with the private JSON created by npm run provision:telemetry.");
const configPath = resolve(values.config);
const config = JSON.parse(readFileSync(configPath, "utf8"));
if (
  config.schemaVersion !== 1 ||
  typeof config.hubId !== "string" ||
  typeof config.hubSecret !== "string" ||
  typeof config.farmCode !== "string" ||
  !Array.isArray(config.nodes) ||
  !config.nodes.length
)
  throw new Error("The gateway configuration is incomplete.");
const api = (values.api ?? process.env.COOPGUARD_API_URL ?? "https://localhost:8443").replace(
  /\/$/,
  "",
);
const intervalSeconds = Number(values.interval);
if (!Number.isFinite(intervalSeconds) || intervalSeconds < 10 || intervalSeconds > 3600)
  throw new Error("--interval must be between 10 and 3600 seconds.");

const statePath = `${configPath}.state.json`;
const spoolPath = `${configPath}.spool.json`;
const load = (path, fallback) => {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`Could not read ${path}. Preserve it and repair the JSON before retrying.`);
  }
};
const save = (path, value) => {
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporary, path);
};
let state = load(statePath, { sequences: {} });
let spool = load(spoolPath, []);
if (!state || typeof state.sequences !== "object" || !Array.isArray(spool))
  throw new Error("The simulator state files are invalid.");

function simulatedReading(node, index, sampledAt) {
  const sequence = Number(state.sequences[node.id] ?? -1) + 1;
  state.sequences[node.id] = sequence;
  const minute = Math.floor(sampledAt / 60_000);
  const wave = Math.sin((minute + index * 3) / 8);
  return {
    messageId: randomUUID(),
    nodeId: node.id,
    sequence,
    section: node.section,
    sampledAt: new Date(sampledAt).toISOString(),
    firmwareVersion: "simulator-0.7.0",
    configVersion: "simulator-reading-only-v1",
    readings: {
      temperatureC: Number((28 + index * 0.35 + wave * 0.8).toFixed(2)),
      humidityPercent: Number((66 - wave * 3 + index * 0.4).toFixed(2)),
      ammoniaPpm: Number((8 + index * 0.45 + Math.max(0, wave)).toFixed(2)),
      co2Ppm: Math.round(850 + index * 45 + Math.max(0, wave) * 120),
      litterMoisturePercent: Number((24 + index * 0.6 - wave).toFixed(2)),
    },
    quality: { calibrated: true, warmingUp: false, sensorsValid: true },
    power: { batteryPercent: null },
    radio: { rssiDbm: -72 - index * 3, snrDb: 8 - index * 0.5 },
  };
}

function enqueue() {
  const sampledAt = Date.now();
  spool.push({
    schemaVersion: 1,
    farmCode: config.farmCode,
    hubId: config.hubId,
    sentAt: new Date(sampledAt).toISOString(),
    readings: config.nodes.map((node, index) => simulatedReading(node, index, sampledAt)),
  });
  if (spool.length > 10_000)
    throw new Error("The offline telemetry queue reached 10,000 batches. Check storage and connectivity.");
  save(statePath, state);
  save(spoolPath, spool);
}

async function flush() {
  while (spool.length) {
    let response;
    try {
      response = await fetch(`${api}/v1/telemetry/ingest`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CoopGuard-Hub-Id": config.hubId,
          "X-CoopGuard-Hub-Token": config.hubSecret,
        },
        body: JSON.stringify(spool[0]),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      console.log(
        `Gateway offline; ${spool.length} batch(es) queued locally. ${error instanceof Error ? error.message : "Request failed."}`,
      );
      return;
    }
    const text = await response.text();
    if (!response.ok) {
      console.error(`Ingestion rejected the queued batch (${response.status}): ${text.slice(0, 300)}`);
      return;
    }
    spool.shift();
    save(spoolPath, spool);
    const result = JSON.parse(text);
    console.log(
      `Sent ${result.accepted} reading(s); ${result.duplicates} duplicate(s); ${result.rejected.length} rejected; ${spool.length} batch(es) queued.`,
    );
  }
}

async function cycle() {
  enqueue();
  await flush();
}

await flush();
await cycle();
if (!values.once) {
  console.log(`Gateway simulator running every ${intervalSeconds} seconds against ${api}.`);
  setInterval(() => void cycle(), intervalSeconds * 1000);
}
