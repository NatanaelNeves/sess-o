// O Lumi adivinha: perguntas de sim ou não que vão apagando os candidatos até
// sobrar o filme da noite. Funções puras: a tela só pergunta e mostra o palpite.
//
// A cada rodada vale a pergunta que divide os acesos o mais perto possível do
// meio a meio; é ela que tira mais dúvida com uma resposta só.

export const MAX_PERGUNTAS = 8;

const tem = (...generos) => c => (c.generos || []).some(g => generos.includes(g));

const PERGUNTAS = [
  { id: "rir", texto: "Hoje é dia de dar risada?", sim: "de comédia", nao: "sem comédia", teste: tem("Comédia") },
  { id: "susto", texto: "Topam levar um susto?", sim: "com susto", nao: "sem susto", teste: tem("Terror") },
  { id: "romance", texto: "Estão no clima de romance?", sim: "romântico", nao: "sem romance", teste: tem("Romance") },
  { id: "acao", texto: "Querem adrenalina, com ação e perseguição?", sim: "com ação", nao: "sem pancadaria", teste: tem("Ação", "Action & Adventure") },
  { id: "tensao", texto: "Topam ficar tensos no sofá?", sim: "de dar tensão", nao: "sem tensão", teste: tem("Suspense", "Mistério", "Crime") },
  { id: "outro-mundo", texto: "Bora para outro mundo, com ficção científica ou fantasia?", sim: "de outro mundo", nao: "com o pé no chão", teste: tem("Ficção científica", "Fantasia", "Sci-Fi & Fantasy") },
  { id: "animacao", texto: "Uma animação cairia bem?", sim: "animado", nao: "sem animação", teste: tem("Animação") },
  { id: "drama", texto: "Estão a fim de um drama, daqueles que emocionam?", sim: "emocionante", nao: "sem drama", teste: tem("Drama") },
  { id: "aventura", texto: "Querem uma aventura?", sim: "de aventura", nao: "sem aventura", teste: tem("Aventura") },
  { id: "real", texto: "Que tal uma história real?", sim: "de história real", nao: "de pura ficção", teste: tem("Documentário", "História") },
  { id: "leve", texto: "Precisa ser algo leve, para qualquer idade?", sim: "leve", nao: "nada infantil", teste: tem("Família", "Kids") },
  { id: "serie", texto: "Querem começar uma série?", sim: "em série", nao: "em filme", teste: c => c.type === "tv" },
  { id: "recente", texto: "Precisa ser recente, deste ano ou do ano passado?", sim: "recente", nao: "de qualquer época", teste: (c, ctx) => +c.year >= ctx.ano - 1 },
  { id: "classico", texto: "Topam um clássico, de antes dos anos 2000?", sim: "clássico", nao: "nada antigo", teste: c => !!c.year && +c.year < 2000 },
  { id: "aclamado", texto: "Só vale se for muito bem avaliado?", sim: "aclamado", nao: "sem exigir nota alta", teste: c => c.nota >= 7.5 },
  { id: "lista", texto: "Vale algo que já está na lista de vocês?", sim: "da lista de vocês", nao: "fora da lista", teste: c => !!c.naLista },
];

// uma pergunta por streaming que aparece entre os candidatos
function perguntasDeStreaming(candidatos) {
  const nomes = [...new Set(candidatos.map(c => c.provedores?.[0]).filter(Boolean))];
  return nomes.map(nome => ({
    id: `streaming:${nome}`,
    texto: `Hoje é noite de ${nome}?`,
    sim: `no ${nome}`,
    nao: `fora do ${nome}`,
    teste: c => (c.provedores || []).includes(nome),
  }));
}

const contexto = hoje => ({ ano: hoje.getFullYear() });

/**
 * A pergunta que melhor divide os acesos, ou null se nenhuma divide mais nada.
 * Quando várias dividem quase igual, vale a que vem antes na lista: as de clima
 * ("querem rir?") são mais gostosas de responder que as de nota, ano ou streaming.
 */
export function proximaPergunta(acesos, feitas = new Set(), { hoje = new Date() } = {}) {
  const n = acesos.length;
  if (n <= 1) return null;
  const ctx = contexto(hoje);
  const uteis = [...PERGUNTAS, ...perguntasDeStreaming(acesos)]
    .filter(p => !feitas.has(p.id))
    .map(p => ({ p, sim: acesos.filter(c => p.teste(c, ctx)).length }))
    .filter(({ sim }) => sim > 0 && sim < n)
    .map(({ p, sim }) => ({ p, diferenca: Math.abs(n - 2 * sim) }));
  if (!uteis.length) return null;
  const melhor = Math.min(...uteis.map(u => u.diferenca));
  const folga = Math.max(2, Math.round(n * 0.2));
  return uteis.find(u => u.diferenca <= melhor + folga).p;
}

/** Apaga os que não combinam com a resposta ("sim" | "nao" | "tanto_faz"). A ordem do ranking fica. */
export function responder(acesos, pergunta, resposta, { hoje = new Date() } = {}) {
  if (resposta === "tanto_faz") return acesos;
  const ctx = contexto(hoje);
  const quer = resposta === "sim";
  return acesos.filter(c => !!pergunta.teste(c, ctx) === quer);
}

/** Hora do palpite: sobrou um, acabaram as perguntas úteis ou já perguntou demais. */
export function horaDoPalpite(acesos, feitas, opts) {
  return acesos.length <= 1 || feitas.size >= MAX_PERGUNTAS || !proximaPergunta(acesos, feitas, opts);
}

/**
 * O pedido do casal em poucas palavras, a partir das respostas dadas
 * (as mais recentes primeiro ficam de fora quando passa de `max`):
 * [{ pergunta, resposta }] → "de comédia, sem susto e no Netflix".
 */
export function resumoDoPedido(respostas, max = 3) {
  const partes = respostas
    .filter(r => r.resposta !== "tanto_faz")
    .map(r => (r.resposta === "sim" ? r.pergunta.sim : r.pergunta.nao))
    .filter(Boolean)
    .slice(-max);
  if (partes.length <= 1) return partes[0] || "";
  return `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
}
