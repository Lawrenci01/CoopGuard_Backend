import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { seedLocalFarm } from "./shared/services/localFarmRepository";

export function openDatabase(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner','worker','technician')),
      password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
      must_change INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS farms (id TEXT PRIMARY KEY, name TEXT NOT NULL,
      state TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS memberships (
      user_id TEXT NOT NULL REFERENCES users(id), farm_id TEXT NOT NULL REFERENCES farms(id),
      PRIMARY KEY(user_id,farm_id)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      digest TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS mutations (
      farm_id TEXT NOT NULL, user_id TEXT NOT NULL, key TEXT NOT NULL, body_hash TEXT NOT NULL,
      PRIMARY KEY(farm_id,user_id,key)
    );
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, farm_id TEXT,
      event TEXT NOT NULL, target_id TEXT, at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until_at INTEGER NOT NULL);
  `);
  return db;
}
export function createFarm(db: DatabaseSync, name: string, now = Date.now()) {
  const id = randomUUID();
  const state = seedLocalFarm(now);
  state.started = true;
  state.flock = null;
  db.prepare("INSERT INTO farms(id,name,state) VALUES(?,?,?)").run(
    id,
    name,
    JSON.stringify(state),
  );
  return id;
}
