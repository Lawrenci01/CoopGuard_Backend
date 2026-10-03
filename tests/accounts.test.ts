import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, createFarm } from "../src/database";
import { connectionForHeaders, createApp } from "../src/app";
import { hashPassword } from "../src/passwords";
import { seedLocalFarm } from "../src/shared/services/localFarmRepository";
import type { Session } from "../src/apiTypes";
import { completeSiteSurvey } from "./siteTestFixture";
import { purgeFarmData, reprovisionFarmAccounts } from "../src/accountAdmin";
import { pairingQr } from "../src/shared/domain/deviceSimulation";

test("public tunnel requests are remote while private farm hosts are local", () => {
  assert.equal(connectionForHeaders({ host: "192.168.8.36:8443" }), "local");
  assert.equal(connectionForHeaders({ host: "localhost:8443" }), "local");
  assert.equal(
    connectionForHeaders({ host: "coopguard-example.trycloudflare.com" }),
    "cloud",
  );
  assert.equal(
    connectionForHeaders({
      host: "192.168.8.36:8443",
      "cf-connecting-ip": "203.0.113.8",
    }),
    "cloud",
  );
});

test("fresh-start reset keeps only administrators and cg.technician", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "coopguard-purge-"));
  const db = await openDatabase(join(dir, "test.sqlite"));
  t.after(async () => {
    await db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const passwordHash = await hashPassword("Temporary test password 123!");
  for (const [id, username, role] of [
    ["admin", "team.admin", "admin"],
    ["tech", "cg.technician", "technician"],
    ["extra-tech", "old.technician", "technician"],
    ["owner", "old.owner", "owner"],
    ["worker", "old.worker", "worker"],
  ] as const)
    await db
      .prepare(
        "INSERT INTO users(id,username,name,role,password_hash,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(id, username, username, role, passwordHash, Date.now());
  const farmId = await createFarm(db, "Old farm");
  await db.batch([
    {
      sql: "INSERT INTO memberships(user_id,farm_id) VALUES(?,?)",
      args: ["owner", farmId],
    },
    {
      sql: "INSERT INTO sessions(digest,user_id,expires_at) VALUES(?,?,?)",
      args: ["session", "tech", Date.now() + 60_000],
    },
    {
      sql: "INSERT INTO audit(user_id,farm_id,event,at) VALUES(?,?,?,?)",
      args: ["owner", farmId, "test", Date.now()],
    },
  ]);

  const result = await purgeFarmData(db);
  assert.equal(result.deletedFarms, 1);
  assert.equal(result.deletedUsers, 3);
  assert.deepEqual(
    (await db.prepare("SELECT username FROM users ORDER BY username").all()).map(
      (row) => row.username,
    ),
    ["cg.technician", "team.admin"],
  );
  for (const table of [
    "farms",
    "farm_codes",
    "memberships",
    "sessions",
    "mutations",
    "audit",
    "login_attempts",
  ])
    assert.equal(
      Number((await db.prepare(`SELECT COUNT(*) count FROM ${table}`).get())?.count),
      0,
    );
});

test("farm reprovision revokes old accounts while preserving the farm", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "coopguard-reprovision-"));
  const db = await openDatabase(join(dir, "test.sqlite"));
  t.after(async () => {
    await db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const farmId = await createFarm(db, "Pilot farm");
  const hash = await hashPassword("Test password 123!");
  await db.batch([
    {
      sql: "INSERT INTO users(id,username,name,role,password_hash,must_change,created_at) VALUES(?,?,?,?,?,0,?)",
      args: ["old-owner", "old.owner", "Old owner", "owner", hash, Date.now()],
    },
    {
      sql: "INSERT INTO memberships(user_id,farm_id) VALUES(?,?)",
      args: ["old-owner", farmId],
    },
    {
      sql: "INSERT INTO sessions(digest,user_id,expires_at) VALUES(?,?,?)",
      args: ["old-session", "old-owner", Date.now() + 60_000],
    },
  ]);

  const result = await reprovisionFarmAccounts(
    db,
    "Pilot farm",
    "old.owner",
    "new.technician",
  );
  assert.equal(result.farmId, farmId);
  assert.equal(result.credentials.length, 2);
  assert.equal(
    await db.prepare("SELECT 1 FROM users WHERE id=?").get("old-owner"),
    undefined,
  );
  assert.ok(
    await db.prepare("SELECT 1 FROM users WHERE username=?").get("old.owner"),
  );
  assert.equal(
    await db
      .prepare("SELECT 1 FROM sessions WHERE digest=?")
      .get("old-session"),
    undefined,
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM farms WHERE id=?").get(farmId))!
      .n,
    1,
  );
  assert.equal(
    (await db
      .prepare("SELECT COUNT(*) n FROM memberships WHERE farm_id=?")
      .get(farmId))!.n,
    1,
  );
  const secondFarmId = await createFarm(db, "Second farm");
  const secondProvision = await reprovisionFarmAccounts(
    db,
    "Second farm",
    "second.owner",
    "new.technician",
  );
  assert.equal(secondProvision.farmId, secondFarmId);
  assert.equal(secondProvision.credentials.length, 1);
  assert.equal(secondProvision.credentials[0]?.role, "owner");
  assert.equal(
    (await db
      .prepare("SELECT COUNT(*) n FROM users WHERE role='technician'")
      .get())!.n,
    1,
  );
});

