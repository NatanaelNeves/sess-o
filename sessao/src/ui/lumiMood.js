// O "cérebro" do Lumi: decide humor e fala a partir do que está acontecendo de
// verdade no app. Funções puras — o componente só desenha o que sai daqui.

// humor -> pose do kit (public/assets/kit/<pose>.webp)
export const MOOD_POSE = {
  happy: "feliz",
  veryHappy: "muito_feliz",
  thinking: "pensativo",
  curious: "curioso",
  excited: "animado",
  loving: "reacao_coracao",
  proud: "orgulhoso",
  sleepy: "dormindo",
  yawning: "reacao_bocejando",
  waiting: "reacao_esperando",
  shy: "vergonha",
  laughing: "rindo",
  winking: "piscando",
  popcorn: "segurando_pipoca",
  celebrating: "reacao_comemorando",
  pointing: "apontando",
};

// Madrugada é hora de o projetor descansar. A noite, não: a noite é a hora da sessão.
export const isSleepyHour = (now = new Date()) => now.getHours() < 5;

/**
 * Humor e fala do Lumi na Home, seguindo a mesma prioridade do card principal
 * (avaliação pendente > sessão marcada > continuar série > sugestão).
 * Nunca cobra frequência: sem "faz tempo que vocês não...".
 */
export function homeLumi({ total, mainCard, sessionState, title, partner, partnerRated, now = new Date() }) {
  const sleepy = isSleepyHour(now);
  if (total === 0) return { mood: "waiting", line: "A tela está prontinha. Só falta o primeiro filme de vocês.", sleepy };
  if (mainCard === "review") {
    return partnerRated
      ? { mood: "curious", line: `${partner} já deu a nota. A sua eu ainda não vi 👀`, sleepy }
      : { mood: "thinking", line: `E aí, como foi ${title}? Tô curioso.`, sleepy };
  }
  if (mainCard === "session") {
    if (sessionState === "hoje") return { mood: "popcorn", line: "Hoje tem cinema! Já separei a pipoca.", sleepy };
    if (sessionState === "passou") return { mood: "thinking", line: "Como foi a sessão? Quero saber de tudo.", sleepy };
    return { mood: "excited", line: "Já estou contando os dias pro cinema.", sleepy };
  }
  if (mainCard === "continue") return { mood: "popcorn", line: `Falta pouco pra terminarem ${title}.`, sleepy };
  return now.getHours() >= 18
    ? { mood: "happy", line: "Noite perfeita pra uma sessão, né?", sleepy }
    : { mood: "happy", line: "Hoje é um ótimo dia pra um filme.", sleepy };
}

// Reações ao toque: seguem em ordem (variedade previsível, nada de sorteio).
export const TAP_REACTIONS = [
  { mood: "laughing", line: "Hihi, faz cócegas!" },
  { mood: "winking", line: "Psiu: tô de olho na pipoca de vocês." },
  { mood: "veryHappy", line: "Oi, oi! Que bom ver vocês." },
  { mood: "proud", line: "Projetor ligado e calibrado ✦" },
];
export const LOVE_REACTION = { mood: "loving", line: "Vocês dois, hein? ❤️" };
export const SHY_REACTION = { mood: "shy", line: "Ei… assim eu fico sem graça." };
export const WAKE_REACTION = { mood: "yawning", line: "Uaaah… oi! Tava só descansando as lentes." };

export const moodPoses = () => Object.values(MOOD_POSE);
