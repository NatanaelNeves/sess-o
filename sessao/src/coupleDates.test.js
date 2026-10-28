import test from "node:test";
import assert from "node:assert/strict";
import { relationshipDuration, relationshipLine, daysOnSessao, sessaoDaysLine } from "./coupleDates.js";

const now = new Date("2026-10-28T20:00:00");

test("relationship duration reads as relationship, not app usage", () => {
  assert.equal(relationshipLine("2025-03-10", now), "1 ano e 7 meses de relacionamento");
  assert.equal(relationshipDuration("2025-10-28", now), "1 ano");
  assert.equal(relationshipDuration("2026-10-20", now), "menos de um mês");
});

test("no relationship date means no relationship line", () => {
  assert.equal(relationshipLine(null, now), null);
  assert.equal(relationshipLine("2027-01-01", now), null);
});

test("days on Sessão count from the diary creation, never from the relationship", () => {
  assert.equal(daysOnSessao("2026-10-28T09:00:00.000Z", now), 0);
  assert.equal(sessaoDaysLine("2026-10-27T18:00:00", now), "1 dia de Sessão");
  assert.equal(sessaoDaysLine("2025-10-28T18:00:00", now), "365 dias de Sessão");
  assert.equal(sessaoDaysLine(undefined, now), "juntos no Sessão");
});