test("farm reprovision can initialize a confirmed empty cloud database", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "coopguard-empty-cloud-"));
  const db = await openDatabase(join(dir, "test.sqlite"));
  t.after(async () => {
    await db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const result = await reprovisionFarmAccounts(
    db,
    "CoopGuard pilot farm",
    "cg.owner",
    "cg.technician",
    Date.now(),
    true,
  );
  assert.equal(result.farmCreated, true);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM farms").get())!.n, 1);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM users").get())!.n, 2);
});

test("fresh databases do not expose a predictable default admin account", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "coopguard-admin-bootstrap-"));
  const path = join(dir, "test.sqlite");
  const db = await openDatabase(path);
  t.after(async () => {
    await db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  assert.equal((await db.prepare("SELECT COUNT(*) n FROM users").get())!.n, 0);
  const app = await createApp(db);
  const login = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { username: "team.admin", password: "password.admin123" },
  });
  assert.equal(login.statusCode, 401, login.body);
});

test("the retired fixed-password admin is disabled and its sessions are revoked", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "coopguard-admin-retired-"));
  const path = join(dir, "test.sqlite");
  const db = await openDatabase(path);
  await db.batch([
    {
      sql: "INSERT INTO users(id,username,name,role,password_hash,active,must_change,created_at) VALUES(?,?,?,?,?,?,?,?)",
      args: [
        "legacy-admin",
        "team.admin",
        "Team Admin",
        "admin",
        await hashPassword("password.admin123"),
        1,
        0,
        Date.now(),
      ],
    },
    {
      sql: "INSERT INTO sessions(digest,user_id,expires_at) VALUES(?,?,?)",
      args: ["legacy-admin-session", "legacy-admin", Date.now() + 60_000],
    },
  ]);
  await db.close();
  const reopened = await openDatabase(path);
  t.after(async () => {
    await reopened.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const user = await reopened
    .prepare("SELECT active,must_change FROM users WHERE id=?")
    .get("legacy-admin");
  assert.equal(user?.active, 0);
  assert.equal(user?.must_change, 1);
  assert.equal(
    await reopened.prepare("SELECT 1 FROM sessions WHERE user_id=?").get("legacy-admin"),
    undefined,
  );
});

