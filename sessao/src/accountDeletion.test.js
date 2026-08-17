import test from "node:test";
import assert from "node:assert/strict";
import { chunkItems, getAccountDeletionRole, withoutUserReview } from "./accountDeletion.js";

test("identifies the deletion impact for each account", () => {
  const couple = { uid1: "owner", uid2: "partner" };
  assert.equal(getAccountDeletionRole(couple, "owner"), "owner");
  assert.equal(getAccountDeletionRole(couple, "partner"), "partner");
  assert.equal(getAccountDeletionRole(couple, "other"), "account-only");
});

test("removes only the departing user's review", () => {
  const reviews = { Ana: { rating: 5 }, Léo: { rating: 4 } };
  assert.deepEqual(withoutUserReview(reviews, "Léo"), { Ana: { rating: 5 } });
  assert.deepEqual(reviews, { Ana: { rating: 5 }, Léo: { rating: 4 } });
});

test("chunks large deletions below Firestore batch limits", () => {
  const chunks = chunkItems(Array.from({ length: 901 }, (_, index) => index));
  assert.deepEqual(chunks.map(chunk => chunk.length), [400, 400, 101]);
});
