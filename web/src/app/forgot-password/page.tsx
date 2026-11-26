import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";
import { resetAvailable } from "@/lib/credentials-auth";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false },
};

export default async function ForgotPasswordPage({
  searchParams,
}: PageProps<"/forgot-password">) {
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email.slice(0, 254) : "";
  const available = resetAvailable();
  return (
    <AuthShell
      title="Reset your password"
      lede={
        available
          ? "Enter the email you use for PRScout and we'll send you a link to choose a new password."
          : undefined
      }
      footer={
        <p>
          Remembered it?{" "}
          <Link href="/signin" className="text-link">
            Back to sign in
          </Link>
        </p>
      }
    >
      {available ? (
        <ForgotForm initialEmail={email} />
      ) : (
        <div role="status" className="auth-message" data-tone="info">
          <p className="font-semibold">
            Password reset by email isn&apos;t set up on this server
          </p>
          <p className="mt-0.5 text-muted">
            If you signed up with GitHub or Google, sign in with that button
            instead.
          </p>
        </div>
      )}
    </AuthShell>
  );
}
