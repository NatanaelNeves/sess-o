import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { TMDB_IMG, TMDB_LOGO, tmdbCached } from "../tmdb.js";
import { gostoDoCasal } from "../recs/gosto.js";
import { montarProgramacao } from "../recs/candidatos.js";
import { montarBaralho, resultadoDoMatch, TAMANHO_DO_BARALHO } from "../recs/match.js";
import { openExternal } from "../nativeShare.js";
import LumiCompanion from "./LumiCompanion.jsx";
import Streamings from "./Streamings.jsx";
import Baralho from "./Baralho.jsx";
import useBackClose from "./useBackClose.js";
import "./programacao.css";
import "./match.css";

/**
 * Match a dois, num celular só: cada um desliza o mesmo baralho sozinho, com
 * uma tela de "passa o celular" no meio. Os votos ficam só no aparelho; o banco
 * só é tocado se vocês pedirem para guardar algo na lista a dois.
 */
export default function Match({
  users, watched, watchlist, streamings = [], prefs,
  onSaveStreamings, onSalvarNaLista, loadVereditos, onClose,
  request = tmdbCached, now,
}) {
  useBackClose(onClose);
  const [meusStreamings, setMeusStreamings] = useState(streamings);
  const [fase, setFase] = useState(streamings.length ? "carregando" : "streamings");
  const [ordenados, setOrdenados] = useState([]);
  const [rodada, setRodada] = useState(0);
  const [primeiro, setPrimeiro] = useState(0); // quem começa: índice em users
  const [vez, setVez] = useState(0);           // 0 = primeiro a votar, 1 = segundo
  const [votos, setVotos] = useState(() => [new Map(), new Map()]);
  const [guardados, setGuardados] = useState(() => new Set());
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
        const lista = await montarProgramacao({
          request, gosto, streamings: meusStreamings, watchlist, excluir, users,
          hoje: now || new Date(), conferir: TAMANHO_DO_BARALHO * 3,
        });
        if (!vivo) return;
        setOrdenados(lista);
        setFase(lista.length >= 2 ? "intro" : "vazio");
      } catch (e) {
        if (!vivo) return;
        console.error(e);
        setErro("Não consegui montar o baralho. Confira a internet e tente de novo.");
        setFase("erro");
      }
    })();
    return () => { vivo = false; };
  }, [fase, tentativa]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalRodadas = Math.max(1, Math.ceil(ordenados.length / TAMANHO_DO_BARALHO));
  const baralho = montarBaralho(ordenados, { rodada: rodada % totalRodadas });
  const ordem = [primeiro, 1 - primeiro];
  const quem = users[ordem[vez]];
  const meusVotos = votos[vez];
  const restantes = baralho.filter(c => !meusVotos.has(c.key));
  const votados = baralho.length - restantes.length;
  const resultado = fase === "resultado" ? resultadoDoMatch(baralho, votos[0], votos[1]) : null;

  const votar = (c, sim) => {
    const novos = [new Map(votos[0]), new Map(votos[1])];
    novos[vez].set(c.key, sim);
    setVotos(novos);
    if (novos[vez].size >= baralho.length) setFase(vez === 0 ? "troca" : "resultado");
  };
  const desfazer = () => {
    const ultimo = [...meusVotos.keys()].pop();
    if (!ultimo) return;
    const novos = [new Map(votos[0]), new Map(votos[1])];
    novos[vez].delete(ultimo);
    setVotos(novos);
  };
  const novaRodada = () => {
    setRodada(r => r + 1);
    setVotos([new Map(), new Map()]);
    setVez(0);
    setGuardados(new Set());
    setFase("intro");
  };
  // grupos: [[cartas, pessoas], ...] — cada grupo vai para a lista querido por essas pessoas
  const guardar = async (grupos, chave) => {
    setGuardados(g => new Set(g).add(chave));
    try {
      for (const [cartas, pessoas] of grupos) if (cartas.length) await onSalvarNaLista?.(cartas, pessoas);
    } catch (e) {
      console.error(e);
      setGuardados(g => { const n = new Set(g); n.delete(chave); return n; });
    }
  };
  const salvarStreamings = async ids => {
    await onSaveStreamings(ids);
    setMeusStreamings(ids);
    setFase("carregando");
  };

  if (users.length < 2) {
    return createPortal(
      <Casca titulo="Match a dois" onClose={onClose}>
        <div className="match__lumi">
          <LumiCompanion mood="waiting" size={64} className="lumi-co--inline" talk
            line="O match precisa de vocês dois. Quando sua pessoa entrar no diário, a gente joga."/>
        </div>
      </Casca>,
      document.body,
    );
  }

  return createPortal(
    <Casca titulo="Match a dois" onClose={onClose}>
      {fase === "streamings" && (
        <>
          <div className="match__lumi">
            <LumiCompanion mood="curious" size={56} className="lumi-co--inline" talk={talk}
              line="Antes, me contem onde vocês assistem. Só entram no baralho filmes que dá pra ver agora."/>
          </div>
          <Streamings inicial={meusStreamings} onSalvar={salvarStreamings} salvarLabel="Montar o baralho" request={request}/>
        </>
      )}

      {fase === "carregando" && (
        <div className="match__centro" aria-busy="true">
          <LumiCompanion mood="popcorn" size={120} talk={talk} line="Embaralhando os cartazes…"/>
        </div>
      )}

      {fase === "erro" && (
        <div className="prog__aviso" role="alert">
          <p>{erro}</p>
          <button className="pill pill--outline" onClick={() => { setTentativa(t => t + 1); setFase("carregando"); }}>Tentar de novo</button>
        </div>
      )}

      {fase === "vazio" && (
        <div className="match__centro">
          <LumiCompanion mood="thinking" size={110} talk line="Não achei cartazes suficientes nos streamings de vocês. Que tal marcar mais algum?"/>
          <button className="prog__mudar" onClick={() => setFase("streamings")}>Mudar nossos streamings</button>
        </div>
      )}

      {fase === "intro" && (
        <div className="match__intro">
          <div className="match__duo" aria-hidden="true">
            <span className="match__ava match__ava--a">{users[0][0]}</span>
            <span className="match__coracao">♥</span>
            <span className="match__ava match__ava--b">{users[1][0]}</span>
          </div>
          <h2 className="match__titulo">Um baralho, dois votos</h2>
          <p className="match__texto">
            Cada um desliza {baralho.length} cartazes sozinho, sem espiar o outro: para a direita, quero; para a esquerda, passo.
            O que os dois quiserem vira o filme da noite.
          </p>
          <button className="prog__assistir" onClick={() => { setVez(0); setFase("vez"); }}>
            Começa {users[primeiro]}
          </button>
          <button className="prog__mudar" onClick={() => setPrimeiro(p => 1 - p)}>Prefiro que {users[1 - primeiro]} comece</button>
        </div>
      )}

      {fase === "vez" && (
        <div className="match__vez">
          <div className="match__placar">
            <span className={`match__ava match__ava--${ordem[vez] === 0 ? "a" : "b"}`}>{quem[0]}</span>
            <strong>Vez de {quem}</strong>
            <span className="match__progresso">{Math.min(votados + 1, baralho.length)} de {baralho.length}</span>
          </div>
          <div className="match__barra" aria-hidden="true"><span style={{ width: `${(votados / baralho.length) * 100}%` }}/></div>
          <Baralho cartas={restantes} onVoto={votar}/>
          {votados > 0 && <button className="prog__mudar" onClick={desfazer}>Desfazer o último</button>}
        </div>
      )}

      {fase === "troca" && (
        <div className="match__troca">
          <LumiCompanion mood="shy" size={130} talk
            line={`Pronto, ${users[ordem[0]]}! Agora passa o celular para ${users[ordem[1]]}. Eu não conto nada.`}/>
          <button className="prog__assistir" onClick={() => { setVez(1); setFase("vez"); }}>
            Sou {users[ordem[1]]}, começar
          </button>
        </div>
      )}

      {fase === "resultado" && resultado && (
        resultado.matches.length ? (
          <div className="match__resultado">
            <div className="match__festa" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ "--i": i }}/>)}</div>
            <LumiCompanion mood="celebrating" size={84} className="lumi-co--inline" talk
              line={resultado.matches.length === 1 ? "Deu match! Esse é o filme da noite." : `Deu ${resultado.matches.length} matches! Comecem por este.`}/>
            <article className="prog__sala prog__sala--frente match__vencedor">
              <div className="prog__moldura">
                {resultado.matches[0].poster
                  ? <img src={`${TMDB_IMG}${resultado.matches[0].poster}`} alt={`Cartaz de ${resultado.matches[0].title}`} className="prog__poster"/>
                  : <span className="prog__poster prog__poster--vazio">{resultado.matches[0].title}</span>}
              </div>
              <h2 className="prog__titulo">{resultado.matches[0].title}</h2>
              <p className="prog__meta">{[resultado.matches[0].year, ...(resultado.matches[0].generos || []).slice(0, 2)].filter(Boolean).join(" · ")}</p>
              {resultado.matches[0].link && (
                <button className="prog__assistir" onClick={() => openExternal(resultado.matches[0].link)}>
                  {resultado.matches[0].logos?.[0] && <img src={`${TMDB_LOGO}${resultado.matches[0].logos[0]}`} alt=""/>}
                  <span>Assistir no {resultado.matches[0].provedores?.[0] || "streaming"}</span>
                </button>
              )}
            </article>
            {resultado.matches.length > 1 && (
              <div className="match__outros">
                <p>Também deu match:</p>
                <ul>{resultado.matches.slice(1).map(c => <li key={c.key}>{c.title}</li>)}</ul>
              </div>
            )}
            <button className="prog__trocar" disabled={guardados.has("matches")}
              onClick={() => guardar([[resultado.matches, users]], "matches")}>
              {guardados.has("matches") ? "Na lista de vocês dois" : resultado.matches.length === 1 ? "Guardar na lista a dois" : "Guardar os matches na lista"}
            </button>
            <button className="prog__mudar" onClick={novaRodada}>Jogar outra rodada</button>
          </div>
        ) : (
          <div className="match__resultado">
            <LumiCompanion mood="thinking" size={84} className="lumi-co--inline" talk
              line="Nenhum match desta vez. Os gostos se desencontraram, mas eu tenho mais cartazes."/>
            <div className="match__desencontro">
              {[0, 1].map(v => (
                <div key={v}>
                  <strong>{users[ordem[v]]} quis {resultado.soDe[v].length}</strong>
                  <span>{resultado.soDe[v].slice(0, 3).map(c => c.title).join(", ") || "nenhum"}</span>
                </div>
              ))}
            </div>
            <button className="prog__assistir" onClick={novaRodada}>Jogar outra rodada</button>
            {resultado.soDe.some(l => l.length) && (
              <button className="prog__trocar" disabled={guardados.has("cada")}
                onClick={() => guardar([
                  [resultado.soDe[0], [users[ordem[0]]]],
                  [resultado.soDe[1], [users[ordem[1]]]],
                ], "cada")}>
                {guardados.has("cada") ? "Guardado na lista" : "Guardar o que cada um quis"}
              </button>
            )}
          </div>
        )
      )}
    </Casca>,
    document.body,
  );
}

function Casca({ titulo, onClose, children }) {
  return (
    <div className="subpage prog match">
      <div className="subpage__inner prog__inner">
        <div className="cfg-head">
          <button className="cfg-back" onClick={onClose} aria-label="Voltar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <h1 className="cfg-title">{titulo}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
