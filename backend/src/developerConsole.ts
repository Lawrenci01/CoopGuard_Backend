import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import QRCode from "qrcode";
import type { CoopDatabase } from "./database";
import { projectDir } from "./config";

const loopback = (request: FastifyRequest) => {
  const address = request.socket.remoteAddress ?? request.ip;
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1"
  );
};

const consoleHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CoopGuard Hub Console</title><style>
:root{color-scheme:light;--green:#164b37;--green2:#236b4a;--ink:#17211d;--muted:#65736c;--line:#dce4df;--bg:#f4f7f5;--card:#fff;--amber:#9a6500}*{box-sizing:border-box}body{margin:0;background:var(--bg);font:14px system-ui;color:var(--ink)}header{background:var(--green);color:#fff;padding:24px max(22px,calc((100vw - 1160px)/2));display:flex;gap:18px;align-items:center;justify-content:space-between}h1{margin:0;font-size:24px}header p{margin:5px 0 0;color:#c7dacf}.badge{padding:7px 11px;border-radius:999px;background:#ffffff1c;font-weight:700}main{max-width:1160px;margin:24px auto;padding:0 22px;display:grid;gap:18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:17px;box-shadow:0 4px 18px #173d2d0a}.label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:700}.value{font-size:22px;font-weight:750;margin-top:7px}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.split{display:grid;grid-template-columns:300px 1fr;gap:18px}button,a.button{appearance:none;border:0;border-radius:9px;padding:10px 14px;background:var(--green2);color:#fff;font-weight:700;text-decoration:none;cursor:pointer}.secondary{background:#e8f1ec!important;color:var(--green)!important}.danger{background:#873b31!important}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:9px;border-bottom:1px solid var(--line);white-space:nowrap}th{color:var(--muted)}.scroll{overflow:auto;max-height:420px}.muted{color:var(--muted)}#qr{width:240px;max-width:100%;display:block;margin:10px auto}.ok{color:var(--green2)}.warn{color:var(--amber)}@media(max-width:720px){.split{grid-template-columns:1fr}header{align-items:flex-start;flex-direction:column}}
</style></head><body><header><div><h1>CoopGuard Laptop Hub</h1><p>Developer console · local machine access only</p></div><div id="mode" class="badge">Loading…</div></header>
<main><section class="grid"><div class="card"><div class="label">Database</div><div id="rows" class="value">—</div><div id="size" class="muted"></div></div><div class="card"><div class="label">Active farm</div><div id="farm" class="value">—</div><div id="hub" class="muted"></div></div><div class="card"><div class="label">Nodes</div><div id="nodes" class="value">—</div><div class="muted">registered / reporting</div></div><div class="card"><div class="label">Latest transmission</div><div id="latest" class="value">—</div><div id="latestNode" class="muted"></div></div><div class="card"><div class="label">Latest backup</div><div id="backupState" class="value">—</div><div id="backupPath" class="muted"></div></div></section>
<section class="split"><div class="card"><div class="label">Hub pairing</div><img id="qr" src="/v1/developer/pairing.svg" alt="Current pairing QR"><div id="pairing" class="muted">Create a pairing if none is shown.</div></div><div class="card"><div class="row" style="justify-content:space-between"><div><div class="label">Telemetry simulator</div><div id="sim" class="value">—</div></div><div class="row"><button onclick="action('start')">Start</button><button class="danger" onclick="action('stop')">Stop</button><button class="secondary" onclick="backup()">Back up database</button><a class="button secondary" href="/v1/developer/readings.csv">Export CSV</a></div></div><pre id="simlog" class="muted" style="white-space:pre-wrap;max-height:110px;overflow:auto"></pre></div></section>
<section class="card"><div class="row" style="justify-content:space-between"><div><div class="label">Stored history</div><div class="value" style="font-size:18px">Latest sensor readings</div></div><button class="secondary" onclick="refresh()">Refresh</button></div><div class="scroll"><table><thead><tr><th>Sampled</th><th>Farm</th><th>Node</th><th>Section</th><th>Temp °C</th><th>Humidity %</th><th>NH₃ ppm</th><th>CO₂ ppm</th><th>Litter %</th></tr></thead><tbody id="history"></tbody></table></div></section><div id="message" class="muted"></div></main>
<script>const fmt=n=>n==null?'—':new Date(n).toLocaleString();async function json(url,options){const r=await fetch(url,options);const x=await r.json();if(!r.ok)throw Error(x.error||'Request failed');return x}async function refresh(){try{const [s,h]=await Promise.all([json('/v1/developer/status'),json('/v1/developer/history?limit=250')]);mode.textContent=s.mode.toUpperCase();rows.textContent=s.database.readings.toLocaleString()+' readings';size.textContent=s.database.sizeText+' · '+s.database.simulated.toLocaleString()+' simulated / '+s.database.hardware.toLocaleString()+' hardware · '+fmt(s.database.earliestAt)+' to '+fmt(s.database.latestAt);farm.textContent=s.farm?.name||'Not registered';hub.textContent=s.farm? s.farm.code+' · '+s.farm.hubId:'Create and scan a hub QR';nodes.textContent=s.nodes.registered+' / '+s.nodes.reporting;latest.textContent=fmt(s.latest?.sampledAt);latestNode.textContent=s.latest? s.latest.nodeId+' · received '+fmt(s.latest.receivedAt):'No telemetry saved yet';backupState.textContent=s.backup.lastAt?fmt(s.backup.lastAt):'No backup yet';backupPath.textContent=s.backup.lastPath||'Use Back up database below';sim.textContent=s.simulator.running?'Running':'Stopped';sim.className='value '+(s.simulator.running?'ok':'warn');simlog.textContent=s.simulator.log||'';pairing.textContent=s.pairing? s.pairing.hubId+' · '+s.pairing.status+' · expires '+fmt(s.pairing.expiresAt):'No current pairing. Run npm run hub:create.';qr.style.display=s.pairing?'block':'none';history.innerHTML=h.rows.map(r=>'<tr><td>'+fmt(r.sampledAt)+'</td><td>'+r.farmCode+'</td><td>'+r.nodeId+'</td><td>'+r.section+' · '+r.source+'</td><td>'+r.temperatureC+'</td><td>'+r.humidityPercent+'</td><td>'+r.ammoniaPpm+'</td><td>'+r.co2Ppm+'</td><td>'+r.litterMoisturePercent+'</td></tr>').join('')}catch(e){message.textContent=e.message}}async function action(name){try{const x=await json('/v1/developer/simulator/'+name,{method:'POST'});message.textContent=x.message;await refresh()}catch(e){message.textContent=e.message}}async function backup(){try{const x=await json('/v1/developer/backup',{method:'POST'});message.textContent='Backup created: '+x.path;await refresh()}catch(e){message.textContent=e.message}}refresh();setInterval(refresh,5000)</script></body></html>`;

export function registerDeveloperConsole(
  app: FastifyInstance,
  db: CoopDatabase,
  options: {
    enabled: boolean;
    mode: "cloud" | "hub" | "standalone";
    databasePath: string;
    hubConfigPath: string;
    apiUrl: string;
  },
) {
  let simulator: ChildProcessWithoutNullStreams | null = null;
  let simulatorLog = "";
  let autoSimulationEnabled = true;
  const guard = (request: FastifyRequest) => {
    if (!options.enabled || !loopback(request))
      throw Object.assign(
        new Error("The developer console is available only on the hub laptop."),
        { statusCode: 403 },
      );
  };
  const simulatorState = () => ({
    running: !!simulator && simulator.exitCode === null,
    log: simulatorLog.slice(-3000),
  });
  const startSimulator = () => {
    if (simulator && simulator.exitCode === null)
      return { message: "Simulator is already running." };
    if (!existsSync(options.hubConfigPath))
      throw Object.assign(
        new Error("Create and claim a hub before starting the simulator."),
        { statusCode: 409 },
      );
    const config = JSON.parse(readFileSync(options.hubConfigPath, "utf8")) as {
      farmCode?: string;
      nodes?: unknown[];
    };
    if (!config.farmCode || !config.nodes?.length)
      throw Object.assign(
        new Error(
          "Scan the hub QR and register at least one sensor node first.",
        ),
        { statusCode: 409 },
      );
    const script = resolve(
      projectDir,
      "..",
      "hardware",
      "gateway-simulator.mjs",
    );
    const localCa = join(dirname(options.hubConfigPath), "tls", "ca.crt");
    simulatorLog = "";
    simulator = spawn(
      process.execPath,
      [
        script,
        "--config",
        options.hubConfigPath,
        "--api",
        options.apiUrl,
        "--interval",
        "60",
        "--backfill-days",
        "183",
        "--backfill-interval",
        "60",
      ],
      {
        env: {
          ...process.env,
          ...(existsSync(localCa)
            ? { NODE_EXTRA_CA_CERTS: localCa }
            : { NODE_TLS_REJECT_UNAUTHORIZED: "0" }),
        },
        stdio: "pipe",
        windowsHide: true,
      },
    );
    simulator.stdout.on("data", (data) => {
      simulatorLog += String(data);
    });
    simulator.stderr.on("data", (data) => {
      simulatorLog += String(data);
    });
    simulator.on("exit", () => {
      simulator = null;
    });
    return { message: "Telemetry simulator started." };
  };

  app.get("/developer", async (request, reply) => {
    guard(request);
    return reply.type("text/html; charset=utf-8").send(consoleHtml);
  });
  app.get("/v1/developer/status", async (request) => {
    guard(request);
    const [counts, active, nodeCounts, latest, pairing] = await Promise.all([
      db
        .prepare(
          `SELECT COUNT(*) readings,MIN(sampled_at) earliestAt,MAX(sampled_at) latestAt,
                  SUM(CASE WHEN source='simulated' THEN 1 ELSE 0 END) simulated,
                  SUM(CASE WHEN source='hardware' THEN 1 ELSE 0 END) hardware
           FROM sensor_readings`,
        )
        .get(),
      db
        .prepare(
          `SELECT f.name,c.code,h.id hubId FROM telemetry_hubs h JOIN farms f ON f.id=h.farm_id JOIN farm_codes c ON c.farm_id=f.id WHERE h.active=1 ORDER BY h.created_at DESC LIMIT 1`,
        )
        .get(),
      db
        .prepare(
          `SELECT COUNT(*) registered,SUM(CASE WHEN last_seen_at IS NOT NULL AND last_seen_at>? THEN 1 ELSE 0 END) reporting FROM (SELECT n.id,MAX(r.received_at) last_seen_at FROM telemetry_nodes n LEFT JOIN sensor_readings r ON r.node_id=n.id WHERE n.active=1 GROUP BY n.id)`,
        )
        .get(Date.now() - 3 * 60_000),
      db
        .prepare(
          `SELECT node_id nodeId,sampled_at sampledAt,received_at receivedAt FROM sensor_readings ORDER BY received_at DESC LIMIT 1`,
        )
        .get(),
      db
        .prepare(
          `SELECT hub_id hubId,status,expires_at expiresAt FROM hub_pairings WHERE status IN ('pending','replacement_pending') ORDER BY created_at DESC LIMIT 1`,
        )
        .get(),
    ]);
    let bytes = 0;
    try {
      bytes = existsSync(options.databasePath)
        ? Number((await import("node:fs")).statSync(options.databasePath).size)
        : 0;
    } catch {}
    const backupDir = join(dirname(options.databasePath), "backups");
    const backups = existsSync(backupDir)
      ? readdirSync(backupDir)
          .filter((name) => name.endsWith(".sqlite"))
          .map((name) => {
            const path = join(backupDir, name);
            return { path, at: statSync(path).mtimeMs };
          })
          .sort((a, b) => b.at - a.at)
      : [];
    return {
      mode: options.mode,
      database: {
        path: options.databasePath,
        readings: Number(counts?.readings ?? 0),
        earliestAt: counts?.earliestAt ?? null,
        latestAt: counts?.latestAt ?? null,
        simulated: Number(counts?.simulated ?? 0),
        hardware: Number(counts?.hardware ?? 0),
        bytes,
        sizeText: `${(bytes / 1_048_576).toFixed(2)} MB`,
      },
      farm: active ?? null,
      nodes: {
        registered: Number(nodeCounts?.registered ?? 0),
        reporting: Number(nodeCounts?.reporting ?? 0),
      },
      latest: latest ?? null,
      pairing: pairing ?? null,
      backup: {
        count: backups.length,
        lastAt: backups[0]?.at ?? null,
        lastPath: backups[0]?.path ?? null,
      },
      simulator: simulatorState(),
    };
  });
  app.get("/v1/developer/history", async (request) => {
    guard(request);
    const requested = Number(
      (request.query as { limit?: string }).limit ?? 250,
    );
    const limit = Math.min(
      2000,
      Math.max(1, Number.isFinite(requested) ? requested : 250),
    );
    const rows = await db
      .prepare(
        `SELECT c.code farmCode,r.node_id nodeId,n.section,r.source,r.sampled_at sampledAt,r.received_at receivedAt,r.temperature_c temperatureC,r.humidity_percent humidityPercent,r.ammonia_ppm ammoniaPpm,r.co2_ppm co2Ppm,r.litter_moisture_percent litterMoisturePercent FROM sensor_readings r JOIN telemetry_nodes n ON n.id=r.node_id JOIN farm_codes c ON c.farm_id=r.farm_id ORDER BY r.sampled_at DESC LIMIT ?`,
      )
      .all(limit);
    return { rows };
  });
  app.get("/v1/developer/pairing.svg", async (request, reply) => {
    guard(request);
    const row = await db
      .prepare(
        `SELECT hub_id,token_digest,wifi_url,usb_url,expires_at FROM hub_pairings WHERE status='pending' ORDER BY created_at DESC LIMIT 1`,
      )
      .get();
    const pairingText = existsSync(`${options.hubConfigPath}.pairing.txt`)
      ? readFileSync(`${options.hubConfigPath}.pairing.txt`, "utf8").trim()
      : "";
    if (!row || !pairingText)
      return reply.code(404).send({ error: "No pending hub pairing." });
    return reply
      .type("image/svg+xml")
      .send(await QRCode.toString(pairingText, { type: "svg", margin: 2 }));
  });
  app.post("/v1/developer/simulator/start", async (request) => {
    guard(request);
    autoSimulationEnabled = true;
    return startSimulator();
  });
  app.post("/v1/developer/simulator/stop", async (request) => {
    guard(request);
    autoSimulationEnabled = false;
    if (simulator && simulator.exitCode === null) simulator.kill();
    simulator = null;
    return { message: "Telemetry simulator stopped." };
  });
  const autoStartTimer = setInterval(() => {
    if (!autoSimulationEnabled || (simulator && simulator.exitCode === null))
      return;
    try {
      startSimulator();
    } catch {}
  }, 5_000);
  app.post("/v1/developer/backup", async (request) => {
    guard(request);
    await db.prepare("PRAGMA wal_checkpoint(FULL)").all();
    const backupDir = join(dirname(options.databasePath), "backups");
    mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const target = join(
      backupDir,
      `${basename(options.databasePath, ".sqlite")}-${stamp}.sqlite`,
    );
    copyFileSync(options.databasePath, target);
    return { path: target };
  });
  app.get("/v1/developer/readings.csv", async (request, reply) => {
    guard(request);
    const rows = await db
      .prepare(
        `SELECT c.code farm_code,r.node_id,n.section,r.source,r.sampled_at,r.received_at,r.temperature_c,r.humidity_percent,r.ammonia_ppm,r.co2_ppm,r.litter_moisture_percent,r.sequence FROM sensor_readings r JOIN telemetry_nodes n ON n.id=r.node_id JOIN farm_codes c ON c.farm_id=r.farm_id ORDER BY r.sampled_at DESC LIMIT 50000`,
      )
      .all();
    const columns = [
      "farm_code",
      "node_id",
      "section",
      "source",
      "sampled_at",
      "received_at",
      "temperature_c",
      "humidity_percent",
      "ammonia_ppm",
      "co2_ppm",
      "litter_moisture_percent",
      "sequence",
    ];
    const cell = (value: unknown) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      columns.join(","),
      ...rows.map((row) =>
        columns.map((column) => cell(row[column])).join(","),
      ),
    ].join("\n");
    return reply
      .header(
        "Content-Disposition",
        `attachment; filename="coopguard-readings-${Date.now()}.csv"`,
      )
      .type("text/csv; charset=utf-8")
      .send(csv);
  });
  app.addHook("onClose", async () => {
    clearInterval(autoStartTimer);
    if (simulator && simulator.exitCode === null) simulator.kill();
  });
}
