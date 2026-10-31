// Regras da feature de sugestões: os streamings do casal e o "já vimos / não é pra nós".
// Rode com: npm run test:rules
import test, { before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, getDoc } from "firebase/firestore";

let env;
const COUPLE = "casal1";

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-sessao-sugestoes",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});
after(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), `couples/${COUPLE}`), { uid1: "ana", name1: "Ana", uid2: "leo", name2: "Léo", inviteCode: "PIPOCA42" });
  });
});

const as = uid => env.authenticatedContext(uid).firestore();

test("either partner can set the couple's streaming services", async () => {
  await assertSucceeds(updateDoc(doc(as("ana"), `couples/${COUPLE}`), { streamings: [8, 119] }));
  await assertSucceeds(updateDoc(doc(as("leo"), `couples/${COUPLE}`), { streamings: [8] }));
});

test("streaming services must be a short list", async () => {
  await assertFails(updateDoc(doc(as("ana"), `couples/${COUPLE}`), { streamings: "netflix" }));
  await assertFails(updateDoc(doc(as("ana"), `couples/${COUPLE}`), { streamings: Array.from({ length: 41 }, (_, i) => i) }));
});

test("setting streamings cannot sneak in other couple fields", async () => {
  await assertFails(updateDoc(doc(as("ana"), `couples/${COUPLE}`), { streamings: [8], uid2: "ana" }));
});

test("someone outside the couple cannot set its streamings", async () => {
  await assertFails(updateDoc(doc(as("estranho"), `couples/${COUPLE}`), { streamings: [8] }));
});

const sugestao = `couples/${COUPLE}/sugestoes/movie-100`;

test("a partner marks a suggestion as already seen or not for us, and both can read it", async () => {
  await assertSucceeds(setDoc(doc(as("ana"), sugestao), { veredito: "nao_e_pra_nos", por: "Ana", em: "2026-10-31T20:00:00Z" }));
  await assertSucceeds(getDoc(doc(as("leo"), sugestao)));
  await assertSucceeds(setDoc(doc(as("leo"), sugestao), { veredito: "ja_vimos", por: "Léo", em: "2026-10-31T21:00:00Z" }));
});

test("a suggestion verdict only takes the two known values", async () => {
  await assertFails(setDoc(doc(as("ana"), sugestao), { veredito: "qualquer", por: "Ana", em: "2026-10-31T20:00:00Z" }));
});

test("someone outside the couple cannot read or write its suggestions", async () => {
  await assertFails(setDoc(doc(as("estranho"), sugestao), { veredito: "ja_vimos", por: "X", em: "2026-10-31T20:00:00Z" }));
  await assertFails(getDoc(doc(as("estranho"), sugestao)));
});
