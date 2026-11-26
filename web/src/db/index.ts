import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url =
  process.env.DATABASE_URL ??
  "postgres://prscout:prscout@127.0.0.1:5432/prscout";

// Serverless (Vercel) runs many short-lived copies of the app, each with its
// own pool, so each keeps few connections and lets idle ones go. DATABASE_URL
// there should be the provider's pooled address (Neon: the "-pooler" host),
// which runs in transaction mode: prepared statements don't survive it, so
// they're off. Migrations use the direct address instead (drizzle.config.ts).
const serverless = process.env.VERCEL === "1";
const pooled = serverless || /-pooler\.|pgbouncer=true/.test(url);

// One pool per process, reused across dev hot reloads and warm invocations.
const globalForDb = globalThis as unknown as {
  prscoutSql?: ReturnType<typeof postgres>;
};
const sql =
  globalForDb.prscoutSql ??
  postgres(url, {
    max: serverless ? 3 : 5,
    connect_timeout: 10,
    idle_timeout: serverless ? 20 : undefined,
    prepare: !pooled,
  });
globalForDb.prscoutSql = sql;

export const db = drizzle(sql, { schema });
