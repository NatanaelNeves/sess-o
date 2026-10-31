// Ordena os candidatos para o casal e explica cada escolha. Funções puras.
//
// Candidato: { key, tmdbId, type, title, generos[], nota, votos, lancamento,
//              fontes: Set("semente" | "descoberta" | "lancamento" | "lista"),
//              semente?: título que originou, naLista?: item da lista a dois }

const MESES = 30 * 86400000;

// nota do TMDB ajustada: com poucos votos ela puxa para a média geral
function qualidade(c) {
  const v = c.votos || 0;
  const m = 300;
  const media = 6.6;
  const bay = (v * (c.nota || 0) + m * media) / (v + m);
  return (bay - media) / 1.2;
}

function afinidadeGeneros(c, gosto) {
  const valores = (c.generos || []).map(g => gosto.generos.get(g)?.afinidade ?? 0);
  return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
}

export function pontuar(c, gosto, { hoje = new Date(), users = [] } = {}) {
  const partes = {};
  partes.genero = afinidadeGeneros(c, gosto) * 3;
  if ((c.generos || []).some(g => gosto.evitar.has(g))) partes.evitar = -3;
  partes.qualidade = qualidade(c);
  if (c.fontes?.has("semente")) partes.semente = 1.5;
  if (c.lancamento && hoje - new Date(c.lancamento + "T12:00:00") <= 4 * MESES && new Date(c.lancamento) <= hoje) {
    partes.lancamento = 1;
  }
  if (c.naLista) {
    const querem = c.naLista.wantedBy?.length ? c.naLista.wantedBy : [c.naLista.suggestedBy].filter(Boolean);
    partes.lista = querem.length >= Math.max(2, users.length) ? 3 : 2;
  }
  const total = Object.values(partes).reduce((a, b) => a + b, 0);
  return { total, partes };
}

function frase(c, partes, gosto, { hoje = new Date(), users = [] } = {}) {
  const provedor = c.provedores?.[0];
  const ondeFrase = provedor ? ` no ${provedor}` : "";
  if (partes.lista) {
    const querem = c.naLista.wantedBy?.length ? c.naLista.wantedBy : [c.naLista.suggestedBy].filter(Boolean);
    const meses = c.naLista.addedAt ? Math.floor((hoje - new Date(c.naLista.addedAt)) / MESES) : 0;
    const desde = meses >= 1 ? ` há ${meses === 1 ? "1 mês" : `${meses} meses`}` : "";
    if (querem.length >= Math.max(2, users.length)) return `Está na lista de vocês dois${desde}, e já dá pra ver${ondeFrase}.`;
    return `${querem[0] || "Vocês"} quer ver${desde}, e está${ondeFrase}.`;
  }
  if (partes.semente && c.semente) return `Porque vocês dois amaram ${c.semente}.`;
  if (partes.lancamento) return `Acabou de chegar${ondeFrase}.`;
  const top = (c.generos || [])
    .map(g => [g, gosto.generos.get(g)?.afinidade ?? 0])
    .sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] > 0.15) return `Vocês dão notas altas para ${top[0].toLowerCase()}.`;
  return `Nota ${(c.nota || 0).toFixed(1).replace(".", ",")} no TMDB${provedor ? `, e está no ${provedor}` : ""}.`;
}

/**
 * Ordena e escolhe com diversidade: depois do primeiro, cada escolha perde pontos
 * por repetir gêneros das anteriores (três suspenses seguidos não ajudam a decidir).
 */
// qual motivo a frase vai usar — mesma precedência de frase()
const categoria = (c, partes) =>
  partes.lista ? "lista" : partes.semente && c.semente ? "semente" : partes.lancamento ? "lancamento" : "gosto";

export function ranquear(candidatos, gosto, opts = {}) {
  const { excluir = new Set(), limite = candidatos.length } = opts;
  const pool = candidatos
    .filter(c => !gosto.vistos.has(c.key) && !excluir.has(c.key))
    .map(c => ({ c, ...pontuar(c, gosto, opts) }));

  const escolhidos = [];
  const generosUsados = new Map();
  const motivosUsados = new Map();
  while (pool.length && escolhidos.length < limite) {
    let melhor = 0;
    let melhorValor = -Infinity;
    pool.forEach((p, i) => {
      const repetidos = (p.c.generos || []).reduce((n, g) => n + (generosUsados.get(g) || 0), 0);
      // três "acabou de chegar" seguidos também não ajudam a decidir
      const mesmoMotivo = motivosUsados.get(categoria(p.c, p.partes)) || 0;
      const valor = p.total - 2 * repetidos - 1.5 * mesmoMotivo;
      if (valor > melhorValor) { melhorValor = valor; melhor = i; }
    });
    const [p] = pool.splice(melhor, 1);
    (p.c.generos || []).forEach(g => generosUsados.set(g, (generosUsados.get(g) || 0) + 1));
    const cat = categoria(p.c, p.partes);
    motivosUsados.set(cat, (motivosUsados.get(cat) || 0) + 1);
    escolhidos.push({ ...p.c, pontos: p.total, motivo: frase(p.c, p.partes, gosto, opts) });
  }
  return escolhidos;
}
