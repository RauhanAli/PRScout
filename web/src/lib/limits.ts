import "server-only";
// Rate limits every instance of the app shares, counted in Postgres
// ("rate_limit", see db/schema.ts). Serverless hosts run many copies of the
// app at once and start fresh ones all the time, so a count in memory would
// be per copy. One statement per hit: it starts a new window when the old one
// has ended, else adds one, and says where the count now stands.
//
// If the database can't be reached the limit is kept in this process's memory
// instead (lib/rate-limit.ts): looser, but a broken database must not lock
// everyone out of signing in, and it's logged.
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { clearRateLimit, rateLimit, type Limited } from "./rate-limit";

export type { Limited } from "./rate-limit";

let warned = 0;
function fallback(key: string, max: number, windowMs: number, e: unknown): Limited {
  if (Date.now() - warned > 60_000) {
    warned = Date.now();
    console.error("[PRScout] rate limit store unavailable, counting in memory:", (e as Error).message);
  }
  return rateLimit(key, max, windowMs);
}

/** Count one hit on `key`: allowed while there have been at most `max` in the current `windowMs`. */
export async function take(key: string, max: number, windowMs: number): Promise<Limited> {
  try {
    const rows = await db.execute<{ hits: number; retry: number }>(sql`
      insert into rate_limit (key, hits, "resetAt")
      values (${key}, 1, now() + ${`${windowMs} milliseconds`}::interval)
      on conflict (key) do update set
        hits = case when rate_limit."resetAt" <= now() then 1 else rate_limit.hits + 1 end,
        "resetAt" = case when rate_limit."resetAt" <= now() then excluded."resetAt" else rate_limit."resetAt" end
      returning hits, ceil(extract(epoch from ("resetAt" - now())))::int as retry`);
    const row = rows[0];
    // Now and then (about one hit in 200), sweep windows that ended over an hour ago.
    if (Math.random() < 0.005)
      void db.execute(sql`delete from rate_limit where "resetAt" < now() - interval '1 hour'`).catch(() => {});
    if (!row || row.hits <= max) return { ok: true };
    return { ok: false, retryAfter: Math.max(1, row.retry) };
  } catch (e) {
    return fallback(key, max, windowMs, e);
  }
}

/** Forget `key`'s count. */
export async function clear(key: string): Promise<void> {
  clearRateLimit(key);
  try {
    await db.execute(sql`delete from rate_limit where key = ${key}`);
  } catch {
    // The window ends by itself.
  }
}
