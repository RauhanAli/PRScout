import assert from "node:assert/strict";
import { test } from "node:test";
import { emailError, isResetToken, newPasswordError, normalizeEmail, passwordStrength, resetErrors, signInErrors, signUpErrors } from "./credentials.ts";
import { hashPassword, needsRehash, verifyPassword } from "./password.ts";

const FAST = { N: 2 ** 10, r: 8, p: 1 };

test("emails are one account whatever the case or spaces", () => {
  assert.equal(normalizeEmail("  Ana@Example.COM "), "ana@example.com");
  assert.equal(emailError("ana@example.com"), undefined);
  assert.ok(emailError(""));
  assert.ok(emailError("ana@example"));
  assert.ok(emailError("ana example@x.com"));
  assert.ok(emailError("@x.com"));
});

test("new passwords: length, edges, variety, not the email", () => {
  assert.equal(newPasswordError("correct horse"), undefined);
  assert.match(newPasswordError("short")!, /at least 8/);
  assert.match(newPasswordError("x".repeat(129))!, /at most/);
  assert.match(newPasswordError(" leading-space")!, /spaces/);
  assert.match(newPasswordError("aaaaaaaaaa")!, /mix/);
  assert.match(newPasswordError("Ana@x.com1", "ana@x.com1")!, /email/);
});

test("form errors name only the fields that are wrong", () => {
  assert.deepEqual(signUpErrors({ name: "Ana", email: "ana@x.com", password: "a-good-pass" }), {});
  assert.deepEqual(Object.keys(signUpErrors({ name: "", email: "nope", password: "1" })).sort(), ["email", "name", "password"]);
  assert.deepEqual(Object.keys(signInErrors({ email: "ana@x.com", password: "" })), ["password"]);
  assert.deepEqual(resetErrors({ password: "a-good-pass", confirm: "a-good-pas" }), { confirm: "The passwords don't match." });
  // A bad password is reported once, not again as a mismatch.
  assert.deepEqual(Object.keys(resetErrors({ password: "x", confirm: "y" })), ["password"]);
});

test("strength is a hint that grows with length and variety", () => {
  assert.equal(passwordStrength("short"), 0);
  assert.ok(passwordStrength("abcdefgh") < passwordStrength("Abcdefgh12!x"));
  assert.equal(passwordStrength("Tr0ub4dor&3-horse-staple"), 4);
  assert.equal(passwordStrength("abababababababab"), 1);
});

test("reset tokens are 43 base64url characters", () => {
  assert.ok(isResetToken("a".repeat(43)));
  assert.ok(!isResetToken("a".repeat(42)));
  assert.ok(!isResetToken("a".repeat(42) + "/"));
  assert.ok(!isResetToken(undefined));
});

test("a hash verifies its own password and nothing else", async () => {
  const h = await hashPassword("correct horse", FAST);
  assert.match(h, /^scrypt\$1024\$8\$1\$/);
  assert.equal(await verifyPassword("correct horse", h), true);
  assert.equal(await verifyPassword("correct horsE", h), false);
  assert.equal(await verifyPassword("correct horse", "garbage"), false);
  assert.notEqual(await hashPassword("correct horse", FAST), h, "each hash gets its own salt");
});

test("a cheaper hash than today's asks to be redone", async () => {
  assert.equal(needsRehash(await hashPassword("x-password", FAST)), true);
  assert.equal(needsRehash("garbage"), true);
});
