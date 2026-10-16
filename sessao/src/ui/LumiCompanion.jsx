import { useEffect, useRef, useState } from "react";
import { lumiSrc } from "../lumi.jsx";
import { MOOD_POSE, TAP_REACTIONS, LOVE_REACTION, SHY_REACTION, WAKE_REACTION, moodPoses } from "./lumiMood.js";

const REACTION_MS = 1700;
const TRIPLE_TAP_MS = 900;
const LONG_PRESS_MS = 550;

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// pulinho com squash & stretch — a resposta física ao toque
const hop = el => {
  if (!el?.animate || reducedMotion()) return;
  el.animate([
    { transform: "translateY(0) scale(1, 1)" },
    { transform: "translateY(2px) scale(1.07, 0.9)", offset: 0.16 },
    { transform: "translateY(-16px) scale(0.95, 1.06)", offset: 0.48 },
    { transform: "translateY(0) scale(1.04, 0.96)", offset: 0.8 },
    { transform: "translateY(0) scale(1, 1)" },
  ], { duration: 540, easing: "cubic-bezier(.3,.7,.4,1)" });
};

const HEARTS = [
  { x: -34, d: 0, s: 1 }, { x: 26, d: 80, s: 0.8 }, { x: -8, d: 160, s: 1.15 },
  { x: 40, d: 240, s: 0.7 }, { x: -46, d: 300, s: 0.75 }, { x: 10, d: 380, s: 0.9 },
];

/**
 * O Lumi como companheiro: reage ao toque, fala com contexto, dorme de madrugada.
 * - mood/line: o que o contexto pede (veja lumiMood.js)
 * - sleepy: começa dormindo; um toque acorda (onWake avisa o cenário)
 * - talk: false desliga as falas (preferência "Comentários do Lumi")
 */
export default function LumiCompanion({ mood = "happy", line, sleepy = false, talk = true, size = 108, onWake, className = "" }) {
  const [reaction, setReaction] = useState(null);
  const [awake, setAwake] = useState(!sleepy);
  const [burst, setBurst] = useState(0);
  const bodyRef = useRef(null);
  const timer = useRef(null);
  const taps = useRef([]);
  const tapIndex = useRef(0);
  const press = useRef({ t: null, fired: false });

  // pré-carrega as poses: a troca de humor nunca pisca em branco
  useEffect(() => {
    moodPoses().forEach(p => { const i = new Image(); i.src = lumiSrc(p); });
    const pressState = press.current;
    return () => { clearTimeout(timer.current); clearTimeout(pressState.t); };
  }, []);

  const react = (r, ms = REACTION_MS, after) => {
    clearTimeout(timer.current);
    setReaction(r);
    timer.current = setTimeout(() => { setReaction(null); after?.(); }, ms);
  };

  const onTap = () => {
    if (press.current.fired) { press.current.fired = false; return; }
    navigator.vibrate?.(8);
    hop(bodyRef.current);
    if (!awake) {
      react(WAKE_REACTION, 1900, () => { setAwake(true); onWake?.(); });
      return;
    }
    const now = Date.now();
    taps.current = [...taps.current.filter(t => now - t < TRIPLE_TAP_MS), now];
    if (taps.current.length >= 3) {
      taps.current = [];
      setBurst(b => b + 1);
      react(LOVE_REACTION, 2200);
      return;
    }
    react(TAP_REACTIONS[tapIndex.current++ % TAP_REACTIONS.length]);
  };

  const onPressStart = () => {
    clearTimeout(press.current.t);
    press.current.fired = false;
    press.current.t = setTimeout(() => {
      if (!awake) return;
      press.current.fired = true;
      navigator.vibrate?.([6, 40, 6]);
      react(SHY_REACTION, 2000);
    }, LONG_PRESS_MS);
  };
  const onPressEnd = () => clearTimeout(press.current.t);

  const sleeping = !awake && !reaction;
  const shownMood = reaction?.mood || (sleeping ? "sleepy" : mood);
  const pose = MOOD_POSE[shownMood] || shownMood;
  const shownLine = reaction?.line || (sleeping ? null : line);

  return (
    <div className={`lumi-co ${sleeping ? "lumi-co--sleeping" : ""} ${className}`} style={{ "--lumi-size": `${size}px` }}>
      <button
        type="button"
        className="lumi-co__hit"
        onClick={onTap}
        onPointerDown={onPressStart}
        onPointerUp={onPressEnd}
        onPointerLeave={onPressEnd}
        onPointerCancel={onPressEnd}
        onContextMenu={e => e.preventDefault()}
        aria-label={sleeping ? "Lumi está dormindo. Toque para acordar" : "Lumi. Toque para brincar"}
      >
        <span className="lumi-co__floor" aria-hidden="true"/>
        <span ref={bodyRef} className="lumi-co__body">
          <img key={pose} src={lumiSrc(pose)} alt="" className="lumi-co__img" draggable={false}/>
        </span>
        {burst > 0 && (
          <span key={burst} className="lumi-co__hearts" aria-hidden="true">
            {HEARTS.map((h, i) => (
              <svg key={i} viewBox="0 0 24 24" style={{ "--x": `${h.x}px`, "--d": `${h.d}ms`, "--s": h.s }}>
                <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.4 5c2.1 0 3.6 1.2 4.4 2.6h2.4C14 6.2 15.5 5 17.6 5 21 5 23.1 8.4 21.6 11.8 19.5 16.4 12 21 12 21z"/>
              </svg>
            ))}
          </span>
        )}
      </button>
      {talk && shownLine && (
        <p key={shownLine} className="lumi-co__bubble" aria-live="polite">{shownLine}</p>
      )}
    </div>
  );
}
