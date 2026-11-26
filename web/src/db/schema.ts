// Auth.js tables (users, accounts, sessions, verification tokens).
// Shape follows @auth/drizzle-adapter's default Postgres schema.
import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// Email and password sign-in (lib/password.ts, lib/credentials-auth.ts). Kept
// apart from "user" so the Auth.js adapter, which reads every column of
// "user" into the session, never carries a password hash. One per user.
export const passwords = pgTable("password", {
  userId: text("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  hash: text("hash").notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

// "Forgot password" links. Only a SHA-256 of the token is stored, so a leaked
// table can't be used to reset anyone's password. Each works once, for an hour.
export const passwordResets = pgTable("password_reset", {
  tokenHash: text("tokenHash").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

// Rate limits shared by every instance of the app (lib/limits.ts). A
// serverless host runs many short-lived copies, so a count kept in one
// process's memory would let each copy allow the full limit. One row per key
// per window: `hits` so far, and when the window ends. Expired rows are
// overwritten on the next hit and swept now and then.
export const rateLimits = pgTable("rate_limit", {
  key: text("key").primaryKey(),
  hits: integer("hits").notNull(),
  resetAt: timestamp("resetAt", { mode: "date", withTimezone: true }).notNull(),
});
