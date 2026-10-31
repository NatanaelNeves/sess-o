import { createPortal } from "react-dom";
import { TMDB_MINI } from "../tmdb.js";
import useBackClose from "./useBackClose.js";
import "./escolher.css";

/**
 * "O que vamos ver hoje?": os quatro jeitos de escolher num lugar só, cada um
 * com uma miniatura de como funciona, o que faz, quanto tempo leva e de onde
 * vêm os filmes. A divisão que mais confunde (streamings ou lista) vira seção.
 */
export default function Escolher({ users, watchlist = [], streamings = [], onSessao, onAdivinha, onMatch, onRoleta, onClose }) {
  useBackClose(onClose);
  const cartazes = watchlist.filter(w => w.poster).slice(0, 3).map(w => w.poster);
  const doisNoApp = users.length >= 2;
  const naLista = watchlist.length;
  const semStreamings = streamings.length === 0;

  return createPortal(
    <div className="subpage esc">
      <div className="subpage__inner">
        <div className="cfg-head">
          <button className="cfg-back" onClick={onClose} aria-label="Voltar"><Icone n="voltar"/></button>
        </div>

        <h1 className="esc__titulo">O que vamos ver hoje?</h1>
        <p className="esc__sub">Cada jeito resolve um tipo de indecisão. Escolham o que mais parece com a noite de vocês.</p>

        {/* cada jeito começa pela situação do casal; o nome e a mecânica vêm embaixo */}
        <button type="button" className="esc__destaque" onClick={onSessao}>
          <ArteSalas cartazes={cartazes}/>
          <span className="esc__selo">Comecem por aqui</span>
          <span className="esc__situacao">Não sabem nem por onde começar?</span>
          <span className="esc__nome">Sessão de hoje</span>
          <span className="esc__desc">O Lumi escolhe três filmes pelo gosto de vocês, entre o que está nos seus streamings. Vocês só olham.</span>
          <Fatos itens={[["relogio", "Na hora"], ["coracao", "Decide pelo gosto de vocês"]]}/>
          {semStreamings && <span className="esc__nota">Na primeira vez, vocês marcam onde assistem.</span>}
          <span className="esc__acao">Ver a sessão de hoje</span>
        </button>

        <h2 className="esc__secao">Outros tipos de indecisão</h2>
        <ul className="esc__lista">
          <li>
            <button type="button" className="esc__jeito" onClick={onAdivinha}>
              <ArteParede/>
              <span className="esc__texto">
                <span className="esc__situacao">Sabem o clima, mas não o filme?</span>
                <span className="esc__nome">O Lumi adivinha</span>
                <span className="esc__desc">Respondam perguntas sobre hoje, como rir ou levar susto, e ele apaga os cartazes até sobrar um.</span>
                <Fatos itens={[["relogio", "Uns 2 minutos"], ["balao", "Decide pelo humor de hoje"]]}/>
              </span>
              <Icone n="seta"/>
            </button>
          </li>
          <li>
            <button type="button" className="esc__jeito" onClick={onMatch} disabled={!doisNoApp}>
              <ArteIngresso iniciais={users.map(u => u[0])}/>
              <span className="esc__texto">
                <span className="esc__situacao">Cada um quer uma coisa?</span>
                <span className="esc__nome">Match a dois</span>
                <span className="esc__desc">Cada um vota sozinho em 12 cartazes, passando o celular. O que os dois quiserem ganha.</span>
                {doisNoApp
                  ? <Fatos itens={[["relogio", "Uns 3 minutos"], ["pessoas", "Decide pelo voto de cada um"]]}/>
                  : <span className="esc__nota">Liberado quando sua pessoa entrar no diário.</span>}
              </span>
              <Icone n="seta"/>
            </button>
          </li>
          <li>
            <button type="button" className="esc__jeito" onClick={onRoleta} disabled={naLista < 2}>
              <ArteRoleta/>
              <span className="esc__texto">
                <span className="esc__situacao">Já têm a lista, só falta escolher?</span>
                <span className="esc__nome">Roleta da lista</span>
                <span className="esc__desc">A sorte escolhe entre o que vocês já guardaram na lista a dois.</span>
                {naLista >= 2
                  ? <Fatos itens={[["relogio", "Na hora"], ["lista", `Entre os ${naLista} da lista`]]}/>
                  : <span className="esc__nota">Guardem pelo menos dois títulos na lista para girar.</span>}
              </span>
              <Icone n="seta"/>
            </button>
          </li>
        </ul>
      </div>
    </div>,
    document.body,
  );
}

