import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { homeLumi, isSleepyHour, MOOD_POSE, TAP_REACTIONS, LOVE_REACTION, SHY_REACTION, WAKE_REACTION } from "./lumiMood.js";

const kit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/assets/kit");
const at = h => new Date(2026, 9, 16, h, 0);

test("every mood points to a pose that exists in the kit as webp", () => {
  for (const pose of Object.values(MOOD_POSE)) {
    assert.ok(existsSync(path.join(kit, `${pose}.webp`)), `${pose}.webp is missing — run npm run lumi:webp`);
  }
  for (const r of [...TAP_REACTIONS, LOVE_REACTION, SHY_REACTION, WAKE_REACTION]) {
    assert.ok(MOOD_POSE[r.mood], `reaction mood ${r.mood} has no pose`);
  }
});

test("Lumi only sleeps in the small hours, never at movie time", () => {
  assert.equal(isSleepyHour(at(2)), true);
  assert.equal(isSleepyHour(at(21)), false);
  assert.equal(isSleepyHour(at(23)), false);
});

test("home mood follows the main card priority", () => {
  const base = { total: 5, title: "Duna", partner: "Léo", now: at(15) };
  assert.equal(homeLumi({ ...base, mainCard: "review", partnerRated: true }).mood, "curious");
  assert.match(homeLumi({ ...base, mainCard: "review", partnerRated: true }).line, /Léo já deu a nota/);
  assert.equal(homeLumi({ ...base, mainCard: "session", sessionState: "hoje" }).mood, "popcorn");
  assert.equal(homeLumi({ ...base, mainCard: "continue" }).line, "Falta pouco pra terminarem Duna.");
  assert.equal(homeLumi({ ...base, total: 0, mainCard: "suggestion" }).mood, "waiting");
});

test("Lumi never guilts the couple about frequency", () => {
  const lines = ["review", "session", "continue", "suggestion"].flatMap(mainCard =>
    [at(10), at(20)].map(now => homeLumi({ total: 3, mainCard, sessionState: "marcada", title: "X", partner: "Léo", now }).line));
  for (const line of lines) assert.doesNotMatch(line, /faz tempo|sumiram|saudade de vocês|esqueceram/i);
});
