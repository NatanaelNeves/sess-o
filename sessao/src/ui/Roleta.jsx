import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { TMDB_IMG } from "../tmdb.js";
import { lumiSrc } from "../lumi.jsx";
import useBackClose from "./useBackClose.js";
import "./programacao.css";
import "./roleta.css";

const MAX_FATIAS = 12;
const GIRO_MS = 4200;
const LAMPADAS = 24;
// as cores da cabine: cachecol, bombom, papel de ingresso e madeira
const FATIAS = [
  { fundo: "#d23a3f", texto: "#fff4ea" },
  { fundo: "#2b1716", texto: "#fbefdf" },
  { fundo: "#f0d8b4", texto: "#2b1716" },
  { fundo: "#5a3524", texto: "#fbefdf" },
];

const semMovimento = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const encurtar = (s, max = 16) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/**
 * Roleta da lista: a sorte escolhe entre o que o casal já guardou. A roda tem
 * a moldura de lâmpadas da cabine, que corre enquanto gira; o sorteado aparece
 * no cartaz aceso.
 */
export default function Roleta({ watchlist, onClose, onRegistrar }) {
  useBackClose(onClose);
  const [tipo, setTipo] = useState("all");
  const [rotacao, setRotacao] = useState(0);
  const [fase, setFase] = useState("parada"); // parada | girando | resultado
  const [sorteado, setSorteado] = useState(null);

  const temFilme = watchlist.some(w => w.type !== "tv");
  const temSerie = watchlist.some(w => w.type === "tv");

  // a roda é congelada: se embaralhasse a cada render, o sorteado não bateria com a fatia
  const fatias = useMemo(() => {
    const filtrados = watchlist.filter(w => (tipo === "movie" ? w.type !== "tv" : tipo === "tv" ? w.type === "tv" : true));
    if (filtrados.length <= MAX_FATIAS) return filtrados;
    return [...filtrados]
      .sort((a, b) => String(a.id || a.tmdbId || a.title).localeCompare(String(b.id || b.tmdbId || b.title)))
      .slice(0, MAX_FATIAS);
  }, [watchlist, tipo]);

  const n = fatias.length;
  const girando = fase === "girando";

  const girar = () => {
    if (girando || n < 2) return;
    const angulo = 360 / n;
    const alvo = Math.floor(Math.random() * n);
    const escolhido = fatias[alvo];
    const atual = ((rotacao % 360) + 360) % 360;
    // a rotação que deixa o meio da fatia sorteada embaixo do ponteiro, lá em cima
    const destino = ((360 - (alvo + 0.5) * angulo) % 360 + 360) % 360;
    const falta = ((destino - atual) + 360) % 360;
    const rapido = semMovimento();
    setSorteado(null);
    setFase("girando");
    setRotacao(rotacao + (rapido ? 0 : 6 * 360) + falta);
    setTimeout(() => { setSorteado(escolhido); setFase("resultado"); }, rapido ? 50 : GIRO_MS + 150);
  };

  const quem = sorteado ? (sorteado.wantedBy?.length ? sorteado.wantedBy : [sorteado.suggestedBy].filter(Boolean)) : [];

  return createPortal(
    <div className="subpage prog rol">
      <div className="subpage__inner prog__inner">
        <div className="cfg-head">
          <button className="cfg-back" onClick={onClose} aria-label="Voltar"><Icone n="voltar"/></button>
          <h1 className="cfg-title">Roleta da lista</h1>
        </div>

        {fase !== "resultado" && (
          <>
            <p className="rol__sub" aria-live="polite">
              {girando ? "E o filme da noite é…" : n >= 2 ? `A sorte escolhe entre ${n} ${n === 1 ? "título" : "títulos"} da lista a dois.` : ""}
            </p>

            {temFilme && temSerie && (
              <div className="rol__tipos" role="radiogroup" aria-label="O que entra na roleta">
                {[["all", "Tudo"], ["movie", "Filmes"], ["tv", "Séries"]].map(([v, rotulo]) => (
                  <button key={v} type="button" role="radio" aria-checked={tipo === v} disabled={girando}
                    className={tipo === v ? "rol__tipo rol__tipo--on" : "rol__tipo"} onClick={() => setTipo(v)}>{rotulo}</button>
                ))}
              </div>
            )}

            {n < 2 ? (
              <p className="rol__vazio">Com esse filtro sobra pouca coisa. Guardem mais títulos na lista a dois para a roleta ter graça.</p>
            ) : (
              <>
                <div className={`rol__roda ${girando ? "rol__roda--girando" : ""}`}>
                  <svg viewBox="-160 -160 320 320" className="rol__svg" aria-hidden="true">
                    <g className="rol__giro" style={{
                      transform: `rotate(${rotacao}deg)`,
                      transition: girando && !semMovimento() ? `transform ${GIRO_MS}ms cubic-bezier(0.16, 0.84, 0.14, 1)` : "none",
                    }}>
                      {fatias.map((item, i) => <Fatia key={item.id || item.tmdbId || i} item={item} i={i} n={n}/>)}
                    </g>
                    {/* a moldura de lâmpadas fica parada; quem corre é a luz */}
                    <circle r="143" className="rol__aro"/>
                    {Array.from({ length: LAMPADAS }, (_, i) => {
                      const a = (i / LAMPADAS) * 2 * Math.PI;
                      return <circle key={i} cx={143 * Math.cos(a)} cy={143 * Math.sin(a)} r="3.6"
                        className={`rol__lampada ${i % 2 ? "rol__lampada--b" : ""}`}/>;
                    })}
                    <circle r="34" className="rol__centro"/>
                    <image href={lumiSrc("headSmiling")} x="-26" y="-26" width="52" height="52"/>
                    <path d="M-13 -162 L13 -162 L0 -134 Z" className="rol__ponteiro"/>
                  </svg>
                </div>

                <button type="button" className="rol__girar" onClick={girar} disabled={girando}>
                  {girando ? "Girando…" : "Girar a roleta"}
                </button>
                {n >= MAX_FATIAS && watchlist.length > MAX_FATIAS && !girando && (
                  <p className="rol__nota">Na roda cabem {MAX_FATIAS} títulos de cada vez.</p>
                )}
              </>
            )}
          </>
        )}

        {fase === "resultado" && sorteado && (
          <div className="rol__resultado">
            <p className="rol__sub">A sorte escolheu</p>
            <article className="prog__sala prog__sala--frente rol__sala">
              <div className="prog__moldura">
                {sorteado.poster
                  ? <img src={`${TMDB_IMG}${sorteado.poster}`} alt={`Cartaz de ${sorteado.title}`} className="prog__poster"/>
                  : <span className="prog__poster prog__poster--vazio">{sorteado.title}</span>}
              </div>
              <h2 className="prog__titulo">{sorteado.title}</h2>
              <p className="prog__meta">
                {[sorteado.type === "tv" ? "Série" : "Filme", sorteado.year, sorteado.runtime ? duracao(sorteado.runtime) : null].filter(Boolean).join(" · ")}
              </p>
              {quem.length > 0 && (
                <p className="prog__motivo">{quem.length >= 2 ? "Vocês dois querem ver." : `${quem[0]} quer ver.`}</p>
              )}
            </article>
            <button type="button" className="prog__assistir" onClick={() => onRegistrar(sorteado)}>Registrar a sessão</button>
            <button type="button" className="prog__mudar" onClick={() => setFase("parada")}>Girar de novo</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Fatia({ item, i, n }) {
  const raio = 138;
  const angulo = 360 / n;
  const rad = g => ((g - 90) * Math.PI) / 180;
  const a = rad(i * angulo);
  const b = rad((i + 1) * angulo);
  const cor = FATIAS[(n % FATIAS.length === 1 && i === n - 1) ? 1 : i % FATIAS.length];
  const meio = rad((i + 0.5) * angulo);
  const tx = raio * 0.58 * Math.cos(meio);
  const ty = raio * 0.58 * Math.sin(meio);
  let giro = (i + 0.5) * angulo - 90;
  if (giro > 90 && giro < 270) giro += 180; // o texto fica de pé na metade de baixo
  return (
    <g>
      <path d={`M0 0L${raio * Math.cos(a)} ${raio * Math.sin(a)}A${raio} ${raio} 0 ${angulo > 180 ? 1 : 0} 1 ${raio * Math.cos(b)} ${raio * Math.sin(b)}Z`}
        fill={cor.fundo} stroke="#170f12" strokeWidth="1.5"/>
      <text x={tx} y={ty} transform={`rotate(${giro} ${tx} ${ty})`} textAnchor="middle" dominantBaseline="middle"
        fill={cor.texto} className="rol__fatia-texto">{encurtar(item.title, n > 8 ? 14 : 18)}</text>
    </g>
  );
}

const duracao = m => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;

const CAMINHOS = { voltar: "M19 12H5M12 19l-7-7 7-7" };
const Icone = ({ n }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={CAMINHOS[n]}/>
  </svg>
);
