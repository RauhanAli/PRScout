// PRScout's mark: an H whose crossbar is a merge path, a branch leaving one
// stem and landing on the other, with a node where the work lands. It reads
// as the letter and as what PRScout checks (does outside work get merged?).
// The tile follows the theme (--logo-tile / --logo-fg in globals.css): Harbor
// with white on light pages, light Harbor with ink on dark ones. `plain`
// draws the glyph alone in currentColor, for places that already have a box.

export function LogoMark({
  className = "size-8",
  plain = false,
  title,
}: {
  className?: string;
  plain?: boolean;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {!plain && <rect width="32" height="32" rx="9" fill="var(--logo-tile)" />}
      <g
        fill="none"
        stroke={plain ? "currentColor" : "var(--logo-fg)"}
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M10.5 8v16" />
        <path d="M21.5 8v16" />
        <path d="M10.5 13.5c5.5 0 5.5 5 11 5" />
      </g>
      <circle
        cx="21.5"
        cy="18.5"
        r="3.4"
        fill={plain ? "currentColor" : "var(--logo-fg)"}
      />
      {!plain && <circle cx="21.5" cy="18.5" r="1.3" fill="var(--logo-tile)" />}
    </svg>
  );
}

/** The mark and the name, as the header, sidebar and auth pages show them. */
export function Logo({
  className = "",
  markClassName = "size-7",
  label = true,
}: {
  className?: string;
  markClassName?: string;
  label?: boolean;
}) {
  return (
    <span
      className={`brand-logo inline-flex items-center gap-2.5 ${className}`}
    >
      <LogoMark className={`${markClassName} shrink-0`} />
      {label && <span className="brand-word">PRScout</span>}
    </span>
  );
}
