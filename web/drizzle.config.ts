import { defineConfig } from "drizzle-kit";

// Migrations run over a direct connection: a pooler in transaction mode
// (Neon's "-pooler" host) can't hold the session a migration needs.
// DATABASE_URL_UNPOOLED is the name Vercel's Neon integration gives it.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      "postgres://prscout:prscout@127.0.0.1:5432/prscout",
  },
});
