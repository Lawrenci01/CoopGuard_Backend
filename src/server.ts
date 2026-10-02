import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "./database";
import { createApp } from "./app";
import { databasePath, localDir } from "./config";

const db = openDatabase(databasePath);
const useHttps = process.env.CG_HTTPS !== "false";
const app = await createApp(db, {
  trustProxy: process.env.CG_TRUST_PROXY === "true",
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
const port = Number(process.env.PORT ?? 8443);
const address = await app.listen({ host: process.env.HOST ?? "0.0.0.0", port });
console.log(
  `CoopGuard API listening at ${address}${useHttps ? " with origin TLS" : " behind a trusted TLS proxy"}. Farm readings are samples; accounts and saved records use SQLite.`,
);
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await app.close();
  db.close();
  process.exit(0);
};
process.on("SIGINT", close);
process.on("SIGTERM", close);
