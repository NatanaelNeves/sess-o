import test from "node:test";
import assert from "node:assert/strict";
import { leaveKind, leaveUpdate, stayingName, loadErrorMessage } from "./coupleLeave.js";

const pair = { uid1: "ana", name1: "Ana", uid2: "leo", name2: "Léo" };
const solo = { uid1: "ana", name1: "Ana", uid2: null, name2: null };
const REMOVED = Symbol("deleteField");

test("who is leaving decides what happens to the diary", () => {
  assert.equal(leaveKind(pair, "leo"), "partner");
  assert.equal(leaveKind(pair, "ana"), "handover");
  assert.equal(leaveKind(solo, "ana"), "solo");
  assert.equal(leaveKind(pair, "eve"), null);
  assert.equal(leaveKind(null, "ana"), null);
  assert.equal(leaveKind({ uid1: "ana" }, undefined), null);
});

test("the partner leaving only opens the seat", () => {
  assert.deepEqual(leaveUpdate(pair, "leo", REMOVED), { uid2: REMOVED, name2: REMOVED });
});

test("the creator leaving hands the diary to the partner", () => {
  assert.deepEqual(leaveUpdate(pair, "ana", REMOVED), { uid1: "leo", name1: "Léo", uid2: REMOVED, name2: REMOVED });
});

test("nobody leaves a diary that has no one else in it", () => {
  assert.equal(leaveUpdate(solo, "ana", REMOVED), null);
  assert.equal(leaveUpdate(pair, "eve", REMOVED), null);
});

test("the diary stays with the other person", () => {
  assert.equal(stayingName(pair, "ana"), "Léo");
  assert.equal(stayingName(pair, "leo"), "Ana");
  assert.equal(stayingName(solo, "ana"), null);
});

test("a diary that does not load explains why, without blaming the couple", () => {
  assert.match(loadErrorMessage({ code: "resource-exhausted" }), /limite de uso/);
  assert.match(loadErrorMessage({ code: "unavailable" }), /internet/);
  assert.match(loadErrorMessage({ code: "firestore/permission-denied" }), /acesso/);
  assert.match(loadErrorMessage(new Error("boom")), /Tente de novo/);
  assert.match(loadErrorMessage(undefined), /Tente de novo/);
});
