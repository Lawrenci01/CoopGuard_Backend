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
        r = await mutate(
          tech.token,
          {
            type: "addSensor",
            section: "A",
            control: false,
            tested: true,
            calibrated: true,
          },
          revision,
        );
        assert.equal(r.statusCode, 200, r.body);
        await app.close();
        db.close();
        db = await openDatabase(path);
        app = await createApp(db, { clock: () => clock });
        const saved = await send("GET", route, owner.token);
        assert.equal(saved.statusCode, 200);
        assert.equal(saved.json().state.house.houseName, "West house");
        assert.equal(saved.json().state.site.status, "installing");
        assert.equal(saved.json().state.flock.birds, 450);
        assert.equal(saved.json().state.snapshot.sensors.length, 13);
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
