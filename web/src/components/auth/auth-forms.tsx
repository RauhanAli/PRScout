"use client";
// The email and password forms. Each checks what you typed in the browser
// first (lib/credentials.ts, the same rules the server applies), then sends
// it to its server action (lib/auth-actions.ts), which decides. Submitting
// goes through onSubmit rather than <form action>, so a refused submit keeps
// what you typed instead of React resetting the form.
import Link from "next/link";
import { useActionState, useEffect, useId, useState, startTransition } from "react";
import {
  forgotPassword,
  resetPassword,
  signInWithPassword,
  signUpWithPassword,
  updatePassword,
  type FormState,
} from "@/lib/auth-actions";
import { emailError, resetErrors, signInErrors, signUpErrors, type Field as FieldName, type FieldErrors } from "@/lib/credentials";
import { Field, FormMessage, PasswordField, SubmitButton } from "./fields";

type Action = (s: FormState, f: FormData) => Promise<FormState>;

/**
 * Shared form plumbing: the server's state, local errors shown after a field
 * is left or the form is sent, and focus on the first wrong field.
 */
function useAuthForm(action: Action, validate: () => FieldErrors) {
  const [state, run, pending] = useActionState(action, {} as FormState);
  // Worked out from what's typed now, on every render; shown once a field is left or the form sent.
  const local = validate();
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const formId = useId();
  const firstInvalid = () => document.getElementById(formId)?.querySelector<HTMLInputElement>("[aria-invalid=true]");

  // The server's field errors stand until that field changes (per response).
  const [cleared, setCleared] = useState<{ for: FormState; fields: FieldName[] }>({ for: state, fields: [] });
  const server = (f: FieldName) => (cleared.for === state && cleared.fields.includes(f) ? undefined : state.errors?.[f]);

  useEffect(() => {
    if (state.errors) firstInvalid()?.focus();
    // Only when a submit comes back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // A saved form starts over: no field counts as visited.
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.ok) {
      setTouched({});
      setSubmitted(false);
    }
  }

  const shown = (f: FieldName) => (touched[f] || submitted ? local[f] : undefined) ?? server(f);

  return {
    state,
    pending,
    formId,
    error: shown,
    changed(f: FieldName) {
      setCleared((c) => ({ for: state, fields: c.for === state ? [...c.fields, f] : [f] }));
    },
    blur(f: FieldName) {
      setTouched((t) => ({ ...t, [f]: true }));
    },
    onSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      const errors = validate();
      setSubmitted(true);
      if (Object.keys(errors).length) {
        requestAnimationFrame(() => firstInvalid()?.focus());
        return;
      }
      const data = new FormData(e.currentTarget);
      startTransition(() => run(data));
    },
  };
}

function useInput(initial = "") {
  return useState(initial);
}

// --- sign in ---------------------------------------------------------------------------

