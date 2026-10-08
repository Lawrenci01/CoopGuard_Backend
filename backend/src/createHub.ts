import { writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import QRCode from "qrcode";
import { localDir, turso } from "./config";
import { openDatabase } from "./database";
import { createHubPairing } from "./hubPairing";

const { values } = parseArgs({
  options: {
    wifi: { type: "string" },
    usb: { type: "string", default: "https://localhost:8443" },
    output: { type: "string", default: resolve(localDir, "hub-config.json") },
  },
});

const privateAddresses = Object.values(networkInterfaces())
  .flatMap((items) => items ?? [])
  .filter(
    (item) =>
      item.family === "IPv4" &&
      !item.internal &&
      (/^10\./.test(item.address) ||
        /^192\.168\./.test(item.address) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(item.address)),
  )
  .map((item) => item.address);
const wifiUrl =
  values.wifi ??
  (privateAddresses[0] ? `https://${privateAddresses[0]}:8443` : undefined);
if (!wifiUrl)
  throw new Error(
    "No private laptop address was found. Run again with --wifi https://YOUR-LAPTOP-IP:8443.",
  );

if (!turso)
  throw new Error(
    "Laptop hub pairing requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN so farms, accounts, devices, and readings use the same cloud-synchronized database.",
  );
const databasePath =
  process.env.CG_DB_PATH ?? resolve(localDir, "coopguard-hub-sync.sqlite");
const db = await openDatabase(databasePath, turso, "hub");
try {
  const pairing = await createHubPairing(db, { wifiUrl, usbUrl: values.usb! });
  await db.sync?.();
  const output = resolve(values.output!);
  writeFileSync(output, `${JSON.stringify(pairing.config, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  writeFileSync(`${output}.pairing.txt`, `${pairing.qr}\n`, "utf8");
  writeFileSync(
    `${output}.qr.svg`,
    await QRCode.toString(pairing.qr, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
    }),
    "utf8",
  );
  console.log(
    await QRCode.toString(pairing.qr, { type: "terminal", small: true }),
  );
  console.log(`Hub created: ${pairing.config.hubId}`);
  console.log(`Wi-Fi address: ${wifiUrl}`);
  console.log(`USB address: ${values.usb}`);
  console.log(`Private simulator config: ${output}`);
  console.log(`Pairing QR image: ${output}.qr.svg`);
  console.log(
    "The QR expires in 15 minutes and can be claimed by only one farm.",
  );
} finally {
  await db.close();
}
