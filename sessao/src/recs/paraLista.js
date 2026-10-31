// Uma sugestão do Lumi vira um item da lista a dois.
export function itemDaLista(c, pessoas) {
  return {
    tmdbId: c.tmdbId, type: c.type, title: c.title, year: c.year, poster: c.poster, backdrop: c.backdrop,
    overview: c.overview, genres: c.generos, tmdbRating: c.nota ? c.nota.toFixed(1) : null,
    priority: pessoas.length >= 2 ? "alta" : "normal",
    suggestedBy: pessoas[0], wantedBy: [...pessoas], addedAt: new Date().toISOString(),
  };
}

/** Quem passa a querer um título que já está na lista (sem repetir ninguém). */
export function querendoJuntos(itemDaLista, pessoas) {
  const atuais = itemDaLista.wantedBy?.length ? itemDaLista.wantedBy : [itemDaLista.suggestedBy].filter(Boolean);
  return [...new Set([...atuais, ...pessoas])];
}
