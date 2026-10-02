import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// OWASP scrypt option: N=2^17, r=8, p=1. Bound expensive jobs to two.
let running = 0;
async function derive(password: string, salt: Buffer): Promise<Buffer> {
  if (running >= 2)
    throw Object.assign(new Error("Please try again shortly."), {
      statusCode: 429,
    });
  running++;
  try {
    return await new Promise<Buffer>((resolve, reject) =>
      scrypt(
        password,
        salt,
        64,
        { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
        (error, key) => (error ? reject(error) : resolve(key)),
      ),
    );
  } finally {
    running--;
  }
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `scrypt-v1$${salt.toString("hex")}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [version, salt, hash] = encoded.split("$");
  if (
    version !== "scrypt-v1" ||
    !/^[a-f0-9]{32}$/.test(salt ?? "") ||
    !/^[a-f0-9]{128}$/.test(hash ?? "")
  )
    return false;
  return timingSafeEqual(
    await derive(password, Buffer.from(salt!, "hex")),
    Buffer.from(hash!, "hex"),
  );
}
export const temporaryPassword = () => randomBytes(18).toString("base64url");
