import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import QRCode from "qrcode";
import { localDir, turso } from "./config";
import { openDatabase } from "./database";
import {
  createHubPairing,
  refreshHubPairing,
  type HubPrivateConfig,
} from "./hubPairing";

const { values } = parseArgs({
  options: {
    wifi: { type: "string" },
    usb: { type: "string", default: "https://localhost:8443" },
    "hotspot-config": {
      type: "string",
      default: resolve(localDir, "hotspot-config.json"),
    },
    output: { type: "string", default: resolve(localDir, "hub-config.json") },
    "new-identity": { type: "boolean", default: false },
  },
});

type HotspotConfig = {
  ssid: string;
  passphrase: string;
  wifiUrl: string;
};
const hotspotPath = resolve(values["hotspot-config"]!);
let hotspot: HotspotConfig | undefined;
if (existsSync(hotspotPath)) {
  const parsed = JSON.parse(readFileSync(hotspotPath, "utf8")) as Partial<HotspotConfig>;
  if (
    typeof parsed.ssid !== "string" ||
    parsed.ssid.length < 1 ||
    parsed.ssid.length > 32 ||
    typeof parsed.passphrase !== "string" ||
    parsed.passphrase.length < 8 ||
    parsed.passphrase.length > 63 ||
    typeof parsed.wifiUrl !== "string" ||
    new URL(parsed.wifiUrl).protocol !== "https:"
  )
    throw new Error(`The hotspot configuration is invalid: ${hotspotPath}`);
  hotspot = parsed as HotspotConfig;
}

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
  hotspot?.wifiUrl ??
  (privateAddresses[0] ? `https://${privateAddresses[0]}:8443` : undefined);
if (!wifiUrl)
  throw new Error(
    "No private laptop address was found. Run again with --wifi https://YOUR-LAPTOP-IP:8443.",
  );

if (!turso)
  throw new Error(
    "Laptop hub pairing requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN so farms, accounts, devices, and readings use the same cloud-synchronized database.",
  );
if (
  new URL(turso.url).protocol !== "libsql:" ||
  /your-database|example/i.test(turso.url)
)
  throw new Error(
    "Replace the TURSO_DATABASE_URL placeholder with the exact libsql:// database URL used by Render.",
  );
const databasePath =
  process.env.CG_DB_PATH ?? resolve(localDir, "coopguard-hub-sync.sqlite");
const db = await openDatabase(databasePath, turso, "hub");
try {
  const endpoints = {
    wifiUrl,
    usbUrl: values.usb!,
    ...(hotspot
      ? { hotspot: { ssid: hotspot.ssid, passphrase: hotspot.passphrase } }
      : {}),
  };
  const output = resolve(values.output!);
  let savedConfig: HubPrivateConfig | undefined;
  if (existsSync(output) && !values["new-identity"]) {
    const parsed = JSON.parse(readFileSync(output, "utf8")) as Partial<HubPrivateConfig>;
    if (
      parsed.schemaVersion !== 1 ||
      typeof parsed.hubId !== "string" ||
      !/^HUB-[A-Z0-9-]{6,48}$/.test(parsed.hubId) ||
      typeof parsed.hubSecret !== "string" ||
      parsed.hubSecret.length < 32 ||
      !Array.isArray(parsed.nodes)
    )
      throw new Error(
        `The saved hub identity is invalid: ${output}. Repair it or use --new-identity intentionally.`,
      );
    savedConfig = parsed as HubPrivateConfig;
  }
  const pairing = savedConfig
    ? await refreshHubPairing(db, savedConfig, endpoints)
    : await createHubPairing(db, endpoints);
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
  try {
    await db.sync?.();
  } catch (error) {
    console.warn(
      `Pairing was saved to the local replica. Cloud synchronization will retry after the hub starts: ${error instanceof Error ? error.message : "sync failed"}`,
    );
  }
  console.log(
    await QRCode.toString(pairing.qr, { type: "terminal", small: true }),
  );
  console.log(
    `${savedConfig ? "Hub pairing refreshed" : "Hub created"}: ${pairing.config.hubId}`,
  );
  console.log(`Wi-Fi address: ${wifiUrl}`);
  if (hotspot) console.log(`Hub hotspot: ${hotspot.ssid}`);
  console.log(`USB address: ${values.usb}`);
  console.log(`Private simulator config: ${output}`);
  console.log(`Pairing QR image: ${output}.qr.svg`);
  console.log(
    "The QR expires in 15 minutes and can be claimed by only one farm.",
  );
} finally {
  await db.close();
}
