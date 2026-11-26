"use server";
// The email and password forms' server actions (sign up, sign in, forgot,
// reset, change). Each checks its input again here (lib/credentials.ts) and
// answers with field errors, or a whole-form message, for the form to show.
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { reportSignIn } from "./api";
import {
  allowAttempt,
  changePassword,
  checkPassword,
  completeReset,
  createAccount,
  requestReset,
  resetAvailable,
  resetTarget,
  startSession,
} from "./credentials-auth";
import {
  emailError,
  isResetToken,
  normalizeEmail,
  resetErrors,
  signInErrors,
  signUpErrors,
  type FieldErrors,
} from "./credentials";
import { afterSignIn } from "./home";
import { currentUser } from "./session";

export interface FormState {
  errors?: FieldErrors;
  /** A message about the whole form. `code` lets the form add a link ("sign in instead"). */
  message?: {
    tone: "error" | "success";
    title: string;
    body?: string;
    code?: "taken" | "no-password" | "expired";
  };
  /** What was typed, sent back so a failed submit doesn't empty the form (never a password). */
  values?: { name?: string; email?: string };
  /** Development without a mailer: the reset link, shown on the page. */
  devLink?: string;
  ok?: boolean;
}

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v : "";
};

const TOO_MANY = {
  tone: "error",
  title: "Too many tries",
  body: "Wait a few minutes, then try again.",
} as const;
const BROKEN = {
  tone: "error",
  title: "Something went wrong on our side",
  body: "Your details weren't saved. Try again in a minute.",
} as const;

async function told(userId: string, email: string | null, first: boolean) {
  // The API server sends the welcome email from this; a failure must not block sign-in.
  try {
    await reportSignIn(userId, email, first);
  } catch (e) {
    console.error("[PRScout] sign-in report failed:", (e as Error).message);
  }
}

export async function signInWithPassword(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const email = str(form, "email");
  const password = str(form, "password");
  const values = { email };
  const errors = signInErrors({ email, password });
  if (Object.keys(errors).length) return { errors, values };
  if (!(await allowAttempt(email))) return { message: TOO_MANY, values };

  let result;
  try {
    result = await checkPassword(email, password);
    if (result.ok) await startSession(result.userId);
  } catch (e) {
    console.error("[PRScout] password sign-in failed:", (e as Error).message);
    return { message: BROKEN, values };
  }
  if (!result.ok) {
    return result.reason === "no-password"
      ? {
          values,
          message: {
            tone: "error",
            code: "no-password",
            title: "This account signs in with GitHub or Google",
            body: "Use the button you signed up with, or reset the password to add one.",
          },
        }
      : {
          values,
          message: {
            tone: "error",
            title: "That email and password don't match",
            body: "Check them and try again, or reset your password.",
          },
        };
  }
  await told(result.userId, result.email, false);
  redirect(afterSignIn(str(form, "callbackUrl")));
}

export async function signUpWithPassword(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const name = str(form, "name");
  const email = str(form, "email");
  const password = str(form, "password");
  const values = { name, email };
  const errors = signUpErrors({ name, email, password });
  if (Object.keys(errors).length) return { errors, values };
  if (!(await allowAttempt(email))) return { message: TOO_MANY, values };

  let made;
  try {
    made = await createAccount({ name, email, password });
    if (made.ok) await startSession(made.userId);
  } catch (e) {
    console.error("[PRScout] sign-up failed:", (e as Error).message);
    return { message: BROKEN, values };
  }
  if (!made.ok) {
    return {
      values,
      errors: { email: "There's already an account with this email." },
      message: {
        tone: "error",
        code: "taken",
        title: "You already have an account",
        body: "Sign in with it instead, or reset its password if you've forgotten it.",
      },
    };
  }
  await told(made.userId, normalizeEmail(email), true);
  redirect(afterSignIn(str(form, "callbackUrl")));
}

/** This site's origin for links in email: AUTH_URL when set (production requires it), else the request's. */
async function origin(): Promise<string> {
  const env = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (env) return new URL(env).origin;
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  return `${proto}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
}

export async function forgotPassword(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const email = str(form, "email");
  const values = { email };
  const err = emailError(email);
  if (err) return { errors: { email: err }, values };
  if (!resetAvailable())
    return {
      values,
      message: {
        tone: "error",
        title: "Password reset isn't available here",
        body: "Email isn't set up on this server.",
      },
    };
  try {
    const r = await requestReset(email, await origin());
    if (r.limited) return { message: TOO_MANY, values };
    return {
      ok: true,
      values,
      devLink: r.devLink ?? undefined,
      message: {
        tone: "success",
        title: "Check your inbox",
        body: `If there's a PRScout account for ${normalizeEmail(email)}, a link to choose a new password is on its way. It works once, for an hour.`,
      },
    };
  } catch (e) {
    console.error("[PRScout] reset request failed:", (e as Error).message);
    return { message: BROKEN, values };
  }
}

const EXPIRED = {
  tone: "error",
  code: "expired",
  title: "This reset link has expired",
  body: "Links work once and only for an hour. Ask for a new one.",
} as const;

export async function resetPassword(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const token = str(form, "token");
  const password = str(form, "password");
  const confirm = str(form, "confirm");
  if (!isResetToken(token)) return { message: EXPIRED };
  let target;
  try {
    target = await resetTarget(token);
  } catch (e) {
    console.error("[PRScout] reset lookup failed:", (e as Error).message);
    return { message: BROKEN };
  }
  if (!target) return { message: EXPIRED };
  const errors = resetErrors({ password, confirm, email: target.email ?? "" });
  if (Object.keys(errors).length) return { errors };
  let done;
  try {
    done = await completeReset(token, password);
  } catch (e) {
    console.error("[PRScout] reset failed:", (e as Error).message);
    return { message: BROKEN };
  }
  if (!done) return { message: EXPIRED };
  await told(done.userId, done.email, false);
  redirect("/settings/accounts?password=reset");
}

export async function updatePassword(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await currentUser();
  if (!user) redirect("/signin?callbackUrl=%2Fsettings%2Faccounts");
  const current = str(form, "current");
  const password = str(form, "password");
  const confirm = str(form, "confirm");
  const errors = resetErrors({ password, confirm, email: user.email ?? "" });
  if (form.has("current") && !current)
    errors.current = "Enter your current password.";
  if (Object.keys(errors).length) return { errors };
  try {
    const r = await changePassword(
      user.id,
      form.has("current") ? current : null,
      password,
    );
    if (!r.ok)
      return r.reason === "limited"
        ? { message: TOO_MANY }
        : { errors: { current: "That isn't your current password." } };
  } catch (e) {
    console.error("[PRScout] password change failed:", (e as Error).message);
    return { message: BROKEN };
  }
  revalidatePath("/settings/accounts");
  return {
    ok: true,
    message: {
      tone: "success",
      title: "Password saved",
      body: "You're still signed in here. Every other device was signed out.",
    },
  };
}
