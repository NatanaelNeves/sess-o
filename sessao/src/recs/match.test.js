import test from "node:test";
import assert from "node:assert/strict";
import { montarBaralho, resultadoDoMatch } from "./match.js";
import { itemDaLista, querendoJuntos } from "./paraLista.js";

const c = id => ({ key: `movie-${id}`, tmdbId: id, type: "movie", title: `F${id}`, generos: ["Drama"], nota: 7.25 });

test("each round deals the next cards from the ranked list", () => {
  const ordenados = Array.from({ length: 30 }, (_, i) => c(i));
  assert.deepEqual(montarBaralho(ordenados, { tamanho: 3 }).map(x => x.tmdbId), [0, 1, 2]);
  assert.deepEqual(montarBaralho(ordenados, { rodada: 1, tamanho: 3 }).map(x => x.tmdbId), [3, 4, 5]);
});

test("a match is a title both of you swiped right, kept in deck order", () => {
  const baralho = [c(1), c(2), c(3), c(4)];
  const ana = new Map([["movie-1", true], ["movie-2", false], ["movie-3", true], ["movie-4", true]]);
  const leo = new Map([["movie-1", false], ["movie-2", true], ["movie-3", true], ["movie-4", true]]);
  const r = resultadoDoMatch(baralho, ana, leo);
  assert.deepEqual(r.matches.map(x => x.tmdbId), [3, 4]);
  assert.deepEqual(r.soDe[0].map(x => x.tmdbId), [1]);
  assert.deepEqual(r.soDe[1].map(x => x.tmdbId), [2]);
});

test("no shared yes means no match, but each person's picks are kept", () => {
  const r = resultadoDoMatch([c(1), c(2)], new Map([["movie-1", true]]), new Map([["movie-2", true]]));
  assert.equal(r.matches.length, 0);
  assert.equal(r.soDe[0][0].tmdbId, 1);
});

test("a match goes to the list wanted by both and marked as priority", () => {
  const item = itemDaLista(c(7), ["Ana", "Léo"]);
  assert.deepEqual(item.wantedBy, ["Ana", "Léo"]);
  assert.equal(item.priority, "alta");
  assert.equal(item.tmdbRating, "7.3");
  assert.deepEqual(querendoJuntos({ wantedBy: ["Léo"] }, ["Ana", "Léo"]), ["Léo", "Ana"]);
  assert.deepEqual(querendoJuntos({ suggestedBy: "Ana" }, ["Ana"]), ["Ana"]);
});
