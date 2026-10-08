import { createClient } from "@libsql/client/web";
import type { Client, InArgs, InStatement, ResultSet } from "@libsql/client";
import type { Database as SyncClient } from "@tursodatabase/sync";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { verifyPassword } from "./passwords";
import { seedLocalFarm } from "./shared/services/localFarmRepository";

export type SqlArgument = string | number | bigint | Uint8Array | null;
export type SqlRow = Record<string, unknown>;
export type BatchStatement = { sql: string; args?: SqlArgument[] };

export interface PreparedStatement {
  get(...args: SqlArgument[]): Promise<SqlRow | undefined>;
  all(...args: SqlArgument[]): Promise<SqlRow[]>;
  run(...args: SqlArgument[]): Promise<{ changes: number }>;
}

export interface CoopDatabase {
  prepare(sql: string): PreparedStatement;
  batch(statements: BatchStatement[]): Promise<void>;
  sync?(): Promise<void>;
  syncState?(): Promise<{
    pendingOperations: number;
    lastPullAt: number;
    lastPushAt: number | null;
  }>;
  close(): void | Promise<void>;
}

class LocalDatabase implements CoopDatabase {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
    this.database.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
  }

  prepare(sql: string): PreparedStatement {
    const statement = this.database.prepare(sql);
    return {
      get: async (...args) => statement.get(...args) as SqlRow | undefined,
      all: async (...args) => statement.all(...args) as SqlRow[],
      run: async (...args) => {
        const result = statement.run(...args);
        return { changes: Number(result.changes) };
      },
    };
  }

  async batch(statements: BatchStatement[]) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      for (const statement of statements)
        this.database.prepare(statement.sql).run(...(statement.args ?? []));
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  close() {
    this.database.close();
  }
}

class TursoDatabase implements CoopDatabase {
  constructor(private readonly client: Client) {}

  private async execute(sql: string, args: SqlArgument[]): Promise<ResultSet> {
    return this.client.execute({ sql, args: args as InArgs });
  }

  prepare(sql: string): PreparedStatement {
    return {
      get: async (...args) =>
        (await this.execute(sql, args)).rows[0] as SqlRow | undefined,
      all: async (...args) =>
        (await this.execute(sql, args)).rows as unknown as SqlRow[],
      run: async (...args) => {
        const result = await this.execute(sql, args);
        return { changes: result.rowsAffected };
      },
    };
  }

  async batch(statements: BatchStatement[]) {
    await this.client.batch(
      statements.map(
        ({ sql, args = [] }): InStatement => ({
          sql,
          args: args as InArgs,
        }),
      ),
      "write",
    );
  }

  close() {
    this.client.close();
  }
}

class HubSyncDatabase implements CoopDatabase {
  private syncing: Promise<void> | null = null;

  constructor(private readonly client: SyncClient) {}

  prepare(sql: string): PreparedStatement {
    return {
      get: async (...args) =>
        (await this.client.get(sql, ...args)) as SqlRow | undefined,
      all: async (...args) => (await this.client.all(sql, ...args)) as SqlRow[],
      run: async (...args) => {
        const result = await this.client.run(sql, ...args);
        return { changes: result.changes };
      },
    };
  }

  async batch(statements: BatchStatement[]) {
    await this.client.batch(
      statements.map(({ sql, args = [] }) => ({ sql, args })),
      "immediate",
    );
  }

  async sync() {
    if (this.syncing) return this.syncing;
    this.syncing = (async () => {
      await this.client.push();
      await this.client.pull();
    })();
    try {
      await this.syncing;
    } finally {
      this.syncing = null;
    }
  }

  async syncState() {
    const state = await this.client.stats();
    return {
      pendingOperations: state.cdcOperations,
      lastPullAt: state.lastPullUnixTime * 1000,
      lastPushAt:
        state.lastPushUnixTime === null ? null : state.lastPushUnixTime * 1000,
    };
  }

  async close() {
    await this.client.close();
  }
}

