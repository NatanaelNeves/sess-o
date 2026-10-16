import { useState } from "react";
import { lumiSrc } from "../lumi.jsx";
import LumiCompanion from "./LumiCompanion.jsx";
import "./cabine.css";

// o projetor "esquenta" (flicker) só na primeira vez que a Home abre na sessão;
// depois a tela só acende, sem repetir o efeito a cada troca de aba
const firstWarmup = () => {
  try {
    if (sessionStorage.getItem("sessao-cabine-on")) return false;
    sessionStorage.setItem("sessao-cabine-on", "1");
  } catch { /* storage bloqueado: sem flicker */ return false; }
  return true;
};

const DUST = [
  { x: 22, y: 76, d: 0 }, { x: 40, y: 44, d: 2.4 }, { x: 29, y: 60, d: 4.1 },
  { x: 56, y: 18, d: 1.2 }, { x: 18, y: 34, d: 5.6 },
];

/**
 * A sala do casal: a tela (children) iluminada pelo feixe que sai da lente do
 * Lumi, sentado na fileira de poltronas onde estão os lugares dos dois.
 */
export function Cabine({ lumi, talk = true, seats, children }) {
  const [lit, setLit] = useState(!lumi.sleepy);
  const [warm] = useState(firstWarmup);

  return (
    <section className={`cabine ${lit ? "" : "cabine--apagada"} ${warm ? "cabine--warm" : ""}`} aria-label="A sala de vocês">
      <div className="cabine__tela-wrap">{children}</div>

      <div className="cabine__plateia">
        <div className="cabine__feixe" aria-hidden="true"/>
        <div className="cabine__poeiras" aria-hidden="true">
          {DUST.map((p, i) => (
            <span key={i} className="cabine__poeira" style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.d}s` }}/>
          ))}
        </div>
        <LumiCompanion mood={lumi.mood} line={lumi.line} sleepy={lumi.sleepy} talk={talk} onWake={() => setLit(true)}/>
      </div>

      <div className="cabine__poltronas">
        {Array.from({ length: 7 }, (_, i) => {
          if (seats && i === 4) {
            return (
              <button key="nossas" type="button" className="poltronas-nossas" onClick={seats.onClick} aria-label={seats.label}>
                {seats.initials.map((ch, i) => <span key={i} className="poltrona poltrona--nossa">{ch}</span>)}
                {seats.badge && <span className="poltronas-nossas__badge">{seats.badge}</span>}
              </button>
            );
          }
          if (seats && i === 5) return null;
          return <span key={i} className="poltrona" aria-hidden="true"/>;
        })}
      </div>
    </section>
  );
}

/** O conteúdo projetado: um único chamado, com pôster opcional e ações. */
export function Tela({ poster, kicker, title, meta, extra, actions }) {
  return (
    <div className="tela">
      <div className="tela__frame">
        {poster && <img src={poster} alt="" className="tela__poster"/>}
        <div className="tela__body">
          {kicker && <p className="tela__kicker">{kicker}</p>}
          <h2 className="tela__title">{title}</h2>
          {meta && <p className="tela__meta">{meta}</p>}
          {extra}
        </div>
      </div>
      {actions && <div className="tela__actions">{actions}</div>}
    </div>
  );
}

/** Os últimos canhotos — cada memória vira o ingresso rasgado daquela noite. */
export function Canhotos({ items, total, quote, onSelect, onSeeAll }) {
  return (
    <section className="canhotos" aria-labelledby="canhotos-t">
      <div className="cabine-sec">
        <h3 id="canhotos-t" className="cabine-sec__title">Os últimos canhotos</h3>
        {total > items.length && <button type="button" className="cabine-sec__link" onClick={onSeeAll}>ver os {total}</button>}
      </div>
      {quote && (
        <blockquote className="canhotos__quote">
          <p>“{quote.text}”</p>
          <footer>{quote.author}, sobre {quote.title}</footer>
        </blockquote>
      )}
      <div className="canhotos__trilho">
        {items.map(it => (
          <button key={it.id} type="button" className="canhoto" onClick={() => onSelect(it.entry)}
            aria-label={`${it.title}, memória ${it.number}${it.nota ? `, nota ${it.nota}` : ""}`}>
            <span className="canhoto__poster">
              {it.poster
                ? <img src={it.poster} alt="" loading="lazy"/>
                : <span className="canhoto__semposter">{it.title}</span>}
              {it.cinema && <span className="canhoto__cinema">cinema</span>}
            </span>
            <span className="canhoto__tira">
              <span className="canhoto__num">Nº {it.number}</span>
              <span className="canhoto__data">{it.date}</span>
              {it.nota && <span className="canhoto__nota">★ {it.nota}</span>}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** A parede de vocês: conquistas viram quadrinhos pendurados, o próximo espera vazio. */
export function Parede({ frames, next, unlocked, onOpen }) {
  const tilt = [-3, 2.5, -1.5];
  return (
    <section className="parede" aria-labelledby="parede-t">
      <div className="cabine-sec">
        <h3 id="parede-t" className="cabine-sec__title">Na parede de vocês</h3>
        <button type="button" className="cabine-sec__link" onClick={onOpen}>ver as {unlocked}</button>
      </div>
      <button type="button" className="parede__quadros" onClick={onOpen} aria-label={`Ver conquistas: ${unlocked} desbloqueadas`}>
        {frames.map((f, i) => (
          <span key={f.id} className="quadro" style={{ "--tilt": `${tilt[i % 3]}deg` }}>
            <span className="quadro__moldura"><img src={lumiSrc(f.lumi)} alt="" loading="lazy"/></span>
            <span className="quadro__legenda">{f.label}</span>
          </span>
        ))}
        {next && (
          <span className="quadro quadro--vazio" style={{ "--tilt": "1deg" }}>
            <span className="quadro__moldura">
              <span className="quadro__progresso">{next.progress}/{next.target}</span>
            </span>
            <span className="quadro__legenda">{next.label}</span>
          </span>
        )}
      </button>
    </section>
  );
}
