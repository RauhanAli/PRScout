import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { devSignInEnabled, oauthProviders, signIn } from "@/auth";
import { SignInForm } from "@/components/auth/auth-forms";
import { AuthShell, OrRule } from "@/components/auth/auth-shell";
import { resetAvailable } from "@/lib/credentials-auth";
import { afterSignIn } from "@/lib/home";
import { currentUser } from "@/lib/session";
import { SIGN_IN_HEADING, signInHeading, signInNotice } from "@/lib/signin";
import {
  PROVIDER_ICONS,
  ProviderButtons,
  type Provider,
} from "./provider-buttons";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

// GitHub first: it's where PRScout's readers already have an account.
const PROVIDERS = [
  { id: "github", name: "GitHub" },
  { id: "google", name: "Google" },
];

export default async function SignInPage({
  searchParams,
}: PageProps<"/signin">) {
  const sp = await searchParams;
  // Back to where you signed in from, else your home (/me).
  const callbackUrl = afterSignIn(sp.callbackUrl);
  if (await currentUser()) redirect(callbackUrl);
  const configured = new Set(oauthProviders.map((p) => p.id));
  // Signed out, but this browser still has a session cookie: the session ended
  // (expired, or a password change signed it out), which is worth saying.
  const stale = (await cookies())
    .getAll()
    .some((c) => /^(__Secure-)?authjs\.session-token/.test(c.name));
  const notice = signInNotice(
    sp.error ?? (stale ? "SessionExpired" : undefined),
  );
  // Worded from the callback (lib/signin.ts); a longer heading is set smaller.
  const heading = signInHeading(sp.callbackUrl);
  const email = typeof sp.email === "string" ? sp.email.slice(0, 254) : "";
  const back =
    typeof sp.callbackUrl === "string"
      ? `?callbackUrl=${encodeURIComponent(sp.callbackUrl)}`
      : "";

  // Only the providers set up on this server; email and password always works.
  const providers: Provider[] = PROVIDERS.filter((p) =>
    configured.has(p.id),
  ).map((p) => ({
    ...p,
    icon: PROVIDER_ICONS[p.id],
    action: async () => {
      "use server";
      await signIn(p.id, { redirectTo: callbackUrl });
    },
  }));

  return (
    <AuthShell
      title={heading === SIGN_IN_HEADING ? "Welcome back" : heading}
      titleSize={heading === SIGN_IN_HEADING ? "lg" : "md"}
      lede="Sign in to see your saved repos, your pull requests and the checks you've run."
      footer={
        <p>
          New to PRScout?{" "}
          <Link href={`/signup${back}`} className="text-link">
            Create an account
          </Link>
        </p>
      }
    >
      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className="auth-message mb-6"
          data-tone={notice.tone === "error" ? "error" : "info"}
        >
          <p className="font-semibold">{notice.title}</p>
          {notice.body && <p className="mt-0.5 text-muted">{notice.body}</p>}
        </div>
      )}

      {providers.length > 0 && (
        <>
          <ProviderButtons providers={providers} />
          <OrRule>or sign in with email</OrRule>
        </>
      )}

      <SignInForm
        callbackUrl={callbackUrl}
        initialEmail={email}
        resetAvailable={resetAvailable()}
      />

      {devSignInEnabled && (
        <details className="auth-dev mt-6">
          <summary className="cursor-pointer font-semibold text-amber">
            Development shortcut
          </summary>
          <form action="/api/dev-signin" method="post" className="mt-3">
            <p className="text-muted">
              No OAuth app is configured, so you can also sign in as a local
              test user.
            </p>
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <label htmlFor="dev-name" className="sr-only">
                Test user name
              </label>
              <input
                id="dev-name"
                name="name"
                defaultValue="Dev Student"
                className="auth-input h-11"
              />
              <button type="submit" className="btn-ghost">
                Dev sign-in
              </button>
            </div>
          </form>
        </details>
      )}
    </AuthShell>
  );
}
