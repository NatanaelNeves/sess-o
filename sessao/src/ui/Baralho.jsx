import { useRef, useState } from "react";
import { TMDB_IMG, TMDB_LOGO } from "../tmdb.js";

const LIMIAR = 90; // px arrastados para o voto valer
const SAIDA_MS = 260;

const semMovimento = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Cartazes empilhados: arraste para a direita (quero) ou para a esquerda (passo).
 * Os botões e as setas do teclado fazem o mesmo, para quem não quer arrastar.
 */
export default function Baralho({ cartas, onVoto }) {
  const [dx, setDx] = useState(0);
  const [saindo, setSaindo] = useState(null); // "sim" | "nao"
  const [arrastando, setArrastando] = useState(false);
  const inicio = useRef(null);
  const topo = cartas[0];
  const proxima = cartas[1];

  const votar = sim => {
    if (!topo || saindo) return;
    navigator.vibrate?.(sim ? [8, 30, 8] : 6);
    setSaindo(sim ? "sim" : "nao");
    setTimeout(() => {
      onVoto(topo, sim);
      setSaindo(null);
      setDx(0);
    }, semMovimento() ? 0 : SAIDA_MS);
  };

  const soltar = () => {
    if (inicio.current === null) return;
    inicio.current = null;
    setArrastando(false);
    if (Math.abs(dx) > LIMIAR) votar(dx > 0);
    else setDx(0);
  };

  if (!topo) return null;
  const forca = Math.max(-1, Math.min(1, dx / LIMIAR));
  const estilo = saindo
    ? { transform: `translateX(${saindo === "sim" ? 130 : -130}%) rotate(${saindo === "sim" ? 16 : -16}deg)`, opacity: 0 }
    : { transform: `translateX(${dx}px) rotate(${dx / 18}deg)`, transition: arrastando ? "none" : undefined };

  return (
    <div className="bar">
      <div className="bar__pilha"
        tabIndex={0}
        role="group"
        aria-label={`${topo.title}. Seta para a direita: quero; para a esquerda: passo.`}
        onKeyDown={e => {
          if (e.key === "ArrowRight") { e.preventDefault(); votar(true); }
          if (e.key === "ArrowLeft") { e.preventDefault(); votar(false); }
        }}>
        {proxima && <Cartaz carta={proxima} className="bar__carta bar__carta--atras" aria-hidden/>}
        <Cartaz carta={topo} className={`bar__carta ${saindo ? "bar__carta--saindo" : ""}`} style={estilo}
          onPointerDown={e => { inicio.current = e.clientX - dx; setArrastando(true); e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={e => { if (inicio.current !== null) setDx(e.clientX - inicio.current); }}
          onPointerUp={soltar}
          onPointerCancel={soltar}>
          <span className="bar__selo bar__selo--sim" style={{ opacity: Math.max(0, forca) }} aria-hidden="true">Quero</span>
          <span className="bar__selo bar__selo--nao" style={{ opacity: Math.max(0, -forca) }} aria-hidden="true">Passo</span>
        </Cartaz>
      </div>

      {topo.motivo && <p className="bar__motivo">{topo.motivo}</p>}

      <div className="bar__botoes">
        <button type="button" className="bar__botao bar__botao--nao" onClick={() => votar(false)} aria-label={`Passo: ${topo.title}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
          <span>Passo</span>
        </button>
        <button type="button" className="bar__botao bar__botao--sim" onClick={() => votar(true)} aria-label={`Quero: ${topo.title}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
          <span>Quero</span>
        </button>
      </div>
    </div>
  );
}

function Cartaz({ carta, className, style, children, ...rest }) {
  return (
    <div className={className} style={style} {...rest}>
      {carta.poster
        ? <img src={`${TMDB_IMG}${carta.poster}`} alt="" draggable={false}/>
        : <span className="bar__semposter">{carta.title}</span>}
      <div className="bar__info">
        <strong>{carta.title}</strong>
        <span>
          {[carta.year, ...(carta.generos || []).slice(0, 2)].filter(Boolean).join(" · ")}
          {carta.nota > 0 && <b> ★ {carta.nota.toFixed(1).replace(".", ",")}</b>}
        </span>
        {carta.logos?.[0] && (
          <span className="bar__onde"><img src={`${TMDB_LOGO}${carta.logos[0]}`} alt=""/>{carta.provedores?.[0]}</span>
        )}
      </div>
      {children}
    </div>
  );
}
