// Entrar, sair e passar o diário adiante — regras reais no emulador.
// Rode com: npm run test:rules
import test, { before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, getDoc, deleteDoc, deleteField, writeBatch } from "firebase/firestore";

let env;
const COUPLE = "couples/casal1";
const INVITE = "inviteCodes/PIPOCA42";
const WATCHED = `${COUPLE}/watched/filme1`;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-sessao-casal",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});
after(async () => env?.cleanup());

const as = uid => env.authenticatedContext(uid).firestore();

// casal completo por padrão; `solo` simula a vaga aberta depois de uma saída
// (uid2/name2 apagados com deleteField, não gravados como null)
async function seed({ solo = false } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    const couple = { uid1: "ana", name1: "Ana", inviteCode: "PIPOCA42" };
    if (!solo) Object.assign(couple, { uid2: "leo", name2: "Léo" });
    await setDoc(doc(db, COUPLE), couple);
    await setDoc(doc(db, INVITE), { coupleId: "casal1", createdBy: "ana" });
    await setDoc(doc(db, WATCHED), { title: "Duna", reviews: { "Léo": { rating: 4, text: "" } } });
  });
}
beforeEach(() => seed());

// a saída do parceiro em leaveCouple(): sai da dupla e leva o código junto
const leaveBatch = db => {
  const batch = writeBatch(db);
  batch.update(doc(db, COUPLE), { uid2: deleteField(), name2: deleteField() });
  batch.delete(doc(db, INVITE));
  return batch.commit();
};

// a saída de quem criou em leaveCouple(): o diário fica com a outra pessoa
const handoverBatch = db => {
  const batch = writeBatch(db);
  batch.update(doc(db, COUPLE), { uid1: "leo", name1: "Léo", uid2: deleteField(), name2: deleteField() });
  batch.delete(doc(db, INVITE));
  return batch.commit();
};

// rotateInvite(): código novo no casal e no índice, no mesmo lote
const rotateBatch = (db, code = "NOVO2345") => {
  const batch = writeBatch(db);
  batch.update(doc(db, COUPLE), { inviteCode: code });
  batch.set(doc(db, `inviteCodes/${code}`), { coupleId: "casal1", createdBy: "ana", createdAt: "2026-11-08" });
  return batch.commit();
};

test("the partner leaves and takes the old code down in the same batch", async () => {
  await assertSucceeds(leaveBatch(as("leo")));
});

test("after a partner left, a new person with the current code can join", async () => {
  await seed({ solo: true });
  await assertSucceeds(updateDoc(doc(as("bia"), COUPLE), { uid2: "bia", name2: "Bia", joinedWith: "PIPOCA42" }));
});

test("after a partner left, joining without showing the code is refused", async () => {
  await seed({ solo: true });
  await assertFails(updateDoc(doc(as("bia"), COUPLE), { uid2: "bia", name2: "Bia" }));
  await assertFails(updateDoc(doc(as("bia"), COUPLE), { uid2: "bia", name2: "Bia", joinedWith: "ERRADO23" }));
});

test("a diary that never had a partner still accepts the old app's join (no joinedWith)", async () => {
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), COUPLE), {
    uid1: "ana", name1: "Ana", uid2: null, name2: null, inviteCode: "PIPOCA42",
  }));
  await assertSucceeds(updateDoc(doc(as("bia"), COUPLE), { uid2: "bia", name2: "Bia" }));
});

test("the ex-partner cannot come back with the code that was taken down", async () => {
  await assertSucceeds(leaveBatch(as("leo")));
  await assertFails(updateDoc(doc(as("leo"), COUPLE), { uid2: "leo", name2: "Léo", joinedWith: "PIPOCA42" }));
});

test("the ex-partner cannot come back with the old code after it was rotated", async () => {
  await assertSucceeds(leaveBatch(as("leo")));
  await assertSucceeds(rotateBatch(as("ana")));
  await assertFails(updateDoc(doc(as("leo"), COUPLE), { uid2: "leo", name2: "Léo", joinedWith: "PIPOCA42" }));
  await assertFails(updateDoc(doc(as("leo"), COUPLE), { uid2: "leo", name2: "Léo" }));
});

test("the owner cannot reopen the old-app join path by writing name2 back", async () => {
  await seed({ solo: true });
  await assertFails(updateDoc(doc(as("ana"), COUPLE), { name2: null }));
});

test("whoever created the diary cannot join it as their own partner", async () => {
  await seed({ solo: true });
  await assertFails(updateDoc(doc(as("ana"), COUPLE), { uid2: "ana", name2: "Ana" }));
});

test("with the seat open, the owner can still edit the profile and save reviews", async () => {
  await seed({ solo: true });
  await assertSucceeds(updateDoc(doc(as("ana"), COUPLE), { since: "2020-02-02" }));
  await assertSucceeds(updateDoc(doc(as("ana"), WATCHED), { "reviews.Ana": { rating: 5, text: "" } }));
});

test("the owner rotates the code while the seat is open", async () => {
  await seed({ solo: true });
  await env.withSecurityRulesDisabled(ctx => deleteDoc(doc(ctx.firestore(), INVITE)));
  await assertSucceeds(rotateBatch(as("ana")));
});

test("the code cannot be rotated while there is a partner", async () => {
  await assertFails(rotateBatch(as("ana")));
});

test("the owner hands the diary over to the partner", async () => {
  await assertSucceeds(handoverBatch(as("ana")));
  await assertSucceeds(getDoc(doc(as("leo"), WATCHED)));
  await assertFails(getDoc(doc(as("ana"), WATCHED)));
});

test("the new owner rotates the code after a handover", async () => {
  await assertSucceeds(handoverBatch(as("ana")));
  const db = as("leo");
  const batch = writeBatch(db);
  batch.update(doc(db, COUPLE), { inviteCode: "LEO23456" });
  batch.set(doc(db, "inviteCodes/LEO23456"), { coupleId: "casal1", createdBy: "leo" });
  await assertSucceeds(batch.commit());
});

test("a handover can only go to the current partner", async () => {
  await assertFails(updateDoc(doc(as("ana"), COUPLE), { uid1: "eve", name1: "Eve", uid2: deleteField(), name2: deleteField() }));
});

test("the partner cannot take the diary for themselves", async () => {
  await assertFails(updateDoc(doc(as("leo"), COUPLE), { uid1: "leo", name1: "Léo", uid2: deleteField(), name2: deleteField() }));
});

test("the new owner can take down a code created by the previous owner", async () => {
  await env.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), COUPLE), {
    uid1: "leo", name1: "Léo", uid2: deleteField(), name2: deleteField(),
  }));
  await assertSucceeds(deleteDoc(doc(as("leo"), INVITE)));
});

test("someone outside the couple cannot take down its code", async () => {
  await assertFails(deleteDoc(doc(as("eve"), INVITE)));
});
