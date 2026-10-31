// O gosto do casal, tirado só do que vocês já registraram: notas (1–5 estrelas),
// gêneros e o que já viram. Funções puras — nada de rede aqui.

const dataDe = e => e.date || (e.createdAt || "").slice(0, 10) || "";
export const chaveTitulo = (type, tmdbId) => `${type === "tv" ? "tv" : "movie"}-${tmdbId}`;

function notasDe(entry, users) {
  return users.map(u => entry.reviews?.[u]?.rating || 0).filter(Boolean);
}

/**
 * - generos: nome → { afinidade (-1 a 1, encolhida quando há poucas notas), n }
 * - evitar: gêneros em que pelo menos um dos dois costuma dar nota baixa
 * - sementes: títulos que os dois avaliaram bem — as melhores pistas do gosto conjunto
 * - vistos: chaves "movie-123"/"tv-456" do que já está no acervo
 * - maturidade: quantas memórias têm nota (com poucas, o gosto ainda não está formado)
 */
export function gostoDoCasal(watched, users, hoje = new Date()) {
  const porGenero = new Map();
  const porPessoaGenero = new Map(); // `${pessoa}|${genero}` → notas
  const sementes = [];
  const vistos = new Set();
  let maturidade = 0;

  for (const e of watched) {
    if (e.tmdbId) vistos.add(chaveTitulo(e.type, e.tmdbId));
    const notas = notasDe(e, users);
    if (!notas.length) continue;
    maturidade++;
    const media = notas.reduce((a, b) => a + b, 0) / notas.length;
    // memórias recentes pesam mais: meia-vida de um ano
    const dias = Math.max(0, (hoje - new Date(dataDe(e) + "T12:00:00")) / 86400000) || 0;
    const peso = Math.pow(0.5, dias / 365);

    for (const g of e.genres || []) {
      const acc = porGenero.get(g) || { soma: 0, peso: 0, n: 0 };
      acc.soma += media * peso; acc.peso += peso; acc.n++;
      porGenero.set(g, acc);
      for (const u of users) {
        const r = e.reviews?.[u]?.rating;
        if (!r) continue;
        const k = `${u}|${g}`;
        porPessoaGenero.set(k, [...(porPessoaGenero.get(k) || []), r]);
      }
    }

    const todosGostaram = notas.length === users.length && notas.every(r => r >= 4);
    if (todosGostaram && e.tmdbId) {
      sementes.push({ tmdbId: e.tmdbId, type: e.type === "tv" ? "tv" : "movie", title: e.title, peso: media + peso });
    }
  }

  const generos = new Map();
  for (const [g, { soma, peso, n }] of porGenero) {
    const media = soma / (peso || 1);
    // com poucas notas a afinidade é encolhida para perto de zero
    generos.set(g, { afinidade: ((media - 3) / 2) * (n / (n + 2)), n });
  }

  const evitar = new Set();
  for (const [k, notas] of porPessoaGenero) {
    const media = notas.reduce((a, b) => a + b, 0) / notas.length;
    if (notas.length >= 2 && media <= 2.5) evitar.add(k.split("|")[1]);
  }

  sementes.sort((a, b) => b.peso - a.peso);
  return { generos, evitar, sementes: sementes.slice(0, 4), vistos, maturidade };
}

/** Gêneros de que o casal mais gosta, do mais forte para o mais fraco. */
export function generosFavoritos(gosto, limite = 3) {
  return [...gosto.generos.entries()]
    .filter(([g, v]) => v.afinidade > 0 && !gosto.evitar.has(g))
    .sort((a, b) => b[1].afinidade - a[1].afinidade)
    .slice(0, limite)
    .map(([g]) => g);
}
