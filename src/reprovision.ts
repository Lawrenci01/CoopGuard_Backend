import { parseArgs } from "node:util";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { reprovisionFarmAccounts } from "./accountAdmin";
import { openDatabase } from "./database";
import { databasePath, localDir, turso } from "./config";
import { username as usernameSchema } from "./schemas";

const { values } = parseArgs({
  options: {
    farm: { type: "string" },
    owner: { type: "string" },
    technician: { type: "string" },
    confirm: { type: "string" },
    output: { type: "string" },
  },
});
if (!turso)
  throw new Error(
    "Remote database credentials are missing. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in this PowerShell window.",
  );
const farmName = values.farm?.trim();
if (!farmName || !values.owner || !values.technician)
  throw new Error(
    'Use --farm "EXACT FARM NAME" --owner NEW_USERNAME --technician NEW_USERNAME --confirm "EXACT FARM NAME".',
  );
if (values.confirm !== farmName)
  throw new Error("Confirmation must exactly match the farm name. No accounts were changed.");
const owner = usernameSchema.parse(values.owner);
const technician = usernameSchema.parse(values.technician);
if (owner === technician) throw new Error("Owner and technician must use different usernames.");
const output = resolve(values.output ?? join(localDir, `accounts-${Date.now()}.txt`));
if (existsSync(output))
  throw new Error("Choose a new output file; existing credentials will not be overwritten.");
mkdirSync(dirname(output), { recursive: true });

const db = await openDatabase(databasePath, turso, "cloud");
try {
  const result = await reprovisionFarmAccounts(db, farmName, owner, technician);
  const body = result.credentials
    .map(
      (entry) =>
        `Role: ${entry.role}\nUsername: ${entry.username}\nTemporary password: ${entry.password}`,
    )
    .join("\n\n");
  writeFileSync(
    output,
    `CoopGuard replacement credentials - keep private\n\nFarm: ${farmName}\nFarm ID: ${result.farmId}\n\n${body}\n\nChange each temporary password at first sign-in. Old farm memberships and sessions were removed. Farm setup and records were preserved.\n`,
    { encoding: "utf8", mode: 0o600, flag: "wx" },
  );
  console.log(`Farm accounts replaced. Private credentials file: ${output}`);
} finally {
  await db.close();
}
