import { authUrlProblem } from "./lib/auth-url";

// Runs once when the server starts (not during `next build`).
export function register() {
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.MOCK_API === "1") {
    if (process.env.ALLOW_MOCK_IN_PROD !== "1")
      throw new Error("MOCK_API=1 in production serves fake reports. Unset it, or set ALLOW_MOCK_IN_PROD=1 for a demo.");
    return;
  }
  // A production site needs its API server, the key it calls it with, its own
  // database (accounts and sessions) and the secret Auth.js signs with.
  // Without them it would quietly call 127.0.0.1 or a local database.
  const missing = ["PRSCOUT_API_URL", "PRSCOUT_INTERNAL_KEY", "DATABASE_URL", "AUTH_SECRET"].filter(
    (k) => !process.env[k],
  );
  if (missing.length) throw new Error(`Missing in production: ${missing.join(", ")} (see web/.env.example).`);
  // A malformed AUTH_URL otherwise fails every sign-in and session lookup with
  // "Invalid URL" while the site looks up (lib/auth-url.ts).
  const problem = authUrlProblem(process.env);
  if (problem) throw new Error(problem);
}
