import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { TMDB_IMG, TMDB_LOGO, TMDB_SM, tmdbCached } from "../tmdb.js";
import { gostoDoCasal } from "../recs/gosto.js";
import { montarProgramacao } from "../recs/candidatos.js";
import { itemDaLista } from "../recs/paraLista.js";
import { openExternal } from "../nativeShare.js";
import LumiCompanion from "./LumiCompanion.jsx";
import Streamings from "./Streamings.jsx";
import useBackClose from "./useBackClose.js";
import "./programacao.css";

const POR_VEZ = 3;

/**
 * A sessão de hoje: três salas, um cartaz em cada. O Lumi escolhe o que combina
 * com o casal e está nos streamings deles — nada de catálogo para rolar; se
 * nenhum servir, ele troca os três.
 */
export default function Programacao({
  users, currentUser, watched, watchlist, streamings = [], prefs,
  onSaveStreamings, onAddWatchlist, onAlsoWant, onVeredito, loadVereditos, onOutroJeito, onClose,
  request = tmdbCached, now,
}) {
  useBackClose(onClose);
  // a escolha feita aqui vale na hora, sem esperar o casal voltar do Firestore
  const [meusStreamings, setMeusStreamings] = useState(streamings);
  const [fase, setFase] = useState(streamings.length ? "carregando" : "streamings");
  const [lista, setLista] = useState([]);
  const [cursor, setCursor] = useState(0);
  const [ocultos, setOcultos] = useState(() => new Set());
  const [adicionados, setAdicionados] = useState(() => new Set());
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [ativa, setAtiva] = useState(0);
  const gosto = useMemo(() => gostoDoCasal(watched, users, now), [watched, users, now]);
  const talk = prefs?.lumiComments !== false;

  useEffect(() => {
    if (fase !== "carregando") return;
    let vivo = true;
    (async () => {
      try {
        const excluir = loadVereditos ? await loadVereditos().catch(() => new Set()) : new Set();
        const resultado = await montarProgramacao({ request, gosto, streamings: meusStreamings, watchlist, excluir, users, hoje: now || new Date() });
        if (!vivo) return;
        setLista(resultado);
        setCursor(0);
        setAtiva(0);
        setFase(resultado.length ? "pronto" : "vazio");
      } catch (e) {
        if (!vivo) return;
        console.error(e);
        setErro(e?.message === "TMDB_AUTH_MISSING"
          ? "O catálogo de filmes não está configurado neste app."
          : "Não consegui falar com o catálogo de filmes. Confira a internet e tente de novo.");
        setFase("erro");
      }
    })();
    return () => { vivo = false; };
    // `tentativa` refaz a busca no "Tentar de novo"
  }, [fase, tentativa]); // eslint-disable-line react-hooks/exhaustive-deps

  const visiveis = lista.filter(c => !ocultos.has(c.key));
  const agora = visiveis.slice(cursor, cursor + POR_VEZ);
  const acabou = fase === "pronto" && agora.length === 0;
  const atual = agora[Math.min(ativa, agora.length - 1)];
  const temMais = visiveis.length > cursor + POR_VEZ;

  const trocar = () => {
    setCursor(c => (temMais ? c + POR_VEZ : 0));
    setAtiva(0);
  };

  const tirar = async (c, veredito) => {
    setOcultos(o => new Set(o).add(c.key));
    setAviso(veredito === "ja_vimos" ? `Anotado: vocês já viram ${c.title}.` : `Combinado, não sugiro mais ${c.title}.`);
    try { await onVeredito?.(c.key, veredito); } catch (e) { console.error(e); }
  };

  const quero = c => {
    if (c.naLista) { onAlsoWant?.(c.naLista); }
    else {
      onAddWatchlist?.(itemDaLista(c, [currentUser]));
    }
    setAdicionados(a => new Set(a).add(c.key));
  };

  const salvarStreamings = async ids => {
    await onSaveStreamings(ids);
    setMeusStreamings(ids);
    setOcultos(new Set());
    setFase("carregando");
  };

  const fala = fase === "streamings"
    ? "Antes, me contem onde vocês assistem. Só sugiro o que dá pra ver agora."
    : fase === "carregando" ? "Escolhendo a sessão de vocês…"
    : fase === "vazio" ? "Não achei nada nos streamings de vocês que combine. Que tal marcar mais algum?"
    : fase === "erro" ? null
    : acabou ? "Essas foram as minhas melhores ideias para hoje."
    : aviso || (gosto.maturidade < 3
      ? "Ainda estou conhecendo o gosto de vocês. Quanto mais notas, mais eu acerto."
      : "Separei três salas para hoje. Toquem num cartaz para ver o filme.");

  return createPortal(
    <div className="subpage prog">
      {/* a sala ganha a luz do filme que está na frente */}
      {fase === "pronto" && atual && (atual.backdrop || atual.poster) && (
        <div key={atual.key} className="prog__ambiente" aria-hidden="true"
          style={{ backgroundImage: `url(${TMDB_SM}${atual.backdrop || atual.poster})` }}/>
      )}

      <div className="subpage__inner prog__inner">
        <div className="cfg-head">
          <button className="cfg-back" onClick={onClose} aria-label="Voltar"><Icone n="voltar"/></button>
          <h1 className="cfg-title">Sessão de hoje</h1>
        </div>

        {fala && (
          <div className="prog__lumi" aria-live="polite">
            <LumiCompanion mood={fase === "carregando" ? "popcorn" : fase === "vazio" || acabou ? "thinking" : aviso ? "winking" : "excited"}
              size={56} className="lumi-co--inline" talk={talk} line={fala}/>
          </div>
        )}

        {fase === "streamings" && (
          <Streamings inicial={meusStreamings} onSalvar={salvarStreamings} salvarLabel="Ver a sessão de hoje" request={request}/>
        )}

        {fase === "carregando" && (
          <div className="prog__palco" aria-busy="true">
            <div className="prog__trilho prog__trilho--espera">
              <div className="prog__sala"><div className="prog__moldura prog__moldura--vazia"><span/></div></div>
            </div>
          </div>
        )}

        {fase === "erro" && (
          <div className="prog__aviso" role="alert">
            <p>{erro}</p>
            <button className="pill pill--outline" onClick={() => { setTentativa(t => t + 1); setFase("carregando"); }}>Tentar de novo</button>
          </div>
        )}

        {fase === "pronto" && !acabou && atual && (() => {
          const naListaJa = atual.naLista && (atual.naLista.wantedBy || []).includes(currentUser);
          const naLista = adicionados.has(atual.key) || naListaJa;
          return (
            <div className="prog__palco">
              {/* o letreiro: os três cartazes lado a lado, para comparar de uma vez só */}
              <div key={cursor} className="prog__letreiro" role="tablist" aria-label="As três salas de hoje">
                {agora.map((c, i) => (
                  <button key={c.key} type="button" role="tab" id={`prog-sala-${i}`} aria-selected={i === ativa}
                    aria-controls="prog-detalhe" aria-label={`Sala ${i + 1}: ${c.title}`}
                    className={`prog__cartaz ${i === ativa ? "prog__cartaz--frente" : ""}`} onClick={() => setAtiva(i)}>
                    <span className="prog__moldura">
                      {c.poster
                        ? <img src={`${TMDB_IMG}${c.poster}`} alt="" className="prog__poster"/>
                        : <span className="prog__poster prog__poster--vazio">{c.title}</span>}
                    </span>
                    <span className="prog__placa" aria-hidden="true">Sala {i + 1}</span>
                  </button>
                ))}
              </div>

              {/* o filme da sala acesa, com o que precisa para decidir */}
              <article key={atual.key} id="prog-detalhe" role="tabpanel" aria-labelledby={`prog-sala-${ativa}`} className="prog__detalhe">
                <h2 className="prog__titulo">{atual.title}</h2>
                <p className="prog__meta">
                  {[atual.year, ...(atual.generos || []).slice(0, 2), atual.type === "tv" ? "série" : null].filter(Boolean).join(" · ")}
                  {atual.nota > 0 && <span className="prog__nota">★ {atual.nota.toFixed(1).replace(".", ",")}</span>}
                </p>
                <p className="prog__motivo">{atual.motivo}</p>
                {atual.overview && <p className="prog__sinopse">{atual.overview}</p>}

                {atual.link && (
                  <button className="prog__assistir" onClick={() => openExternal(atual.link)}>
                    {atual.logos?.[0] && <img src={`${TMDB_LOGO}${atual.logos[0]}`} alt=""/>}
                    <span>Assistir no {atual.provedores?.[0] || "streaming"}</span>
                  </button>
                )}

                <div className="prog__acoes" role="group" aria-label={`O que fazer com ${atual.title}`}>
                  <button className={naLista ? "prog__acao prog__acao--feita" : "prog__acao"} disabled={naLista} onClick={() => quero(atual)}>
                    <Icone n="coracao"/>{naLista ? "Na lista" : atual.naLista ? "Também quero" : "Quero ver"}
                  </button>
                  <button className="prog__acao" onClick={() => tirar(atual, "ja_vimos")}><Icone n="visto"/>Já vimos</button>
                  <button className="prog__acao" onClick={() => tirar(atual, "nao_e_pra_nos")}><Icone n="nao"/>Não é pra nós</button>
                </div>
              </article>
            </div>
          );
        })()}

        {(fase === "pronto" || fase === "vazio") && (
          <div className="prog__rodape">
            {fase === "pronto" && (
              <button className="prog__trocar" onClick={trocar}>
                <Icone n="trocar"/>{acabou ? "Ver as primeiras de novo" : temMais ? "Trocar as três" : "Voltar às primeiras"}
              </button>
            )}
            {onOutroJeito && fase === "pronto" && (
              <button className="prog__mudar" onClick={onOutroJeito}>Nenhum dos três? Escolham de outro jeito</button>
            )}
            <button className="prog__mudar" onClick={() => setFase("streamings")}>Mudar nossos streamings</button>
            <p className="prog__credito">Onde assistir: dados do JustWatch, via TMDB.</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

const CAMINHOS = {
  voltar: "M19 12H5M12 19l-7-7 7-7",
  coracao: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z",
  visto: "M20 6L9 17l-5-5",
  nao: "M18 6L6 18M6 6l12 12",
  trocar: "M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3",
};
const Icone = ({ n }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={CAMINHOS[n]}/>
  </svg>
);
