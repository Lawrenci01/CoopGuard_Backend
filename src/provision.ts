import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { createFarm, openDatabase } from "./database";
import { hashPassword, temporaryPassword } from "./passwords";
import { username as usernameSchema } from "./schemas";
import { databasePath, localDir, turso } from "./config";

// Deliberately a server-side operator command: never exposed as a public signup route.
const { values } = parseArgs({
  options: {
    farm: { type: "string" },
    owner: { type: "string" },
    technician: { type: "string" },
    output: { type: "string" },
    "reset-user": { type: "string" },
  },
});
const output = resolve(
  values.output ?? join(localDir, `accounts-${Date.now()}.txt`),
);
if (existsSync(output))
  throw new Error(
    "Choose a new output file; existing credentials will not be overwritten.",
  );
mkdirSync(dirname(output), { recursive: true });
const db = await openDatabase(databasePath, turso);
const credentials: string[] = [];
if (values["reset-user"]) {
  const username = usernameSchema.parse(values["reset-user"]);
  const user = await db
    .prepare("SELECT id FROM users WHERE username=?")
    .get(username);
  if (!user) throw new Error("Account not found.");
  const password = temporaryPassword(),
    hash = await hashPassword(password);
  await db.batch([
    {
      sql: "UPDATE users SET password_hash=?,must_change=1 WHERE id=?",
      args: [hash, user.id as string],
    },
    {
      sql: "DELETE FROM sessions WHERE user_id=?",
      args: [user.id as string],
    },
  ]);
  credentials.push(`Username: ${username}\nTemporary password: ${password}`);
} else {
  if (
    !values.farm?.trim() ||
    values.farm.length > 80 ||
    !values.owner ||
    !values.technician
  )
    throw new Error("Use --farm NAME --owner USERNAME --technician USERNAME.");
  const owner = usernameSchema.parse(values.owner),
    technician = usernameSchema.parse(values.technician);
  if (owner === technician)
    throw new Error("Owner and technician must have separate accounts.");
  for (const username of [owner, technician])
    if (await db.prepare("SELECT 1 FROM users WHERE username=?").get(username))
      throw new Error("Username already exists. Choose a unique account name.");
  const entries = [];
  for (const [username, role] of [
    [owner, "owner"],
    [technician, "technician"],
  ] as const) {
    const password = temporaryPassword();
    entries.push({
      id: randomUUID(),
      username,
      role,
      password,
      hash: await hashPassword(password),
    });
  }
  const farmId = await createFarm(db, values.farm.trim());
  credentials.push(`Farm: ${values.farm.trim()}\nFarm ID: ${farmId}`);
  await db.batch(
    entries.flatMap((entry) => [
      {
        sql: "INSERT INTO users(id,username,name,role,password_hash,created_at) VALUES(?,?,?,?,?,?)",
        args: [
          entry.id,
          entry.username,
          entry.role === "owner" ? "Farm owner" : "CoopGuard technician",
          entry.role,
          entry.hash,
          Date.now(),
        ],
      },
      {
        sql: "INSERT INTO memberships(user_id,farm_id) VALUES(?,?)",
        args: [entry.id, farmId],
      },
    ]),
  );
  for (const entry of entries) {
    credentials.push(
      `Role: ${entry.role}\nUsername: ${entry.username}\nTemporary password: ${entry.password}`,
    );
  }
}
writeFileSync(
  output,
  `CoopGuard initial credentials — keep private\n\n${credentials.join("\n\n")}\n\nChange each temporary password at first sign-in. These passwords are not embedded in the app.\n`,
  { encoding: "utf8", mode: 0o600, flag: "wx" },
);
db.close();
console.log(`Accounts provisioned. Private credentials file: ${output}`);
