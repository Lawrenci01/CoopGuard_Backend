import { fileURLToPath } from "node:url";
import { join } from "node:path";
export const projectDir = fileURLToPath(new URL("..", import.meta.url));
export const localDir = join(projectDir, ".local");
export const databasePath =
  process.env.CG_DB_PATH ?? join(localDir, "coopguard.sqlite");
