// A entrada do Sessão: a fachada de um cinema de rua à noite. O letreiro anuncia
// o que está em cartaz (vocês dois), a bilheteria entrega um ingresso cujo canhoto
// é o login e, rolando, a programação da noite mostra o app funcionando — a luz
// do projetor acompanha a sessão em cartaz, e as cenas dá para usar de verdade.
// Quem chega por um convite vê o letreiro e o ingresso falando com ela.
import { useEffect, useRef, useState } from "react";
import { lumiSrc } from "../lumi.jsx";
import NotaDoCasal from "./NotaDoCasal.jsx";
import "./entrada.css";

const reduzMovimento = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const AppleIcon = () => (
  <svg width="16" height="19" viewBox="0 0 814 1000" aria-hidden="true">
    <path fill="currentColor" d="M788 341c-6 4-108 62-108 190 0 149 131 202 135 203-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-165-40c-77 0-104 41-166 41s-106-57-156-127C45 792 0 668 0 551c0-189 123-289 244-289 64 0 118 42 158 42 38 0 98-45 171-45 28 0 128 3 194 82zM554 165c30-36 52-86 52-136 0-7-1-14-2-19-49 2-108 33-143 74-28 32-54 82-54 133 0 8 1 15 2 18 3 1 9 1 14 1 44 0 99-29 131-71z"/>
  </svg>
);

const HEART = "M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.4 5c2.1 0 3.6 1.2 4.4 2.6h2.4C14 6.2 15.5 5 17.6 5 21 5 23.1 8.4 21.6 11.8 19.5 16.4 12 21 12 21z";
const Coracao = ({ className }) => <svg viewBox="0 0 24 24" aria-hidden="true" className={className}><path d={HEART}/></svg>;
const Xis = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none"/></svg>;
const Seta = ({ lado }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={lado === "esq" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);
const Poltrona = ({ acesa }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`ent-poltrona ${acesa ? "is-acesa" : ""}`}>
    <path d="M6 4h12a2 2 0 0 1 2 2v7H4V6a2 2 0 0 1 2-2zM3 11h2v6H3zM19 11h2v6h-2zM5 13h14v4H5zM7 17h2v3H7zM15 17h2v3h-2z"/>
  </svg>
);

