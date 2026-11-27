import "server-only";
// Email and password accounts, next to Auth.js's GitHub and Google sign-in.
// They share everything after the password check: the same "user" row, the
// same database session in "session" and the same cookie Auth.js reads, so
// auth(), currentUser(), the proxy's gate, sign-out and session expiry work
// the same whichever way someone signed in. Auth.js's own Credentials
// provider only works with JWT sessions, which is why this makes the session
// row itself, as Auth.js does for OAuth.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { passwordResets, passwords, sessions, users } from "@/db/schema";
import { secureSessionCookie, sessionCookieName } from "./auth-url";
import { normalizeEmail } from "./credentials";
import { clear, take } from "./limits";
import { clientIpFrom } from "./client-ip";
import {
  hashPassword,
  needsRehash,
  verifyPassword,
  burnVerify,
} from "./password";

/** Auth.js's defaults: a session lasts 30 days and is pushed back as it's used. */
const SESSION_DAYS = 30;
const RESET_MINUTES = 60;

// --- the session cookie ---------------------------------------------------------------

/** Auth.js's rule (lib/auth-url.ts), so auth() reads the cookie written here. */
async function secureCookies(): Promise<boolean> {
  return secureSessionCookie(process.env, (await headers()).get("x-forwarded-proto"));
}

export async function startSession(userId: string): Promise<void> {
  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  // Before the row: a broken AUTH_URL fails here, leaving no session behind.
  const secure = await secureCookies();
  await db.insert(sessions).values({ sessionToken, userId, expires });
  (await cookies()).set(
    sessionCookieName(secure),
    sessionToken,
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure,
      expires,
    },
  );
}

/** Signs out everywhere (a password reset or change), keeping `except` if given. */
async function endSessions(userId: string, except?: string): Promise<void> {
  const all = await db
    .select({ token: sessions.sessionToken })
    .from(sessions)
    .where(eq(sessions.userId, userId));
  for (const s of all)
    if (s.token !== except)
      await db.delete(sessions).where(eq(sessions.sessionToken, s.token));
}

async function currentSessionToken(): Promise<string | undefined> {
  const jar = await cookies();
  return (
    jar.get("__Secure-authjs.session-token")?.value ??
    jar.get("authjs.session-token")?.value
  );
}

// --- rate limits ---------------------------------------------------------------------

// Per address and per IP, shared by every instance (lib/limits.ts): ten tries
// for one account in 15 minutes, thirty tries of anything from one IP, three
// reset emails to one address an hour.
const FIFTEEN_MIN = 15 * 60_000;
const perEmail = async (key: string) => (await take(`auth:email:${key}`, 10, FIFTEEN_MIN)).ok;
const perIp = async (ip: string) => (await take(`auth:ip:${ip}`, 30, FIFTEEN_MIN)).ok;
const resetMails = async (email: string) => (await take(`auth:reset:${email}`, 3, 60 * 60_000)).ok;

async function ipKey(): Promise<string> {
  return clientIpFrom(await headers()) ?? "unknown";
}

export async function allowAttempt(email: string): Promise<boolean> {
  const ip = await ipKey();
  return (await perIp(ip)) && (await perEmail(normalizeEmail(email)));
}

// --- accounts ------------------------------------------------------------------------

async function userByEmail(email: string) {
  const [u] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      hash: passwords.hash,
    })
    .from(users)
    .leftJoin(passwords, eq(passwords.userId, users.id))
    .where(sql`lower(${users.email}) = ${normalizeEmail(email)}`)
    .limit(1);
  return u ?? null;
}

export type SignUpResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "taken" };

/** A new account with a password. One account per email, whichever way it was made. */
export async function createAccount(f: {
  name: string;
  email: string;
  password: string;
}): Promise<SignUpResult> {
  const email = normalizeEmail(f.email);
  if (await userByEmail(email)) return { ok: false, reason: "taken" };
  const hash = await hashPassword(f.password);
  try {
    const userId = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ name: f.name.trim(), email })
        .returning({ id: users.id });
      await tx.insert(passwords).values({ userId: u.id, hash });
      return u.id;
    });
    return { ok: true, userId };
  } catch (e) {
    // Two sign-ups for one address at once: the unique email decides.
    if (
      (e as { code?: string }).code === "23505" ||
      /unique/i.test(String((e as Error).message))
    )
      return { ok: false, reason: "taken" };
    throw e;
  }
}

export type SignInResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: "invalid" | "no-password" };

/** Checks an email and password. "no-password": the account exists but signs in with GitHub or Google. */
export async function checkPassword(
  rawEmail: string,
  password: string,
): Promise<SignInResult> {
  const u = await userByEmail(rawEmail);
  if (!u)
    return {
      ok: false,
      reason: await burnVerify(password).then(() => "invalid" as const),
    };
  if (!u.hash) {
    await burnVerify(password);
    return { ok: false, reason: "no-password" };
  }
  if (!(await verifyPassword(password, u.hash)))
    return { ok: false, reason: "invalid" };
  await clear(`auth:email:${normalizeEmail(rawEmail)}`);
  if (needsRehash(u.hash))
    await db
      .update(passwords)
      .set({ hash: await hashPassword(password), updatedAt: new Date() })
      .where(eq(passwords.userId, u.id));
  return { ok: true, userId: u.id, email: u.email ?? normalizeEmail(rawEmail) };
}

export async function hasPassword(userId: string): Promise<boolean> {
  const [p] = await db
    .select({ userId: passwords.userId })
    .from(passwords)
    .where(eq(passwords.userId, userId))
    .limit(1);
  return Boolean(p);
}