test("legacy user schema without admin is upgraded automatically", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "coopguard-admin-upgrade-"));
  const path = join(dir, "test.sqlite");
  const legacy = await openDatabase(path);

  await legacy.batch([
    {
      sql: "DROP TABLE users",
    },
    {
      sql: "CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','worker','technician')), password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, must_change INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL)",
    },
    {
      sql: "INSERT INTO users(id,username,name,role,password_hash,active,must_change,created_at) VALUES(?,?,?,?,?,?,?,?)",
      args: [
        "legacy-owner",
        "legacy.owner",
        "Legacy Owner",
        "owner",
        await hashPassword("Legacy pass 123!"),
        1,
        0,
        Date.now(),
      ],
    },
  ]);

  await legacy.close();
  const reopened = await openDatabase(path);
  t.after(async () => {
    await reopened.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const definition = await reopened
    .prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name='users'")
    .get();
  assert.match(String(definition?.sql), /'admin'/);
  assert.ok(await reopened.prepare("SELECT 1 FROM users WHERE username=?").get("legacy.owner"));
});

test("admin can create a farm record with customer metadata and generated credentials", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "coopguard-admin-farm-"));
  const path = join(dir, "test.sqlite");
  const db = await openDatabase(path);
  t.after(async () => {
    await db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  await db
    .prepare(
      "INSERT INTO users(id,username,name,role,password_hash,must_change,created_at) VALUES(?,?,?,?,?,0,?)",
    )
    .run(
      "admin-1",
      "team.admin",
      "Team admin",
      "admin",
      await hashPassword("Admin password 123!"),
      Date.now(),
    );
  const app = await createApp(db);
  const login = async () => {
    const r = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { username: "team.admin", password: "Admin password 123!" },
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json<Session>();
  };
  const admin = await login();
  const response = await app.inject({
    method: "POST",
    url: "/v1/admin/farms",
    headers: { authorization: `Bearer ${admin.token}` },
    payload: {
      farmName: "North Valley Poultry",
      customerName: "North Valley Coop",
      contactName: "Casey Green",
      contactPhone: "+1 555 010 2020",
      address: "12 River Lane, Bayview",
      ownerUsername: "north.owner",
      ownerName: "North Valley Owner",
    },
  });
  assert.equal(response.statusCode, 200, response.body);
  const body = response.json<{
    farmId: string;
    farmCode: string;
    qr: string;
    owner: { username: string; password: string };
  }>();
  assert.match(body.farmCode, /^CG-PH-/);
  assert.equal(body.qr.startsWith("coopguard://farm/open?"), true);
  assert.equal(body.owner.username, "north.owner");
  assert.equal(body.owner.password.length >= 12, true);
  assert.equal("technician" in body, false);
  const farm = await db
    .prepare(
      "SELECT name,customer_name,contact_phone,address FROM farms WHERE id=?",
    )
    .get(body.farmId);
  assert.equal(farm?.name, "North Valley Poultry");
  assert.equal(farm?.customer_name, "North Valley Coop");
  assert.equal(farm?.contact_phone, "+1 555 010 2020");
  assert.equal(farm?.address, "12 River Lane, Bayview");
  assert.equal(
    (await db
      .prepare("SELECT COUNT(*) n FROM memberships WHERE farm_id=?")
      .get(body.farmId))!.n,
    1,
  );
  assert.equal(
    (await db
      .prepare("SELECT COUNT(*) n FROM users WHERE username=?")
      .get("north.owner"))!.n,
    1,
  );

  const second = await app.inject({
    method: "POST",
    url: "/v1/admin/farms",
    headers: { authorization: `Bearer ${admin.token}` },
    payload: {
      farmName: "South Valley Poultry",
      ownerUsername: "south.owner",
      ownerName: "South Valley Owner",
    },
  });
  assert.equal(second.statusCode, 200, second.body);
  const secondBody = second.json<typeof body>();
  assert.equal(
    (await db
      .prepare("SELECT COUNT(*) n FROM users WHERE role='technician'")
      .get())!.n,
    0,
  );
  assert.equal(
    (await db
      .prepare("SELECT COUNT(*) n FROM memberships WHERE farm_id=?")
      .get(secondBody.farmId))!.n,
    1,
  );
});