/** A faixa que leva para "O que vamos ver hoje?", na Home e na lista a dois. */
export function FaixaEscolher({ onAbrir, titulo = "O que vamos ver hoje?", texto = "Quatro jeitos de decidir juntos, com a ajuda do Lumi." }) {
  return (
    <button type="button" className="esc-faixa" onClick={onAbrir}>
      <span className="esc-faixa__artes" aria-hidden="true">
        <ArteSalas mini/>
        <ArteRoleta mini/>
      </span>
      <span className="esc-faixa__texto">
        <span className="esc-faixa__titulo">{titulo}</span>
        <span className="esc-faixa__sub">{texto}</span>
      </span>
      <Icone n="seta"/>
    </button>
  );
}

function Fatos({ itens }) {
  return (
    <span className="esc__fatos">
      {itens.map(([icone, texto]) => <span key={texto}><Icone n={icone}/>{texto}</span>)}
    </span>
  );
}

/* ---------- as miniaturas: cada uma mostra o jeito de escolher ---------- */

function ArteSalas({ cartazes = [], mini = false }) {
  return (
    <span className={`arte-salas ${mini ? "arte-salas--mini" : ""}`} aria-hidden="true">
      {[0, 1, 2].map(i => (
        <span key={i} className={`arte-salas__sala ${i === 1 ? "arte-salas__sala--frente" : ""}`}>
          {cartazes[i] ? <img src={`${TMDB_MINI}${cartazes[i]}`} alt=""/> : <i/>}
        </span>
      ))}
    </span>
  );
}

const ACESOS = new Set([1, 6, 8, 11]);
function ArteParede() {
  return (
    <span className="arte-parede" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => <i key={i} className={ACESOS.has(i) ? "acesa" : ""}/>)}
    </span>
  );
}

function ArteIngresso({ iniciais = [] }) {
  return (
    <span className="arte-ingresso" aria-hidden="true">
      <i>{iniciais[0] || "A"}</i>
      <i>{iniciais[1] || "B"}</i>
    </span>
  );
}

const FATIAS = ["#d23a3f", "#2b1716", "#fbefdf", "#4a2a20", "#d23a3f", "#2b1716", "#fbefdf", "#4a2a20"];
function ArteRoleta({ mini = false }) {
  const r = 30;
  return (
    <span className={`arte-roleta ${mini ? "arte-roleta--mini" : ""}`} aria-hidden="true">
      <svg viewBox="-36 -36 72 72">
        {FATIAS.map((cor, i) => {
          const a = (i / FATIAS.length) * 2 * Math.PI - Math.PI / 2;
          const b = ((i + 1) / FATIAS.length) * 2 * Math.PI - Math.PI / 2;
          return <path key={i} d={`M0 0L${r * Math.cos(a)} ${r * Math.sin(a)}A${r} ${r} 0 0 1 ${r * Math.cos(b)} ${r * Math.sin(b)}Z`} fill={cor}/>;
        })}
        <circle r={r + 2.5} fill="none" stroke="#4a2a20" strokeWidth="5"/>
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * 2 * Math.PI;
          return <circle key={i} cx={(r + 2.5) * Math.cos(a)} cy={(r + 2.5) * Math.sin(a)} r="1.3" fill="#ffd58a"/>;
        })}
        <circle r="6" fill="#170f12" stroke="#ffb54a" strokeWidth="1.5"/>
        <path d="M-4 -40L4 -40L0 -31Z" fill="#ffb54a"/>
      </svg>
    </span>
  );
}

const CAMINHOS = {
  voltar: "M19 12H5M12 19l-7-7 7-7",
  seta: "M9 6l6 6-6 6",
  relogio: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  tv: "M4 6h16v11H4zM9 21h6M12 17v4",
  pessoas: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8",
  lista: "M6 3h12v18l-6-4-6 4z",
  coracao: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z",
  balao: "M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z",
};
function Icone({ n }) {
  return (
    <svg className={`esc-ic esc-ic--${n}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={CAMINHOS[n]}/>
    </svg>
  );
}
