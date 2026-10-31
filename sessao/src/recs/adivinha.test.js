import { test } from "node:test";
import assert from "node:assert/strict";
import { proximaPergunta, responder, horaDoPalpite, resumoDoPedido, MAX_PERGUNTAS } from "./adivinha.js";

const hoje = new Date("2026-10-31T20:00:00");
const filme = (key, generos, extra = {}) => ({ key, type: "movie", year: "2015", nota: 7, generos, ...extra });

const acervo = [
  filme("a", ["Comédia"]),
  filme("b", ["Comédia", "Romance"]),
  filme("c", ["Terror"]),
  filme("d", ["Drama"]),
];

test("escolhe a pergunta que divide os acesos mais perto do meio a meio", () => {
  // comédia separa 2 de 4; terror e drama separam só 1
  assert.equal(proximaPergunta(acervo, new Set(), { hoje }).id, "rir");
});

test("não repete pergunta nem faz pergunta que não separa ninguém", () => {
  const p = proximaPergunta(acervo, new Set(["rir"]), { hoje });
  assert.notEqual(p.id, "rir");
  assert.ok(!["acao", "serie", "classico"].includes(p.id));
});

test("sim mantém quem combina, não apaga, tanto faz deixa todos", () => {
  const rir = proximaPergunta(acervo, new Set(), { hoje });
  assert.deepEqual(responder(acervo, rir, "sim", { hoje }).map(c => c.key), ["a", "b"]);
  assert.deepEqual(responder(acervo, rir, "nao", { hoje }).map(c => c.key), ["c", "d"]);
  assert.equal(responder(acervo, rir, "tanto_faz", { hoje }), acervo);
});

test("pergunta pelo streaming quando ele divide os candidatos", () => {
  const mesmos = [
    filme("a", ["Drama"], { provedores: ["Netflix"] }),
    filme("b", ["Drama"], { provedores: ["Netflix"] }),
    filme("c", ["Drama"], { provedores: ["Max"] }),
    filme("d", ["Drama"], { provedores: ["Max"] }),
  ];
  const p = proximaPergunta(mesmos, new Set(), { hoje });
  assert.match(p.texto, /Netflix|Max/);
  assert.equal(responder(mesmos, p, "sim", { hoje }).length, 2);
});

test("recente conta este ano e o anterior", () => {
  const anos = [filme("a", [], { year: "2026" }), filme("b", [], { year: "2025" }), filme("c", [], { year: "2019" }), filme("d", [], { year: "2018" })];
  const p = proximaPergunta(anos, new Set(), { hoje });
  assert.equal(p.id, "recente");
  assert.deepEqual(responder(anos, p, "sim", { hoje }).map(c => c.key), ["a", "b"]);
});

test("hora do palpite: sobrou um, nada mais divide ou perguntas demais", () => {
  assert.equal(horaDoPalpite([acervo[0]], new Set(), { hoje }), true);
  assert.equal(horaDoPalpite([filme("x", ["Drama"]), filme("y", ["Drama"])], new Set(), { hoje }), true);
  assert.equal(horaDoPalpite(acervo, new Set(), { hoje }), false);
  const muitas = new Set(Array.from({ length: MAX_PERGUNTAS }, (_, i) => `p${i}`));
  assert.equal(horaDoPalpite(acervo, muitas, { hoje }), true);
});

test("resume o pedido com as últimas respostas, ignorando o tanto faz", () => {
  const p = (sim, nao) => ({ sim, nao });
  assert.equal(resumoDoPedido([]), "");
  assert.equal(resumoDoPedido([{ pergunta: p("de comédia", "sem comédia"), resposta: "sim" }]), "de comédia");
  assert.equal(resumoDoPedido([
    { pergunta: p("velho", "x"), resposta: "sim" },
    { pergunta: p("de comédia", "sem comédia"), resposta: "sim" },
    { pergunta: p("a", "b"), resposta: "tanto_faz" },
    { pergunta: p("com susto", "sem susto"), resposta: "nao" },
    { pergunta: p("no Netflix", "fora do Netflix"), resposta: "sim" },
  ]), "de comédia, sem susto e no Netflix");
});

test("quando dividem quase igual, prefere a pergunta de clima à de nota", () => {
  // nota divide 5/5 (perfeito); comédia divide 4/6, por pouco: vale a comédia
  const dez = Array.from({ length: 10 }, (_, i) =>
    filme(`f${i}`, i < 4 ? ["Comédia"] : ["Drama", "Romance"], { nota: i % 2 ? 8 : 6 }));
  assert.equal(proximaPergunta(dez, new Set(), { hoje }).id, "rir");
});
