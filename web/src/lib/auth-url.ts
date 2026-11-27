// AUTH_URL (or NEXTAUTH_URL) is the site's public address. Auth.js parses it
// on every session lookup, and the password forms read it to name the session
// cookie. A value that isn't a full address ("example.com" with no https://,
// quotes pasted with it, a placeholder) throws "Invalid URL" in each of those
// places: sign-up and sign-in fail after the account is saved, and every page
// sees a signed-in visitor as signed out. So it is checked before the site
// runs (next.config.ts, instrumentation.ts) instead.
// No runtime imports: it runs under `node --test` and in next.config.ts.

type Env = Record<string, string | undefined>;

/** The variable Auth.js reads (AUTH_URL first), or undefined when neither is set. */
export function authUrlSetting(env: Env): { name: string; value: string } | undefined {
  // Auth.js reads `AUTH_URL ?? NEXTAUTH_URL`: an empty AUTH_URL still wins,
  // and an empty value means "use the request's address".
  if (env.AUTH_URL !== undefined) return env.AUTH_URL ? { name: "AUTH_URL", value: env.AUTH_URL } : undefined;
  return env.NEXTAUTH_URL ? { name: "NEXTAUTH_URL", value: env.NEXTAUTH_URL } : undefined;
}

/** What's wrong with AUTH_URL, in a sentence for a log, or null when it's fine or unset. */
export function authUrlProblem(env: Env): string | null {
  const s = authUrlSetting(env);
  if (!s) return null;
  const example = "a full address such as https://your-site.vercel.app";
  let u: URL;
  try {
    u = new URL(s.value);
  } catch {
    const hint = /^["']|["']$/.test(s.value.trim())
      ? " (remove the quotes around it)"
      : !/^[a-z][a-z0-9+.-]*:\/\//i.test(s.value.trim())
        ? " (it needs https:// in front)"
        : "";
    return `${s.name} is not a valid address${hint}. Set it to ${example}.`;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:")
    return `${s.name} must start with https:// (or http:// on your own machine). Set it to ${example}.`;
  return null;
}

/**
 * Whether the session cookie gets the __Secure- prefix: Auth.js's rule, so the
 * cookie a password sign-in writes is the one auth() reads. https in AUTH_URL
 * when it is set, else the protocol the request arrived on.
 */
export function secureSessionCookie(env: Env, forwardedProto: string | null | undefined): boolean {
  const s = authUrlSetting(env);
  if (s) return new URL(s.value).protocol === "https:";
  // Auth.js: x-forwarded-proto, else https.
  const proto = forwardedProto?.split(",")[0]?.trim();
  return (proto || "https") === "https";
}

export function sessionCookieName(secure: boolean): string {
  return secure ? "__Secure-authjs.session-token" : "authjs.session-token";
}
