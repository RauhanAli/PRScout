import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { oauthProviders, signIn } from "@/auth";
import { SignUpForm } from "@/components/auth/auth-forms";
import { AuthShell, OrRule } from "@/components/auth/auth-shell";
import { afterSignIn } from "@/lib/home";
import { currentUser } from "@/lib/session";
import { PROVIDER_ICONS, ProviderButtons, type Provider } from "../signin/provider-buttons";

export const metadata: Metadata = { title: "Create your account", robots: { index: false } };

const NAMES: Record<string, string> = { github: "GitHub", google: "Google" };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const callbackUrl = afterSignIn(sp.callbackUrl);
  if (await currentUser()) redirect(callbackUrl);
  const back = typeof sp.callbackUrl === "string" ? `?callbackUrl=${encodeURIComponent(sp.callbackUrl)}` : "";

  // GitHub or Google make an account on first sign-in, so they're offered here too.
  const providers: Provider[] = ["github", "google"]
    .filter((id) => oauthProviders.some((p) => p.id === id))
    .map((id) => ({
      id,
      name: NAMES[id],
      icon: PROVIDER_ICONS[id],
      action: async () => {
        "use server";
        await signIn(id, { redirectTo: callbackUrl });
      },
    }));

  return (
    <AuthShell
      title="Create your account"
      lede="Free, and no card needed. Save repos, run checks and follow your pull requests in one place."
      footer={
        <p>
          Already have an account? <Link href={`/signin${back}`} className="text-link">Sign in</Link>
        </p>
      }
    >
      {providers.length > 0 && (
        <>
          <ProviderButtons providers={providers} />
          <OrRule>or with email</OrRule>
        </>
      )}
      <SignUpForm callbackUrl={callbackUrl} />
    </AuthShell>
  );
}
