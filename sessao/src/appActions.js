// Ações que abrem o app direto na tela certa — vindas de atalho do ícone,
// notificação, link de convite ou do próprio site (?acao=...).
//   com.natanaelneves.sessao://acao/registrar      (atalhos Android/iOS)
//   https://sess-80b2c.web.app/?acao=roleta         (site / PWA)
//   https://sess-80b2c.web.app/?convite=ABCD2345    (convite do casal)
import { normalizeInviteCode, isInviteCodeValid } from "./inviteCode.js";

export const APP_SCHEME = "com.natanaelneves.sessao";
export const ACTIONS = ["registrar", "querover", "lista", "roleta", "cinema"];

export function actionFromUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { return null; }

  const convite = url.searchParams.get("convite");
  if (convite) {
    const codigo = normalizeInviteCode(convite);
    return isInviteCodeValid(codigo) ? { acao: "convite", codigo } : null;
  }

  let acao = url.searchParams.get("acao");
  // no esquema próprio a ação vem no caminho: //acao/registrar
  if (!acao && url.protocol === `${APP_SCHEME}:` && url.hostname === "acao") acao = url.pathname.replace(/^\/+/, "");
  if (!ACTIONS.includes(acao)) return null;
  const id = url.searchParams.get("id");
  return id ? { acao, id } : { acao };
}

// tira ?acao, ?id e ?convite da barra de endereço depois de usados
export function urlWithoutAction(raw) {
  const url = new URL(raw);
  ["acao", "id", "convite"].forEach(key => url.searchParams.delete(key));
  return url.pathname + url.search + url.hash;
}
