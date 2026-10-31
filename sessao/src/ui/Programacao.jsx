import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { TMDB_IMG, tmdbCached } from "../tmdb.js";
import { gostoDoCasal } from "../recs/gosto.js";
import { montarProgramacao } from "../recs/candidatos.js";
import { openExternal } from "../nativeShare.js";
import LumiCompanion from "./LumiCompanion.jsx";
import Streamings from "./Streamings.jsx";
import useBackClose from "./useBackClose.js";
import "./programacao.css";

const POR_VEZ = 3;

/**
 * A sessão de hoje: o Lumi escolhe 3 títulos que combinam com o casal e que
 * estão nos streamings deles. Nada de catálogo para rolar — se nenhum servir,
 * ele troca os três.
 */
export default function Programacao({
  users, currentUser, watched, watchlist, streamings = [], prefs,
  onSaveStreamings, onAddWatchlist, onAlsoWant, onVeredito, loadVereditos, onClose,
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
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
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

  const tirar = async (c, veredito) => {
    setOcultos(o => new Set(o).add(c.key));
    try { await onVeredito?.(c.key, veredito); } catch (e) { console.error(e); }
  };

  const quero = c => {
    if (c.naLista) { onAlsoWant?.(c.naLista); }
    else {
      onAddWatchlist?.({
        tmdbId: c.tmdbId, type: c.type, title: c.title, year: c.year, poster: c.poster, backdrop: c.backdrop,
        overview: c.overview, genres: c.generos, tmdbRating: c.nota ? c.nota.toFixed(1) : null,
        priority: "normal", suggestedBy: currentUser, wantedBy: [currentUser], addedAt: new Date().toISOString(),
      });
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
    : gosto.maturidade < 3 ? "Ainda estou conhecendo o gosto de vocês. Quanto mais notas, mais eu acerto."
    : acabou ? "Essas foram as minhas melhores ideias para hoje."
    : "Separei três para hoje. Se nenhum servir, eu troco.";

  return createPortal(
    <div className="subpage prog">
      <div className="subpage__inner">
        <div className="cfg-head">
          <button className="cfg-back" onClick={onClose} aria-label="Voltar"><BackIcon/></button>
          <h1 className="cfg-title">Sessão de hoje</h1>
        </div>

        {/* o letreiro do cinema: a única ousadia da tela */}
        <div className="prog__letreiro" aria-hidden="true"><span>Em cartaz hoje</span></div>

        {fala && (
          <div className="prog__lumi">
            <LumiCompanion mood={fase === "carregando" ? "popcorn" : fase === "vazio" || acabou ? "thinking" : "excited"}
              size={60} className="lumi-co--inline" talk={talk} line={fala}/>
          </div>
        )}

        {fase === "streamings" && (
          <Streamings inicial={meusStreamings} onSalvar={salvarStreamings} salvarLabel="Ver a sessão de hoje" request={request}/>
        )}

        {fase === "carregando" && (
          <div className="prog__lista" aria-busy="true">
            {Array.from({ length: POR_VEZ }, (_, i) => <div key={i} className="prog__cartaz prog__cartaz--skel"/>)}
          </div>
        )}

        {fase === "erro" && (
          <div className="prog__aviso" role="alert">
            <p>{erro}</p>
            <button className="pill pill--outline" onClick={() => { setTentativa(t => t + 1); setFase("carregando"); }}>Tentar de novo</button>
          </div>
        )}

        {fase === "pronto" && !acabou && (
          <ol className="prog__lista">
            {agora.map(c => {
              const naLista = c.naLista && (c.naLista.wantedBy || []).includes(currentUser);
              const jaAdicionado = adicionados.has(c.key) || naLista;
              return (
                <li key={c.key} className="prog__cartaz">
                  {c.poster
                    ? <img src={`${TMDB_IMG}${c.poster}`} alt="" className="prog__poster" loading="lazy"/>
                    : <span className="prog__poster prog__poster--vazio" aria-hidden="true"/>}
                  <div className="prog__corpo">
                    <h2 className="prog__titulo">{c.title}</h2>
                    <p className="prog__meta">{[c.year, ...(c.generos || []).slice(0, 2), c.type === "tv" ? "série" : null].filter(Boolean).join(", ")}</p>
                    <p className="prog__motivo">{c.motivo}</p>
                    {c.provedores?.length > 0 && <p className="prog__onde">{c.provedores.join(", ")}</p>}
                    <div className="prog__acoes">
                      {c.link && <button className="pill pill--primary pill--sm" onClick={() => openExternal(c.link)}>Assistir agora</button>}
                      <button className="pill pill--outline pill--sm" disabled={jaAdicionado} onClick={() => quero(c)}>
                        {jaAdicionado ? "Na lista" : c.naLista ? "Também quero" : "Quero ver"}
                      </button>
                    </div>
                    <div className="prog__acoes prog__acoes--fracas">
                      <button onClick={() => tirar(c, "ja_vimos")}>Já vimos</button>
                      <button onClick={() => tirar(c, "nao_e_pra_nos")}>Não é pra nós</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {(fase === "pronto" || fase === "vazio") && (
          <div className="prog__rodape">
            {fase === "pronto" && !acabou && visiveis.length > cursor + POR_VEZ && (
              <button className="pill pill--light pill--block" onClick={() => setCursor(c => c + POR_VEZ)}>Trocar as três</button>
            )}
            {acabou && <button className="pill pill--light pill--block" onClick={() => setCursor(0)}>Ver as primeiras de novo</button>}
            <button className="prog__mudar" onClick={() => setFase("streamings")}>Mudar nossos streamings</button>
            <p className="prog__credito">Onde assistir: dados do JustWatch, via TMDB.</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);
