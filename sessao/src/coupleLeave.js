// Sair do diário sem levar o que é do outro. Funções puras: as escritas de
// verdade (lote no Firestore) ficam em App.jsx, e as regras espelham isto em
// isLeavingCouple / isHandingOver (firestore.rules).
//
//   "partner"  — quem entrou pelo convite sai; o diário fica com quem criou
//   "handover" — quem criou sai; o diário passa para a outra pessoa
//   "solo"     — não há outra pessoa: sair seria abandonar o diário (só excluindo)

export function leaveKind(couple, uid) {
  if (!couple || !uid) return null;
  if (couple.uid1 === uid) return couple.uid2 ? "handover" : "solo";
  if (couple.uid2 && couple.uid2 === uid) return "partner";
  return null;
}

// Campos do casal na saída. `removed` é o deleteField() do Firestore: os campos
// da vaga somem (não viram null), e é isso que obriga quem entrar depois a
// mostrar o código atual.
export function leaveUpdate(couple, uid, removed) {
  const kind = leaveKind(couple, uid);
  if (kind === "handover") return { uid1: couple.uid2, name1: couple.name2, uid2: removed, name2: removed };
  if (kind === "partner") return { uid2: removed, name2: removed };
  return null;
}

// o nome de quem fica com o diário
export function stayingName(couple, uid) {
  const kind = leaveKind(couple, uid);
  if (kind === "handover") return couple.name2 || null;
  if (kind === "partner") return couple.name1 || null;
  return null;
}

// Mensagem quando o diário não carrega (cota do dia, rede, permissão).
export function loadErrorMessage(error) {
  const code = String(error?.code || "").replace(/^firestore\//, "");
  if (code === "resource-exhausted") return "O Sessão atingiu o limite de uso por hoje. Tente de novo mais tarde: as memórias de vocês estão guardadas.";
  if (code === "unavailable" || code === "deadline-exceeded") return "Não consegui falar com o diário. Confira a internet e tente de novo.";
  if (code === "permission-denied") return "Esta conta não tem acesso a este diário.";
  return "Não consegui abrir o diário agora. Tente de novo em instantes.";
}
