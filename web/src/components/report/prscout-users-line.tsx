// On a report, under where newcomer work lands: what PRScout users' own pull requests here came to.
// Rendered only when the server sends the numbers (5+ people make them up).
import Link from "next/link";
import {
  prscoutUsersLine,
  windowLabel,
  type PRScoutUsers,
} from "@/lib/prscout-users";

export function PRScoutUsersLine({ stats }: { stats: PRScoutUsers | null }) {
  if (!stats) return null;
  return (
    <div className="border-l-2 border-line-strong pl-4">
      <p className="font-sans text-[0.95rem] text-ink">
        <span className="text-muted">PRScout users who sent PRs here: </span>
        {prscoutUsersLine(stats)}
      </p>
      <details className="group mt-1 text-[0.87rem] text-faint">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center hover:text-ink sm:min-h-0 [&::-webkit-details-marker]:hidden">
          what&apos;s this?
        </summary>
        <p className="mt-1 max-w-xl font-sans leading-relaxed text-muted">
          People who connected GitHub to PRScout, counted without names, over{" "}
          {windowLabel(stats.window_days)}. Shown only when 5 or more people
          make up the numbers. Anyone who opted out of statistics is never
          counted.{" "}
          <Link href="/privacy#connect-github" className="text-link">
            How we handle this
          </Link>
        </p>
      </details>
    </div>
  );
}
