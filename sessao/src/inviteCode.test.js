import test from "node:test";
import assert from "node:assert/strict";
import { generateInviteCode, normalizeInviteCode, isInviteCodeValid } from "./inviteCode.js";

test("normalizes pasted invite codes", () => {
  assert.equal(normalizeInviteCode(" ab-cd 23_ef "), "ABCD23EF");
});

test("generates a non-ambiguous eight-character code", () => {
  const fakeRandom = { getRandomValues: bytes => bytes.fill(7) };
  assert.match(generateInviteCode(fakeRandom), /^[A-HJ-NP-Z2-9]{8}$/);
});

test("accepts legacy six-character and current eight-character invites", () => {
  assert.equal(isInviteCodeValid("ABC234"), true);
  assert.equal(isInviteCodeValid("ABCD2345"), true);
  assert.equal(isInviteCodeValid("ABC23"), false);
});
