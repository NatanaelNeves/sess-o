import test from "node:test";
import assert from "node:assert/strict";
import { gostoDoCasal, generosFavoritos } from "./gosto.js";
import { ranquear } from "./ranking.js";
import { montarProgramacao } from "./candidatos.js";

const USERS = ["Ana", "Léo"];
const HOJE = new Date("2026-10-31T20:00:00");
const memoria = (id, generos, ana, leo, extra = {}) => ({
  id: `m${id}`, tmdbId: id, type: "movie", title: `Filme ${id}`, genres: generos, date: "2026-09-01",
  reviews: { Ana: { rating: ana }, Léo: { rating: leo } }, ...extra,
});

const ACERVO = [
  memoria(1, ["Ficção científica"], 5, 5, { title: "Interestelar" }),
  memoria(2, ["Ficção científica", "Drama"], 5, 4),
  memoria(3, ["Romance"], 4, 4),
  memoria(4, ["Terror"], 1, 4),
  memoria(5, ["Terror"], 2, 5),
];

test("the couple's taste favours genres both rate highly and avoids what one of them dislikes", () => {
  const gosto = gostoDoCasal(ACERVO, USERS, HOJE);
  assert.equal(generosFavoritos(gosto, 1)[0], "Ficção científica");
  assert.ok(gosto.evitar.has("Terror"), "Ana dá nota baixa para terror");
  assert.deepEqual(gosto.sementes.map(s => s.title).slice(0, 1), ["Interestelar"]);
  assert.ok(gosto.vistos.has("movie-1"));
  assert.equal(gosto.maturidade, 5);
});

const cand = (id, generos, extra = {}) => ({
  key: `movie-${id}`, tmdbId: id, type: "movie", title: `C${id}`, generos, nota: 7.5, votos: 2000,
  fontes: new Set(["descoberta"]), ...extra,
});

test("ranking skips what the couple saw or turned down, and explains each pick", () => {
  const gosto = gostoDoCasal(ACERVO, USERS, HOJE);
  const lista = ranquear([
    cand(1, ["Ficção científica"]),                           // já visto
    cand(10, ["Ficção científica"], { fontes: new Set(["semente"]), semente: "Interestelar" }),
    cand(11, ["Terror"]),                                     // gênero a evitar
    cand(12, ["Romance"]),
    cand(13, ["Comédia"]),
  ], gosto, { excluir: new Set(["movie-13"]), users: USERS, hoje: HOJE });

  assert.deepEqual(lista.map(c => c.tmdbId), [10, 12, 11]);
  assert.equal(lista[0].motivo, "Porque vocês dois amaram Interestelar.");
});

test("a title both of you already want beats a slightly better unknown", () => {
  const gosto = gostoDoCasal(ACERVO, USERS, HOJE);
  const naLista = { wantedBy: ["Ana", "Léo"], addedAt: "2026-07-01T00:00:00Z" };
  const lista = ranquear([
    cand(20, ["Romance"], { nota: 8.2 }),
    cand(21, ["Romance"], { nota: 7.0, naLista, fontes: new Set(["lista"]), provedores: ["Netflix"] }),
  ], gosto, { users: USERS, hoje: HOJE });
  assert.equal(lista[0].tmdbId, 21);
  assert.equal(lista[0].motivo, "Está na lista de vocês dois há 4 meses, e já dá pra ver no Netflix.");
});

test("picks are diversified so the three options are not the same kind of film", () => {
  const gosto = gostoDoCasal(ACERVO, USERS, HOJE);
  const lista = ranquear([
    cand(30, ["Ficção científica"], { nota: 8.6 }),
    cand(31, ["Ficção científica"], { nota: 8.5 }),
    cand(32, ["Romance"], { nota: 7.4 }),
  ], gosto, { users: USERS, hoje: HOJE, limite: 2 });
  assert.deepEqual(lista.map(c => c.tmdbId), [30, 32]);
});

