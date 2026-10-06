import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { databasePath, localDir, turso } from "./config";
import { openDatabase } from "./database";
import { provisionTelemetryGateway } from "./telemetry";

const { values } = parseArgs({
  options: {
    "farm-code": { type: "string" },
    output: { type: "string" },
    "require-cloud": { type: "boolean" },
  },
});

if (!values["farm-code"])
  throw new Error("Use --farm-code with the Farm ID shown in the technician workspace.");
if (values["require-cloud"] && !turso)
  throw new Error(
    "Cloud provisioning requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN. No local database changes were made.",
  );

const output = resolve(
  values.output ?? join(localDir, `telemetry-gateway-${Date.now()}.json`),
);
if (existsSync(output))
  throw new Error("Choose a new output file; an existing gateway secret will not be overwritten.");

const db = await openDatabase(databasePath, turso);
try {
  const credentials = await provisionTelemetryGateway(
    db,
    values["farm-code"].trim().toUpperCase(),
  );
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(
    output,
    `${JSON.stringify({ schemaVersion: 1, ...credentials }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600, flag: "wx" },
  );
  console.log(`Gateway provisioned. Private configuration file: ${output}`);
} finally {
  await db.close();
}
