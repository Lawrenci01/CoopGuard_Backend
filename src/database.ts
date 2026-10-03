import { createClient } from "@libsql/client/web";
import type { Client, InArgs, InStatement, ResultSet } from "@libsql/client";
import type { Database as SyncClient } from "@tursodatabase/sync";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
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
        ({ sql, args = [] }): InStatement => ({ sql, args: args as InArgs }),
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
      get: async (...args) => (await this.client.get(sql, ...args)) as SqlRow | undefined,
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
];

export async function openDatabase(
  path: string,
  turso?: { url: string; authToken: string },
  mode: "cloud" | "hub" | "standalone" = turso ? "cloud" : "standalone",
): Promise<CoopDatabase> {
  let database: CoopDatabase;
  if (mode === "hub") {
    if (!turso)
      throw new Error(
        "Hub mode requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for cloud synchronization.",
      );
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
  const farmColumns = new Set(
    (await database.prepare("PRAGMA table_info(farms)").all()).map((row) => String(row.name)),
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
      await database.prepare(`ALTER TABLE farms ADD COLUMN ${column} ${definition}`).run();
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
  return `CG-PH-${id.replace(/[^a-f0-9]/gi, "").slice(0, 8).toUpperCase()}`;
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
