// Busca candidatos no TMDB e monta a programação de hoje.
// `request(endpoint, params)` é injetado: no app é o tmdbCached, nos testes um falso.
import { chaveTitulo, generosFavoritos } from "./gosto.js";
import { ranquear } from "./ranking.js";

const LANG = "pt-BR";
const REGIAO = "BR";

async function mapaDeGeneros(request) {
  const [filmes, series] = await Promise.all([
    request("/genre/movie/list", { language: LANG }),
    request("/genre/tv/list", { language: LANG }),
  ]);
  const nomes = new Map();
  for (const g of [...(filmes.genres || []), ...(series.genres || [])]) nomes.set(g.id, g.name);
  const idsDeFilme = new Map((filmes.genres || []).map(g => [g.name, g.id]));
  return { nomes, idsDeFilme };
}

function doTmdb(r, type, fonte, generos, extra = {}) {
  const t = r.media_type === "tv" || type === "tv" ? "tv" : "movie";
  return {
    key: chaveTitulo(t, r.id),
    tmdbId: r.id,
    type: t,
    title: r.title || r.name,
    year: (r.release_date || r.first_air_date || "").slice(0, 4),
    lancamento: r.release_date || r.first_air_date || null,
    poster: r.poster_path || null,
    backdrop: r.backdrop_path || null,
    overview: r.overview || "",
    generos: (r.genre_ids || []).map(id => generos.nomes.get(id)).filter(Boolean),
    nota: r.vote_average || 0,
    votos: r.vote_count || 0,
    fontes: new Set([fonte]),
    ...extra,
  };
}

function daLista(item) {
  const type = item.type === "tv" ? "tv" : "movie";
  return {
    key: chaveTitulo(type, item.tmdbId),
    tmdbId: item.tmdbId,
    type,
    title: item.title,
    year: item.year || "",
    lancamento: null,
    poster: item.poster || null,
    backdrop: item.backdrop || null,
    overview: item.overview || "",
    generos: item.genres || [],
    nota: parseFloat(item.tmdbRating) || 0,
    votos: 0,
    fontes: new Set(["lista"]),
    naLista: item,
  };
}

function juntar(mapa, c) {
  const atual = mapa.get(c.key);
  if (!atual) { mapa.set(c.key, c); return; }
  c.fontes.forEach(f => atual.fontes.add(f));
  atual.semente = atual.semente || c.semente;
  atual.naLista = atual.naLista || c.naLista;
}

const isoDiasAtras = (hoje, dias) => new Date(hoje - dias * 86400000).toISOString().slice(0, 10);

/** Reúne candidatos de quatro fontes: sementes, gosto, lançamentos e a lista a dois. */
export async function buscarCandidatos({ request, gosto, streamings, watchlist = [], hoje = new Date() }) {
  const generos = await mapaDeGeneros(request);
  const provedores = streamings.join("|");
  const favoritos = generosFavoritos(gosto, 3).map(g => generos.idsDeFilme.get(g)).filter(Boolean);
  const comuns = { language: LANG, watch_region: REGIAO, with_watch_providers: provedores, with_watch_monetization_types: "flatrate" };

  const pedidos = [
    // parecidos com o que os dois amaram
    ...gosto.sementes.slice(0, 3).map(s =>
      request(`/${s.type}/${s.tmdbId}/recommendations`, { language: LANG })
        .then(d => (d.results || []).slice(0, 12).map(r => doTmdb(r, s.type, "semente", generos, { semente: s.title })))
        .catch(() => [])),
    // o gosto do casal no que está nos streamings deles
    request("/discover/movie", {
      ...comuns, with_genres: favoritos.join("|"), sort_by: "popularity.desc",
      "vote_average.gte": 6.5, "vote_count.gte": 150,
    }).then(d => (d.results || []).map(r => doTmdb(r, "movie", "descoberta", generos))).catch(() => []),
    // o que acabou de chegar
    request("/discover/movie", {
      ...comuns, sort_by: "popularity.desc", "primary_release_date.gte": isoDiasAtras(hoje, 120),
      "primary_release_date.lte": hoje.toISOString().slice(0, 10), "vote_count.gte": 20,
    }).then(d => (d.results || []).map(r => doTmdb(r, "movie", "lancamento", generos))).catch(() => []),
  ];

  const mapa = new Map();
  (await Promise.all(pedidos)).flat().forEach(c => juntar(mapa, c));
  proximosDaLista(watchlist).forEach(w => juntar(mapa, daLista(w)));
  return [...mapa.values()];
}

// De uma saga na lista, só a próxima parte ainda não vista: sugerir o terceiro
// filme quando o segundo está esperando na fila seria pular a história.
function proximosDaLista(watchlist) {
  const proximoDaSaga = new Map();
  const soltos = [];
  for (const w of watchlist.filter(w => w.tmdbId)) {
    if (!w.collection?.id) { soltos.push(w); continue; }
    const atual = proximoDaSaga.get(w.collection.id);
    if (!atual || (w.sagaOrder ?? Infinity) < (atual.sagaOrder ?? Infinity)) proximoDaSaga.set(w.collection.id, w);
  }
  return [...soltos, ...proximoDaSaga.values()];
}

/** Em quais dos streamings do casal o título está agora (assinatura, no Brasil). */
async function ondeAssistir(request, c, streamings) {
  try {
    const d = await request(`/${c.type}/${c.tmdbId}/watch/providers`);
    const br = d.results?.[REGIAO];
    const nossos = (br?.flatrate || []).filter(p => streamings.includes(p.provider_id));
    return nossos.length ? { provedores: nossos.map(p => p.provider_name), link: br.link || null } : null;
  } catch {
    return null;
  }
}

/**
 * A programação de hoje: ordena tudo, confere onde assistir só para os mais
 * promissores (cada conferência é uma consulta) e devolve a lista final já com
 * o motivo de cada um. As 3 primeiras são a sugestão; o resto são reservas.
 */
export async function montarProgramacao({ request, gosto, streamings, watchlist, excluir = new Set(), users = [], hoje = new Date(), conferir = 24 }) {
  const candidatos = await buscarCandidatos({ request, gosto, streamings, watchlist, hoje });
  const previa = ranquear(candidatos, gosto, { excluir, users, hoje, limite: conferir });
  const conferidos = await Promise.all(previa.map(async c => {
    const onde = await ondeAssistir(request, c, streamings);
    return onde ? { ...c, ...onde } : null;
  }));
  return ranquear(conferidos.filter(Boolean), gosto, { excluir, users, hoje });
}
