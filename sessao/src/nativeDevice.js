// Integrações com o sistema do celular (Android/iOS via Capacitor). Na web
// tudo aqui vira no-op ou cai no comportamento do navegador.
//   - lembretes locais (sexta de sessão, sessão de cinema marcada)
//   - ações vindas de atalho do ícone, notificação ou link
//   - háptica nos momentos que confirmam algo
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { LocalNotifications } from "@capacitor/local-notifications";
import { actionFromUrl, urlWithoutAction } from "./appActions.js";
import { planReminders, isOurReminder } from "./reminderPlan.js";

const isNative = () => Capacitor.isNativePlatform();
const quiet = promise => promise.catch(() => {});

// ── háptica ────────────────────────────────────────────────────────────────
export const hapticTap = () => { if (isNative()) quiet(Haptics.impact({ style: ImpactStyle.Light })); };
export const hapticSuccess = () => { if (isNative()) quiet(Haptics.notification({ type: NotificationType.Success })); };
export const hapticError = () => { if (isNative()) quiet(Haptics.notification({ type: NotificationType.Error })); };

// ── lembretes ──────────────────────────────────────────────────────────────
export const remindersAvailable = isNative;

// "granted" | "denied" | "prompt" | "unavailable"
export async function reminderPermission() {
  if (!isNative()) return "unavailable";
  const { display } = await LocalNotifications.checkPermissions();
  return display.startsWith("prompt") ? "prompt" : display;
}

// Pede a permissão só quando o usuário acabou de pedir algo que depende dela.
export async function askReminderPermission() {
  if (!isNative()) return false;
  let state = await reminderPermission();
  if (state === "prompt") ({ display: state } = await LocalNotifications.requestPermissions());
  return state === "granted";
}

// Reagenda tudo a partir do estado atual (lista a dois + preferências).
// Sem permissão não agenda nada e não pergunta.
export async function syncReminders({ watchlist, fridayReminders }) {
  if (!isNative() || (await reminderPermission()) !== "granted") return;
  const { notifications: pending } = await LocalNotifications.getPending();
  const ours = pending.filter(n => isOurReminder(n.id)).map(n => ({ id: n.id }));
  if (ours.length) await LocalNotifications.cancel({ notifications: ours });
  const next = planReminders({ watchlist, fridayReminders });
  if (!next.length) return;
  await LocalNotifications.schedule({
    notifications: next.map(n => ({
      ...n,
      schedule: { ...n.schedule, allowWhileIdle: true },
      smallIcon: "ic_stat_sessao",
      iconColor: "#FFB54A",
      // lembrete não precisa de alarme exato: sem isso o plugin abriria a tela
      // "Alarmes e lembretes" do Android
      isExactNotification: false,
    })),
  });
}

// ── ações (atalho, notificação, link) ──────────────────────────────────────
// Chama `onAction` uma vez por ação recebida. Devolve a função de limpeza.
export function listenForActions(onAction) {
  if (!isNative()) {
    const action = actionFromUrl(window.location.href);
    if (action) {
      window.history.replaceState(window.history.state, "", urlWithoutAction(window.location.href));
      onAction(action);
    }
    return () => {};
  }
  const handles = [
    App.addListener("appUrlOpen", ({ url }) => { const a = actionFromUrl(url); if (a) onAction(a); }),
    LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
      const { acao, id } = notification?.extra || {};
      if (acao) onAction(id ? { acao, id } : { acao });
    }),
  ];
  // abertura a frio por atalho/link: a URL chega pelo getLaunchUrl
  quiet(App.getLaunchUrl().then(result => { const a = result?.url && actionFromUrl(result.url); if (a) onAction(a); }));
  return () => handles.forEach(h => quiet(h.then(x => x.remove())));
}
