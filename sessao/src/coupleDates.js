// O casal tem duas datas que não podem se misturar (misturá-las fez casais lerem
// "juntos há 1 ano" como "1 ano usando o app"):
//   since     — quando o relacionamento começou (opcional, "AAAA-MM-DD")
//   createdAt — quando o diário foi criado no Sessão (ISO)
const DAY = 86400000;

// "2025-03-10" vira meio-dia local, para o fuso não puxar a data para o dia anterior
const parse = value => {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// "1 ano e 8 meses", "3 meses", "menos de um mês" — ou null sem data
export function relationshipDuration(since, now = new Date()) {
  const start = parse(since);
  if (!start || start > now) return null;
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months--;
  if (months < 1) return "menos de um mês";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years ? `${years} ${years === 1 ? "ano" : "anos"}` : "";
  const m = rest ? `${rest} ${rest === 1 ? "mês" : "meses"}` : "";
  return [y, m].filter(Boolean).join(" e ");
}

export const relationshipLine = (since, now = new Date()) => {
  const duration = relationshipDuration(since, now);
  return duration ? `${duration} de relacionamento` : null;
};

// dias desde que o diário foi criado no app (0 no primeiro dia)
export function daysOnSessao(createdAt, now = new Date()) {
  const start = parse(createdAt);
  if (!start) return null;
  return Math.max(0, Math.floor((now - start) / DAY));
}

export const sessaoDaysLine = (createdAt, now = new Date()) => {
  const days = daysOnSessao(createdAt, now);
  if (days === null) return "juntos no Sessão";
  if (days === 0) return "primeiro dia no Sessão";
  return `${days} ${days === 1 ? "dia" : "dias"} de Sessão`;
};

// "mar 2025"
export const monthYear = value => {
  const date = parse(value);
  return date ? date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "") : null;
};
