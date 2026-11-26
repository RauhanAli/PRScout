"use client";

// The site footer: the brand, one last action, the links, and the repos PRScout
// checked most recently.
// - The brand block: PRScout's mark and a one-line promise.
// - On the landing page only, the last action: the URL trick as a form
//   (gitprscout.com/owner/repo) and find a project. Other pages have their own.
// - "Recently checked" loads only when the footer is near, from a cached
//   route, and sits last so it never pushes anything down when it arrives.
// Everything is in the server HTML, links included.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { deviceReduces, setMotion, toggledMotion } from "@/lib/motion";
import { NOT_A_REPO, pasteHref } from "@/lib/gate";
import { timeAgo } from "@/lib/format";
import { checkedLabel, type RecentChecks } from "@/lib/recent-checks";
import { parseRepoInput } from "@/lib/repo";
import { GITHUB_REPO_URL, LEGAL_PAGES, SITE_HOST } from "@/lib/site";
import { useReducedMotion } from "./motion/use-seen";
import { useOpen } from "./paste-box";
import { Logo } from "./brand/logo";

/** "terms" → "Terms": the policy labels are lowercase where the policy pages use them as their rail. */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** First path segments that are the site's own pages, not a repository owner. */
const SITE_ROUTES = new Set([
  "api",
  "badge",
  "compare",
  "contact",
  "discover",
  "example-ai-report",
  "example-merge-plan",
  "examples",
  "find",
  "hacktoberfest",
  "how-it-works",
  "me",
  "preflight",
  "pricing",
  "privacy",
  "profile",
  "refunds",
  "settings",
  "signin",
  "terms",
]);

/** /owner/repo, and not one of the site's own two-part pages such as /me/repos. */
function isReportPath(path: string | null): boolean {
  const parts = (path ?? "").split("/").filter(Boolean);
  return parts.length === 2 && !SITE_ROUTES.has(parts[0].toLowerCase());
}

/** Find a project's tabs: pages used every day, where the list is the point. */
const WORKING_ROUTES = new Set(["find", "discover", "hacktoberfest"]);

/** Reports and the working pages get the slim footer. */
function isSlimPath(path: string | null): boolean {
  return (
    isReportPath(path) ||
    WORKING_ROUTES.has(
      (path ?? "").split("/").filter(Boolean)[0]?.toLowerCase() ?? "",
    )
  );
}

