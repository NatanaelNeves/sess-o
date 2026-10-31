// O match a dois: cada um vota no mesmo baralho, sem ver os votos do outro.
// Funções puras — os votos vivem só no aparelho durante a rodada.

export const TAMANHO_DO_BARALHO = 12;

/** O baralho da rodada: os mais promissores da lista ordenada, sem repetir rodadas anteriores. */
export function montarBaralho(ordenados, { rodada = 0, tamanho = TAMANHO_DO_BARALHO } = {}) {
  return ordenados.slice(rodada * tamanho, (rodada + 1) * tamanho);
}

/**
 * votos: Map(key → true | false) de cada pessoa.
 * - matches: os que os dois quiseram, na ordem do baralho (o primeiro é o filme da noite)
 * - soDe: o que cada um quis sozinho
 */
export function resultadoDoMatch(baralho, votosA, votosB) {
  const matches = [];
  const soA = [];
  const soB = [];
  for (const c of baralho) {
    const a = votosA.get(c.key) === true;
    const b = votosB.get(c.key) === true;
    if (a && b) matches.push(c);
    else if (a) soA.push(c);
    else if (b) soB.push(c);
  }
  return { matches, soDe: [soA, soB] };
}
