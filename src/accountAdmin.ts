import { randomUUID } from "node:crypto";
import type { CoopDatabase } from "./database";
import { hashPassword, temporaryPassword } from "./passwords";

export interface NewCredential {
  role: "owner" | "technician";
  username: string;
  password: string;
}

export async function reprovisionFarmAccounts(
  db: CoopDatabase,
  farmName: string,
  ownerUsername: string,
  technicianUsername: string,
  now = Date.now(),
): Promise<{ farmId: string; credentials: NewCredential[] }> {
  const farms = await db.prepare("SELECT id FROM farms WHERE name=?").all(farmName);
  if (farms.length !== 1)
    throw new Error(
      farms.length ? "More than one farm has that name. Use a unique farm name first." : "Farm not found.",
    );
  const farmId = farms[0]!.id as string;
  const members = await db
    .prepare("SELECT user_id FROM memberships WHERE farm_id=?")
    .all(farmId);
  const oldUserIds = members.map((row) => row.user_id as string);
  for (const username of [ownerUsername, technicianUsername]) {
    const existing = await db.prepare("SELECT id FROM users WHERE username=?").get(username);
    if (!existing) continue;
    const id = existing.id as string;
    const membershipCount = await db
      .prepare("SELECT COUNT(*) n FROM memberships WHERE user_id=?")
      .get(id);
    if (!oldUserIds.includes(id) || Number(membershipCount?.n) !== 1)
      throw new Error(
        `The username ${username} belongs to an account outside this farm. Choose a new username.`,
      );
  }
  const credentials: NewCredential[] = [];
  const inserts = [];
  for (const [username, role, displayName] of [
    [ownerUsername, "owner", "Farm owner"],
    [technicianUsername, "technician", "CoopGuard technician"],
  ] as const) {
    const password = temporaryPassword();
    const id = randomUUID();
    credentials.push({ role, username, password });
    inserts.push(
      {
        sql: "INSERT INTO users(id,username,name,role,password_hash,created_at) VALUES(?,?,?,?,?,?)",
        args: [id, username, displayName, role, await hashPassword(password), now],
      },
      {
        sql: "INSERT INTO memberships(user_id,farm_id) VALUES(?,?)",
        args: [id, farmId],
      },
    );
  }
  const userPlaceholders = oldUserIds.map(() => "?").join(",");
  await db.batch([
    ...(oldUserIds.length
      ? [
          { sql: `DELETE FROM sessions WHERE user_id IN (${userPlaceholders})`, args: oldUserIds },
          {
            sql: `DELETE FROM mutations WHERE farm_id=? AND user_id IN (${userPlaceholders})`,
            args: [farmId, ...oldUserIds],
          },
        ]
      : []),
    { sql: "DELETE FROM audit WHERE farm_id=?", args: [farmId] },
    { sql: "DELETE FROM memberships WHERE farm_id=?", args: [farmId] },
    ...(oldUserIds.length
      ? [
          {
            sql: `DELETE FROM users WHERE id IN (${userPlaceholders}) AND NOT EXISTS (SELECT 1 FROM memberships WHERE memberships.user_id=users.id)`,
            args: oldUserIds,
          },
        ]
      : []),
    { sql: "DELETE FROM login_attempts" },
    ...inserts,
  ]);
  return { farmId, credentials };
}
