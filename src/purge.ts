import { parseArgs } from "node:util";
import { databasePath, turso } from "./config";
import { openDatabase } from "./database";
import { purgeFarmData } from "./accountAdmin";

const { values } = parseArgs({
  options: {
    confirm: { type: "string" },
    "preserve-technician": { type: "string", default: "cg.technician" },
    "require-cloud": { type: "boolean" },
  },
});

if (values.confirm !== "DELETE_ALL_FARMS")
  throw new Error("Pass --confirm DELETE_ALL_FARMS to run this destructive reset.");
if (values["require-cloud"] && !turso)
  throw new Error(
    "Cloud reset requires both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN. No local database changes were made.",
  );

const db = await openDatabase(databasePath, turso);
try {
  const result = await purgeFarmData(db, values["preserve-technician"]);
  console.log(
    `Reset complete. Deleted ${result.deletedFarms} farm(s) and ${result.deletedUsers} account(s).`,
  );
  console.log(`Preserved accounts: ${result.preservedUsers.join(", ")}`);
  console.log("All sessions were revoked. Preserved accounts must sign in again.");
} finally {
  await db.close();
}
