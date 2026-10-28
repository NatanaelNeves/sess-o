import test from "node:test";
import assert from "node:assert/strict";
import { actionFromUrl, urlWithoutAction } from "./appActions.js";
import { planReminders, cinemaReminderTime, cinemaReminderId, FRIDAY_ID } from "./reminderPlan.js";

test("app shortcuts and site links open the same actions", () => {
  assert.deepEqual(actionFromUrl("com.natanaelneves.sessao://acao/registrar"), { acao: "registrar" });
  assert.deepEqual(actionFromUrl("https://sess-80b2c.web.app/?acao=roleta"), { acao: "roleta" });
  assert.deepEqual(actionFromUrl("https://localhost/?acao=cinema&id=w2"), { acao: "cinema", id: "w2" });
});

test("unknown actions and malformed links are ignored", () => {
  assert.equal(actionFromUrl("com.natanaelneves.sessao://acao/apagar-tudo"), null);
  assert.equal(actionFromUrl("https://sess-80b2c.web.app/"), null);
  assert.equal(actionFromUrl("não é url"), null);
});

test("invite links carry a normalized code, and bad codes are dropped", () => {
  assert.deepEqual(actionFromUrl("https://sess-80b2c.web.app/?convite=abcd-2345"), { acao: "convite", codigo: "ABCD2345" });
  assert.equal(actionFromUrl("https://sess-80b2c.web.app/?convite=x"), null);
  assert.equal(urlWithoutAction("https://sess-80b2c.web.app/?convite=ABCD2345&utm=1#a"), "/?utm=1#a");
});

test("cinema reminder fires 2h before the session, or at noon without a time", () => {
  assert.equal(cinemaReminderTime({ date: "2026-11-06", time: "21:40" }).toString(), new Date("2026-11-06T19:40:00").toString());
  assert.equal(cinemaReminderTime({ date: "2026-11-06" }).toString(), new Date("2026-11-06T12:00:00").toString());
  assert.equal(cinemaReminderTime({ date: "amanhã" }), null);
});

test("only upcoming sessions within 60 days get reminders; friday follows the preference", () => {
  const now = new Date("2026-10-28T20:00:00");
  const watchlist = [
    { id: "a", title: "Duna", plan: { date: "2026-11-06", time: "21:00", venue: "Kinoplex" } },
    { id: "b", title: "Passado", plan: { date: "2026-10-01", time: "20:00" } },
    { id: "c", title: "Longe", plan: { date: "2027-06-01" } },
    { id: "d", title: "Sem plano" },
  ];
  const off = planReminders({ watchlist, fridayReminders: false, now });
  assert.deepEqual(off.map(r => r.extra.id), ["a"]);
  assert.equal(off[0].body, "às 21:00 · Kinoplex");
  assert.equal(off[0].id, cinemaReminderId("a"));
  const on = planReminders({ watchlist, fridayReminders: true, now });
  assert.equal(on[0].id, FRIDAY_ID);
  assert.notEqual(cinemaReminderId("a"), FRIDAY_ID);
});
