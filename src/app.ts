import Fastify, { type FastifyRequest } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { ServerOptions } from "node:https";
import { z } from "zod";
import { hashPassword, verifyPassword, temporaryPassword } from "./passwords";
import { mutationSchema, username, password, name } from "./schemas";
import {
  LocalFarmRepository,
  validLocalFarm,
  seedLocalFarm,
  type LocalAction,
  type LocalFarmState,
} from "./shared/services/localFarmRepository";
import { surveyRecommendation } from "./shared/domain/setup";
import type { Role } from "./shared/domain/types";
import type { FarmResponse, Identity, Session } from "./apiTypes";
import { createFarm, type BatchStatement, type CoopDatabase } from "./database";

type User = {
  id: string;
  username: string;
  name: string;
  role: Role;
  password_hash: string;
  active: number;
  must_change: number;
};
const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex");
export function connectionForHeaders(
  headers: Record<string, unknown>,
): "local" | "cloud" {
  if (typeof headers["cf-connecting-ip"] === "string") return "cloud";
  const host = typeof headers.host === "string" ? headers.host : "";
  let hostname = "";
  try {
    hostname = new URL(`https://${host}`).hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, "");
  } catch {
    return "cloud";
  }
  if (
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname)
  )
    return "local";
  const match = hostname.match(/^172\.(\d{1,3})\./);
  return match && Number(match[1]) >= 16 && Number(match[1]) <= 31
    ? "local"
    : "cloud";
}
const requestConnection = (request: FastifyRequest) =>
  connectionForHeaders(request.headers);
function fail(statusCode: number, message: string): never {
  throw Object.assign(new Error(message), { statusCode });
}
const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success)
    fail(400, result.error.issues[0]?.message ?? "Invalid request.");
  return result.data;
};