export function SignInForm({ callbackUrl, initialEmail = "", resetAvailable }: { callbackUrl: string; initialEmail?: string; resetAvailable: boolean }) {
  const [email, setEmail] = useInput(initialEmail);
  const [password, setPassword] = useInput();
  const f = useAuthForm(signInWithPassword, () => signInErrors({ email, password }));
  const forgotHref = `/forgot-password${email && !emailError(email) ? `?email=${encodeURIComponent(email.trim())}` : ""}`;

  return (
    <form id={f.formId} onSubmit={f.onSubmit} noValidate className="space-y-5" aria-busy={f.pending}>
      {f.state.message && <FormMessage message={f.state.message} email={email} />}
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="you@example.com"
        value={email}
        onValue={(v) => (setEmail(v), f.changed("email"))}
        onBlur={() => f.blur("email")}
        error={f.error("email")}
      />
      <PasswordField
        autoComplete="current-password"
        value={password}
        onValue={(v) => (setPassword(v), f.changed("password"))}
        onBlur={() => f.blur("password")}
        error={f.error("password")}
        aside={resetAvailable ? <Link href={forgotHref} className="auth-aside-link">Forgot password?</Link> : undefined}
      />
      <SubmitButton pending={f.pending} pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

// --- sign up ---------------------------------------------------------------------------

export function SignUpForm({ callbackUrl }: { callbackUrl: string }) {
  const [name, setName] = useInput();
  const [email, setEmail] = useInput();
  const [password, setPassword] = useInput();
  const f = useAuthForm(signUpWithPassword, () => signUpErrors({ name, email, password }));

  return (
    <form id={f.formId} onSubmit={f.onSubmit} noValidate className="space-y-5" aria-busy={f.pending}>
      {f.state.message && <FormMessage message={f.state.message} email={email} />}
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <Field
        label="Name"
        name="name"
        autoComplete="name"
        placeholder="Ada Lovelace"
        maxLength={60}
        value={name}
        onValue={(v) => (setName(v), f.changed("name"))}
        onBlur={() => f.blur("name")}
        error={f.error("name")}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="you@example.com"
        value={email}
        onValue={(v) => (setEmail(v), f.changed("email"))}
        onBlur={() => f.blur("email")}
        error={f.error("email")}
      />
      <PasswordField
        autoComplete="new-password"
        meter
        value={password}
        onValue={(v) => (setPassword(v), f.changed("password"))}
        onBlur={() => f.blur("password")}
        error={f.error("password")}
      />
      <SubmitButton pending={f.pending} pendingLabel="Creating your account…">Create account</SubmitButton>
    </form>
  );
}

// --- forgot ----------------------------------------------------------------------------

export function ForgotForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useInput(initialEmail);
  const f = useAuthForm(forgotPassword, () => {
    const e = emailError(email);
    return e ? { email: e } : {};
  });

  if (f.state.ok && f.state.message) {
    return (
      <div className="space-y-5">
        <FormMessage message={f.state.message} />
        {f.state.devLink && (
          <div className="auth-dev">
            <p className="font-semibold text-amber">Development: no mailer is set up</p>
            <p className="mt-1 text-muted">The email wasn&apos;t sent. This is the link it would carry:</p>
            <Link href={f.state.devLink.replace(/^https?:\/\/[^/]+/, "")} className="text-link mt-2 inline-block break-all">
              Open the reset link
            </Link>
          </div>
        )}
        <p className="text-[0.9rem] text-muted">
          Nothing after a few minutes? Check spam, or{" "}
          <button type="button" className="text-link" onClick={() => location.reload()}>
            try another address
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form id={f.formId} onSubmit={f.onSubmit} noValidate className="space-y-5" aria-busy={f.pending}>
      {f.state.message && <FormMessage message={f.state.message} />}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="you@example.com"
        value={email}
        onValue={(v) => (setEmail(v), f.changed("email"))}
        onBlur={() => f.blur("email")}
        error={f.error("email")}
      />
      <SubmitButton pending={f.pending} pendingLabel="Sending…">Email me a reset link</SubmitButton>
    </form>
  );
}

// --- reset -----------------------------------------------------------------------------

export function ResetForm({ token, email }: { token: string; email: string }) {
  const [password, setPassword] = useInput();
  const [confirm, setConfirm] = useInput();
  const f = useAuthForm(resetPassword, () => resetErrors({ password, confirm, email }));
  return (
    <form id={f.formId} onSubmit={f.onSubmit} noValidate className="space-y-5" aria-busy={f.pending}>
      {f.state.message && <FormMessage message={f.state.message} />}
      <input type="hidden" name="token" value={token} />
      {/* For password managers: which account this new password belongs to. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <PasswordField
        label="New password"
        autoComplete="new-password"
        meter
        value={password}
        onValue={(v) => (setPassword(v), f.changed("password"))}
        onBlur={() => f.blur("password")}
        error={f.error("password")}
      />
      <PasswordField
        label="Confirm new password"
        name="confirm"
        autoComplete="new-password"
        value={confirm}
        onValue={(v) => (setConfirm(v), f.changed("confirm"))}
        onBlur={() => f.blur("confirm")}
        error={f.error("confirm")}
      />
      <SubmitButton pending={f.pending} pendingLabel="Saving…">Save and sign in</SubmitButton>
    </form>
  );
}

// --- change (settings) -----------------------------------------------------------------

export function ChangePasswordForm({ hasPassword, email }: { hasPassword: boolean; email: string }) {
  const [current, setCurrent] = useInput();
  const [password, setPassword] = useInput();
  const [confirm, setConfirm] = useInput();
  const f = useAuthForm(updatePassword, () => {
    const e = resetErrors({ password, confirm, email });
    if (hasPassword && !current) e.current = "Enter your current password.";
    return e;
  });
  // Saved: clear the fields for next time (once per response, while rendering).
  const [seen, setSeen] = useState(f.state);
  if (seen !== f.state) {
    setSeen(f.state);
    if (f.state.ok) {
      setCurrent("");
      setPassword("");
      setConfirm("");
    }
  }

  return (
    <form id={f.formId} onSubmit={f.onSubmit} noValidate className="max-w-md space-y-5" aria-busy={f.pending}>
      {f.state.message && <FormMessage message={f.state.message} />}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      {hasPassword && (
        <PasswordField
          label="Current password"
          name="current"
          autoComplete="current-password"
          value={current}
          onValue={(v) => (setCurrent(v), f.changed("current"))}
          onBlur={() => f.blur("current")}
          error={f.error("current")}
        />
      )}
      <PasswordField
        label={hasPassword ? "New password" : "Password"}
        autoComplete="new-password"
        meter
        value={password}
        onValue={(v) => (setPassword(v), f.changed("password"))}
        onBlur={() => f.blur("password")}
        error={f.error("password")}
      />
      <PasswordField
        label="Confirm password"
        name="confirm"
        autoComplete="new-password"
        value={confirm}
        onValue={(v) => (setConfirm(v), f.changed("confirm"))}
        onBlur={() => f.blur("confirm")}
        error={f.error("confirm")}
      />
      <div className="sm:w-56">
        <SubmitButton pending={f.pending} pendingLabel="Saving…">{hasPassword ? "Change password" : "Add password"}</SubmitButton>
      </div>
    </form>
  );
}