test("shared accounts, farm permissions, offline replay and durable records", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "coopguard-accounts-"));
  const path = join(dir, "test.sqlite");
  let db = await openDatabase(path),
    clock = Date.now();
  const hash = await hashPassword("Test password 123!");
  const farm = await createFarm(db, "First farm", clock),
    otherFarm = await createFarm(db, "Other farm", clock);
  for (const [id, role, site] of [
    ["owner", "owner", farm],
    ["tech", "technician", farm],
    ["worker", "worker", farm],
    ["other", "owner", otherFarm],
  ] as const) {
    await db
      .prepare(
        "INSERT INTO users(id,username,name,role,password_hash,must_change,created_at) VALUES(?,?,?,?,?,0,?)",
      )
      .run(id, id, `${role} name`, role, hash, clock);
    await db
      .prepare("INSERT INTO memberships(user_id,farm_id) VALUES(?,?)")
      .run(id, site);
  }
  let app = await createApp(db, { clock: () => clock });
  const send = async (
    method: "GET" | "POST" | "PATCH",
    url: string,
    token?: string,
    payload?: unknown,
  ) =>
    app.inject({
      method,
      url,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      ...(payload === undefined
        ? {}
        : {
            payload: JSON.stringify(payload),
            headers: {
              ...(token ? { authorization: `Bearer ${token}` } : {}),
              "content-type": "application/json",
            },
          }),
    });
  const login = async (username: string, password = "Test password 123!") => {
    const r = await send("POST", "/v1/auth/login", undefined, {
      username,
      password,
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json<Session>();
  };
  const owner = await login("owner"),
    tech = await login("tech"),
    worker = await login("worker"),
    other = await login("other");
  const route = `/v1/farms/${farm}`,
    workers = `${route}/workers`;
  const mutate = (
    token: string,
    action: unknown,
    revision = 0,
    key = randomUUID(),
  ) => send("POST", `${route}/actions`, token, { key, revision, action });
  try {
    await t.test(
      "no public signup; farm isolation and server-assigned roles",
      async () => {
        assert.equal((await send("GET", route)).statusCode, 401);
        assert.equal(
          (await send("POST", "/v1/auth/signup", undefined, {})).statusCode,
          404,
        );
        assert.equal((await send("GET", route, other.token)).statusCode, 403);
        assert.equal(
          (await send("GET", `/v1/farms/${otherFarm}`, owner.token)).statusCode,
          403,
        );
        assert.equal(
          (await send("GET", `/v1/farms/${otherFarm}`, tech.token)).statusCode,
          200,
        );
        const onlineOwnerRequest = await app.inject({
          method: "GET",
          url: `/v1/farms/${otherFarm}`,
          headers: {
            authorization: `Bearer ${owner.token}`,
            host: "coopguard-example.onrender.com",
          },
        });
        const onlineTechnicianRequest = await app.inject({
          method: "GET",
          url: `/v1/farms/${otherFarm}`,
          headers: {
            authorization: `Bearer ${tech.token}`,
            host: "coopguard-example.onrender.com",
          },
        });
        assert.equal(onlineOwnerRequest.statusCode, 403);
        assert.equal(onlineTechnicianRequest.statusCode, 200);
        assert.equal(owner.farms.length, 1);
        const technicianIdentity = await send("GET", "/v1/me", tech.token);
        assert.equal(technicianIdentity.statusCode, 200);
        assert.equal(technicianIdentity.json<Session>().farms.length, 2);
        const ownerIdentity = await send("GET", "/v1/me", owner.token);
        assert.equal(ownerIdentity.statusCode, 200);
        assert.deepEqual(
          ownerIdentity.json<Session>().farms.map((farm) => farm.id),
          [farm],
        );
        await db
          .prepare("INSERT INTO memberships(user_id,farm_id) VALUES(?,?)")
          .run("owner", otherFarm);
        assert.equal((await send("GET", route, owner.token)).statusCode, 403);
        assert.equal(
          (await send("GET", "/v1/me", owner.token)).json<Session>().farms
            .length,
          0,
        );
        await db
          .prepare("DELETE FROM memberships WHERE user_id=? AND farm_id=?")
          .run("owner", otherFarm);
        assert.equal(
          (
            await mutate(owner.token, {
              type: "saveSiteSurvey",
              value: completeSiteSurvey(),
            })
          ).statusCode,
          403,
        );
        for (const token of [worker.token, tech.token]) {
          assert.equal((await send("GET", workers, token)).statusCode, 403);
          assert.equal(
            (
              await send("POST", workers, token, {
                username: "blocked",
                name: "Blocked",
                temporaryPassword: "A long password",
              })
            ).statusCode,
            403,
          );
        }
        for (const role of ["owner", "technician"])
          assert.equal(
            (
              await send("POST", workers, owner.token, {
                username: "bad-role",
                name: "Bad",
                temporaryPassword: "A long password",
                role,
              })
            ).statusCode,
            400,
          );
        assert.equal(
          (
            await mutate(worker.token, {
              type: "context",
              patch: { role: "owner" },
            })
          ).statusCode,
          400,
        );
        assert.equal(
          (
            await mutate(owner.token, {
              type: "addSensor",
              section: "A",
              control: false,
              tested: true,
              calibrated: true,
            })
          ).statusCode,
          403,
        );
        assert.equal(
          (
            await mutate(owner.token, {
              type: "house",
              value: {
                farmName: "First farm",
                houseName: "East",
                houseType: "open",
                controller: "absent",
                flock: "broiler",
                lengthMetres: 90,
                widthMetres: 12,
              },
            })
          ).statusCode,
          403,
        );
        assert.equal(
          (
            await mutate(worker.token, {
              type: "house",
              value: {
                farmName: "First farm",
                houseName: "East",
                houseType: "open",
                controller: "absent",
                flock: "broiler",
                lengthMetres: 90,
                widthMetres: 12,
              },
            })
          ).statusCode,
          403,
        );
        assert.equal(
          (
            await mutate(tech.token, {
              type: "startFlock",
              startDate: "2026-10-01",
              days: 42,
              birds: 500,
            })
          ).statusCode,
          403,
        );
        const digests = await db.prepare("SELECT digest FROM sessions").all();
        assert.ok(digests.every((r) => r.digest !== owner.token));
        assert.ok(
          digests.some(
            (r) =>
              r.digest ===
              createHash("sha256").update(owner.token).digest("hex"),
          ),
        );
      },
    );
    await t.test(
      "temporary passwords, reset, disable and independent phone sessions",
      async () => {
        const created = await send("POST", workers, owner.token, {
          username: "new.worker",
          name: "New Worker",
          temporaryPassword: "First password 123!",
        });
        assert.equal(created.statusCode, 200, created.body);
        const id = created
          .json()
          .find((r: { username: string }) => r.username === "new.worker").id;
        const temporary = await login("new.worker", "First password 123!");
        assert.equal(temporary.account.role, "worker");
        assert.equal(temporary.account.mustChangePassword, true);
        assert.equal(
          (await send("GET", route, temporary.token)).statusCode,
          403,
        );
        const changed = await send(
          "POST",
          "/v1/auth/password",
          temporary.token,
          {
            currentPassword: "First password 123!",
            newPassword: "Personal password 456!",
          },
        );
        assert.equal(changed.statusCode, 200, changed.body);
        const phone1 = changed.json<Session>(),
          phone2 = await login("new.worker", "Personal password 456!");
        assert.equal(phone1.account.mustChangePassword, false);
        assert.notEqual(phone1.token, phone2.token);
        assert.equal(
          (await send("GET", route, temporary.token)).statusCode,
          401,
        );
        assert.equal((await send("GET", route, phone1.token)).statusCode, 200);
        assert.equal((await send("GET", route, phone2.token)).statusCode, 200);
        assert.equal(
          (
            await send("POST", `${workers}/${id}/password`, other.token, {
              temporaryPassword: "Reset password 789!",
            })
          ).statusCode,
          403,
        );
        assert.equal(
          (
            await send("POST", `${workers}/tech/password`, owner.token, {
              temporaryPassword: "Reset password 789!",
            })
          ).statusCode,
          404,
        );
        assert.equal(
          (
            await send("POST", `${workers}/${id}/password`, owner.token, {
              temporaryPassword: "Reset password 789!",
            })
          ).statusCode,
          200,
        );
        for (const token of [phone1.token, phone2.token])
          assert.equal((await send("GET", "/v1/me", token)).statusCode, 401);
        const reset = await login("new.worker", "Reset password 789!");
        assert.equal(reset.account.mustChangePassword, true);
        assert.equal(
          (
            await send("PATCH", `${workers}/${id}`, owner.token, {
              name: "New Worker",
              active: false,
            })
          ).statusCode,
          200,
        );
        assert.equal(
          (await send("GET", "/v1/me", reset.token)).statusCode,
          401,
        );
        assert.equal(
          (
            await send("POST", "/v1/auth/login", undefined, {
              username: "new.worker",
              password: "Reset password 789!",
            })
          ).statusCode,
          401,
        );
      },
    );
    await t.test(
      "legacy import is technician-only, once, and strips old role/commands",
      async () => {
        const legacy = seedLocalFarm(clock);
        legacy.context.role = "technician";
        legacy.flock = null;
        assert.equal(
          (await send("POST", `${route}/import`, worker.token, legacy))
            .statusCode,
          403,
        );
        assert.equal(
          (await send("POST", `${route}/import`, owner.token, legacy))
            .statusCode,
          403,
        );
        const imported = await send(
          "POST",
          `${route}/import`,
          tech.token,
          legacy,
        );
        assert.equal(imported.statusCode, 200, imported.body);
        assert.equal(imported.json().state.context.role, "technician");
        assert.equal(imported.json().state.context.controlMode, "monitor");
        assert.equal(imported.json().state.snapshot.request, null);
        assert.equal(
          (await send("POST", `${route}/import`, tech.token, legacy))
            .statusCode,
          409,
        );
      },
    );
    await t.test(
      "offline note replay is idempotent, attributed and visible to another phone",
      async () => {
        const key = randomUUID(),
          action = {
            type: "saveInspection",
            kind: "sound",
            text: "Birds settled after feeding.",
          };
        const first = await mutate(worker.token, action, 0, key);
        assert.equal(first.statusCode, 200, first.body);
        const revision = first.json().revision,
          note = first.json().state.inspections[0];
        assert.equal(note.authorId, "worker");
        assert.equal(note.authorName, "worker name");
        const repeated = await mutate(worker.token, action, 0, key);
        assert.equal(repeated.statusCode, 200);
        assert.equal(repeated.json().revision, revision);
        assert.equal(repeated.json().state.inspections.length, 1);
        assert.equal(
          (
            await mutate(
              worker.token,
              { ...action, text: "Changed payload" },
              0,
              key,
            )
          ).statusCode,
          409,
        );
        const otherPhone = (await send("GET", route, owner.token)).json();
        assert.equal(otherPhone.state.inspections[0].id, note.id);
        assert.equal(
          (
            await mutate(
              tech.token,
              { type: "deleteInspection", id: note.id },
              revision,
            )
          ).statusCode,
          403,
        );
        const edit = await mutate(
          owner.token,
          { ...action, id: note.id, text: "Owner checked the note." },
          revision,
        );
        assert.equal(edit.statusCode, 200);
        assert.equal(edit.json().state.inspections[0].authorId, "worker");
        assert.equal(
          (
            await mutate(
              worker.token,
              { ...action, id: note.id, text: "Stale edit" },
              revision,
            )
          ).statusCode,
          409,
        );
        assert.equal(
          (
            await mutate(
              owner.token,
              {
                type: "saveInspection",
                kind: "sound",
                text: "",
                authorId: "tech",
              },
              revision,
            )
          ).statusCode,
          400,
        );
      },
    );
    await t.test(
      "technician survey, owner flock, and sensor changes persist across a server restart",
      async () => {
        let revision = (await send("GET", route, owner.token)).json().revision;
        let r = await mutate(
          tech.token,
          { type: "saveSiteSurvey", value: completeSiteSurvey() },
          revision,
        );
        assert.equal(r.statusCode, 200, r.body);
        revision = r.json().revision;
        r = await mutate(tech.token, { type: "approveSitePlan" }, revision);
        assert.equal(r.statusCode, 200, r.body);
        revision = r.json().revision;
        r = await mutate(tech.token, { type: "startInstallation" }, revision);
        assert.equal(r.statusCode, 200, r.body);
        revision = r.json().revision;
        r = await mutate(
          owner.token,
          { type: "startFlock", startDate: "2026-10-01", days: 42, birds: 450 },
          revision,
        );
        assert.equal(r.statusCode, 200, r.body);
        revision = r.json().revision;
        const farmCode = owner.farms.find((item) => item.id === farm)!.code;
        r = await mutate(
          tech.token,
          { type: "createVirtualHub", farmCode },
          revision,
        );
        assert.equal(r.statusCode, 200, r.body);
        revision = r.json().revision;
        let state = r.json().state;
        const hub = state.deviceSimulation.hub!;
        r = await mutate(
          tech.token,
          {
            type: "pairVirtualDevice",
            qr: pairingQr({
              version: 1,
              kind: "hub",
              farmCode,
              deviceId: hub.id,
              pairingCode: hub.pairingCode,
            }),
          },
          revision,
        );
        assert.equal(r.statusCode, 200, r.body);
        revision = r.json().revision;
        for (const section of ["A", "B", "C"] as const) {
          r = await mutate(
            tech.token,
            { type: "createVirtualNode", farmCode, section },
            revision,
          );
          assert.equal(r.statusCode, 200, r.body);
          revision = r.json().revision;
          state = r.json().state;
          const node = state.deviceSimulation.nodes.at(-1)!;
          r = await mutate(
            tech.token,
            {
              type: "pairVirtualDevice",
              qr: pairingQr({
                version: 1,
                kind: "node",
                farmCode,
                deviceId: node.id,
                pairingCode: node.pairingCode,
              }),
            },
            revision,
          );
          assert.equal(r.statusCode, 200, r.body);
          revision = r.json().revision;
        }
        await app.close();
        db.close();
        db = await openDatabase(path);
        app = await createApp(db, { clock: () => clock });
        const saved = await send("GET", route, owner.token);
        assert.equal(saved.statusCode, 200);
        assert.equal(saved.json().state.house.houseName, "West house");
        assert.equal(saved.json().state.site.status, "installing");
        assert.equal(saved.json().state.flock.birds, 450);
        assert.equal(saved.json().state.snapshot.sensors.length, 3);
        assert.deepEqual(
          saved
            .json()
            .state.snapshot.sensors.map(
              (sensor: { section: string }) => sensor.section,
            ),
          ["A", "B", "C"],
        );
        assert.equal(
          saved.json().state.inspections[0].text,
          "Owner checked the note.",
        );
      },
    );
    await t.test(
      "login throttling, logout and expiry reject stale sessions",
      async () => {
        for (let i = 0; i < 10; i++)
          assert.equal(
            (
              await send("POST", "/v1/auth/login", undefined, {
                username: "missing",
                password: "Wrong password",
              })
            ).statusCode,
            401,
          );
        assert.equal(
          (
            await send("POST", "/v1/auth/login", undefined, {
              username: "missing",
              password: "Wrong password",
            })
          ).statusCode,
          429,
        );
        assert.equal(
          (await send("POST", "/v1/auth/logout", worker.token, {})).statusCode,
          200,
        );
        assert.equal((await send("GET", route, worker.token)).statusCode, 401);
        clock += 8 * 86_400_000;
        assert.equal((await send("GET", route, owner.token)).statusCode, 401);
      },
    );
  } finally {
    await app.close();
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