/** The footer under a report or a working page: one line of what PRScout does and doesn't do, then the links. */
function ReportFooter({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className="site-footer mt-auto border-t border-line bg-panel">
      <div className="wrap flex flex-col gap-5 py-8 text-[0.85rem] md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <p className="font-semibold text-ink">PRScout</p>
          <p className="mt-1 font-sans leading-snug text-muted">
            Reads a project&apos;s public pull request history on GitHub. It
            never posts, comments or contacts anyone.
          </p>
          <p className="mt-2 text-faint">Open source, Apache-2.0</p>
        </div>
        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-x-10 gap-y-1 sm:grid-cols-3"
        >
          <ul>
            <FLink href="/find">Find a project</FLink>
            <FLink href="/discover">Browse projects</FLink>
            <FLink href="/how-it-works">How it works</FLink>
          </ul>
          <ul>
            <FLink href="/badge">Badge for maintainers</FLink>
            <FLink href="/pricing">Pricing</FLink>
            <FLink href={GITHUB_REPO_URL}>Source on GitHub</FLink>
          </ul>
          <ul>
            {LEGAL_PAGES.map((p) => (
              <FLink key={p.href} href={p.href}>
                {cap(p.label)}
              </FLink>
            ))}
            <FLink href="/contact#team">Team</FLink>
            {!signedIn && <MotionSwitch />}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

export function Footer({ signedIn = false }: { signedIn?: boolean }) {
  // The landing page is "/"; every other page
  // already has its own action, so only the landing ends on the form.
  const path = usePathname();
  const onLanding = path === "/";
  // A report (/owner/repo) and the working pages get a slim footer: the page is long, and the big sign-off is for the landing.
  const slim = isSlimPath(path);
  const root = useRef<HTMLElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, open] = useOpen();
  const [recent, setRecent] = useState<RecentChecks | null>(null);

  // Near the viewport: fetch the strip.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let fetched = false;
    const near = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || fetched) return;
        fetched = true;
        near.disconnect();
        fetch("/api/recent-checks")
          .then((r) => (r.ok ? r.json() : null))
          .then((d: RecentChecks | null) => {
            if (d?.recent?.length) setRecent(d);
          })
          .catch(() => {});
      },
      { rootMargin: "600px 0px" },
    );
    near.observe(el);
    return () => near.disconnect();
  }, []);

  const ref = parseRepoInput(value);

  const go = () => {
    if (!ref) {
      setError(NOT_A_REPO);
      return;
    }
    setError("");
    const repo = `${ref.owner}/${ref.repo}`;
    track("paste-submit", {
      repo,
      signedIn: signedIn ? "yes" : "no",
      from: "footer",
    });
    open(pasteHref(repo));
  };

  if (slim) return <ReportFooter signedIn={signedIn} />;

  return (
    <footer
      ref={root}
      className="site-footer mt-auto overflow-clip border-t border-line bg-panel"
    >
      <div className="wrap relative pb-10 pt-14 md:pt-20">
        <Link href="/" className="inline-flex" aria-label="PRScout home">
          <Logo markClassName="size-9" className="text-[1.15rem]" />
        </Link>
        <p className="ft-signoff mt-6 max-w-[18ch] text-ink">
          Know before you write a line of code.
        </p>
        {onLanding && (
          <p className="mt-4 max-w-[560px] text-[1.05rem] text-muted">
            Paste a repo, or swap hub for PRScout in any GitHub link.
          </p>
        )}

        {onLanding && (
          <>
            {/* The URL trick as a form. */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                go();
              }}
              className="mt-8 grid max-w-[720px] grid-cols-[auto_minmax(0,1fr)_auto] items-stretch rounded-xl border border-line-strong bg-bg transition-[border-color,box-shadow] focus-within:border-blue focus-within:shadow-[0_0_0_3px_var(--ring)]"
            >
              <label
                htmlFor="footer-repo"
                className="flex items-center pl-4 text-[0.95rem] text-faint sm:text-[1.05rem]"
              >
                <span className="sr-only">Repo to check: </span>
                <span aria-hidden="true" className="font-mono">
                  {SITE_HOST}/
                </span>
              </label>
              <input
                id="footer-repo"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError("");
                }}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                placeholder="owner/repo"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "footer-repo-error" : undefined}
                className="h-14 min-w-0 bg-transparent px-0.5 font-mono text-[0.95rem] text-ink outline-none placeholder:text-faint focus-visible:shadow-none sm:text-[1.02rem]"
              />
              <button
                type="submit"
                disabled={busy}
                className="btn-primary m-1.5 min-h-0 px-4 sm:px-6"
              >
                {busy ? "Opening…" : "Check"}
              </button>
            </form>
            <p
              id="footer-repo-error"
              role={error ? "alert" : undefined}
              className="mt-2 min-h-6 font-sans text-[0.9rem] text-orange"
            >
              {error}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link href="/find" className="bracket-link">
                Find a project →
              </Link>
            </p>
          </>
        )}

        {/* Three columns side by side from the sign-off's left edge, each as
            wide as its words, then one line of fine print under a rule. */}
        <nav
          aria-label="Footer"
          className="mt-14 grid grid-cols-2 gap-x-10 gap-y-8 text-[0.86rem] sm:flex sm:flex-wrap sm:gap-x-20"
        >
          <Group title="Product">
            <FLink href="/find">Find a project</FLink>
            <FLink href="/discover">Browse projects</FLink>
            <FLink href="/how-it-works">How it works</FLink>
            <FLink href="/badge">Badge for maintainers</FLink>
            <FLink href="/pricing">Pricing</FLink>
          </Group>
          <Group title="Open source">
            <FLink href={GITHUB_REPO_URL}>RauhanAli/prscout</FLink>
            <FLink href={`${GITHUB_REPO_URL}/blob/main/CONTRIBUTING.md`}>
              Contributing
            </FLink>
            <FLink href={`${GITHUB_REPO_URL}/blob/main/docs/USAGE.md`}>
              The CLI
            </FLink>
          </Group>
          <Group title="Legal">
            {LEGAL_PAGES.map((p) => (
              <FLink key={p.href} href={p.href}>
                {cap(p.label)}
              </FLink>
            ))}
            <FLink href="/contact#team">Team</FLink>
            {/* Signed in, it's under Settings → Display. */}
            {!signedIn && <MotionSwitch />}
          </Group>
        </nav>
        <p className="mt-10 border-t border-line pt-5 text-[0.78rem] text-faint">
          PRScout · open source, Apache-2.0 · read-only toward GitHub: it never
          posts, comments or contacts anyone.
        </p>
      </div>

      {/* Last, so it can arrive without moving anything. */}
      {recent && (
        <div className="ft-ticker border-t border-line pb-1.5 pt-4 text-[0.85rem]">
          <p className="wrap text-faint">
            recently checked · {checkedLabel(recent)}
          </p>
          <div className="ft-ticker-mask">
            <ul className="ft-ticker-track">
              {[0, 1].map((copy) =>
                recent.recent.map((r) => (
                  <li
                    key={`${copy}-${r.repo}`}
                    aria-hidden={copy === 1 || undefined}
                    className="ft-ticker-item"
                  >
                    <Link
                      href={`/${r.repo}`}
                      prefetch={false}
                      tabIndex={copy === 1 ? -1 : undefined}
                      className="inline-flex min-h-11 items-center hover:text-blue"
                    >
                      {r.repo}
                    </Link>
                    <span className="text-faint">
                      {" "}
                      {timeAgo(r.generated_at)}
                    </span>
                  </li>
                )),
              )}
            </ul>
          </div>
        </div>
      )}
    </footer>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2.5 text-[0.72rem] uppercase tracking-[0.08em] text-faint">
        {title}
      </p>
      <ul>{children}</ul>
    </div>
  );
}

function MotionSwitch() {
  const reduced = useReducedMotion();
  return (
    <li>
      <button
        type="button"
        aria-pressed={reduced}
        onClick={() => setMotion(toggledMotion(reduced, deviceReduces()))}
        className="inline-flex min-h-11 items-center text-left text-muted hover:text-ink sm:min-h-0 sm:py-1"
      >
        Reduce motion
        <span
          aria-hidden="true"
          className={reduced ? "ml-1.5 text-blue" : "hidden"}
        >
          · on
        </span>
      </button>
    </li>
  );
}

function FLink({
  href,
  children,
  ...rest
}: {
  href: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLAnchorElement>) {
  const cls =
    "inline-flex min-h-11 items-center text-muted hover:text-ink sm:min-h-0 sm:py-1";
  return (
    <li>
      {href.startsWith("/") ? (
        <Link href={href} className={cls} {...rest}>
          {children}
        </Link>
      ) : (
        <a href={href} className={cls} {...rest}>
          {children}
        </a>
      )}
    </li>
  );
}
