// Cliente do TMDB compartilhado pelo app e pelo motor de sugestões.
export const TMDB_BASE = "https://api.themoviedb.org/3";
export const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
export const TMDB_BG = "https://image.tmdb.org/t/p/w1280";
export const TMDB_LOGO = "https://image.tmdb.org/t/p/w92";
export const TMDB_SM = "https://image.tmdb.org/t/p/w300";

const TMDB_READ_TOKEN = import.meta.env.VITE_TMDB_READ_TOKEN;
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

export async function tmdbRequest(endpoint, params = {}) {
  if (!TMDB_READ_TOKEN && !TMDB_API_KEY) {
    const error = new Error("TMDB_AUTH_MISSING");
    error.status = 0;
    throw error;
  }

  const url = new URL(`${TMDB_BASE}${endpoint}`);
  if (TMDB_API_KEY) {
    url.searchParams.set("api_key", TMDB_API_KEY);
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, {
    headers: TMDB_READ_TOKEN
      ? {
          Authorization: `Bearer ${TMDB_READ_TOKEN}`,
          Accept: "application/json",
        }
      : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.status_message || `TMDB_HTTP_${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

// Mesma consulta, guardada por um tempo no aparelho: a programação de hoje não
// precisa refazer dezenas de pedidos cada vez que o casal abre a tela.
const DAY = 24 * 60 * 60 * 1000;
export async function tmdbCached(endpoint, params = {}, ttl = DAY) {
  const key = `tmdb:${endpoint}?${new URLSearchParams(params)}`;
  try {
    const hit = JSON.parse(localStorage.getItem(key) || "null");
    if (hit && Date.now() - hit.at < ttl) return hit.data;
  } catch { /* storage indisponível: segue sem cache */ }
  const data = await tmdbRequest(endpoint, params);
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); }
  catch { /* cota cheia: tudo bem, só não guarda */ }
  return data;
}
