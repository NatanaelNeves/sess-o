import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { TMDB_IMG, TMDB_LOGO, TMDB_SM, tmdbCached } from "../tmdb.js";
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

const CORTINA_MS = 750;
const semMovimento = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Match a dois, num celular só: um ingresso rasgado ao meio, uma metade para
 * cada um. Cada um desliza o mesmo baralho sozinho, a cortina fecha para passar
 * o celular, e o filme que os dois quiserem junta o ingresso de novo.
 * Os votos ficam só no aparelho; o banco só é tocado se vocês pedirem para
 * guardar algo na lista a dois.
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
  const [escolhido, setEscolhido] = useState(0); // qual match está no cartaz
  const [abrindo, setAbrindo] = useState(false);
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
  const vencedor = resultado?.matches[Math.min(escolhido, resultado.matches.length - 1)];
  const ambiente = fase === "vez" ? restantes[0] : vencedor;

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
  const abrirCortina = () => {
    const entrar = () => { setAbrindo(false); setVez(1); setFase("vez"); };
    if (semMovimento()) return entrar();
    setAbrindo(true);
    setTimeout(entrar, CORTINA_MS);
  };
  const novaRodada = () => {
    setRodada(r => r + 1);
    setVotos([new Map(), new Map()]);
    setVez(0);
    setEscolhido(0);
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

  const fundo = (
    <>
      {ambiente && (ambiente.backdrop || ambiente.poster) && (
        <div key={ambiente.key} className="prog__ambiente" aria-hidden="true"
          style={{ backgroundImage: `url(${TMDB_SM}${ambiente.backdrop || ambiente.poster})` }}/>
      )}
      {fase === "troca" && (
        <div className={`match-cortina ${abrindo ? "match-cortina--abrindo" : ""}`} aria-hidden="true"><i/><i/></div>
      )}
    </>
  );

  return createPortal(
    <Casca titulo="Match a dois" onClose={onClose} fundo={fundo}>
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
          <h2 className="match__titulo">Um ingresso, duas metades</h2>
          <p className="match__texto">
            Cada um desliza {baralho.length} cartazes sozinho: para a direita é quero, para a esquerda é passo.
            O filme que os dois quiserem junta o ingresso.
          </p>

          <div className="ingresso ingresso--rasgado" role="radiogroup" aria-label="Quem começa">
            {[0, 1].map(i => (
              <button key={i} type="button" role="radio" aria-checked={primeiro === i} aria-label={users[i]}
                className={`meio meio--${i ? "dir" : "esq"} ${primeiro === i ? "meio--on" : ""}`}
                onClick={() => setPrimeiro(i)}>
                <Ava i={i} nome={users[i]}/>
                <strong>{users[i]}</strong>
                <small>{primeiro === i ? "começa" : "vota depois"}</small>
              </button>
            ))}
          </div>
          <p className="match__dica">Toque numa metade para escolher quem começa.</p>

          <button className="prog__assistir" onClick={() => { setVez(0); setFase("vez"); }}>
            {users[primeiro]} começa
          </button>
        </div>
      )}

      {fase === "vez" && (
        <div className="match__vez">
          <div className="match__placar">
            <Ava i={ordem[vez]} nome={quem}/>
            <strong>Vez de {quem}</strong>
            <span className="match__progresso">{Math.min(votados + 1, baralho.length)} de {baralho.length}</span>
          </div>
          {/* um furo no canhoto por cartaz: âmbar é quero, apagado é passo */}
          <div className="match__furos" aria-hidden="true">
            {baralho.map(c => {
              const v = meusVotos.get(c.key);
              return <i key={c.key} className={v === undefined ? "" : v ? "furo--sim" : "furo--nao"}/>;
            })}
          </div>
          <Baralho cartas={restantes} onVoto={votar}/>
          <button className="prog__mudar match__desfazer" onClick={desfazer} disabled={!votados}
            style={{ visibility: votados ? "visible" : "hidden" }}>
            Desfazer o último
          </button>
        </div>
      )}

      {fase === "troca" && (
        <div className={`match__troca ${abrindo ? "match__troca--saindo" : ""}`}>
          <LumiCompanion mood="shy" size={120} talk
            line={`Tapei os olhos, ${users[ordem[0]]}. Não vou contar nada.`}/>
          <p className="match__passa">Agora passa o celular para</p>
          <p className="match__nome">{users[ordem[1]]}</p>
          <button className="prog__assistir" onClick={abrirCortina} disabled={abrindo}>
            Sou {users[ordem[1]]}, abrir a cortina
          </button>
        </div>
      )}

      {fase === "resultado" && resultado && (
        vencedor ? (
          <div className="match__resultado">
            <LumiCompanion mood="celebrating" size={64} className="lumi-co--inline" talk
              line={resultado.matches.length === 1 ? "Deu match! Esse é o filme da noite."
                : vencedor.key === resultado.matches[0].key ? `Deu ${resultado.matches.length} matches! Eu começaria por este.`
                : "Boa escolha. Esse também foi dos dois."}/>

            <div className="match__palco">
              <div className="prog__sala prog__sala--frente match__vencedor">
                <div className="prog__moldura">
                  {vencedor.poster
                    ? <img key={vencedor.key} src={`${TMDB_IMG}${vencedor.poster}`} alt={`Cartaz de ${vencedor.title}`} className="prog__poster"/>
                    : <span className="prog__poster prog__poster--vazio">{vencedor.title}</span>}
                </div>
              </div>
              {/* as duas metades se juntam em cima do cartaz */}
              <div className="ingresso ingresso--junto" key={rodada} role="img"
                aria-label={`Ingresso inteiro: ${users[0]} e ${users[1]} querem ver ${vencedor.title}`}>
                {[0, 1].map(i => (
                  <div key={i} className={`meio meio--${i ? "dir" : "esq"}`}>
                    <Ava i={i} nome={users[i]}/>
                    <strong>{users[i]}</strong>
                  </div>
                ))}
                <span className="ingresso__coracao" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d={CORACAO}/></svg>
                </span>
              </div>
            </div>

            <h2 className="match__filme">{vencedor.title}</h2>
            <p className="prog__meta">{[vencedor.year, ...(vencedor.generos || []).slice(0, 2)].filter(Boolean).join(" · ")}</p>

            {vencedor.link && (
              <button className="prog__assistir" onClick={() => openExternal(vencedor.link)}>
                {vencedor.logos?.[0] && <img src={`${TMDB_LOGO}${vencedor.logos[0]}`} alt=""/>}
                <span>Assistir no {vencedor.provedores?.[0] || "streaming"}</span>
              </button>
            )}

            {resultado.matches.length > 1 && (
              <div className="match__outros">
                <p>Os {resultado.matches.length} matches de vocês. Toque para trocar o cartaz.</p>
                <ul>
                  {resultado.matches.map((c, i) => (
                    <li key={c.key}>
                      <button type="button" aria-pressed={c.key === vencedor.key} onClick={() => setEscolhido(i)}
                        aria-label={c.title}>
                        {c.poster ? <img src={`${TMDB_SM}${c.poster}`} alt=""/> : <span>{c.title}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="match__fim">
              <button className="prog__trocar" disabled={guardados.has("matches")}
                onClick={() => guardar([[resultado.matches, users]], "matches")}>
                {guardados.has("matches") ? "Na lista de vocês dois" : resultado.matches.length === 1 ? "Guardar na lista a dois" : "Guardar os matches na lista"}
              </button>
              <button className="prog__mudar" onClick={novaRodada}>Jogar outra rodada</button>
            </div>
          </div>
        ) : (
          <div className="match__resultado">
            <LumiCompanion mood="thinking" size={64} className="lumi-co--inline" talk
              line="Nenhum match desta vez. Cada um ficou com a sua metade, mas eu tenho mais cartazes."/>

            <div className="ingresso ingresso--separado">
              {[0, 1].map(v => {
                const quis = resultado.soDe[v];
                return (
                  <div key={v} className={`meio meio--${v ? "dir" : "esq"}`}>
                    <Ava i={ordem[v]} nome={users[ordem[v]]}/>
                    <strong>{users[ordem[v]]}</strong>
                    <small>{quis.length === 0 ? "passou em todos" : quis.length === 1 ? "quis 1 filme" : `quis ${quis.length} filmes`}</small>
                    {quis.length > 0 && (
                      <span className="meio__cartazes">
                        {quis.slice(0, 3).map(c => c.poster
                          ? <img key={c.key} src={`${TMDB_SM}${c.poster}`} alt={c.title}/>
                          : <span key={c.key}>{c.title}</span>)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="match__fim">
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
          </div>
        )
      )}
    </Casca>,
    document.body,
  );
}

const CORACAO = "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z";

const Ava = ({ i, nome }) => (
  <span className={`match__ava match__ava--${i ? "b" : "a"}`} aria-hidden="true">{nome?.[0]}</span>
);

function Casca({ titulo, onClose, fundo, children }) {
  return (
    <div className="subpage prog match">
      {fundo}
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