export async function createApp(
  db: CoopDatabase,
  options: {
    clock?: () => number;
    https?: ServerOptions;
    trustProxy?: boolean;
    deploymentMode?: "cloud" | "hub" | "standalone";
    hubId?: string;
  } = {},
) {
  const now = options.clock ?? Date.now;
  const app = Fastify({
    logger: false,
    bodyLimit: 4_200_000,
    requestTimeout: 30_000,
    trustProxy: options.trustProxy ?? false,
    ...(options.https ? { https: options.https } : {}),
  });
  await app.register(rateLimit, { max: 180, timeWindow: "1 minute" });
  const dummyHash = await hashPassword(temporaryPassword());
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work);
    queue = result.catch(() => {});
    return result;
  };
  const auditStatement = (
    user: User,
    farm: string | null,
    event: string,
    target: string | null = null,
  ): BatchStatement => ({
    sql: "INSERT INTO audit(user_id,farm_id,event,target_id,at) VALUES(?,?,?,?,?)",
    args: [user.id, farm, event, target, now()],
  });
  const audit = async (
    user: User,
    farm: string | null,
    event: string,
    target: string | null = null,
  ) => db.batch([auditStatement(user, farm, event, target)]);
  async function identity(user: User): Promise<Identity> {
    return {
      account: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        mustChangePassword: !!user.must_change,
      },
      farms:
        user.role === "admin"
          ? []
          : ((await db
              .prepare(
                "SELECT f.id,f.name,c.code FROM farms f JOIN farm_codes c ON c.farm_id=f.id JOIN memberships m ON m.farm_id=f.id WHERE m.user_id=? ORDER BY f.name",
              )
              .all(user.id)) as { id: string; name: string; code: string }[]),
    };
  }
  async function issue(user: User): Promise<Session> {
    const token = randomBytes(32).toString("base64url"),
      expiresAt = now() + 7 * 86_400_000;
    await db.batch([
      { sql: "DELETE FROM sessions WHERE expires_at<=?", args: [now()] },
      {
        sql: "INSERT INTO sessions(digest,user_id,expires_at) VALUES(?,?,?)",
        args: [digest(token), user.id, expiresAt],
      },
    ]);
    return { ...(await identity(user)), token, expiresAt };
  }
  async function account(
    request: FastifyRequest,
    complete = true,
  ): Promise<User> {
    const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(
      request.headers.authorization ?? "",
    )?.[1];
    if (!token) fail(401, "Sign in to continue.");
    const user = (await db
      .prepare(
        "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.digest=? AND s.expires_at>? AND u.active=1",
      )
      .get(digest(token), now())) as User | undefined;
    if (!user) fail(401, "Your session has ended. Sign in again.");
    if (complete && user.must_change)
      fail(403, "Change your temporary password first.");
    return user;
  }
  async function access(
    request: FastifyRequest,
    roles: Role[] = ["owner", "worker", "technician"],
  ) {
    const user = await account(request);
    const farmId = (request.params as { farmId?: string }).farmId;
    if (
      !farmId ||
      !roles.includes(user.role) ||
      !(await db
        .prepare("SELECT 1 FROM memberships WHERE user_id=? AND farm_id=?")
        .get(user.id, farmId))
    )
      fail(403, "You do not have access to this action or farm.");
    return { user, farmId };
  }
  async function row(farmId: string) {
    const farm = (await db
      .prepare("SELECT state,revision FROM farms WHERE id=?")
      .get(farmId)) as { state: string; revision: number } | undefined;
    if (!farm) fail(404, "Farm not found.");
    return farm;
  }
  async function readFarm(
    farmId: string,
    user: User,
    request: FastifyRequest,
  ): Promise<FarmResponse> {
    const farm = await row(farmId);
    const repo = new LocalFarmRepository(
      {
        getItem: async () => farm.state,
        setItem: async (_key, value) => {
          farm.state = value;
        },
      },
      now,
    );
    const state = await repo.load();
    // Cache reads do not refresh sensor timestamps or replay commands.
    state.context = {
      ...state.context,
      role: user.role,
      connection: requestConnection(request),
    };
    state.started = true;
    return { state, revision: farm.revision };
  }
  const workers = async (farmId: string) =>
    (
      await db
        .prepare(
          `SELECT u.id,u.username,u.name,u.active,u.must_change FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.farm_id=? AND u.role='worker' ORDER BY u.name`,
        )
        .all(farmId)
    ).map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      active: !!u.active,
      mustChangePassword: !!u.must_change,
    }));
  async function targetWorker(farmId: string, id: string) {
    const user = (await db
      .prepare(
        `SELECT u.* FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.id=? AND m.farm_id=? AND u.role='worker'`,
      )
      .get(id, farmId)) as User | undefined;
    if (!user) fail(404, "Worker not found in this farm.");
    // Owners cannot change a credential that grants access outside their farm.
    if (
      ((
        await db
          .prepare("SELECT COUNT(*) AS n FROM memberships WHERE user_id=?")
          .get(id)
      )?.n as number) !== 1
    )
      fail(403, "Contact the CoopGuard team to manage this account.");
    return user;
  }
  app.setErrorHandler((error, _request, reply) => {
    const err = error as { statusCode?: number; message?: string };
    const status = typeof err.statusCode === "number" ? err.statusCode : 500;
    reply.code(status).send({
      error:
        status < 500
          ? err.message
          : "The server could not complete the request.",
    });
  });
  app.addHook("onSend", async (_req, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff");
  });
  app.get("/health", async () => ({
    service: "CoopGuard",
    version: "0.6.2",
    readings: "sample",
    mode: options.deploymentMode ?? "standalone",
    ...(options.deploymentMode === "hub" && options.hubId
      ? { hubId: options.hubId }
      : {}),
    ...(db.syncState ? { sync: await db.syncState() } : {}),
  }));
  app.post(
    "/v1/auth/login",
    { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } },
    async (request) => {
      const body = parse(
        z.object({ username, password: z.string().min(1).max(128) }).strict(),
        request.body,
      );
      const key = digest(body.username),
        attempt = (await db
          .prepare("SELECT count,until_at FROM login_attempts WHERE key=?")
          .get(key)) as { count: number; until_at: number } | undefined;
      if (attempt && attempt.count >= 10 && attempt.until_at > now())
        fail(429, "Too many sign-in attempts. Try again in 15 minutes.");
      await db
        .prepare("DELETE FROM login_attempts WHERE until_at<=?")
        .run(now());
      // Count before expensive work so concurrent requests cannot skip the limit.
      await db
        .prepare(
          "INSERT INTO login_attempts(key,count,until_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
        )
        .run(key, now() + 15 * 60_000);
      const user = (await db
        .prepare("SELECT * FROM users WHERE username=?")
        .get(body.username)) as User | undefined;
      const valid = await verifyPassword(
        body.password,
        user?.password_hash ?? dummyHash,
      );
      const fresh =
        user &&
        ((await db.prepare("SELECT * FROM users WHERE id=?").get(user.id)) as
          User | undefined);
      if (
        !valid ||
        !fresh?.active ||
        fresh.password_hash !== user?.password_hash
      )
        fail(401, "Incorrect username or password.");
      await db.prepare("DELETE FROM login_attempts WHERE key=?").run(key);
      await audit(fresh, null, "login");
      return await issue(fresh);
    },
  );
  app.get("/v1/me", async (request) => identity(await account(request, false)));
  app.post("/v1/auth/logout", async (request) => {
    const user = await account(request, false);
    await db
      .prepare("DELETE FROM sessions WHERE digest=?")
      .run(digest(request.headers.authorization!.slice(7)));
    await audit(user, null, "logout");
    return { ok: true };
  });
  app.post(
    "/v1/auth/password",
    { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } },
    async (request) => {
      const user = await account(request, false);
      const body = parse(
        z
          .object({
            currentPassword: z.string().min(1).max(128),
            newPassword: password,
          })
          .strict(),
        request.body,
      );
      if (!(await verifyPassword(body.currentPassword, user.password_hash)))
        fail(400, "Current password is incorrect.");
      if (body.currentPassword === body.newPassword)
        fail(400, "Choose a different password.");
      const hash = await hashPassword(body.newPassword);
      const fresh = await account(request, false);
      if (fresh.password_hash !== user.password_hash)
        fail(409, "The password changed. Sign in again.");
      await db.batch([
        {
          sql: "UPDATE users SET password_hash=?,must_change=0 WHERE id=?",
          args: [hash, user.id],
        },
        { sql: "DELETE FROM sessions WHERE user_id=?", args: [user.id] },
        auditStatement(user, null, "password_changed"),
      ]);
      return await issue({ ...fresh, must_change: 0, password_hash: hash });
    },
  );
  app.post("/v1/admin/farms", async (request) => {
    const user = await account(request, false);
    if (user.role !== "admin")
      fail(403, "Only a team admin can create farms.");
    const body = parse(
      z
        .object({
          farmName: z.string().trim().min(1).max(80),
          customerName: z.string().trim().min(1).max(120).optional(),
          contactName: z.string().trim().min(1).max(120).optional(),
          contactPhone: z.string().trim().min(1).max(40).optional(),
          address: z.string().trim().min(1).max(200).optional(),
          ownerUsername: username,
          ownerName: name,
          technicianUsername: username,
          technicianName: name,
        })
        .strict(),
      request.body,
    );
    const ownerUsername = body.ownerUsername,
      technicianUsername = body.technicianUsername;
    if (ownerUsername === technicianUsername)
      fail(400, "Use separate usernames for the owner and technician.");
    for (const username of [ownerUsername, technicianUsername]) {
      if (await db.prepare("SELECT 1 FROM users WHERE username=?").get(username))
        fail(409, "This username is unavailable. Choose a unique account name.");
    }
    const ownerPassword = temporaryPassword(),
      technicianPassword = temporaryPassword();
    const farmId = await createFarm(db, body.farmName, now(), {
      customerName: body.customerName,
      contactName: body.contactName,
      contactPhone: body.contactPhone,
      address: body.address,
    });
    const farmCode = (await db
      .prepare("SELECT code FROM farm_codes WHERE farm_id=?")
      .get(farmId)) as { code: string } | undefined;
    if (!farmCode) fail(500, "Farm code generation failed.");
    const ownerHash = await hashPassword(ownerPassword),
      technicianHash = await hashPassword(technicianPassword);
    const ownerUserId = randomUUID(),
      technicianUserId = randomUUID();
    await db.batch([
      {
        sql: "INSERT INTO users(id,username,name,role,password_hash,created_at) VALUES(?,?,?,'owner',?,?)",
        args: [ownerUserId, ownerUsername, body.ownerName, ownerHash, now()],
      },
      {
        sql: "INSERT INTO users(id,username,name,role,password_hash,created_at) VALUES(?,?,?,'technician',?,?)",
        args: [technicianUserId, technicianUsername, body.technicianName, technicianHash, now()],
      },
      {
        sql: "INSERT INTO memberships(user_id,farm_id) VALUES(?,?)",
        args: [ownerUserId, farmId],
      },
      {
        sql: "INSERT INTO memberships(user_id,farm_id) VALUES(?,?)",
        args: [technicianUserId, farmId],
      },
      auditStatement(user, farmId, "farm_created", farmId),
    ]);
    return {
      farmId,
      farmCode: farmCode.code,
      qr: `coopguard://farm/open?version=1&farm=${encodeURIComponent(farmCode.code)}`,
      owner: {
        username: ownerUsername,
        name: body.ownerName,
        password: ownerPassword,
      },
      technician: {
        username: technicianUsername,
        name: body.technicianName,
        password: technicianPassword,
      },
    };
  });
  app.get("/v1/farms/:farmId", (request) =>
    serial(async () => {
      const { user, farmId } = await access(request);
      return readFarm(farmId, user, request);
    }),
  );
  app.post("/v1/farms/:farmId/actions", (request) =>
    serial(async () => {
      const { user, farmId } = await access(request),
        body = parse(mutationSchema, request.body);
      const action = body.action as LocalAction;
      if (
        action.type === "createVirtualHub" ||
        action.type === "createVirtualNode"
      ) {
        const target = (await db
          .prepare("SELECT code FROM farm_codes WHERE farm_id=?")
          .get(farmId)) as { code: string } | undefined;
        if (!target || action.farmCode !== target.code)
          fail(400, "The device Farm ID does not match the selected farm.");
      }
      if (
        [
          "addSensor",
          "moveSensor",
          "retireSensor",
          "calibrate",
          "saveSiteSurvey",
          "approveSitePlan",
          "startInstallation",
          "beginCommissioning",
          "startMonitoringTrial",
          "siteChecklist",
          "activateSite",
          "createVirtualHub",
          "createVirtualNode",
          "pairVirtualDevice",
          "removeVirtualDevice",
          "updateVirtualFirmware",
        ].includes(action.type) &&
        user.role !== "technician"
      )
        fail(403, "Only a technician can manage devices.");
      if (
        ["startFlock", "endFlock"].includes(action.type) &&
        user.role !== "owner"
      )
        fail(403, "Only the owner can manage flock cycles.");
      if (action.type === "house" && user.role !== "technician")
        fail(403, "Only a technician can complete or change the site survey.");
      const fingerprint = digest(JSON.stringify(body.action));
      const duplicate = await db
        .prepare(
          "SELECT body_hash FROM mutations WHERE farm_id=? AND user_id=? AND key=?",
        )
        .get(farmId, user.id, body.key);
      if (duplicate) {
        if (duplicate.body_hash !== fingerprint)
          fail(409, "This request identifier was already used.");
        return readFarm(farmId, user, request);
      }
      const farm = await row(farmId),
        before = JSON.parse(farm.state) as LocalFarmState;
      const appendNote = action.type === "saveInspection" && !action.id;
      if (
        !appendNote &&
        action.type !== "ack" &&
        body.revision !== farm.revision
      )
        fail(
          409,
          "Farm records changed on another phone. Refresh and try again.",
        );
      if (
        (action.type === "saveInspection" && action.id) ||
        action.type === "deleteInspection"
      ) {
        const note = before.inspections.find((n) => n.id === action.id);
        if (!note || (user.role !== "owner" && note.authorId !== user.id))
          fail(403, "You can only change your own inspection notes.");
      }
      let saved = farm.state;
      const repo = new LocalFarmRepository(
        {
          getItem: async () => saved,
          setItem: async (_key, value) => {
            saved = value;
          },
        },
        now,
      );
      await repo.load();
      await repo.dispatch({
        type: "context",
        patch: { role: user.role, connection: requestConnection(request) },
      });
      let state: LocalFarmState;
      try {
        state = await repo.dispatch(action);
      } catch (error) {
        fail(
          400,
          error instanceof Error
            ? error.message
            : "The action could not be completed.",
        );
      }
      if (appendNote)
        Object.assign(state.inspections[0]!, {
          authorId: user.id,
          authorName: user.name,
        });
      await access(request);
      await db.batch([
        {
          sql: "UPDATE farms SET state=?,revision=revision+1 WHERE id=?",
          args: [JSON.stringify(state), farmId],
        },
        {
          sql: "INSERT INTO mutations(farm_id,user_id,key,body_hash) VALUES(?,?,?,?)",
          args: [farmId, user.id, body.key, fingerprint],
        },
        auditStatement(user, farmId, action.type),
      ]);
      return { state, revision: farm.revision + 1 };
    }),
  );
  app.post("/v1/farms/:farmId/import", (request) =>
    serial(async () => {
      const { user, farmId } = await access(request, ["technician"]);
      if (requestConnection(request) !== "local")
        fail(
          403,
          "Import previous phone records while connected on the farm WiFi.",
        );
      if ((await row(farmId)).revision !== 0)
        fail(
          409,
          "Import is only available before this farm has saved changes.",
        );
      const draft = request.body;
      if (!validLocalFarm(draft))
        fail(400, "The saved phone records are invalid.");
      const state = structuredClone(draft);
      state.context = {
        role: "technician",
        connection: "local",
        controlMode:
          state.house && surveyRecommendation(state.house) === "eligible"
            ? "full"
            : "monitor",
      };
      state.snapshot.request = null;
      state.snapshot.fanStage = "high";
      state.started = true;
      state.people = seedLocalFarm().people;
      state.inspections.forEach((n) => {
        n.authorId = user.id;
        n.authorName = user.name;
      });
      if (state.flock?.id === "flock-1") state.flock = null;
      await db
        .prepare("UPDATE farms SET state=?,revision=1 WHERE id=?")
        .run(JSON.stringify(state), farmId);
      await audit(user, farmId, "phone_records_imported");
      return { state, revision: 1 };
    }),
  );
  app.get("/v1/farms/:farmId/workers", async (request) => {
    const { farmId } = await access(request, ["owner"]);
    return await workers(farmId);
  });
  app.post(
    "/v1/farms/:farmId/workers",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request) => {
      const { farmId } = await access(request, ["owner"]);
      const body = parse(
        z.object({ username, name, temporaryPassword: password }).strict(),
        request.body,
      );
      const hash = await hashPassword(body.temporaryPassword);
      const { user } = await access(request, ["owner"]),
        id = randomUUID();
      if (
        await db
          .prepare("SELECT 1 FROM users WHERE username=?")
          .get(body.username)
      )
        fail(409, "This username is unavailable.");
      await db.batch([
        {
          sql: "INSERT INTO users(id,username,name,role,password_hash,created_at) VALUES(?,?,?,'worker',?,?)",
          args: [id, body.username, body.name, hash, now()],
        },
        {
          sql: "INSERT INTO memberships(user_id,farm_id) VALUES(?,?)",
          args: [id, farmId],
        },
        auditStatement(user, farmId, "worker_created", id),
      ]);
      return await workers(farmId);
    },
  );
  app.patch("/v1/farms/:farmId/workers/:id", async (request) => {
    const { user, farmId } = await access(request, ["owner"]),
      id = (request.params as { id: string }).id;
    await targetWorker(farmId, id);
    const body = parse(
      z.object({ name, active: z.boolean() }).strict(),
      request.body,
    );
    await db
      .prepare("UPDATE users SET name=?,active=? WHERE id=?")
      .run(body.name, Number(body.active), id);
    if (!body.active)
      await db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
    await audit(
      user,
      farmId,
      body.active ? "worker_updated" : "worker_disabled",
      id,
    );
    return await workers(farmId);
  });
  app.post(
    "/v1/farms/:farmId/workers/:id/password",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request) => {
      const { farmId } = await access(request, ["owner"]),
        id = (request.params as { id: string }).id;
      await targetWorker(farmId, id);
      const body = parse(
          z.object({ temporaryPassword: password }).strict(),
          request.body,
        ),
        hash = await hashPassword(body.temporaryPassword);
      const { user } = await access(request, ["owner"]);
      await targetWorker(farmId, id);
      await db.batch([
        {
          sql: "UPDATE users SET password_hash=?,must_change=1 WHERE id=?",
          args: [hash, id],
        },
        { sql: "DELETE FROM sessions WHERE user_id=?", args: [id] },
        auditStatement(user, farmId, "worker_password_reset", id),
      ]);
      return { ok: true };
    },
  );
  return app;
}
