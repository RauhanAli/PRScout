// What the sign-up, sign-in and password forms accept, checked the same way in
// the browser (as you type) and on the server (which decides). Pure, so it
// runs under `node --test`.

export const PASSWORD_MIN = 8;
// scrypt takes any length; this only stops a megabyte "password" from costing a request.
export const PASSWORD_MAX = 128;
export const NAME_MAX = 60;
const EMAIL_MAX = 254;

export type Field = "name" | "email" | "password" | "confirm" | "current";
export type FieldErrors = Partial<Record<Field, string>>;

/** Emails are compared lowercased and trimmed, so "Ana@X.com " and "ana@x.com" are one account. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Deliberately loose: one @, something on each side, a dot in the domain, no spaces.
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function emailError(raw: string): string | undefined {
  const email = normalizeEmail(raw);
  if (!email) return "Enter your email address.";
  if (email.length > EMAIL_MAX || !EMAIL.test(email)) return "That doesn't look like an email address.";
  return undefined;
}

export function nameError(raw: string): string | undefined {
  const name = raw.trim();
  if (!name) return "Enter your name.";
  if (name.length > NAME_MAX) return `Keep it under ${NAME_MAX} characters.`;
  return undefined;
}

export function newPasswordError(password: string, email = ""): string | undefined {
  if (!password) return "Choose a password.";
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  if (/^\s|\s$/.test(password)) return "Leave out spaces at the start or end.";
  if (new Set(password).size < 4) return "Use a mix of characters, not one repeated.";
  if (email && password.toLowerCase() === normalizeEmail(email)) return "Don't use your email address as the password.";
  return undefined;
}

/** A rough 0–4 for the strength meter. Only a hint: newPasswordError decides what's allowed. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (password.length < PASSWORD_MIN) return 0;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  let score = (password.length >= 12 ? 2 : 1) + (kinds >= 3 ? 1 : 0) + (password.length >= 16 && kinds >= 2 ? 1 : 0);
  if (new Set(password).size < 6) score = Math.min(score, 1);
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}

export const STRENGTH_LABEL = ["Too short", "Weak", "Fair", "Good", "Strong"] as const;

export function signUpErrors(f: { name: string; email: string; password: string }): FieldErrors {
  const e: FieldErrors = { name: nameError(f.name), email: emailError(f.email), password: newPasswordError(f.password, f.email) };
  return prune(e);
}

export function signInErrors(f: { email: string; password: string }): FieldErrors {
  return prune({ email: emailError(f.email), password: f.password ? undefined : "Enter your password." });
}

export function resetErrors(f: { password: string; confirm: string; email?: string }): FieldErrors {
  const password = newPasswordError(f.password, f.email);
  return prune({ password, confirm: !password && f.confirm !== f.password ? "The passwords don't match." : undefined });
}

function prune(e: FieldErrors): FieldErrors {
  return Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as FieldErrors;
}

/** Reset tokens are 32 random bytes in base64url: 43 characters. */
export function isResetToken(t: unknown): t is string {
  return typeof t === "string" && /^[A-Za-z0-9_-]{43}$/.test(t);
}
