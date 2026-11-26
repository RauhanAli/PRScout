// A small in-memory fixed-window limiter. Per process only, so on its own it
// suits a single long-running server; lib/limits.ts keeps the shared count in
// Postgres and falls back to this when the database can't be reached.
const g = globalThis as unknown as {
  prscoutRate?: Map<string, { n: number; reset: number }>;
};
const hits = (g.prscoutRate ??= new Map());

export type Limited = { ok: true } | { ok: false; retryAfter: number };

export function rateLimit(key: string, limit: number, windowMs = 60_000): Limited {
  const now = Date.now();
  const e = hits.get(key);
  if (!e || e.reset <= now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    if (hits.size > 10_000)
      for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    return { ok: true };
  }
  if (e.n >= limit)
    return { ok: false, retryAfter: Math.ceil((e.reset - now) / 1000) };
  e.n++;
  return { ok: true };
}

/** Forget a key's count (a good sign-in clears that address's wrong-password tries). */
export function clearRateLimit(key: string): void {
  hits.delete(key);
}
