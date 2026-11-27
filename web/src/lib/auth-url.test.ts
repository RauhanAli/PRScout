import { test } from "node:test";
import assert from "node:assert/strict";
import { createActionURL } from "@auth/core";
import {
  authUrlProblem,
  authUrlSetting,
  secureSessionCookie,
  sessionCookieName,
} from "./auth-url.ts";
import { arrivalGate } from "./gate.ts";

const SITE = "https://pr-scout-murex.vercel.app";

test("a full https address, with or without a slash or Auth.js's path, is fine", () => {
  for (const v of [SITE, `${SITE}/`, `${SITE}/api/auth`, "http://localhost:3000", ` ${SITE} `])
    assert.equal(authUrlProblem({ AUTH_URL: v }), null, v);
});

test("unset or empty is fine: Auth.js uses the request's address", () => {
  assert.equal(authUrlProblem({}), null);
  assert.equal(authUrlProblem({ AUTH_URL: "" }), null);
});

test("the values that broke sign-in in production are refused, with the fix", () => {
  const cases: [string, RegExp][] = [
    ["pr-scout-murex.vercel.app", /needs https:\/\/ in front/],
    [`"${SITE}"`, /remove the quotes/],
    [`'${SITE}'`, /remove the quotes/],
    ["https://<your-domain>", /not a valid address/],
    [`AUTH_URL=${SITE}`, /not a valid address/],
    ["ftp://pr-scout-murex.vercel.app", /must start with https:\/\//],
  ];
  for (const [v, why] of cases) {
    const p = authUrlProblem({ AUTH_URL: v });
    assert.ok(p, v);
    assert.match(p, why, v);
    assert.match(p, /^AUTH_URL /);
  }
});

test("every value refused here is one Auth.js would throw on", () => {
  for (const v of ["pr-scout-murex.vercel.app", `"${SITE}"`, "https://<your-domain>"])
    assert.throws(() => createActionURL("session", "https", new Headers(), { AUTH_URL: v }, { basePath: "/api/auth" }));
});

test("NEXTAUTH_URL is read when AUTH_URL is unset, as Auth.js does", () => {
  assert.equal(authUrlSetting({ NEXTAUTH_URL: SITE })?.name, "NEXTAUTH_URL");
  assert.match(authUrlProblem({ NEXTAUTH_URL: "example.com" }) ?? "", /^NEXTAUTH_URL /);
  // An empty AUTH_URL still wins over NEXTAUTH_URL (`??`), meaning "not set".
  assert.equal(authUrlSetting({ AUTH_URL: "", NEXTAUTH_URL: "example.com" }), undefined);
});

// Session persistence: a password sign-in writes the cookie, Auth.js's auth()
// reads it. Auth.js picks __Secure- when the URL it builds for the session
// lookup is https. The two must agree, or the next page sees no session.
test("the session cookie a password sign-in writes is the one auth() reads", () => {
  const envs = [{}, { AUTH_URL: SITE }, { AUTH_URL: "http://localhost:3000" }, { NEXTAUTH_URL: SITE }];
  const protos = ["https", "http", null];
  for (const env of envs)
    for (const proto of protos) {
      const h = new Headers({ host: "pr-scout-murex.vercel.app" });
      if (proto) h.set("x-forwarded-proto", proto);
      const url = createActionURL("session", proto as string, h, env, { basePath: "/api/auth" });
      const authReads = sessionCookieName(url.protocol === "https:");
      const weWrite = sessionCookieName(secureSessionCookie(env, proto));
      assert.equal(weWrite, authReads, `${JSON.stringify(env)} ${proto}`);
    }
});

test("cookie names match the proxy's gate", () => {
  assert.equal(sessionCookieName(true), "__Secure-authjs.session-token");
  assert.equal(sessionCookieName(false), "authjs.session-token");
});

// Protected routes: with the cookie a sign-in wrote, an account page renders
// (the page then asks auth() who it is); without one it goes to sign-in.
test("an account page lets either session cookie through, and sends no cookie to sign-in", () => {
  for (const path of ["/me", "/me/repos", "/compare", "/settings", "/preflight"]) {
    for (const secure of [true, false])
      assert.equal(arrivalGate(path, "", [sessionCookieName(secure)]), null, path);
    assert.equal(arrivalGate(path, "?x=1", []), `/signin?callbackUrl=${encodeURIComponent(`${path}?x=1`)}`);
  }
  // Find is open to everyone, so it never asks for sign-in at the door.
  assert.equal(arrivalGate("/find", "", []), null);
});
