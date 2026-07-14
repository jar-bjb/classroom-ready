import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt password hashing (no native dependency). Used only in Node-runtime
// route handlers (login, activation) — never in middleware.
function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

const COST_N = 16384;
const BLOCK_R = 8;
const PARALLEL_P = 1;
const KEY_LENGTH = 64;
const MAX_MEM = 64 * 1024 * 1024;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(plain, salt, KEY_LENGTH, {
    N: COST_N,
    r: BLOCK_R,
    p: PARALLEL_P,
    maxmem: MAX_MEM,
  });
  return `scrypt$${COST_N}$${BLOCK_R}$${PARALLEL_P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p) || expected.length === 0) {
    return false;
  }

  const derived = await scrypt(plain, salt, expected.length, { N: n, r, p, maxmem: MAX_MEM });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
