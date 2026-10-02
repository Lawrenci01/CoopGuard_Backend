import { fileURLToPath } from "node:url";
import { join } from "node:path";
export const projectDir = fileURLToPath(new URL("..", import.meta.url));
export const localDir = join(projectDir, ".local");
export const databasePath =
  process.env.CG_DB_PATH ?? join(localDir, "coopguard.sqlite");
export const turso =
  process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN
    ? {
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }
    : undefined;
export const deploymentMode =
  process.env.CG_MODE === "hub"
    ? "hub"
    : process.env.RENDER === "true" || process.env.CG_MODE === "cloud"
      ? "cloud"
      : "standalone";
