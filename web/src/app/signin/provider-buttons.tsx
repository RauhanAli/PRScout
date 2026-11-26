"use client";
// The "Continue with …" buttons. Once one is pressed, every button locks and
// the pressed one says where you're going, so a slow redirect never looks like
// a dead click (or invites a second one). Coming back with the browser's Back
// button restores a page from the cache mid-redirect, so that unlocks them.
import { useEffect, useState } from "react";

export interface Provider {
  id: string;
  name: string;
  icon: React.ReactNode;
  /** A server action that starts sign-in, or null when this provider isn't set up here. */
  action: (() => Promise<void>) | null;
}

const BASE = "auth-provider flex min-h-12 w-full items-center justify-center gap-3 border px-4 text-[0.92rem] font-semibold";
// Outlined, so the email form's submit stays the one filled button on the card.
const LOOK: Record<string, string> = {
  github: "border-line-strong bg-panel text-ink",
  google: "border-line-strong bg-panel text-ink",
};
const MOTION = "transition-[background-color,border-color,scale] duration-(--dur-fast) ease-(--ease-out) active:not-disabled:scale-[0.99] disabled:cursor-wait disabled:opacity-70";

export function ProviderButtons({ providers }: { providers: Provider[] }) {
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const unlock = (e: PageTransitionEvent) => e.persisted && setPending(null);
    window.addEventListener("pageshow", unlock);
    return () => window.removeEventListener("pageshow", unlock);
  }, []);

  return (
    <div className="space-y-3" aria-busy={pending !== null}>
      {providers.map((p) =>
        p.action ? (
          <form key={p.id} action={p.action} onSubmit={() => setPending(p.id)}>
            <button
              type="submit"
              disabled={pending !== null}
              data-umami-event="sign-in"
              data-umami-event-provider={p.id}
              className={`${BASE} ${LOOK[p.id] ?? LOOK.google} ${MOTION}`}
            >
              {pending === p.id ? <Spinner /> : p.icon}
              <span>{pending === p.id ? `Opening ${p.name}…` : `Continue with ${p.name}`}</span>
            </button>
          </form>
        ) : (
          <p key={p.id} className={`${BASE} border-dashed border-line-strong font-normal text-faint`}>
            {p.icon}
            <span>{p.name} sign-in isn&apos;t set up here</span>
          </p>
        ),
      )}
      <p role="status" className="sr-only">
        {pending ? `Opening ${providers.find((p) => p.id === pending)?.name} to sign you in.` : ""}
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 motion-safe:animate-spin" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  github: (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  ),
  google: (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
    </svg>
  ),
};