// Letras de encaixe: cada uma assenta no trilho com um desvio mínimo, como quem
// montou o letreiro à mão. Determinístico, para não mudar a cada render.
const Letreiro = ({ linhas }) => {
  let n = 0;
  return (
    <span className="ent-letras" aria-hidden="true">
      {linhas.map((linha, l) => (
        <span key={l} className="ent-letras__linha">
          {linha.split(" ").map((palavra, p) => (
            <span key={p} className="ent-letras__palavra">
              {[...palavra].map((ch, i) => {
                n += 1;
                const giro = ((n * 37) % 7 - 3) * 0.5;
                const desce = ((n * 53) % 5 - 2) * 0.6;
                return <span key={i} className="ent-letra" style={{ "--giro": `${giro}deg`, "--desce": `${desce}px` }}>{ch}</span>;
              })}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
};

// O ingresso: a frente diz o que é a sessão; depois do picote, o canhoto com os
// botões de entrar. Quando o login começa, o canhoto se inclina como quem rasga.
const Ingresso = ({ onGoogle, onApple, onEmail, loading, convite, id, compacto = false }) => (
  <div className={`ent-ingresso ${compacto ? "ent-ingresso--compacto" : ""} ${loading ? "is-rasgando" : ""}`}>
    {!compacto && (
      <div className="ent-ingresso__frente">
        <div className="ent-ingresso__cabeca">
          <p className="ent-ingresso__titulo">{convite ? "Seu lugar está guardado" : "Sessão para dois"}</p>
          <span className="ent-ingresso__carimbo" aria-hidden="true">admite<br/>dois</span>
        </div>
        <dl className="ent-ingresso__campos">
          <div><dt>Sala</dt><dd>o sofá ou o cinema</dd></div>
          <div><dt>Lugares</dt><dd>2, lado a lado</dd></div>
          {convite
            ? <div><dt>Convite</dt><dd className="ent-ingresso__codigo">{convite}</dd></div>
            : <div><dt>Entrada</dt><dd>grátis</dd></div>}
        </dl>
      </div>
    )}
    {!compacto && <div className="ent-ingresso__picote" aria-hidden="true"><i/><i/></div>}
    <div className="ent-ingresso__canhoto" id={id}>
      <button type="button" className="ent-botao ent-botao--google" onClick={onGoogle} disabled={loading}>
        {loading ? <span className="login-google__spinner" aria-hidden="true"/> : <GoogleIcon/>}
        {loading ? "Entrando…" : convite ? "Entrar com Google e aceitar" : "Continuar com Google"}
      </button>
      {onApple && (
        <button type="button" className="ent-botao ent-botao--google" onClick={onApple} disabled={loading}>
          <AppleIcon/> Continuar com a Apple
        </button>
      )}
      <button type="button" className="ent-botao ent-botao--contorno" onClick={onEmail} disabled={loading}>
        Entrar com e-mail
      </button>
      <p className="ent-ingresso__nota">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
        Privado: só vocês dois veem o diário.
      </p>
    </div>
  </div>
);

// ── as cenas da programação (filmes e números de exemplo) ─────────────────

// 19h30: o match de verdade. A pessoa é a Ana; o Léo já escolheu.
const BARALHO = [
  { titulo: "Duna", info: "2021, ficção", leo: true, tom: "duna" },
  { titulo: "La La Land", info: "2016, musical", leo: false, tom: "lalaland" },
  { titulo: "Interestelar", info: "2014, ficção", leo: true, tom: "interestelar" },
];

const Cartaz = ({ filme, atras = false, saida = null }) => (
  <div className={`ent-cartaz ent-cartaz--${filme.tom} ${atras ? "ent-cartaz--atras" : ""} ${saida ? `is-saindo-${saida}` : ""}`}>
    <span>{filme.titulo}</span>
    <small>{filme.info}</small>
  </div>
);

const CenaEscolher = () => {
  const [i, setI] = useState(0);
  const [saida, setSaida] = useState(null);
  const [matches, setMatches] = useState([]);
  const [aviso, setAviso] = useState("Toque no coração ou no x.");
  const atual = BARALHO[i];

  const escolher = quer => {
    if (!atual || saida) return;
    setSaida(quer ? "sim" : "nao");
    const fim = () => {
      if (quer && atual.leo) { setMatches(m => [...m, atual.titulo]); setAviso(`Deu match: ${atual.titulo}`); }
      else if (quer) setAviso(`O Léo não quis ${atual.titulo}.`);
      else setAviso("Próximo cartaz.");
      setI(n => n + 1);
      setSaida(null);
    };
    if (reduzMovimento()) fim(); else setTimeout(fim, 300);
  };
  const recomecar = () => { setI(0); setMatches([]); setAviso("Toque no coração ou no x."); };

  return (
    <div className="ent-cena ent-cena--escolher">
      <div className="ent-deck">
        {atual ? (
          <>
            {BARALHO[i + 1] && <Cartaz filme={BARALHO[i + 1]} atras/>}
            <Cartaz key={atual.titulo} filme={atual} saida={saida}/>
          </>
        ) : (
          <div className="ent-deck__fim">
            <strong>{matches.length ? `${matches.length} ${matches.length === 1 ? "match" : "matches"}` : "Sem match"}</strong>
            <span>{matches.length ? matches.join(" e ") : "Acontece. A roleta resolve."}</span>
            <button type="button" onClick={recomecar} className="ent-deck__de-novo">Jogar de novo</button>
          </div>
        )}
      </div>
      <div className="ent-deck__lado">
        <p className="ent-cena__instrucao">Você é a Ana. O Léo já escolheu.</p>
        <div className="ent-deck__botoes">
          <button type="button" className="ent-deck__botao ent-deck__botao--nao" onClick={() => escolher(false)} disabled={!atual}
            aria-label={atual ? `Não quero ver ${atual.titulo}` : "Os cartazes acabaram"}><Xis/></button>
          <button type="button" className="ent-deck__botao ent-deck__botao--sim" onClick={() => escolher(true)} disabled={!atual}
            aria-label={atual ? `Quero ver ${atual.titulo}` : "Os cartazes acabaram"}><Coracao/></button>
        </div>
        <p className={`ent-deck__aviso ${aviso.startsWith("Deu match") ? "is-match" : ""}`} aria-live="polite">{aviso}</p>
      </div>
    </div>
  );
};

const CenaSessao = () => (
  <div className="ent-cena ent-cena--sessao" aria-hidden="true">
    <div className="ent-memoria">
      <div className="ent-memoria__capa"><span>Ruptura</span></div>
      <div className="ent-memoria__info">
        <strong>Ruptura</strong>
        <span>série, assistindo juntos</span>
        <span className="ent-memoria__onde">vocês pararam em <b>T2 E4</b></span>
        <span className="ent-memoria__barra"><i style={{ width: "42%" }}/></span>
      </div>
    </div>
    <div className="ent-mini-ingresso">
      <span>cinema</span>
      <strong>sáb, 21h40</strong>
      <span>poltronas H7 e H8</span>
    </div>
  </div>
);

// Sexta: as poltronas acendem ao toque; com as duas acesas, o filme é dos dois.
const LISTA = [["Pecadores", true, false], ["Wicked", true, true], ["Anora", false, true]];

const CenaLista = () => {
  const [lista, setLista] = useState(LISTA);
  const alterna = (linha, pessoa) =>
    setLista(l => l.map((item, k) => (k === linha ? item.map((v, j) => (j === pessoa ? !v : v)) : item)));
  return (
    <div className="ent-cena ent-cena--lista">
      <p className="ent-cena__instrucao">Toque nas poltronas da Ana (A) e do Léo (L).</p>
      <ul className="ent-lista">
        {lista.map(([titulo, ana, leo], k) => (
          <li key={titulo} className={ana && leo ? "is-dos-dois" : ""}>
            <span className="ent-lista__titulo">{titulo}</span>
            <span className="ent-lista__poltronas">
              <button type="button" aria-pressed={ana} aria-label={`Ana quer ver ${titulo}`} onClick={() => alterna(k, 1)}>
                <Poltrona acesa={ana}/><small>A</small>
              </button>
              <button type="button" aria-pressed={leo} aria-label={`Léo quer ver ${titulo}`} onClick={() => alterna(k, 2)}>
                <Poltrona acesa={leo}/><small>L</small>
              </button>
            </span>
            <span className="ent-lista__selo" aria-live="polite">{ana && leo ? "os dois querem" : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const CenaRetro = () => (
  <div className="ent-cena ent-cena--retro" aria-hidden="true">
    <div className="ent-story">
      <span className="ent-story__barras">{[1, 2, 3, 4, 5, 6].map(i => <i key={i} className={i <= 2 ? "is-vista" : ""}/>)}</span>
      <span className="ent-story__ano">2026 de vocês</span>
      <strong className="ent-story__numero">312h</strong>
      <span className="ent-story__legenda">juntos na frente da tela</span>
      <span className="ent-story__filme">filme do ano: <b>Aftersun</b></span>
    </div>
    <img src={lumiSrc("retrospective")} alt="" className="ent-cena__lumi"/>
  </div>
);

const CenaNesseDia = () => (
  <div className="ent-cena ent-cena--dia" aria-hidden="true">
    <figure className="ent-lembranca">
      <div className="ent-lembranca__foto"><span>Interestelar</span></div>
      <figcaption>há 2 anos, neste mesmo dia</figcaption>
    </figure>
    <img src={lumiSrc("milestone365")} alt="" className="ent-cena__lumi ent-cena__lumi--dia"/>
  </div>
);

// 23h00: um casal de exemplo para provar como a nota do casal nasce.
const VEREDITOS = ["Em perfeita sintonia", "Quase a mesma vibe", "Gostos diferentes", "Opiniões opostas", "Polos opostos"];
const NOTAS = [1, 2, 3, 4, 5];

const ProvaDaNota = () => {
  const [ana, setAna] = useState(4);
  const [leo, setLeo] = useState(3);
  const pessoa = (nome, valor, setValor, tipo) => (
    <div className="ent-prova__pessoa" role="group" aria-label={`Nota de ${nome}`}>
      <span className={`ent-prova__nome ent-prova__nome--${tipo}`}>{nome}</span>
      <span className="ent-prova__coracoes">
        {NOTAS.map(v => (
          <button key={v} type="button" aria-pressed={valor === v} aria-label={`${nome} dá ${v * 2}`}
            className={`ent-prova__coracao ent-prova__coracao--${tipo} ${v <= valor ? "is-on" : ""}`}
            onClick={() => setValor(v)}>
            <Coracao/>
          </button>
        ))}
      </span>
    </div>
  );
  return (
    <div className="ent-cena ent-prova">
      <p className="ent-cena__instrucao">Toque nos corações e dê as duas notas.</p>
      {pessoa("Ana", ana, setAna, "eu")}
      {pessoa("Léo", leo, setLeo, "par")}
      <NotaDoCasal me={{ name: "Ana", rating: ana }} partner={{ name: "Léo", rating: leo }}
        verdict={VEREDITOS[Math.min(Math.abs(ana - leo), 4)]}/>
    </div>
  );
};

const PROGRAMACAO = [
  {
    hora: "19h30", titulo: "Escolher a dois", Cena: CenaEscolher,
    texto: "Cada um diz sim ou não aos cartazes no mesmo celular, e o que os dois querem vira a sessão. Sem acordo? O Lumi adivinha com perguntas de sim ou não, ou a roleta decide.",
  },
  {
    hora: "21h00", titulo: "A sessão", Cena: CenaSessao,
    texto: "Filme ou série, no sofá ou no cinema: registrem em segundos, com capa, ano e duração. Nas séries, o diário guarda o episódio em que vocês pararam. Vai ser no cinema? Marquem a data e o ingresso fica guardado.",
  },
  {
    hora: "23h00", titulo: "A nota do casal", Cena: ProvaDaNota,
    texto: "Cada um dá a sua nota e ninguém mexe na do outro. Das duas nasce a nota de vocês, e o Lumi diz se estavam em sintonia.",
  },
  {
    hora: "Sexta", titulo: "A lista a dois", Cena: CenaLista,
    texto: "Guardem o que querem ver e quem quer. Quando os dois querem o mesmo filme, as duas poltronas acendem.",
  },
  {
    hora: "Dezembro", titulo: "A retrospectiva", Cena: CenaRetro,
    texto: "O ano de vocês em cenas: as horas juntos, o filme do ano, a maior discordância. No fim, um pôster pra guardar ou compartilhar.",
  },
  {
    hora: "Todo dia", titulo: "Nesse dia", Cena: CenaNesseDia,
    texto: "O Lumi lembra o que vocês assistiram nesta mesma data, em anos anteriores.",
  },
];

// A programação: a luz do projetor acompanha a sessão no meio da tela, e a agenda
// fixa no topo mostra em que horário a pessoa está (e leva a qualquer outro).
const Programacao = () => {
  const [ativa, setAtiva] = useState(0);
  const linhas = useRef([]);
  const agenda = useRef(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(entradas => {
      entradas.forEach(e => { if (e.isIntersecting) setAtiva(Number(e.target.dataset.i)); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    linhas.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  // a hora em cartaz fica sempre à vista na agenda (rola só a agenda, nunca a página)
  useEffect(() => {
    const barra = agenda.current;
    const pilula = barra?.children[ativa];
    if (barra && pilula && barra.scrollWidth > barra.clientWidth) {
      barra.scrollTo({ left: pilula.offsetLeft - 16, behavior: reduzMovimento() ? "auto" : "smooth" });
    }
  }, [ativa]);

  const ir = i => linhas.current[i]?.scrollIntoView({ behavior: reduzMovimento() ? "auto" : "smooth", block: "center" });

  return (
    <section className="ent-programacao" aria-labelledby="ent-prog-titulo">
      <div className="ent-programacao__cabeca">
        <h2 id="ent-prog-titulo" className="ent-h2">A programação da noite</h2>
        <p className="ent-programacao__aviso">Filmes e números de exemplo. As cenas com instrução dá pra usar.</p>
      </div>
      <nav className="ent-agenda" aria-label="Horários da programação">
        <div className="ent-agenda__trilho" ref={agenda}>
          {PROGRAMACAO.map((s, i) => (
            <button key={s.hora} type="button" className={`ent-agenda__hora ${i === ativa ? "is-ativa" : ""}`}
              aria-current={i === ativa ? "true" : undefined} onClick={() => ir(i)}>
              {s.hora}
            </button>
          ))}
        </div>
      </nav>
      <ol className="ent-sessoes">
        {PROGRAMACAO.map(({ hora, titulo, texto, Cena }, i) => (
          <li key={titulo} data-i={i} ref={el => { linhas.current[i] = el; }}
            className={`ent-sessao ${i === ativa ? "is-no-ar" : ""}`}>
            <span className="ent-sessao__hora">{hora}</span>
            <div className="ent-sessao__corpo">
              <h3 className="ent-sessao__titulo">{titulo}</h3>
              <p className="ent-sessao__texto">{texto}</p>
            </div>
            <div className="ent-sessao__cena"><Cena/></div>
          </li>
        ))}
      </ol>
    </section>
  );
};

// O rolo das conquistas: as medalhas reais do app, quadro a quadro.
const CONQUISTAS = [
  ["Primeira sessão", "medal"],
  ["Primeira ida ao cinema", "camera"],
  ["Choramos juntos", "chorando_emocao"],
  ["Nota igual no mesmo filme", "stars"],
  ["Completar uma saga", "holdingPopcorn"],
  ["Favorito em comum", "inLove"],
  ["3 dias seguidos", "correndo"],
  ["100 horas juntos", "milestone365"],
  ["Críticos do sofá", "laptop"],
];

const RoloDeConquistas = () => {
  const rolo = useRef(null);
  const anda = direcao => {
    const el = rolo.current;
    if (el) el.scrollBy({ left: direcao * el.clientWidth * 0.8, behavior: reduzMovimento() ? "auto" : "smooth" });
  };
  return (
    <section className="ent-creditos" aria-labelledby="ent-creditos-titulo">
      <div className="ent-creditos__cabeca">
        <div>
          <h2 id="ent-creditos-titulo" className="ent-h2">Cada marco vira medalha</h2>
          <p className="ent-creditos__texto">São mais de 15 conquistas, e cada uma chega com uma comemoração do Lumi.</p>
        </div>
        <div className="ent-creditos__setas">
          <button type="button" onClick={() => anda(-1)} aria-label="Conquistas anteriores"><Seta lado="esq"/></button>
          <button type="button" onClick={() => anda(1)} aria-label="Próximas conquistas"><Seta/></button>
        </div>
      </div>
      <div className="ent-rolo">
        <ul className="ent-rolo__quadros" ref={rolo} tabIndex={0} aria-label="Algumas conquistas do Sessão">
          {CONQUISTAS.map(([nome, pose]) => (
            <li key={nome} className="ent-rolo__quadro">
              <img src={lumiSrc(pose)} alt=""/>
              <span>{nome}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

const PASSOS = [
  ["Entre com a sua conta", "Google, e-mail ou Apple. Cada pessoa tem a sua."],
  ["Crie o diário e chame sua pessoa", "Vocês recebem um código de convite pra mandar. Dá pra começar antes de ela chegar."],
  ["Ela entra com o código", "Pronto: o diário é dos dois, nos dois celulares."],
];

const REGRAS = [
  "Só vocês dois veem o diário.",
  "Cada nota é de quem deu: ninguém altera a do outro.",
  "Nada de anúncios, e os dados de vocês não são vendidos.",
  "Querem parar? Exportem as memórias, saiam do diário ou apaguem a conta quando quiserem.",
];

const DUVIDAS = [
  ["É grátis mesmo?", "É. Os dois usam tudo, sem pagar nada."],
  ["Os dois precisam ter conta?", "Sim. Cada um entra com a própria conta e as duas se ligam pelo código de convite. Dá pra começar sozinho enquanto a outra pessoa não chega."],
  ["A minha pessoa vê a minha nota?", "Vê, depois que você der. Cada um escreve só a própria nota e a própria crítica, e ninguém consegue mudar a do outro."],
  ["Funciona no iPhone e no Android?", "Funciona no navegador dos dois e instala como app na tela de início, sem passar por loja."],
  ["Dá pra registrar séries?", "Dá. O diário guarda o episódio em que vocês pararam e o ritmo da maratona."],
  ["E se um de nós quiser sair?", "Nas configurações dá pra sair do diário ou excluir a conta. As suas notas saem das memórias, e o diário fica com a outra pessoa. Antes, dá pra exportar tudo."],
  ["De onde vêm os filmes?", "Do TMDB, um catálogo aberto de filmes e séries, com capa, ano e duração."],
];

export default function Entrada({ onGoogle, onApple, onEmail, loading = false, convite = "", onInstall = null, mostrarInstalar = true, onPagina, contato }) {
  const titulo = convite ? ["Guardaram um", "lugar pra você"] : ["Em cartaz:", "vocês dois"];
  const ingresso = { onGoogle, onApple, onEmail, loading, convite };
  const [barra, setBarra] = useState(false);

  // a barra de entrar aparece no celular quando o ingresso some da tela e sai
  // de cena quando o canhoto final aparece
  useEffect(() => {
    const topo = document.getElementById("bilheteria");
    const fim = document.getElementById("canhoto-final");
    if (!topo || !fim || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(() => {
      const acima = topo.getBoundingClientRect().bottom < 0;
      const r = fim.getBoundingClientRect();
      const fimVisivel = r.top < window.innerHeight && r.bottom > 0;
      setBarra(acima && !fimVisivel);
    });
    io.observe(topo);
    io.observe(fim);
    return () => io.disconnect();
  }, []);

  const irParaBilheteria = () => {
    document.getElementById("bilheteria")?.scrollIntoView({ behavior: reduzMovimento() ? "auto" : "smooth", block: "center" });
    document.querySelector("#bilheteria .ent-botao")?.focus({ preventScroll: true });
  };

  return (
    <div className="ent">
      <header className="ent-topo">
        <span className="ent-marca"><img src={lumiSrc("headHappy")} alt=""/> Sessão</span>
        <button type="button" className="ent-topo__entrar" onClick={irParaBilheteria}>Entrar</button>
      </header>

      <main>
        {/* a fachada: letreiro, a frase do que é e a bilheteria que entrega o ingresso */}
        <section className="ent-fachada" aria-labelledby="ent-titulo">
          <div className="ent-letreiro">
            <span className="ent-letreiro__lampadas ent-letreiro__lampadas--cima" aria-hidden="true"/>
            <span className="ent-letreiro__lampadas ent-letreiro__lampadas--baixo" aria-hidden="true"/>
            <h1 id="ent-titulo" className="ent-letreiro__painel" aria-label={titulo.join(" ")}>
              <Letreiro linhas={titulo}/>
            </h1>
          </div>

          <p className="ent-frase">
            {convite
              ? "Sua pessoa te chamou para o diário de cinema de vocês. Entre com a sua conta e o convite já vem preenchido."
              : "O diário de cinema de vocês dois: guardem cada filme e série, cada um dá a sua nota e vocês decidem juntos o que ver hoje."}
          </p>

          <div className="ent-bilheteria">
            <div className="ent-bilheteria__guiche">
              <span className="ent-bilheteria__placa" aria-hidden="true">Bilheteria</span>
              <div className="ent-bilheteria__vidro">
                <img src={lumiSrc(convite ? "hugHeart" : "peeking")} alt=""
                  className={`ent-bilheteria__lumi ${convite ? "ent-bilheteria__lumi--convite" : ""}`}/>
              </div>
              <span className="ent-bilheteria__boca" aria-hidden="true"/>
            </div>
            <Ingresso {...ingresso} id="bilheteria"/>
          </div>
        </section>

        <Programacao/>

        <RoloDeConquistas/>

        {/* entrada franca: como o casal começa */}
        <section className="ent-franca" aria-labelledby="ent-franca-titulo">
          <h2 id="ent-franca-titulo" className="ent-h2">Entrada franca. Para os dois.</h2>
          <ol className="ent-fila">
            {PASSOS.map(([t, d], i) => (
              <li key={t} className="ent-fila__passo">
                <span className="ent-fila__num" aria-hidden="true">{i + 1}</span>
                <h3 className="ent-fila__titulo">{t}</h3>
                <p className="ent-fila__texto">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* regras da casa: privacidade, numa placa iluminada */}
        <section className="ent-regras" aria-labelledby="ent-regras-titulo">
          <div className="ent-placa">
            <h2 id="ent-regras-titulo" className="ent-placa__titulo">Regras da casa</h2>
            <ul className="ent-placa__lista">
              {REGRAS.map(r => <li key={r}><Coracao/>{r}</li>)}
            </ul>
            {onPagina && (
              <button type="button" className="ent-placa__link" onClick={() => onPagina("/privacy.html")}>
                Ler a política de privacidade
              </button>
            )}
          </div>
        </section>

        {/* dúvidas: perguntas reais, respostas curtas */}
        <section className="ent-duvidas" aria-labelledby="ent-duvidas-titulo">
          <h2 id="ent-duvidas-titulo" className="ent-h2">Dúvidas na fila da pipoca</h2>
          <div className="ent-duvidas__lista">
            {DUVIDAS.map(([pergunta, resposta]) => (
              <details key={pergunta} className="ent-duvida">
                <summary>
                  {pergunta}
                  <span className="ent-duvida__sinal" aria-hidden="true"/>
                </summary>
                <p>{resposta}</p>
              </details>
            ))}
          </div>
        </section>

        {mostrarInstalar && (
          <section className="ent-instalar" aria-labelledby="ent-instalar-titulo">
            <img src={lumiSrc("projector")} alt="" className="ent-instalar__lumi"/>
            <div>
              <h2 id="ent-instalar-titulo" className="ent-h2">A cabine no seu celular</h2>
              <p className="ent-instalar__intro">O Sessão abre no navegador e instala como app, sem passar por loja.</p>
              {onInstall && (
                <button type="button" className="ent-botao ent-botao--contorno-escuro ent-instalar__agora" onClick={onInstall}>
                  Instalar agora
                </button>
              )}
              <dl className="ent-instalar__jeitos">
                <div>
                  <dt>Android</dt>
                  <dd>No Chrome, toque nos três pontinhos e em <b>Instalar app</b>.</dd>
                </div>
                <div>
                  <dt>iPhone</dt>
                  <dd>No Safari, toque em Compartilhar e em <b>Adicionar à Tela de Início</b>.</dd>
                </div>
              </dl>
            </div>
          </section>
        )}

        {/* a última chamada: o canhoto de novo */}
        <section className="ent-fim" aria-labelledby="ent-fim-titulo">
          <h2 id="ent-fim-titulo" className="ent-fim__titulo">A sala está pronta.</h2>
          <p className="ent-fim__texto">{convite ? "Sua pessoa já guardou o lugar ao lado." : "Falta só a pipoca e a sua pessoa."}</p>
          <Ingresso {...ingresso} id="canhoto-final" compacto/>
        </section>
      </main>

      <footer className="ent-rodape">
        <p>Sessão, feito para assistir junto.</p>
        <nav aria-label="Links do Sessão" className="ent-rodape__links">
          {onPagina && <button type="button" onClick={() => onPagina("/privacy.html")}>Privacidade</button>}
          {onPagina && <button type="button" onClick={() => onPagina("/credits.html")}>Créditos</button>}
          {contato && <a href={`mailto:${contato}`}>Fale com a gente</a>}
        </nav>
        <p className="ent-rodape__tmdb">Filmes e séries do TMDB. O Sessão usa a API do TMDB, mas não é endossado nem certificado por ele.</p>
      </footer>

      {/* no celular: a bilheteria acompanha quem rola a página */}
      <div className={`ent-barra ${barra ? "is-visivel" : ""}`} inert={!barra}>
        <span className="ent-barra__texto"><b>{convite ? "Seu lugar está guardado" : "Sessão para dois"}</b>{convite ? `convite ${convite}` : "grátis, para os dois"}</span>
        <button type="button" className="ent-barra__botao" onClick={onGoogle} disabled={loading}>
          <GoogleIcon/> Entrar
        </button>
      </div>
    </div>
  );
}
