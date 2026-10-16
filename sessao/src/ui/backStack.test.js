import test from "node:test";
import assert from "node:assert/strict";
import { createBackStack } from "./backStack.js";

// histórico falso, com o "voltar" assíncrono como no navegador
const fakeWindow = () => {
  const listeners = [];
  const entries = [null];
  let index = 0;
  return {
    addEventListener: (type, fn) => type === "popstate" && listeners.push(fn),
    history: {
      pushState: state => { entries.splice(index + 1); entries.push(state); index++; },
      back: () => setTimeout(() => { if (index > 0) { index--; listeners.forEach(fn => fn()); } }, 0),
    },
    get index() { return index; },
  };
};
const settle = () => new Promise(r => setTimeout(r, 30));

test("the phone back button closes only the top layer", async () => {
  const win = fakeWindow();
  const stack = createBackStack(win);
  const closed = [];
  stack.open(() => closed.push("tab"));
  stack.open(() => closed.push("modal"));
  await settle();
  win.history.back();
  await settle();
  assert.deepEqual(closed, ["modal"]);
  win.history.back();
  await settle();
  assert.deepEqual(closed, ["modal", "tab"]);
  assert.equal(win.index, 0, "no history entry is left behind");
});

test("closing a layer from the UI does not close another one", async () => {
  const win = fakeWindow();
  const stack = createBackStack(win);
  const closed = [];
  stack.open(() => closed.push("tab"));
  const dropModal = stack.open(() => closed.push("modal"));
  await settle();
  dropModal();
  await settle();
  assert.deepEqual(closed, []);
  win.history.back();
  await settle();
  assert.deepEqual(closed, ["tab"]);
  assert.equal(win.index, 0);
});

test("closing everything from the UI removes the guard entry", async () => {
  const win = fakeWindow();
  const stack = createBackStack(win);
  const drop = stack.open(() => {});
  await settle();
  assert.equal(win.index, 1);
  drop();
  await settle();
  assert.equal(win.index, 0);
});

test("swapping modals in the same instant (or StrictMode remounts) keeps one back step", async () => {
  const win = fakeWindow();
  const stack = createBackStack(win);
  const closed = [];
  const dropDetail = stack.open(() => closed.push("detail"));
  dropDetail();
  stack.open(() => closed.push("edit"));
  await settle();
  assert.equal(win.index, 1);
  win.history.back();
  await settle();
  assert.deepEqual(closed, ["edit"]);
  assert.equal(win.index, 0);
});