const schema = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner','worker','technician','admin')),
    password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
    must_change INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS farms (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, customer_name TEXT,
    contact_name TEXT, contact_phone TEXT, address TEXT,
    state TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS farm_codes (
    farm_id TEXT PRIMARY KEY REFERENCES farms(id), code TEXT NOT NULL UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS memberships (
    user_id TEXT NOT NULL REFERENCES users(id), farm_id TEXT NOT NULL REFERENCES farms(id),
    PRIMARY KEY(user_id,farm_id)
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    digest TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)",
  `CREATE TABLE IF NOT EXISTS mutations (
    farm_id TEXT NOT NULL, user_id TEXT NOT NULL, key TEXT NOT NULL, body_hash TEXT NOT NULL,
    PRIMARY KEY(farm_id,user_id,key)
  )`,
  `CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, farm_id TEXT,
    event TEXT NOT NULL, target_id TEXT, at INTEGER NOT NULL
  )`,
  "CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until_at INTEGER NOT NULL)",
  `CREATE TABLE IF NOT EXISTS telemetry_hubs (
    id TEXT PRIMARY KEY, farm_id TEXT NOT NULL REFERENCES farms(id),
    secret_digest TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'hardware' CHECK(source IN ('simulated','hardware')),
    created_at INTEGER NOT NULL, last_seen_at INTEGER
  )`,
  "CREATE INDEX IF NOT EXISTS telemetry_hubs_farm_lookup ON telemetry_hubs(farm_id)",
  `CREATE TABLE IF NOT EXISTS telemetry_nodes (
    id TEXT PRIMARY KEY, farm_id TEXT NOT NULL REFERENCES farms(id),
    hub_id TEXT NOT NULL REFERENCES telemetry_hubs(id), number TEXT NOT NULL,
    section TEXT NOT NULL,
    x REAL NOT NULL, y REAL NOT NULL, control INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'hardware' CHECK(source IN ('simulated','hardware')),
    active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS telemetry_nodes_farm ON telemetry_nodes(farm_id)",
  `CREATE TABLE IF NOT EXISTS sensor_readings (
    id TEXT PRIMARY KEY, message_id TEXT NOT NULL,
    farm_id TEXT NOT NULL REFERENCES farms(id),
    hub_id TEXT NOT NULL REFERENCES telemetry_hubs(id),
    node_id TEXT NOT NULL REFERENCES telemetry_nodes(id),
    sequence INTEGER NOT NULL, sampled_at INTEGER NOT NULL, received_at INTEGER NOT NULL,
    temperature_c REAL NOT NULL, humidity_percent REAL NOT NULL,
    ammonia_ppm REAL NOT NULL, co2_ppm REAL NOT NULL,
    litter_moisture_percent REAL NOT NULL,
    calibrated INTEGER NOT NULL, warming_up INTEGER NOT NULL,
    sensors_valid INTEGER NOT NULL, battery_percent REAL,
    rssi_dbm REAL NOT NULL, snr_db REAL NOT NULL,
    source TEXT NOT NULL DEFAULT 'hardware' CHECK(source IN ('simulated','hardware')),
    firmware_version TEXT, config_version TEXT,
    UNIQUE(hub_id,message_id), UNIQUE(node_id,sequence)
  )`,
  "CREATE INDEX IF NOT EXISTS sensor_readings_farm_time ON sensor_readings(farm_id,sampled_at DESC)",
  "CREATE INDEX IF NOT EXISTS sensor_readings_node_time ON sensor_readings(node_id,sampled_at DESC)",
  `CREATE TABLE IF NOT EXISTS hub_pairings (
    id TEXT PRIMARY KEY, hub_id TEXT NOT NULL UNIQUE,
    token_digest TEXT NOT NULL, secret_digest TEXT NOT NULL,
    wifi_url TEXT NOT NULL, usb_url TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending','claimed','replacement_pending','expired','cancelled')),
    farm_id TEXT REFERENCES farms(id), requested_by TEXT REFERENCES users(id),
    expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, claimed_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS hub_replacement_requests (
    id TEXT PRIMARY KEY, pairing_id TEXT NOT NULL UNIQUE REFERENCES hub_pairings(id),
    farm_id TEXT NOT NULL REFERENCES farms(id), old_hub_id TEXT NOT NULL REFERENCES telemetry_hubs(id),
    requested_by TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
    reviewed_by TEXT REFERENCES users(id), created_at INTEGER NOT NULL, reviewed_at INTEGER
  )`,
  "CREATE INDEX IF NOT EXISTS hub_replacements_status ON hub_replacement_requests(status,created_at)",
];

async function migrateTelemetryHubIndex(db: CoopDatabase) {
  await db.prepare("DROP INDEX IF EXISTS telemetry_hubs_farm").run();
  await db
    .prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS telemetry_hubs_one_active_farm ON telemetry_hubs(farm_id) WHERE active=1",
    )
    .run();
}

async function migrateTelemetryNodeSections(db: CoopDatabase) {
  const table = (await db
    .prepare(
      "SELECT sql FROM sqlite_schema WHERE type='table' AND name='telemetry_nodes'",
    )
    .get()) as { sql?: string } | undefined;
  if (!table?.sql?.includes("section IN ('A','B','C')")) return;
  await db.prepare("PRAGMA foreign_keys=OFF").run();
  try {
    await db.batch([
      { sql: "DROP TABLE IF EXISTS telemetry_nodes_v2" },
      {
        sql: "CREATE TABLE telemetry_nodes_v2 (id TEXT PRIMARY KEY, farm_id TEXT NOT NULL REFERENCES farms(id), hub_id TEXT NOT NULL REFERENCES telemetry_hubs(id), number TEXT NOT NULL, section TEXT NOT NULL, x REAL NOT NULL, y REAL NOT NULL, control INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'hardware' CHECK(source IN ('simulated','hardware')), active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL)",
      },
      {
        sql: "INSERT INTO telemetry_nodes_v2(id,farm_id,hub_id,number,section,x,y,control,source,active,created_at) SELECT id,farm_id,hub_id,number,section,x,y,control,'hardware',active,created_at FROM telemetry_nodes",
      },
      { sql: "DROP TABLE telemetry_nodes" },
      { sql: "ALTER TABLE telemetry_nodes_v2 RENAME TO telemetry_nodes" },
      {
        sql: "CREATE INDEX IF NOT EXISTS telemetry_nodes_farm ON telemetry_nodes(farm_id)",
      },
    ]);
  } finally {
    await db.prepare("PRAGMA foreign_keys=ON").run();
  }
}

async function migrateTelemetrySources(db: CoopDatabase) {
  for (const table of [
    "telemetry_hubs",
    "telemetry_nodes",
    "sensor_readings",
  ] as const) {
    const columns = new Set(
      (await db.prepare(`PRAGMA table_info(${table})`).all()).map((row) =>
        String(row.name),
      ),
    );
    if (!columns.has("source"))
      await db
        .prepare(
          `ALTER TABLE ${table} ADD COLUMN source TEXT NOT NULL DEFAULT 'hardware' CHECK(source IN ('simulated','hardware'))`,
        )
        .run();
  }
  // Existing simulator records pre-date explicit provenance. These stable
  // firmware/device identifiers let the migration label them without changing
  // physical gateway data.
  await db
    .prepare(
      "UPDATE sensor_readings SET source='simulated' WHERE firmware_version LIKE 'simulator-%'",
    )
    .run();
  await db
    .prepare(
      "UPDATE telemetry_nodes SET source='simulated' WHERE id IN (SELECT DISTINCT node_id FROM sensor_readings WHERE source='simulated')",
    )
    .run();
  await db
    .prepare(
      "UPDATE telemetry_hubs SET source='simulated' WHERE id IN (SELECT DISTINCT hub_id FROM sensor_readings WHERE source='simulated') OR id IN (SELECT hub_id FROM hub_pairings)",
    )
    .run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS sensor_readings_farm_source_time ON sensor_readings(farm_id,source,sampled_at DESC)",
    )
    .run();
}

async function migrateLegacyUsersTable(db: CoopDatabase) {
  const legacy = (await db
    .prepare(
      "SELECT sql FROM sqlite_schema WHERE type='table' AND name='users'",
    )
    .get()) as { sql?: string } | undefined;
  if (!legacy?.sql) return;
  const definition = legacy.sql;
  if (definition.includes("'admin'") || !definition.includes("'technician'"))
    return;
  await db.prepare("PRAGMA foreign_keys=OFF").run();
  try {
    await db.batch([
      { sql: "DROP TABLE IF EXISTS users_v2" },
      {
        sql: "CREATE TABLE users_v2 (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','worker','technician','admin')), password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, must_change INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL)",
      },
      {
        sql: "INSERT INTO users_v2(id,username,name,role,password_hash,active,must_change,created_at) SELECT id,username,name,role,password_hash,active,must_change,created_at FROM users",
      },
      { sql: "DROP TABLE users" },
      { sql: "ALTER TABLE users_v2 RENAME TO users" },
    ]);
  } finally {
    await db.prepare("PRAGMA foreign_keys=ON").run();
  }
}

async function disableLegacyDefaultAdmin(db: CoopDatabase) {
  const user = await db
    .prepare(
      "SELECT id,password_hash FROM users WHERE username=? AND role='admin'",
    )
    .get("team.admin");
  if (
    !user ||
    !(await verifyPassword("password.admin123", String(user.password_hash)))
  )
    return;
  await db.batch([
    {
      sql: "UPDATE users SET active=0,must_change=1 WHERE id=?",
      args: [user.id as string],
    },
    { sql: "DELETE FROM sessions WHERE user_id=?", args: [user.id as string] },
  ]);
}

export async function openDatabase(
  path: string,
  turso?: { url: string; authToken: string },
  mode: "cloud" | "hub" | "standalone" = turso ? "cloud" : "standalone",
): Promise<CoopDatabase> {
  let database: CoopDatabase;
  if (mode === "hub" && turso) {
    const commissioned = existsSync(path);
    mkdirSync(dirname(path), { recursive: true });
    const { connect } = await import("@tursodatabase/sync");
    let client: SyncClient;
    try {
      client = await connect({
        path,
        url: turso.url,
        authToken: turso.authToken,
        clientName: process.env.CG_HUB_ID ?? "coopguard-hub",
      });
    } catch (error) {
      if (!commissioned)
        throw new Error(
          `A new hub needs internet for its first cloud bootstrap: ${error instanceof Error ? error.message : "connection failed"}`,
        );
      throw error;
    }
    database = new HubSyncDatabase(client);
    try {
      await client.pull();
    } catch (error) {
      if (!commissioned) {
        await client.close();
        throw new Error(
          `A new hub needs internet for its first cloud bootstrap: ${error instanceof Error ? error.message : "sync failed"}`,
        );
      }
      console.warn(
        "Cloud unavailable during hub startup; using the commissioned local database.",
      );
    }
  } else if (turso) {
    database = new TursoDatabase(
      createClient({
        url: turso.url,
        authToken: turso.authToken,
        intMode: "number",
      }),
    );
  } else database = new LocalDatabase(path);
  await database.batch(schema.map((sql) => ({ sql })));
  await migrateTelemetryHubIndex(database);
  await migrateTelemetryNodeSections(database);
  await migrateTelemetrySources(database);
  await migrateLegacyUsersTable(database);
  await disableLegacyDefaultAdmin(database);
  const farmColumns = new Set(
    (await database.prepare("PRAGMA table_info(farms)").all()).map((row) =>
      String(row.name),
    ),
  );
  const columnsToAdd = [
    ["customer_name", "TEXT"],
    ["contact_name", "TEXT"],
    ["contact_phone", "TEXT"],
    ["address", "TEXT"],
    ["created_at", "INTEGER NOT NULL DEFAULT 0"],
  ] as const;
  for (const [column, definition] of columnsToAdd) {
    if (!farmColumns.has(column))
      await database
        .prepare(`ALTER TABLE farms ADD COLUMN ${column} ${definition}`)
        .run();
  }
  const farms = await database.prepare("SELECT id FROM farms").all();
  if (farms.length)
    await database.batch(
      farms.map((farm) => ({
        sql: "INSERT OR IGNORE INTO farm_codes(farm_id,code) VALUES(?,?)",
        args: [farm.id as string, farmCode(farm.id as string)],
      })),
    );
  return database;
}

export function farmCode(id: string) {
  return `CG-PH-${id
    .replace(/[^a-f0-9]/gi, "")
    .slice(0, 8)
    .toUpperCase()}`;
}

export async function createFarm(
  db: CoopDatabase,
  name: string,
  now = Date.now(),
  details: {
    customerName?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    address?: string | null;
  } = {},
) {
  const id = randomUUID();
  await db
    .prepare(
      "INSERT INTO farms(id,name,customer_name,contact_name,contact_phone,address,state,revision,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
    )
    .run(
      id,
      name,
      details.customerName ?? null,
      details.contactName ?? null,
      details.contactPhone ?? null,
      details.address ?? null,
      JSON.stringify(seedLocalFarm(now)),
      0,
      now,
    );
  await db
    .prepare("INSERT INTO farm_codes(farm_id,code) VALUES(?,?)")
    .run(id, farmCode(id));
  return id;
}
