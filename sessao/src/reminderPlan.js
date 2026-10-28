// Quais lembretes locais o app deve ter agendados agora. Função pura: o
// agendamento de verdade (plugin nativo) fica em nativeReminders.js.
const HOUR = 3600000;
const DAY = 24 * HOUR;

export const FRIDAY_ID = 1;
const CINEMA_BASE = 1000;
const CINEMA_HORIZON = 60 * DAY;

// o plugin exige id inteiro: um hash estável do item da lista
export function cinemaReminderId(itemId) {
  let hash = 0;
  for (const char of String(itemId)) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return CINEMA_BASE + (Math.abs(hash) % 1000000);
}

export const isOurReminder = id => id === FRIDAY_ID || id >= CINEMA_BASE;

// 2 horas antes do horário marcado; sem horário, ao meio-dia do dia da sessão
export function cinemaReminderTime(plan) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan?.date || "")) return null;
  const at = new Date(`${plan.date}T12:00:00`);
  const time = /^(\d{1,2}):(\d{2})$/.exec(plan.time || "");
  if (time) {
    at.setHours(Number(time[1]), Number(time[2]), 0, 0);
    at.setTime(at.getTime() - 2 * HOUR);
  }
  return at;
}

export function planReminders({ watchlist = [], fridayReminders = false, now = new Date() }) {
  const reminders = [];
  if (fridayReminders) {
    reminders.push({
      id: FRIDAY_ID,
      title: "Sexta de sessão? 🍿",
      body: "A lista a dois está esperando. Que tal escolher o filme de hoje?",
      schedule: { on: { weekday: 6, hour: 19, minute: 0 } }, // 6 = sexta (domingo = 1)
      extra: { acao: "lista" },
    });
  }
  for (const item of watchlist) {
    const at = item?.plan && cinemaReminderTime(item.plan);
    if (!at || at <= now || at - now > CINEMA_HORIZON) continue;
    const { time, venue, seats } = item.plan;
    reminders.push({
      id: cinemaReminderId(item.id),
      title: `Hoje tem cinema: ${item.title}`,
      body: [time && `às ${time}`, venue, seats && `lugares ${seats}`].filter(Boolean).join(" · ") || "Bom filme pra vocês dois ❤",
      schedule: { at },
      extra: { acao: "cinema", id: item.id },
    });
  }
  return reminders;
}