// TMDB falso: só o necessário para a programação
function tmdbFalso({ disponiveis }) {
  const chamadas = [];
  const request = async (endpoint, params = {}) => {
    chamadas.push(endpoint);
    if (endpoint === "/genre/movie/list") return { genres: [{ id: 878, name: "Ficção científica" }, { id: 10749, name: "Romance" }] };
    if (endpoint === "/genre/tv/list") return { genres: [] };
    if (endpoint === "/movie/1/recommendations") return { results: [{ id: 100, title: "Contato", genre_ids: [878], vote_average: 7.4, vote_count: 4000 }] };
    if (endpoint === "/discover/movie" && params["primary_release_date.gte"]) {
      return { results: [{ id: 200, title: "Novo", genre_ids: [10749], vote_average: 7.0, vote_count: 80, release_date: "2026-10-10" }] };
    }
    if (endpoint === "/discover/movie") return { results: [{ id: 300, title: "Gravidade", genre_ids: [878], vote_average: 7.2, vote_count: 9000 }] };
    const m = endpoint.match(/^\/movie\/(\d+)\/watch\/providers$/);
    if (m) {
      const id = Number(m[1]);
      return disponiveis[id]
        ? { results: { BR: { link: `https://jw/${id}`, flatrate: disponiveis[id].map(p => ({ provider_id: p[0], provider_name: p[1] })) } } }
        : { results: {} };
    }
    return { results: [] };
  };
  return { request, chamadas };
}

test("today's lineup only offers titles available on the couple's streaming services", async () => {
  const gosto = gostoDoCasal(ACERVO, USERS, HOJE);
  const { request } = tmdbFalso({ disponiveis: { 100: [[8, "Netflix"]], 300: [[337, "Disney Plus"]], 200: [[119, "Prime Video"]] } });
  const lista = await montarProgramacao({ request, gosto, streamings: [8, 119], watchlist: [], users: USERS, hoje: HOJE });
  assert.deepEqual(lista.map(c => c.tmdbId).sort(), [100, 200], "Gravidade só está no Disney Plus, que eles não têm");
  const contato = lista.find(c => c.tmdbId === 100);
  assert.equal(contato.motivo, "Porque vocês dois amaram Interestelar.");
  assert.equal(contato.link, "https://jw/100");
  assert.equal(lista.find(c => c.tmdbId === 200).motivo, "Acabou de chegar no Prime Video.");
});

test("a TMDB failure in one source does not sink the whole lineup", async () => {
  const gosto = gostoDoCasal(ACERVO, USERS, HOJE);
  const base = tmdbFalso({ disponiveis: { 300: [[8, "Netflix"]] } }).request;
  const request = async (endpoint, params) => {
    if (endpoint.includes("recommendations")) throw new Error("TMDB_HTTP_500");
    return base(endpoint, params);
  };
  const lista = await montarProgramacao({ request, gosto, streamings: [8], watchlist: [], users: USERS, hoje: HOJE });
  assert.deepEqual(lista.map(c => c.tmdbId), [300]);
});

test("from a saga on the list, only the next unseen part is suggested", async () => {
  const gosto = gostoDoCasal(ACERVO, USERS, HOJE);
  const { request } = tmdbFalso({ disponiveis: { 501: [[8, "Netflix"]], 502: [[8, "Netflix"]] } });
  const saga = { id: 119, name: "O Senhor dos Anéis — Coleção" };
  const watchlist = [
    { id: "w3", tmdbId: 502, type: "movie", title: "O Retorno do Rei", genres: ["Fantasia"], collection: saga, sagaOrder: 2, wantedBy: ["Léo"] },
    { id: "w2", tmdbId: 501, type: "movie", title: "As Duas Torres", genres: ["Fantasia"], collection: saga, sagaOrder: 1, wantedBy: ["Léo"] },
  ];
  const lista = await montarProgramacao({ request, gosto, streamings: [8], watchlist, users: USERS, hoje: HOJE });
  const titulos = lista.map(c => c.title);
  assert.ok(titulos.includes("As Duas Torres"));
  assert.ok(!titulos.includes("O Retorno do Rei"));
});

test("the three picks do not all give the same reason", () => {
  const gosto = gostoDoCasal(ACERVO, USERS, HOJE);
  const novo = (id, generos) => cand(id, generos, { fontes: new Set(["lancamento"]), lancamento: "2026-10-20", provedores: ["Netflix"] });
  const lista = ranquear([
    novo(40, ["Comédia"]), novo(41, ["Animação"]), novo(42, ["Documentário"]),
    cand(43, ["Romance"], { nota: 7.2 }),
  ], gosto, { users: USERS, hoje: HOJE, limite: 3 });
  const motivos = lista.map(c => c.motivo);
  assert.ok(new Set(motivos).size >= 2, `motivos repetidos: ${motivos.join(" | ")}`);
});
