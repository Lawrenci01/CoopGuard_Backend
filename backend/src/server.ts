import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "./database";
import { createApp } from "./app";
import { databasePath, deploymentMode, localDir, turso } from "./config";

if (process.env.RENDER === "true" && !turso)
  throw new Error(
    "Render Free requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN. Add both secrets in the service Environment page.",
  );
const db = await openDatabase(databasePath, turso, deploymentMode);
const useHttps = process.env.CG_HTTPS !== "false";
const port = Number(process.env.PORT ?? 8443);
const hubConfigPath =
  process.env.CG_HUB_CONFIG ?? join(localDir, "hub-config.json");
const savedHubId = existsSync(hubConfigPath)
  ? (JSON.parse(readFileSync(hubConfigPath, "utf8")) as { hubId?: string })
      .hubId
  : undefined;
const app = await createApp(db, {
  trustProxy: process.env.CG_TRUST_PROXY === "true",
  deploymentMode,
  hubId: process.env.CG_HUB_ID ?? savedHubId,
  databasePath,
  hubConfigPath,
  developerConsole: process.env.CG_DEVELOPER_CONSOLE !== "false",
  localApiUrl: `${useHttps ? "https" : "http"}://localhost:${port}`,
  ...(useHttps
    ? {
        https: {
          key: readFileSync(
            process.env.CG_TLS_KEY ?? join(localDir, "tls", "server.key"),
          ),
          cert: readFileSync(
            process.env.CG_TLS_CERT ?? join(localDir, "tls", "server.crt"),
          ),
          minVersion: "TLSv1.2",
        },
      }
    : {}),
});
const address = await app.listen({ host: process.env.HOST ?? "0.0.0.0", port });
console.log(
  `CoopGuard API listening at ${address}${useHttps ? " with origin TLS" : " behind a trusted TLS proxy"}. Authenticated telemetry is used after gateway provisioning; otherwise readings remain samples.`,
);
if (deploymentMode !== "cloud")
  console.log(
    `Developer console: ${useHttps ? "https" : "http"}://localhost:${port}/developer`,
  );
const syncTimer =
  deploymentMode === "hub" && db.sync
    ? setInterval(
        () => {
          void db.sync!().catch((error) =>
            console.error(
              "Hub sync failed; local operation continues:",
              error instanceof Error ? error.message : error,
            ),
          );
        },
        Number(process.env.CG_SYNC_INTERVAL_MS ?? 30_000),
      )
    : undefined;
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  if (syncTimer) clearInterval(syncTimer);
  await app.close();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", close);
process.on("SIGTERM", close);
