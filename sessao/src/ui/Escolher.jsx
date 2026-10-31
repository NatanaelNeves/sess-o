import { useState } from "react";
import { createPortal } from "react-dom";
import { TMDB_MINI } from "../tmdb.js";
import { lumiSrc } from "../lumi.jsx";
import LumiCompanion from "./LumiCompanion.jsx";
import useBackClose from "./useBackClose.js";
import "./escolher.css";

/**
 * "O que vamos ver hoje?": os quatro jeitos de escolher, cada um como uma sala.
 * Só uma fica acesa por vez — a que vocês tocaram — e ela explica em três
 * passos como funciona, quanto tempo leva e quem decide. As outras ficam no
 * escuro, só com a situação que resolvem.
 */
export default function Escolher({ users, watchlist = [], streamings = [], prefs, onSessao, onAdivinha, onMatch, onRoleta, onClose }) {
  useBackClose(onClose);
  const [acesa, setAcesa] = useState("sessao");
  const cartazes = watchlist.filter(w => w.poster).slice(0, 3).map(w => w.poster);
  const doisNoApp = users.length >= 2;
  const naLista = watchlist.length;
  const semStreamings = streamings.length === 0;

  const jeitos = [
    {
      id: "sessao",
      arte: <ArteSalas cartazes={cartazes}/>,
      situacao: "Não sabem nem por onde começar?",
      nome: "Sessão de hoje",
      selo: "Comecem por aqui",
      passos: [
        semStreamings ? "Vocês marcam os streamings que assinam. É só na primeira vez." : "O Lumi olha os streamings que vocês assinam.",
        "Ele separa três filmes pelo gosto de vocês, cada um numa sala.",
        "Deslizem entre as salas e escolham o da noite.",
      ],
      fatos: [["relogio", "Na hora"], ["coracao", "Decide pelo gosto de vocês"]],
      acao: "Ver a sessão de hoje",
      abrir: onSessao,
    },
    {
      id: "adivinha",
      arte: <ArteParede/>,
      situacao: "Sabem o clima, mas não o filme?",
      nome: "O Lumi adivinha",
      passos: [
        "Respondam juntos perguntas como: hoje é dia de rir? Topam um susto?",
        "Cada resposta apaga os cartazes que não combinam.",
        "Quando sobra um, o Lumi revela o filme.",
      ],
      fatos: [["relogio", "Uns 2 minutos"], ["balao", "Decide pelo humor de hoje"]],
      acao: "Começar as perguntas",
      abrir: onAdivinha,
    },
    {
      id: "match",
      arte: <ArteIngresso iniciais={users.map(u => u[0])}/>,
      situacao: "Cada um quer uma coisa?",
      nome: "Match a dois",
      passos: [
        "Um de vocês desliza 12 cartazes: para a direita é quero, para a esquerda é passo.",
        "Passa o celular, e o outro vota sem ver os votos.",
        "O que os dois quiserem vira o filme da noite.",
      ],
      fatos: [["relogio", "Uns 3 minutos"], ["pessoas", "Decide pelo voto de cada um"]],
      acao: "Começar o match",
      abrir: onMatch,
      bloqueio: doisNoApp ? null : "Fica liberado quando sua pessoa entrar no diário.",
    },
    {
      id: "roleta",
      arte: <ArteRoleta/>,
      situacao: "Já têm a lista, só falta escolher?",
      nome: "Roleta da lista",
      passos: [
        `Os títulos da lista a dois entram na roda${naLista > 12 ? ", até 12 por vez" : ""}.`,
        "Vocês giram e deixam a sorte decidir.",
        "O sorteado aparece no cartaz, pronto para a sessão.",
      ],
      fatos: [["relogio", "Na hora"], ["lista", naLista ? `Entre os ${naLista} da lista` : "Da lista a dois"]],
      acao: "Girar a roleta",
      abrir: onRoleta,
      bloqueio: naLista >= 2 ? null : "Guardem pelo menos dois títulos na lista a dois para girar.",
    },
  ];

  return createPortal(
    <div className="subpage esc">
      <div className="subpage__inner">
        <div className="cfg-head">
          <button className="cfg-back" onClick={onClose} aria-label="Voltar"><Icone n="voltar"/></button>
        </div>

        <h1 className="esc__titulo">O que vamos ver hoje?</h1>
        <div className="esc__lumi">
          <LumiCompanion mood="pointing" size={60} className="lumi-co--inline" talk={prefs?.lumiComments !== false}
            line="Cada jeito resolve um tipo de indecisão. Toquem no que parece com a noite de vocês."/>
        </div>

        <ul className="esc__salas">
          {jeitos.map(j => {
            const aberta = acesa === j.id;
            return (
              <li key={j.id} className={`esc__sala ${aberta ? "esc__sala--acesa" : ""}`}>
                <button type="button" className="esc__porta" aria-expanded={aberta} aria-controls={`esc-${j.id}`}
                  onClick={e => {
                    setAcesa(j.id);
                    // a sala que acendeu pode abrir abaixo da dobra: traz ela inteira para a tela
                    const sala = e.currentTarget.closest("li");
                    const suave = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
                    setTimeout(() => sala?.scrollIntoView({ block: "nearest", behavior: suave ? "smooth" : "auto" }), 30);
                  }}>
                  <span className="esc__arte">{j.arte}</span>
                  <span className="esc__cabeca">
                    <span className="esc__situacao">{j.situacao}</span>
                    <span className="esc__nome">{j.nome}{j.selo && <span className="esc__selo">{j.selo}</span>}</span>
                  </span>
                  <Icone n="seta"/>
                </button>

                {/* o conteúdo só existe na sala acesa: as apagadas ficam curtas */}
                <div id={`esc-${j.id}`} className="esc__dentro" role="region" aria-label={`Como funciona: ${j.nome}`} hidden={!aberta}>
                  <ol className="esc__passos">
                    {j.passos.map(p => <li key={p}>{p}</li>)}
                  </ol>
                  <Fatos itens={j.fatos}/>
                  {j.bloqueio
                    ? <p className="esc__nota">{j.bloqueio}</p>
                    : <button type="button" className="esc__acao" onClick={j.abrir}>{j.acao}</button>}
                </div>
              </li>
            );
          })}
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
      <img src={lumiSrc("roulette")} alt="" className="esc-faixa__lumi"/>
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

function ArteSalas({ cartazes = [] }) {
  return (
    <span className="arte-salas" aria-hidden="true">
      {[0, 1, 2].map(i => (
        <span key={i} className={`arte-salas__sala ${i === 1 ? "arte-salas__sala--frente" : ""}`}>
          {/* sem pôster na lista, cada sala ganha um cartaz de cor, nunca uma moldura vazia */}
          {cartazes[i] ? <img src={`${TMDB_MINI}${cartazes[i]}`} alt=""/> : <i className={`arte-salas__cor arte-salas__cor--${i}`}/>}
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
function ArteRoleta() {
  const r = 30;
  return (
    <span className="arte-roleta" aria-hidden="true">
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