export type ChangeResult =
  | { ok: true }
  | { ok: false; reason: "wrong-current" | "limited" };

/**
 * Sets or changes the signed-in user's password. Changing one needs the
 * current password; setting a first one (an OAuth account) doesn't, since
 * they're already signed in. Every other session ends.
 */
export async function changePassword(
  userId: string,
  current: string | null,
  next: string,
): Promise<ChangeResult> {
  const [p] = await db
    .select({ hash: passwords.hash })
    .from(passwords)
    .where(eq(passwords.userId, userId))
    .limit(1);
  if (p) {
    if (!(await perEmail(`change:${userId}`)))
      return { ok: false, reason: "limited" };
    if (!current || !(await verifyPassword(current, p.hash)))
      return { ok: false, reason: "wrong-current" };
  }
  await setPassword(userId, next);
  await endSessions(userId, await currentSessionToken());
  return { ok: true };
}

async function setPassword(userId: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  await db
    .insert(passwords)
    .values({ userId, hash })
    .onConflictDoUpdate({
      target: passwords.userId,
      set: { hash, updatedAt: new Date() },
    });
}

// --- forgotten passwords ---------------------------------------------------------------

const sha256 = (t: string) => createHash("sha256").update(t).digest("hex");

/**
 * Makes a reset link for the account at `email` and mails it. Says nothing
 * about whether the account exists: the page shows the same message either
 * way. Returns the link in development without a mailer, so it can be shown.
 */
export async function requestReset(
  rawEmail: string,
  origin: string,
): Promise<{ devLink: string | null; limited: boolean }> {
  const email = normalizeEmail(rawEmail);
  if (!(await resetMails(email)) || !(await perIp(await ipKey())))
    return { devLink: null, limited: true };
  const u = await userByEmail(email);
  if (!u) return { devLink: null, limited: false };
  const token = randomBytes(32).toString("base64url");
  await db.delete(passwordResets).where(eq(passwordResets.userId, u.id));
  await db
    .insert(passwordResets)
    .values({
      tokenHash: sha256(token),
      userId: u.id,
      expires: new Date(Date.now() + RESET_MINUTES * 60_000),
    });
  const link = `${origin}/reset-password?token=${token}`;
  const sent = await sendResetMail(email, u.name, link);
  return {
    devLink: !sent && process.env.NODE_ENV === "development" ? link : null,
    limited: false,
  };
}

/** The account a reset token belongs to, while it's unused and in date. */
export async function resetTarget(
  token: string,
): Promise<{ userId: string; email: string | null } | null> {
  const [r] = await db
    .select({ userId: passwordResets.userId, email: users.email })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(
      and(
        eq(passwordResets.tokenHash, sha256(token)),
        gt(passwordResets.expires, new Date()),
      ),
    )
    .limit(1);
  return r ?? null;
}

/**
 * Uses a reset token: the new password, every old session ended, the email
 * marked confirmed (the link proved it), and a fresh session here.
 * Null when the token is unknown, used or expired.
 */
export async function completeReset(
  token: string,
  password: string,
): Promise<{ userId: string; email: string | null } | null> {
  const deleted = await db
    .delete(passwordResets)
    .where(eq(passwordResets.tokenHash, sha256(token)))
    .returning();
  const r = deleted[0];
  if (!r || r.expires.getTime() <= Date.now()) return null;
  await setPassword(r.userId, password);
  await db
    .update(users)
    .set({ emailVerified: new Date() })
    .where(eq(users.id, r.userId));
  await endSessions(r.userId);
  await startSession(r.userId);
  const [u] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, r.userId))
    .limit(1);
  return { userId: r.userId, email: u?.email ?? null };
}

// --- the email --------------------------------------------------------------------------

/** Whether "forgot password" can work here: a mailer, or development (the link is shown on the page). */
export function resetAvailable(): boolean {
  return (
    Boolean(process.env.RESEND_API_KEY) ||
    process.env.NODE_ENV === "development"
  );
}

const FROM = () =>
  process.env.PRSCOUT_AUTH_EMAIL_FROM ||
  process.env.PRSCOUT_ALERT_EMAIL_FROM ||
  "PRScout <account@gitprscout.com>";

/** Sends the reset email through Resend, as the API server sends PRScout's other email. False when there's no mailer. */
async function sendResetMail(
  to: string,
  name: string | null,
  link: string,
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "development")
      console.info(
        `[PRScout] password reset link (no RESEND_API_KEY, development): ${link}`,
      );
    return false;
  }
  const hello = name ? `Hi ${name.split(/\s+/)[0]},` : "Hi,";
  const text = `${hello}\n\nSomeone asked to reset the password for your PRScout account. If it was you, choose a new one here (the link works once, for an hour):\n\n${link}\n\nIf it wasn't you, ignore this email: your password stays as it is.\n\nprscout`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#0f1b22;max-width:480px">
<p>${escapeHtml(hello)}</p>
<p>Someone asked to reset the password for your PRScout account. If it was you, choose a new one. The link works once, for an hour.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#0f5d78;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Choose a new password</a></p>
<p style="color:#4b5a63">If it wasn't you, ignore this email: your password stays as it is.</p></div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": sha256(link),
      },
      body: JSON.stringify({
        from: FROM(),
        to: [to],
        subject: "Reset your PRScout password",
        text,
        html,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok)
      console.error(
        `[PRScout] reset email not sent: Resend answered ${res.status}`,
      );
    return res.ok;
  } catch (e) {
    console.error("[PRScout] reset email not sent:", (e as Error).message);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
