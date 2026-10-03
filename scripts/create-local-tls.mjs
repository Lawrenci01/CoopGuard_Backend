import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const root = fileURLToPath(new URL("../.local/tls/", import.meta.url));
mkdirSync(root, { recursive: true });
const executable =
  process.env.OPENSSL_PATH ??
  (process.platform === "win32"
    ? "C:\\Program Files\\Git\\usr\\bin\\openssl.exe"
    : "openssl");
function run(args) {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0)
    throw new Error(result.stderr || result.error?.message || "OpenSSL failed");
}
const ca = join(root, "ca.crt"),
  key = join(root, "ca.key");
if (!existsSync(ca) || !existsSync(key)) {
  if (existsSync(ca) || existsSync(key))
    throw new Error(
      "Incomplete CA files. Restore the matching CA certificate/key before continuing.",
    );
  run([
    "req",
    "-x509",
    "-newkey",
    "rsa:3072",
    "-nodes",
    "-sha256",
    "-days",
    "3650",
    "-keyout",
    key,
    "-out",
    ca,
    "-subj",
    "/CN=CoopGuard Local Development CA",
    "-addext",
    "basicConstraints=critical,CA:TRUE",
    "-addext",
    "keyUsage=critical,keyCertSign,cRLSign",
  ]);
}
const ips = [
  ...new Set([
    "127.0.0.1",
    ...Object.values(networkInterfaces())
      .flat()
      .filter((a) => a?.family === "IPv4" && !a.internal)
      .map((a) => a.address),
  ]),
];
const serverKey = join(root, "server.key"),
  request = join(root, "server.csr"),
  extension = join(root, "server.ext");
run([
  "req",
  "-new",
  "-newkey",
  "rsa:2048",
  "-nodes",
  "-keyout",
  serverKey,
  "-out",
  request,
  "-subj",
  "/CN=CoopGuard Local API",
]);
writeFileSync(
  extension,
  `basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:localhost,${ips.map((ip) => `IP:${ip}`).join(",")}\n`,
);
run([
  "x509",
  "-req",
  "-in",
  request,
  "-CA",
  ca,
  "-CAkey",
  key,
  "-CAcreateserial",
  "-out",
  join(root, "server.crt"),
  "-days",
  "365",
  "-sha256",
  "-extfile",
  extension,
]);
console.log(
  `Local TLS ready. Public app trust certificate: ${ca}\nAddresses: ${ips.join(", ")}`,
);
