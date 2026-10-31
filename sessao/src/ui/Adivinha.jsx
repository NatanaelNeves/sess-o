import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { TMDB_IMG, TMDB_LOGO, TMDB_MINI, tmdbCached } from "../tmdb.js";
import { gostoDoCasal } from "../recs/gosto.js";
import { montarProgramacao } from "../recs/candidatos.js";
import { proximaPergunta, responder, horaDoPalpite, resumoDoPedido } from "../recs/adivinha.js";
import { openExternal } from "../nativeShare.js";
import LumiCompanion from "./LumiCompanion.jsx";
import Streamings from "./Streamings.jsx";
import useBackClose from "./useBackClose.js";
import "./programacao.css";
import "./adivinha.css";

const NA_PAREDE = 36;  // quantos cartazes o Lumi considera de cada vez
const APAGAR_MS = 750; // tempo para ver as luzes apagando antes do palpite

const semMovimento = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * O Lumi adivinha: uma parede de cartazes acesos e perguntas de sim ou não.
 * Cada resposta apaga os que não combinam, até sobrar o filme da noite.
 * Nada vai para o banco, a não ser que vocês guardem o palpite na lista.
 */
export default function Adivinha({
  users, currentUser, watched, watchlist, streamings = [], prefs,
  onSaveStreamings, onSalvarNaLista, onVeredito, loadVereditos, onClose,
  request = tmdbCached, now,
}) {
  useBackClose(onClose);
  const [meusStreamings, setMeusStreamings] = useState(streamings);
  const [fase, setFase] = useState(streamings.length ? "carregando" : "streamings");
  const [parede, setParede] = useState([]);
  const [acesos, setAcesos] = useState([]);
  const [respostas, setRespostas] = useState([]); // [{ pergunta, resposta, antes }]
  const [descartados, setDescartados] = useState(() => new Set());
  const [guardados, setGuardados] = useState(() => new Set());
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const hoje = useMemo(() => now || new Date(), [now]);
  const gosto = useMemo(() => gostoDoCasal(watched, users, now), [watched, users, now]);
  const talk = prefs?.lumiComments !== false;

  useEffect(() => {
    if (fase !== "carregando") return;
    let vivo = true;
    (async () => {
      try {
        const excluir = loadVereditos ? await loadVereditos().catch(() => new Set()) : new Set();
        const lista = await montarProgramacao({ request, gosto, streamings: meusStreamings, watchlist, excluir, users, hoje, conferir: NA_PAREDE });
        if (!vivo) return;
        // a parede fecha em fileiras inteiras de 9
        const cabem = lista.length >= 18 ? Math.floor(Math.min(lista.length, NA_PAREDE) / 9) * 9 : lista.length;
        const cartazes = lista.slice(0, cabem);
        setParede(cartazes);
        setAcesos(cartazes);
        setRespostas([]);
        setDescartados(new Set());
        setFase(cartazes.length < 3 ? "vazio" : horaDoPalpite(cartazes, new Set(), { hoje }) ? "palpite" : "pergunta");
      } catch (e) {
        if (!vivo) return;
        console.error(e);
        setErro("Não consegui montar a parede de cartazes. Confira a internet e tente de novo.");
        setFase("erro");
      }
    })();
    return () => { vivo = false; };
  }, [fase, tentativa]); // eslint-disable-line react-hooks/exhaustive-deps

  const feitas = useMemo(() => new Set(respostas.map(r => r.pergunta.id)), [respostas]);
  const pergunta = fase === "pergunta" ? proximaPergunta(acesos, feitas, { hoje }) : null;
  const palpites = acesos.filter(c => !descartados.has(c.key));
  const palpite = palpites[0];
  const acesas = new Set(acesos.map(c => c.key));

  const responderPergunta = resposta => {
    if (!pergunta || pensando) return;
    const novos = responder(acesos, pergunta, resposta, { hoje });
    const novasRespostas = [...respostas, { pergunta, resposta, antes: acesos }];
    setAcesos(novos);
    setRespostas(novasRespostas);
    if (!horaDoPalpite(novos, new Set(novasRespostas.map(r => r.pergunta.id)), { hoje })) return;
    if (semMovimento()) { setFase("palpite"); return; }
    setPensando(true);
    setTimeout(() => { setPensando(false); setFase("palpite"); }, APAGAR_MS);
  };
  const voltar = () => {
    const ultima = respostas.at(-1);
    if (!ultima) return;
    setAcesos(ultima.antes);
    setRespostas(respostas.slice(0, -1));
    setDescartados(new Set());
    setFase("pergunta");
  };
  const outroPalpite = () => {
    const proximos = new Set(descartados).add(palpite.key);
    setDescartados(proximos);
    if (!acesos.some(c => !proximos.has(c.key))) setFase("esgotou");
  };
  const jaVimos = async () => {
    const c = palpite;
    outroPalpite();
    try { await onVeredito?.(c.key, "ja_vimos"); } catch (e) { console.error(e); }
  };
  const guardar = async c => {
    setGuardados(g => new Set(g).add(c.key));
    try { await onSalvarNaLista?.([c], users.length >= 2 ? users : [currentUser]); }
    catch (e) { console.error(e); setGuardados(g => { const n = new Set(g); n.delete(c.key); return n; }); }
  };
  const recomecar = () => {
    setAcesos(parede);
    setRespostas([]);
    setDescartados(new Set());
    setFase("pergunta");
  };
  const salvarStreamings = async ids => {
    await onSaveStreamings(ids);
    setMeusStreamings(ids);
    setFase("carregando");
  };

  const n = acesos.length;
  const pedido = resumoDoPedido(respostas);
  const falaDaPergunta = respostas.length === 0
    ? `Separei ${n} cartazes que combinam com vocês. Respondam juntos que eu adivinho.`
    : n > 12 ? `Ainda tenho ${n} acesos. Continuem.`
    : n > 3 ? `Esquentando: sobraram ${n}.`
    : n > 1 ? `Quase lá. Só ${n} acesos.`
    : "Achei! Sobrou um só.";
  const naListaJa = palpite?.naLista && (users.length >= 2
    ? users.every(u => (palpite.naLista.wantedBy || []).includes(u))
    : (palpite.naLista.wantedBy || []).includes(currentUser));

  return createPortal(
    <div className="subpage prog adv">
      <div className="subpage__inner prog__inner">
        <div className="cfg-head">
          <button className="cfg-back" onClick={onClose} aria-label="Voltar"><Icone n="voltar"/></button>
          <h1 className="cfg-title">O Lumi adivinha</h1>
        </div>

        {fase === "streamings" && (
          <>
            <div className="adv__lumi">
              <LumiCompanion mood="curious" size={56} className="lumi-co--inline" talk={talk}
                line="Antes, me contem onde vocês assistem. Só penso em filmes que dá pra ver agora."/>
            </div>
            <Streamings inicial={meusStreamings} onSalvar={salvarStreamings} salvarLabel="Começar" request={request}/>
          </>
        )}

        {fase === "carregando" && (
          <div className="adv__centro" aria-busy="true">
            <LumiCompanion mood="thinking" size={120} talk={talk} line="Acendendo os cartazes…"/>
          </div>
        )}

        {fase === "erro" && (
          <div className="prog__aviso" role="alert">
            <p>{erro}</p>
            <button className="pill pill--outline" onClick={() => { setTentativa(t => t + 1); setFase("carregando"); }}>Tentar de novo</button>
          </div>
        )}

        {fase === "vazio" && (
          <div className="adv__centro">
            <LumiCompanion mood="thinking" size={110} talk line="Achei poucos cartazes nos streamings de vocês para brincar. Que tal marcar mais algum?"/>
            <button className="prog__mudar" onClick={() => setFase("streamings")}>Mudar nossos streamings</button>
          </div>
        )}

        {fase === "pergunta" && (
          <div className="adv__jogo">
            {/* a parede: cada resposta apaga os cartazes que não combinam */}
            <div className={`adv__parede ${pensando ? "adv__parede--pensando" : ""}`} aria-hidden="true">
              {parede.map((c, i) => (
                <span key={c.key} style={{ "--i": i }} className={acesas.has(c.key) ? "adv__luz adv__luz--acesa" : "adv__luz"}>
                  {c.poster ? <img src={`${TMDB_MINI}${c.poster}`} alt="" loading="lazy"/> : <b>{c.title}</b>}
                </span>
              ))}
            </div>
            <p className="adv__contagem" aria-live="polite">
              {n === 1 ? "Sobrou 1 aceso" : `${n} de ${parede.length} acesos`}
            </p>

            <div className="adv__lumi">
              <LumiCompanion mood={n <= 3 ? "excited" : respostas.length ? "thinking" : "curious"} size={52}
                className="lumi-co--inline" talk={talk} line={falaDaPergunta}/>
            </div>

            {pergunta && !pensando && (
              <div key={pergunta.id} className="adv__pergunta">
                <p className="adv__numero">Pergunta {respostas.length + 1}</p>
                <h2>{pergunta.texto}</h2>
                <div className="adv__respostas">
                  <button className="adv__resposta" onClick={() => responderPergunta("sim")}>Sim</button>
                  <button className="adv__resposta" onClick={() => responderPergunta("nao")}>Não</button>
                </div>
                <div className="adv__extras">
                  <button className="prog__mudar" onClick={() => responderPergunta("tanto_faz")}>Tanto faz</button>
                  {respostas.length > 0 && <button className="prog__mudar" onClick={voltar}>Voltar uma pergunta</button>}
                </div>
              </div>
            )}
            {pensando && <p className="adv__pensando">Apagando as luzes…</p>}
          </div>
        )}

        {fase === "palpite" && palpite && (
          <div className="adv__palpite">
            <div className="adv__lumi">
              <LumiCompanion mood={descartados.size ? "thinking" : "pointing"} size={64} className="lumi-co--inline" talk
                line={descartados.size
                  ? "Hmm, então deve ser este."
                  : pedido ? `Pedido anotado: ${pedido}. Só pode ser este!` : "Já sei! Só pode ser este."}/>
            </div>

            <article key={palpite.key} className="prog__sala prog__sala--frente adv__revelado">
              <div className="prog__moldura">
                {palpite.poster
                  ? <img src={`${TMDB_IMG}${palpite.poster}`} alt={`Cartaz de ${palpite.title}`} className="prog__poster"/>
                  : <span className="prog__poster prog__poster--vazio">{palpite.title}</span>}
              </div>
              <h2 className="prog__titulo">{palpite.title}</h2>
              <p className="prog__meta">
                {[palpite.year, ...(palpite.generos || []).slice(0, 2), palpite.type === "tv" ? "série" : null].filter(Boolean).join(" · ")}
                {palpite.nota > 0 && <span className="prog__nota">★ {palpite.nota.toFixed(1).replace(".", ",")}</span>}
              </p>
              <p className="prog__motivo">{palpite.motivo}</p>

              {palpite.link && (
                <button className="prog__assistir" onClick={() => openExternal(palpite.link)}>
                  {palpite.logos?.[0] && <img src={`${TMDB_LOGO}${palpite.logos[0]}`} alt=""/>}
                  <span>Assistir no {palpite.provedores?.[0] || "streaming"}</span>
                </button>
              )}

              <div className="prog__acoes" role="group" aria-label={`O que fazer com ${palpite.title}`}>
                {(() => {
                  const feito = guardados.has(palpite.key) || naListaJa;
                  return (
                    <button className={feito ? "prog__acao prog__acao--feita" : "prog__acao"} disabled={feito} onClick={() => guardar(palpite)}>
                      <Icone n="coracao"/>{feito ? "Na lista" : "Guardar"}
                    </button>
                  );
                })()}
                <button className="prog__acao" onClick={jaVimos}><Icone n="visto"/>Já vimos</button>
                <button className="prog__acao" onClick={outroPalpite}><Icone n="trocar"/>Não é esse</button>
              </div>
            </article>

            <div className="adv__fim">
              {palpites.length > 1 && (
                <p className="adv__reserva">
                  {palpites.length === 2 ? "Ainda tenho mais 1 palpite." : `Ainda tenho mais ${palpites.length - 1} palpites.`}
                </p>
              )}
              <button className="prog__mudar" onClick={voltar}>Mudar a última resposta</button>
              <button className="prog__mudar" onClick={recomecar}>Jogar de novo</button>
            </div>
          </div>
        )}

        {fase === "esgotou" && (
          <div className="adv__centro">
            <LumiCompanion mood="shy" size={110} talk line="Errei todos com essas respostas. Me deem outra chance?"/>
            <button className="prog__assistir adv__largo" onClick={recomecar}>Jogar de novo</button>
            <button className="prog__mudar" onClick={voltar}>Mudar a última resposta</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

const CAMINHOS = {
  voltar: "M19 12H5M12 19l-7-7 7-7",
  coracao: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z",
  visto: "M20 6L9 17l-5-5",
  trocar: "M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3",
};
const Icone = ({ n }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={CAMINHOS[n]}/>
  </svg>
);
