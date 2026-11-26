"use client";
// The auth forms' parts: a labelled field with its error, a password field
// with show/hide and an optional strength meter, the submit button, and the
// message above a form. Errors are tied to their input (aria-describedby,
// aria-invalid) so a screen reader reads them with the field.
import Link from "next/link";
import { useId, useState } from "react";
import { passwordStrength, STRENGTH_LABEL, PASSWORD_MIN } from "@/lib/credentials";
import type { FormState } from "@/lib/auth-actions";

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label: string;
  name: string;
  value: string;
  onValue: (v: string) => void;
  error?: string;
  hint?: React.ReactNode;
  /** Something at the label's right, like "Forgot password?". */
  aside?: React.ReactNode;
}

export function Field({ label, name, value, onValue, error, hint, aside, ...input }: FieldProps) {
  const id = useId();
  const described = [error && `${id}-err`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="auth-field">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="auth-label">{label}</label>
        {aside}
      </div>
      <input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        className="auth-input"
        {...input}
      />
      {error ? <FieldError id={`${id}-err`}>{error}</FieldError> : hint ? <p id={`${id}-hint`} className="auth-hint">{hint}</p> : null}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="auth-error">
      <svg viewBox="0 0 16 16" className="mt-[0.2em] size-3.5 shrink-0" fill="currentColor" aria-hidden="true">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 3.5h1.5v4.5h-1.5V4.5Zm0 6h1.5V12h-1.5v-1.5Z" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

export function PasswordField({
  label = "Password",
  name = "password",
  value,
  onValue,
  error,
  meter = false,
  autoComplete,
  aside,
  ...rest
}: {
  label?: string;
  name?: string;
  value: string;
  onValue: (v: string) => void;
  error?: string;
  /** Show the strength meter and the length hint (new passwords). */
  meter?: boolean;
  autoComplete: "current-password" | "new-password";
  aside?: React.ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type" | "name">) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const score = passwordStrength(value);
  const described = [error && `${id}-err`, meter && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="auth-field">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="auth-label">{label}</label>
        {aside}
      </div>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => onValue(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className="auth-input pr-12"
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-controls={id}
          aria-label={shown ? "Hide password" : "Show password"}
          className="auth-eye"
        >
          {shown ? <EyeOff /> : <Eye />}
        </button>
      </div>
      {meter && (
        <div id={`${id}-hint`} className="mt-2" aria-live="polite">
          <div className="auth-meter" data-score={value ? score : undefined} aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} data-on={value && score >= n ? "" : undefined} />
            ))}
          </div>
          {!error && (
            <p className="auth-hint mt-1.5">
              {value ? (
                <>
                  <span className="font-medium text-ink">{STRENGTH_LABEL[score]}.</span>{" "}
                  {score < 3 ? "Longer is stronger: try a few unrelated words." : "Nice."}
                </>
              ) : (
                `At least ${PASSWORD_MIN} characters. A short phrase works well.`
              )}
            </p>
          )}
        </div>
      )}
      {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
    </div>
  );
}

export function SubmitButton({ pending, children, pendingLabel }: { pending: boolean; children: React.ReactNode; pendingLabel: string }) {
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className="btn-primary auth-submit w-full">
      {pending ? (
        <>
          <Spinner /> {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="size-4.5 motion-safe:animate-spin" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** The message over a form: an error, a success, or a nudge, with a follow-up link where one helps. */
export function FormMessage({ message, email }: { message: NonNullable<FormState["message"]>; email?: string }) {
  const q = email ? `?email=${encodeURIComponent(email)}` : "";
  return (
    <div role={message.tone === "error" ? "alert" : "status"} className="auth-message" data-tone={message.tone}>
      <p className="font-semibold">{message.title}</p>
      {message.body && <p className="mt-0.5 text-muted">{message.body}</p>}
      {message.code === "taken" && (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <Link href={`/signin${q}`} className="text-link">Sign in instead</Link>
          <Link href={`/forgot-password${q}`} className="text-link">Reset password</Link>
        </p>
      )}
      {message.code === "no-password" && (
        <p className="mt-2">
          <Link href={`/forgot-password${q}`} className="text-link">Add a password by email</Link>
        </p>
      )}
      {message.code === "expired" && (
        <p className="mt-2">
          <Link href="/forgot-password" className="text-link">Send a new link</Link>
        </p>
      )}
    </div>
  );
}

function Eye() {
  return (
    <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.75 10S4.75 4 10 4s8.25 6 8.25 6S15.25 16 10 16 1.75 10 1.75 10Z" />
      <circle cx="10" cy="10" r="2.6" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8.2 4.2A8 8 0 0 1 10 4c5.25 0 8.25 6 8.25 6a14 14 0 0 1-2.1 2.9M5.4 5.4C3 7 1.75 10 1.75 10S4.75 16 10 16a7.8 7.8 0 0 0 4.1-1.2" />
      <path d="M8.2 8.2a2.6 2.6 0 0 0 3.6 3.6" />
      <path d="m2.5 2.5 15 15" />
    </svg>
  );
}
