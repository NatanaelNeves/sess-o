// Testa as regras reais (firestore.rules) no emulador do Firestore.
// Rode com: npm run test:rules
import test, { before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc } from "firebase/firestore";

let env;
const COUPLE = "casal1";
const WATCHED = `couples/${COUPLE}/watched/filme1`;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-sessao",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});
after(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, `couples/${COUPLE}`), { uid1: "ana", name1: "Ana", uid2: "leo", name2: "Léo", inviteCode: "PIPOCA42" });
    await setDoc(doc(db, WATCHED), { title: "Duna", reviews: { "Léo": { rating: 4, text: "" } } });
    await setDoc(doc(db, `couples/${COUPLE}/watched/semNotas`), { title: "Oppenheimer" });
  });
});

const as = uid => env.authenticatedContext(uid).firestore();

// é exatamente a escrita de saveReview() no App.jsx
test("a member adds their own review next to the partner's", async () => {
  await assertSucceeds(updateDoc(doc(as("ana"), WATCHED), { "reviews.Ana": { rating: 5, text: "linda" } }));
});

test("a member adds the first review of a memory", async () => {
  await assertSucceeds(updateDoc(doc(as("ana"), `couples/${COUPLE}/watched/semNotas`), { "reviews.Ana": { rating: 3, text: "" } }));
});

test("a member edits their own existing review", async () => {
  await assertSucceeds(updateDoc(doc(as("leo"), WATCHED), { "reviews.Léo": { rating: 2, text: "mudei de ideia" } }));
});

// é a escrita de editWatched(): o formulário "Editar registro" regrava o documento inteiro
test("editing a memory saves other fields together with your own review", async () => {
  await assertSucceeds(setDoc(doc(as("ana"), WATCHED), {
    title: "Duna", date: "2026-10-20",
    reviews: { "Léo": { rating: 4, text: "" }, "Ana": { rating: 5, text: "de novo" } },
  }));
});

test("editing a memory cannot change the partner's review", async () => {
  await assertFails(setDoc(doc(as("ana"), WATCHED), {
    title: "Duna", date: "2026-10-20",
    reviews: { "Léo": { rating: 1, text: "" }, "Ana": { rating: 5, text: "" } },
  }));
});

test("editing a memory cannot delete the partner's review", async () => {
  await assertFails(setDoc(doc(as("ana"), WATCHED), {
    title: "Duna", reviews: { "Ana": { rating: 5, text: "" } },
  }));
});

// é a escrita de addWatched(): registrar uma memória nova já com a própria nota
test("a new memory can carry your own review", async () => {
  await assertSucceeds(setDoc(doc(as("ana"), `couples/${COUPLE}/watched/novo`), {
    title: "La La Land", reviews: { "Ana": { rating: 5, text: "" } },
  }));
});

test("a new memory cannot carry the partner's review", async () => {
  await assertFails(setDoc(doc(as("ana"), `couples/${COUPLE}/watched/novo`), {
    title: "La La Land", reviews: { "Léo": { rating: 5, text: "" } },
  }));
});

test("nobody can write the partner's review", async () => {
  await assertFails(updateDoc(doc(as("ana"), WATCHED), { "reviews.Léo": { rating: 1, text: "" } }));
});

test("someone outside the couple cannot review", async () => {
  await assertFails(updateDoc(doc(as("estranho"), WATCHED), { "reviews.Ana": { rating: 5, text: "" } }));
});
