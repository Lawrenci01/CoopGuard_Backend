import { randomUUID } from "node:crypto";
import { createFarm, type CoopDatabase } from "./database";
import { hashPassword, temporaryPassword } from "./passwords";

export interface NewCredential {
  role: "owner" | "technician";
  username: string;
  password: string;
}

export async function purgeFarmData(
  db: CoopDatabase,
  technicianUsername = "cg.technician",
) {
  const technician = await db
    .prepare("SELECT id,username,role FROM users WHERE username=?")
    .get(technicianUsername);
  if (!technician || technician.role !== "technician")
    throw new Error(
      `Required technician account ${technicianUsername} was not found. Nothing was deleted.`,
    );
  const admins = await db
    .prepare("SELECT id,username FROM users WHERE role='admin' ORDER BY username")
    .all();
  if (!admins.length)
    throw new Error("No administrator account was found. Nothing was deleted.");
  const before = {
    farms: Number((await db.prepare("SELECT COUNT(*) count FROM farms").get())?.count ?? 0),
    users: Number((await db.prepare("SELECT COUNT(*) count FROM users").get())?.count ?? 0),
  };
  await db.batch([
    { sql: "DELETE FROM sessions" },
    { sql: "DELETE FROM login_attempts" },
    { sql: "DELETE FROM audit" },
    { sql: "DELETE FROM mutations" },
    { sql: "DELETE FROM sensor_readings" },
    { sql: "DELETE FROM telemetry_nodes" },
    { sql: "DELETE FROM telemetry_hubs" },
    { sql: "DELETE FROM memberships" },
    { sql: "DELETE FROM farm_codes" },
    { sql: "DELETE FROM farms" },
    {
      sql: "DELETE FROM users WHERE role!='admin' AND NOT (role='technician' AND username=?)",
      args: [technicianUsername],
    },
  ]);
  return {
    deletedFarms: before.farms,
    deletedUsers: before.users - admins.length - 1,
    preservedUsers: [technicianUsername, ...admins.map((row) => String(row.username))],
  };
}

export async function reprovisionFarmAccounts(
  db: CoopDatabase,
  farmName: string,
  ownerUsername: string,
  technicianUsername: string,
  now = Date.now(),
  createIfMissing = false,
): Promise<{
  farmId: string;
  farmCreated: boolean;
  credentials: NewCredential[];
}> {
  const allFarms = await db
    .prepare("SELECT id,name FROM farms ORDER BY name")
    .all();
  const farms = allFarms.filter(
    (farm) =>
      String(farm.name).toLocaleLowerCase() === farmName.toLocaleLowerCase(),
  );
  let farmCreated = false;
  let farmId: string;
  if (farms.length === 1) farmId = farms[0]!.id as string;
  else if (farms.length === 0 && allFarms.length === 0 && createIfMissing) {
    if (
      await db
        .prepare("SELECT 1 FROM users WHERE username=?")
        .get(ownerUsername)
    )
      throw new Error(
        `The empty database contains an orphaned ${ownerUsername} account. Choose a new username or repair it first.`,
      );
    farmId = await createFarm(db, farmName, now);
    farmCreated = true;
  } else {
    const available = allFarms.map((farm) => String(farm.name)).join(", ");
    throw new Error(
      farms.length
        ? "More than one farm has that name. Use a unique farm name first."
        : available
          ? `Farm not found. Available farm names: ${available}`
          : "Farm not found. This Turso database does not contain a farm yet.",
    );
  }
  const members = await db
    .prepare("SELECT user_id FROM memberships WHERE farm_id=?")
    .all(farmId);
  const oldUserIds = members.map((row) => row.user_id as string);
  if (ownerUsername === technicianUsername)
    throw new Error("Owner and technician must use separate accounts.");
  const existingOwner = await db
    .prepare("SELECT id FROM users WHERE username=?")
    .get(ownerUsername);
  if (existingOwner) {
    const membershipCount = await db
      .prepare("SELECT COUNT(*) n FROM memberships WHERE user_id=?")
      .get(existingOwner.id as string);
    if (
      !oldUserIds.includes(existingOwner.id as string) ||
      Number(membershipCount?.n) !== 1
    )
      throw new Error(
        `The username ${ownerUsername} belongs to an account outside this farm. Choose a new username.`,
      );
  }
  const technicians = (await db
    .prepare(
      "SELECT id,username FROM users WHERE role='technician' AND active=1 ORDER BY created_at",
    )
    .all()) as { id: string; username: string }[];
  if (technicians.length > 1)
    throw new Error(
      "Multiple active technician accounts exist. Consolidate them before reprovisioning.",
    );
  const sharedTechnician = technicians[0];
  if (sharedTechnician && sharedTechnician.username !== technicianUsername)
    throw new Error(
      `Use the shared technician account ${sharedTechnician.username}.`,
    );
  if (
    !sharedTechnician &&
    (await db
      .prepare("SELECT 1 FROM users WHERE username=?")
      .get(technicianUsername))
  )
    throw new Error(
      "The technician username belongs to an inactive or non-technician account.",
    );
  const credentials: NewCredential[] = [];
  const ownerPassword = temporaryPassword();
  const ownerId = randomUUID();
  credentials.push({
    role: "owner",
    username: ownerUsername,
    password: ownerPassword,
  });
  const inserts = [
    {
      sql: "INSERT INTO users(id,username,name,role,password_hash,created_at) VALUES(?,?,?,'owner',?,?)",
      args: [
        ownerId,
        ownerUsername,
        "Farm owner",
        await hashPassword(ownerPassword),
        now,
      ],
    },
    {
      sql: "INSERT INTO memberships(user_id,farm_id) VALUES(?,?)",
      args: [ownerId, farmId],
    },
  ];
  if (!sharedTechnician) {
    const password = temporaryPassword();
    const id = randomUUID();
    credentials.push({
      role: "technician",
      username: technicianUsername,
      password,
    });
    inserts.push({
      sql: "INSERT INTO users(id,username,name,role,password_hash,created_at) VALUES(?,?,?,'technician',?,?)",
      args: [
        id,
        technicianUsername,
        "CoopGuard technician",
        await hashPassword(password),
        now,
      ],
    });
  }
  const replaceUserIds = oldUserIds.filter((id) => id !== sharedTechnician?.id);
  const userPlaceholders = oldUserIds.map(() => "?").join(",");
  const replaceUserPlaceholders = replaceUserIds.map(() => "?").join(",");
  await db.batch([
    ...(replaceUserIds.length
      ? [
          {
            sql: `DELETE FROM sessions WHERE user_id IN (${replaceUserPlaceholders})`,
            args: replaceUserIds,
          },
          {
            sql: `DELETE FROM mutations WHERE farm_id=? AND user_id IN (${userPlaceholders})`,
            args: [farmId, ...oldUserIds],
          },
        ]
      : []),
    { sql: "DELETE FROM audit WHERE farm_id=?", args: [farmId] },
    { sql: "DELETE FROM memberships WHERE farm_id=?", args: [farmId] },
    ...(replaceUserIds.length
      ? [
          {
            sql: `DELETE FROM users WHERE id IN (${replaceUserPlaceholders}) AND NOT EXISTS (SELECT 1 FROM memberships WHERE memberships.user_id=users.id)`,
            args: replaceUserIds,
          },
        ]
      : []),
    { sql: "DELETE FROM login_attempts" },
    ...inserts,
  ]);
  return { farmId, farmCreated, credentials };
}
