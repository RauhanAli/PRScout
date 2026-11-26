"use client";
// A small repo box: type or paste a repo, press enter, read its report. In the
// top bar on every app page ("bar", from md up; "band" is a wider copy for a
// page's own row), and above the home headline on smaller screens
// ("inline", while the top bar's copy is hidden below md). An unreadable entry gets a
// hint that goes as soon as you type, leave the box or change page
// (lib/quick-check.ts).
import { usePathname } from "next/navigation";
import { useReducer, useState } from "react";
import { track } from "@/lib/analytics";
import { pasteHref } from "@/lib/gate";
import { hintState, nextHint } from "@/lib/quick-check";
import { parseRepoInput } from "@/lib/repo";
import { useOpen } from "../paste-box";

export function QuickCheck({ variant = "bar", className = "" }: { variant?: "bar" | "band" | "inline"; className?: string }) {
  const bar = variant !== "inline";
  const id = `${variant === "inline" ? "home" : variant}-repo`;
  const [value, setValue] = useState("");
  const [busy, open] = useOpen();
  const pathname = usePathname();
  const [hint, send] = useReducer(nextHint, pathname, hintState);
  // The box outlives the page: a new page starts without the hint.
  if (hint.path !== pathname) send({ type: "route", path: pathname });
  const bad = hint.shown && hint.path === pathname;

  return (
    <form
      role="search"
      data-check-target={variant}
      onSubmit={(e) => {
        e.preventDefault();
        const ref = parseRepoInput(value);
        send({ type: "submit", valid: !!ref });
        if (!ref) return;
        track("paste-submit", { repo: `${ref.owner}/${ref.repo}`, from: variant });
        setValue("");
        open(pasteHref(`${ref.owner}/${ref.repo}`));
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) send({ type: "leave" });
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && bad) send({ type: "leave" });
      }}
      className={`relative w-full items-center overflow-visible rounded-lg border border-line-strong bg-panel transition-[border-color,box-shadow] focus-within:border-blue focus-within:shadow-[0_0_0_3px_var(--ring)] ${variant === "bar" ? "hidden max-w-md md:flex" : bar ? "hidden max-w-xl md:flex" : "flex max-w-md"} ${className}`}
    >
      <label htmlFor={id} className="sr-only">Check a repo</label>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="ml-3 size-3.5 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <circle cx="7" cy="7" r="4.75" />
        <path d="m10.5 10.5 3.25 3.25" />
      </svg>
      <input
        id={id}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          send({ type: "input" });
        }}
        aria-invalid={bad || undefined}
        aria-describedby={bad ? `${id}-error` : undefined}
        placeholder={bar ? "Check a repo: owner/name" : "owner/name or a GitHub link"}
        autoComplete="off"
        spellCheck={false}
        className={`min-w-0 flex-1 bg-transparent px-2 outline-none placeholder:text-faint focus-visible:shadow-none ${bar ? "py-1.5 text-[0.8rem]" : "py-3 text-[0.92rem]"}`}
      />
      {bar && !value && <kbd aria-hidden="true" className="mr-2 hidden rounded border border-line-strong px-1.5 font-mono text-[0.7rem] leading-5 text-faint lg:block">/</kbd>}
      <button type="submit" disabled={busy} className={`m-1 rounded-md bg-panel-2 px-3 font-medium text-ink transition-colors hover:bg-blue hover:text-on-accent ${bar ? "text-[0.76rem]" : "text-[0.8rem]"}`}>{busy ? "Opening…" : "Check"}</button>
      {bad && (
        <p id={`${id}-error`} role="alert" className="absolute left-0 top-full mt-1 border border-orange/50 bg-panel px-3 py-2 font-sans text-[0.82rem] text-orange shadow-card">
          Try owner/name or a github.com link.
        </p>
      )}
    </form>
  );
}
