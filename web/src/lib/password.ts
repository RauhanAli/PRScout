// Password hashing with scrypt (node:crypto, no extra dependency).
// Stored as "scrypt$<N>$<r>$<p>$<salt b64>$<hash b64>" so the cost can be
// raised later: verifyPassword reads it from the hash, and needsRehash says
// when a sign-in should store a fresh one. No imports outside node, so it
// runs under `node --test`.
import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

// OWASP's scrypt floor is N=2^17, r=8, p=1 (128 MiB). maxmem must cover 128·N·r.
const COST = { N: 2 ** 17, r: 8, p: 1 };
const KEY_LEN = 32;
const SALT_LEN = 16;

function derive(
  password: string,
  salt: Buffer,
  o: { N: number; r: number; p: number },
): Promise<Buffer> {
  const opts: ScryptOptions = {
    N: o.N,
    r: o.r,
    p: o.p,
    maxmem: 256 * o.N * o.r,
  };
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LEN, opts, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(
  password: string,
  cost = COST,
): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await derive(password, salt, cost);
  return [
    "scrypt",
    cost.N,
    cost.r,
    cost.p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

function parse(stored: string) {
  const [alg, n, r, p, salt, key] = stored.split("$");
  if (alg !== "scrypt" || !salt || !key) return null;
  const cost = { N: Number(n), r: Number(r), p: Number(p) };
  if (![cost.N, cost.r, cost.p].every((x) => Number.isInteger(x) && x > 0))
    return null;
  return {
    cost,
    salt: Buffer.from(salt, "base64"),
    key: Buffer.from(key, "base64"),
  };
}

/** Whether `password` matches `stored`. A malformed hash never matches. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const h = parse(stored);
  if (!h) return false;
  const key = await derive(password, h.salt, h.cost);
  return key.length === h.key.length && timingSafeEqual(key, h.key);
}

/** A hash made with a lower cost than today's: store a new one after a good sign-in. */
export function needsRehash(stored: string, cost = COST): boolean {
  const h = parse(stored);
  return !h || h.cost.N < cost.N || h.cost.r < cost.r || h.cost.p < cost.p;
}

// Hashed once, lazily: sign-in for an email with no password still pays for a
// verify, so the response time doesn't say whether the account exists.
let decoy: Promise<string> | null = null;
export async function burnVerify(password: string): Promise<false> {
  decoy ??= hashPassword("prscout-decoy-password");
  await verifyPassword(password, await decoy);
  return false;
}
