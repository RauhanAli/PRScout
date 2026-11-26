// The frame every auth page shares (sign in, create account, forgot and reset
// password): PRScout's ink panel with what an account gets you on wide screens,
// and the form card. On phones the card is the page.
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { PageTransition } from "@/components/motion/page-transition";

export function AuthShell({
  title,
  lede,
  children,
  footer,
  titleSize = "lg",
}: {
  title: string;
  lede?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  titleSize?: "lg" | "md";
}) {
  return (
    <PageTransition>
      <div className="auth-page">
        <aside className="auth-brand" aria-hidden="true">
          <div className="auth-brand-inner">
            <LogoMark className="size-10" />
            <p className="auth-brand-title">
              Spend your weekend on a PR that gets merged.
            </p>
            <p className="auth-brand-sub">
              PRScout reads a project&apos;s recent pull requests and tells you
              whether outsiders get replies, reviews and merges.
            </p>
            <VerdictSample />
            <ul className="auth-brand-list">
              <li>Save repos and come back to their verdicts</li>
              <li>Track where your open pull requests stand</li>
              <li>Starter issues picked for the languages you read</li>
            </ul>
          </div>
        </aside>
        <div className="auth-main">
          <section aria-labelledby="auth-title" className="auth-card">
            <h1
              id="auth-title"
              className={`auth-title ${titleSize === "md" ? "auth-title-md" : ""}`}
            >
              {title}
            </h1>
            {lede && <p className="auth-lede">{lede}</p>}
            <div className="mt-7">{children}</div>
            {footer && <div className="auth-foot">{footer}</div>}
          </section>
          <p className="auth-legal">
            By continuing you agree to the{" "}
            <Link
              href="/terms"
              className="underline decoration-line-strong underline-offset-2 hover:text-ink"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="underline decoration-line-strong underline-offset-2 hover:text-ink"
            >
              Privacy Policy
            </Link>
            . PRScout only reads public GitHub data and never posts for you.
          </p>
        </div>
      </div>
    </PageTransition>
  );
}

/** A still of the product: the shape of a report (a made-up repo, labelled so), on the brand panel. */
function VerdictSample() {
  return (
    <div className="auth-sample">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[0.78rem] opacity-70">
          example-org/toolkit · example
        </span>
        <span className="auth-sample-pill">Worth your time</span>
      </div>
      <p className="mt-3 text-[0.92rem] leading-snug">
        Outside pull requests get a reply in about a day, and most good ones are
        merged.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-[0.72rem]">
        {[
          ["1 day", "first reply"],
          ["64%", "merged"],
          ["38", "outsiders"],
        ].map(([n, l]) => (
          <div key={l} className="auth-sample-stat">
            <span className="block font-mono text-[0.95rem] font-semibold">
              {n}
            </span>
            <span className="opacity-65">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "or", between the provider buttons and the email form. */
export function OrRule({ children = "or" }: { children?: React.ReactNode }) {
  return (
    <div className="auth-or" role="separator">
      <span>{children}</span>
    </div>
  );
}
