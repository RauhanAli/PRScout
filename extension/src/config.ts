// Replaced at build time by scripts/build.mjs (PRSCOUT_HOST env var).
declare const __PRSCOUT_HOST__: string;

export const PRSCOUT_HOST: string =
  typeof __PRSCOUT_HOST__ === "string" ? __PRSCOUT_HOST__ : "gitprscout.com";

const seg = (s: string) => encodeURIComponent(s);

export function reportPageUrl(
  owner: string,
  repo: string,
  host = PRSCOUT_HOST,
): string {
  return `https://${host}/${seg(owner)}/${seg(repo)}`;
}

export function publicApiUrl(
  kind: "report" | "starter-issues",
  owner: string,
  repo: string,
  host = PRSCOUT_HOST,
): string {
  return `https://${host}/api/public/${kind}/${seg(owner)}/${seg(repo)}`;
}
