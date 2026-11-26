import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { isResetToken } from "@/lib/credentials";
import { resetTarget } from "@/lib/credentials-auth";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  // Looking the link up doesn't use it: only saving a new password does.
  const target = isResetToken(token) ? await resetTarget(token).catch(() => null) : null;

  if (!target || !isResetToken(token)) {
    return (
      <AuthShell
        title="This link has expired"
        lede="Reset links work once and only for an hour. Ask for a new one and use the latest email."
        footer={
          <p>
            <Link href="/signin" className="text-link">Back to sign in</Link>
          </p>
        }
      >
        <Link href="/forgot-password" className="btn-primary w-full">Send a new link</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      lede={
        <>
          For <span className="font-medium text-ink">{target.email}</span>. Saving it signs you in here and signs you out everywhere else.
        </>
      }
    >
      <ResetForm token={token} email={target.email ?? ""} />
    </AuthShell>
  );
}
