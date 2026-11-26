// PRScout's mark for the share images (next/og draws plain SVG, not CSS vars):
// the same shapes as components/brand/logo.tsx, in the dark card's colours.
export const OG = {
  bg: "#0a1115",
  panel: "#0f181d",
  ink: "#e3ebee",
  muted: "#9db0b9",
  line: "#2a3b44",
  blue: "#62bcdc",
  green: "#5ccb9a",
  orange: "#f08b63",
  amber: "#f0b84d",
};

export function OgMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect width="32" height="32" rx="9" fill={OG.blue} />
      <path
        d="M10.5 8v16M21.5 8v16M10.5 13.5c5.5 0 5.5 5 11 5"
        fill="none"
        stroke="#05141a"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="21.5" cy="18.5" r="3.4" fill="#05141a" />
      <circle cx="21.5" cy="18.5" r="1.3" fill={OG.blue} />
    </svg>
  );
}
