import { createClient } from "@libsql/client/web";
import type { Client, InArgs, InStatement, ResultSet } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
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
  close(): void;
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

const schema = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner','worker','technician')),
    password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
    must_change INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS farms (id TEXT PRIMARY KEY, name TEXT NOT NULL,
    state TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0)`,
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
): Promise<CoopDatabase> {
  const database: CoopDatabase = turso
    ? new TursoDatabase(
        createClient({
          url: turso.url,
          authToken: turso.authToken,
          intMode: "number",
        }),
      )
    : new LocalDatabase(path);
  await database.batch(schema.map((sql) => ({ sql })));
  return database;
}

export async function createFarm(
  db: CoopDatabase,
  name: string,
  now = Date.now(),
) {
  const id = randomUUID();
  await db
    .prepare("INSERT INTO farms(id,name,state) VALUES(?,?,?)")
    .run(id, name, JSON.stringify(seedLocalFarm(now)));
  return id;
}
