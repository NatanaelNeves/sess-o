import test from "node:test";
import assert from "node:assert/strict";
import { validateEmailForm, authErrorMessage, normalizeEmail, hasPassword } from "./emailAuth.js";

test("signup asks for a name, a real e-mail and an 8+ character password", () => {
  assert.match(validateEmailForm({ mode: "signup", name: " ", email: "a@b.co", password: "12345678" }), /chamado/);
  assert.match(validateEmailForm({ mode: "signup", name: "Ana", email: "ana@", password: "12345678" }), /e-mail/);
  assert.match(validateEmailForm({ mode: "signup", name: "Ana", email: "ana@x.com", password: "1234567" }), /8 caracteres/);
  assert.equal(validateEmailForm({ mode: "signup", name: "Ana", email: " Ana@X.com ", password: "12345678" }), null);
});

test("login and reset only check what they need", () => {
  assert.equal(validateEmailForm({ mode: "login", email: "ana@x.com", password: "1" }), null);
  assert.match(validateEmailForm({ mode: "login", email: "ana@x.com", password: "" }), /senha/);
  assert.equal(validateEmailForm({ mode: "reset", email: "ana@x.com" }), null);
});

test("wrong login never reveals whether the e-mail exists", () => {
  const wrong = authErrorMessage({ code: "auth/wrong-password" });
  assert.equal(authErrorMessage({ code: "auth/user-not-found" }), wrong);
  assert.equal(authErrorMessage({ code: "auth/invalid-credential" }), wrong);
  assert.match(authErrorMessage({ code: "auth/whatever" }), /Tente de novo/);
});

test("e-mails are compared trimmed and lowercase; password accounts are detected", () => {
  assert.equal(normalizeEmail("  Ana@X.COM "), "ana@x.com");
  assert.equal(hasPassword({ providerData: [{ providerId: "google.com" }] }), false);
  assert.equal(hasPassword({ providerData: [{ providerId: "password" }] }), true);
});
