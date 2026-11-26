/**
 * The visitor's IP, for the API server's per-IP rate limits.
 *
 * Proxy headers are client-controlled unless our own proxy set them, so they
 * are trusted only with TRUST_PROXY_HEADERS=1 (staging/production, where the
 * app is reachable only through Cloudflare). Then: cf-connecting-ip (set by
 * Cloudflare), else the last X-Forwarded-For hop (added by our proxy; earlier
 * entries can be forged), else X-Real-IP.
 *
 * On Vercel (VERCEL=1, set by the platform) the edge network sets these
 * itself: x-vercel-forwarded-for and x-real-ip are the visitor's address, and
 * X-Forwarded-For is overwritten rather than appended to, so a client can't
 * forge them. cf-connecting-ip is not Vercel's and is ignored there.
 *
 * Without a trusted IP: 127.0.0.1 outside production; in production nothing
 * (the server answers 400 rather than lumping every visitor into one bucket).
 */
export function clientIpFrom(h: Headers): string | null {
  if (process.env.VERCEL === "1") {
    const ip =
      h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip")?.trim() ||
      h.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (ip) return ip;
  }
  if (process.env.TRUST_PROXY_HEADERS === "1") {
    const ip =
      h.get("cf-connecting-ip")?.trim() ||
      h
        .get("x-forwarded-for")
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .pop() ||
      h.get("x-real-ip")?.trim();
    if (ip) return ip;
  }
  if (process.env.NODE_ENV !== "production") return "127.0.0.1";
  console.warn(
    "[PRScout] no trusted client IP (set TRUST_PROXY_HEADERS=1 behind the proxy)",
  );
  return null;
}
