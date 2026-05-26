import { useState, useEffect, useRef } from "react";
import { auth, db } from "./firebase";
import {
  onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider,
} from "firebase/auth";
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, getDocs,
} from "firebase/firestore";
import "./App.css";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const TMDB_BG   = "https://image.tmdb.org/t/p/w1280";

const TMDB_READ_TOKEN = import.meta.env.VITE_TMDB_READ_TOKEN;
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

async function tmdbRequest(endpoint, params = {}) {
  if (!TMDB_READ_TOKEN && !TMDB_API_KEY) {
    const error = new Error("TMDB_AUTH_MISSING");
    error.status = 0;
    throw error;
  }

  const url = new URL(`${TMDB_BASE}${endpoint}`);
  if (TMDB_API_KEY) {
    url.searchParams.set("api_key", TMDB_API_KEY);
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, {
    headers: TMDB_READ_TOKEN
      ? {
          Authorization: `Bearer ${TMDB_READ_TOKEN}`,
          Accept: "application/json",
        }
      : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.status_message || `TMDB_HTTP_${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

async function tmdbSearch(q) {
  const d = await tmdbRequest("/search/multi", { query: q, language: "pt-BR" });
  return (d.results||[]).filter(x=>x.media_type==="movie"||x.media_type==="tv").slice(0,8);
}

async function tmdbFetch(id, type) {
  const ep = type==="tv" ? "tv" : "movie";
  const d = await tmdbRequest(`/${ep}/${id}`, {
    language: "pt-BR",
    append_to_response: "credits,external_ids",
  });

  return {
    genres: (d.genres||[]).map(g=>g.name),
    runtime: type==="movie" ? (d.runtime||null) : (d.episode_run_time?.[0]||null),
    numberOfSeasons: type==="tv" ? (d.number_of_seasons||null) : null,
    cast: (d.credits?.cast||[]).slice(0,5).map(c=>c.name),
    director: type!=="tv" ? ((d.credits?.crew||[]).find(c=>c.job==="Director")?.name||null) : null,
    imdbId: d.imdb_id||d.external_ids?.imdb_id||null,
    tmdbRating: d.vote_average ? d.vote_average.toFixed(1) : null,
    overview: d.overview||null,
    poster: d.poster_path||null,
    backdrop: d.backdrop_path||null,
    title: d.title||d.name,
    year: (d.release_date||d.first_air_date||"").slice(0,4),
  };
}

// icons
const Ic = ({ n, s=20, style={} }) => {
  const d = {
    home:     "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
    book:     "M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
    bookmark: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
    heart:    "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
    plus:     "M12 5v14 M5 12h14",
    search:   "M21 21l-4.35-4.35 M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z",
    trash:    "M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2",
    x:        "M18 6L6 18 M6 6l12 12",
    check:    "M20 6L9 17l-5-5",
    film:     "M2 2h20v20H2z M7 2v20 M17 2v20 M2 12h20 M2 7h5 M17 7h5 M17 17h5 M2 17h5",
    tv:       "M2 3h20v14H2z M8 21h8 M12 17v4",
    star:     "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    arrow:    "M19 12H5 M12 19l-7-7 7-7",
    user:     "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    edit:     "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
    eye:      "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    link:     "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
    filter:   "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
    clock:    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2",
    zap:      "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    chev:     "M6 9l6 6 6-6",
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>
      {(d[n]||"").split(" M").map((seg,i) => <path key={i} d={i===0?seg:"M"+seg}/>)}
    </svg>
  );
};

const Stars = ({ val=0, onChange, size=20 }) => (
  <div className="stars" style={{ ['--star-size']: `${size}px` }}>
    {[1,2,3,4,5].map(i => (
      <span key={i} onClick={() => onChange?.(i===val?0:i)}
        className={`stars__icon ${i<=val ? "stars__icon--active" : ""} ${onChange ? "clickable" : ""}`}>
        <Ic n="star" s={Math.max(10, size-4)} />
      </span>
    ))}
  </div>
);

const Avatar = ({ name, size=28, active=false }) => {
  const initials = name?.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()||"?";
  const colors = ["#e63946","#7c3aed","#0284c7","#059669","#d97706"];
  const color = colors[name?.charCodeAt(0)%colors.length]||"#888";
  return (
    <div className="avatar-badge" style={{ "--avatar-size": `${size}px`, "--avatar-bg": color, "--avatar-font": `${size * 0.38}px`, "--avatar-border": active ? "var(--text-primary)" : "transparent" }}>
      {initials}
    </div>
  );
};

const PosterFallback = ({ type, h=220 }) => (
  <div className="poster-fallback" style={{ height:h }}>
    <Ic n={type==="tv"?"tv":"film"} s={48}/>
  </div>
);

// toast
const ToastContainer = ({ toasts, onDismiss }) => (
  <div className="toast-stack">
    {toasts.map(t => (
      <div key={t.id} className={`toast toast--${t.type||"success"}`}>
        <span className="toast__message">{t.message}</span>
        {t.undoFn && (
          <button onClick={() => { t.undoFn(); onDismiss(t.id); }} className="toast__action">
            Desfazer
          </button>
        )}
        <button onClick={() => onDismiss(t.id)} className="toast__close">
          <Ic n="x" s={14}/>
        </button>
      </div>
    ))}
  </div>
);

// confirm modal
const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <div onClick={e=>e.target===e.currentTarget&&onCancel()}
    className="modal-backdrop modal-backdrop--confirm">
    <div className="modal-panel modal-panel--confirm">
      <div className="modal-panel__emoji">⚠️</div>
      <p className="modal-panel__copy">{message}</p>
      <div className="modal-panel__actions">
        <button onClick={onCancel} className="button button--ghost">
          Cancelar
        </button>
        <button onClick={onConfirm} className="button button--danger">
          Deletar
        </button>
      </div>
    </div>
  </div>
);

// overlay / modal helpers
const Overlay = ({ children, onClose }) => (
  <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} className="modal-backdrop">
    {children}
  </div>
);

const Modal = ({ title, onClose, children, maxW=480, banner }) => (
  <div className="modal-panel" style={{ maxWidth:maxW, position:"relative" }}>
    {banner}
    {!title && (
      <button onClick={onClose} className="modal-close-float">
        <Ic n="x" s={18}/>
      </button>
    )}
    <div className="modal-panel__body">
      {title && (
        <div className="modal-panel__header">
          <h3 className="modal-panel__title">{title}</h3>
          <button onClick={onClose} className="icon-button icon-button--subtle">
            <Ic n="x" s={20}/>
          </button>
        </div>
      )}
      {children}
    </div>
  </div>
);

const Label = ({ children }) => (
  <div className="field-label">{children}</div>
);

const SegBtn = ({ options, value, onChange, colorMap={} }) => (
  <div className="segmented-group">
    {options.map(([v,l]) => (
      <button key={v} onClick={() => onChange(v)}
        className={`segmented-group__button ${value===v ? "segmented-group__button--active" : ""}`}
        style={{ "--segmented-accent": colorMap[v]||"var(--accent)" }}>
        {l}
      </button>
    ))}
  </div>
);

const Input = ({ style={}, ...p }) => (
  <input {...p} className="text-input" style={style}/>
);

// search modal
const SearchModal = ({ onSelect, onClose }) => {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef();

  useEffect(() => { setTimeout(()=>inputRef.current?.focus(),50); }, []);
  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.length<2) { setRes([]); setError(""); return; }
      setLoading(true);
      setError("");
      try {
        setRes(await tmdbSearch(q));
      } catch (error) {
        setRes([]);
        setError(
          error.message === "TMDB_AUTH_MISSING"
            ? "Defina VITE_TMDB_READ_TOKEN ou VITE_TMDB_API_KEY no arquivo .env."
            : error.status === 401
              ? "TMDB recusou a credencial. Verifique VITE_TMDB_READ_TOKEN ou VITE_TMDB_API_KEY."
              : "Não foi possível buscar no TMDB agora."
        );
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const pick = async r => {
    setFetching(true);
    setError("");
    try {
      const full = await tmdbFetch(r.id, r.media_type);
      onSelect({
        tmdbId: r.id, type: r.media_type,
        title: full.title||r.title||r.name,
        poster: full.poster||r.poster_path||null,
        backdrop: full.backdrop||r.backdrop_path||null,
        overview: full.overview||r.overview||null,
        year: full.year||(r.release_date||r.first_air_date||"").slice(0,4),
        tmdbRating: full.tmdbRating||(r.vote_average?.toFixed(1))||null,
        genres: full.genres||[],
        runtime: full.runtime||null,
        numberOfSeasons: full.numberOfSeasons||null,
        cast: full.cast||[],
        director: full.director||null,
        imdbId: full.imdbId||null,
      });
    } catch (error) {
      setError(
        error.message === "TMDB_AUTH_MISSING"
          ? "Defina VITE_TMDB_READ_TOKEN ou VITE_TMDB_API_KEY no arquivo .env."
          : error.status === 401
            ? "TMDB recusou a credencial. Verifique VITE_TMDB_READ_TOKEN ou VITE_TMDB_API_KEY."
            : "Não foi possível carregar os detalhes do título."
      );
    } finally {
      setFetching(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <Modal title="Buscar título" onClose={onClose} maxW={520}>
        {error && <div className="search-error">{error}</div>}
        {fetching ? (
          <div className="search-loading">Carregando detalhes...</div>
        ) : (
          <>
            <div className="search-row">
              <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)}
                placeholder="Nome do filme ou série..."
                className="text-input" />
              <div className="search-row__icon"><Ic n="search" s={18}/></div>
            </div>
            {loading && <p className="search-loading search-loading--small">Buscando...</p>}
            <div className="search-results">
              {res.map(r => (
                <div key={r.id} onClick={()=>pick(r)} className="search-result">
                  {r.poster_path
                    ? <img src={`${TMDB_IMG}${r.poster_path}`} alt="" className="search-result__poster"/>
                          : <div className="search-result__poster-fallback"><Ic n="film" s={18} className="icon-muted"/></div>}
                  <div className="search-result__content">
                    <div className="search-result__title">{r.title||r.name}</div>
                    <div className="search-result__meta">
                      {r.media_type==="tv"?"Série":"Filme"} • {(r.release_date||r.first_air_date||"").slice(0,4)}
                      {r.vote_average?` • ★ ${r.vote_average.toFixed(1)}`:""}
                    </div>
                    <div className="search-result__overview">
                      {r.overview}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>
    </Overlay>
  );
};

// season pills
const SeasonPills = ({ count, selected, onChange }) => {
  const toggle = s => onChange(selected.includes(s) ? selected.filter(x=>x!==s) : [...selected,s].sort((a,b)=>a-b));
  return (
    <div className="season-group">
      {Array.from({length:count},(_,i)=>i+1).map(s => (
        <button key={s} onClick={()=>toggle(s)}
          className={`season-pill ${selected.includes(s) ? "season-pill--active" : ""}`}>
          T{s}
        </button>
      ))}
    </div>
  );
};

// watched form (shared by Add + Edit)
const WatchedForm = ({ users, currentUser, initial, onSave, onClose, title }) => {
  const [step, setStep] = useState(initial?.movie ? 1 : 0);
  const [movie, setMovie] = useState(initial?.movie||null);
  const [where, setWhere] = useState(initial?.where||"streaming");
  const [date, setDate] = useState(initial?.date||new Date().toISOString().slice(0,10));
  const [reviews, setReviews] = useState(() =>
    Object.fromEntries(users.map(u=>[u,{ rating:initial?.reviews?.[u]?.rating||0, text:initial?.reviews?.[u]?.text||"" }]))
  );
  const [seasonsWatched, setSeasonsWatched] = useState(initial?.seasonsWatched||[]);

  const setReview = (user,field,val) => setReviews(r=>({...r,[user]:{...r[user],[field]:val}}));

  const handleSave = () => {
    if (!movie) return;
    onSave({
      id: initial?.id||Date.now().toString(),
      ...movie,
      where, date, reviews, seasonsWatched,
      addedBy: initial?.addedBy||currentUser,
      createdAt: initial?.createdAt||new Date().toISOString(),
    });
  };

  if (step===0) return <SearchModal onSelect={m=>{ setMovie(m); setStep(1); }} onClose={onClose}/>;

  return (
    <Overlay onClose={onClose}>
      <Modal title={title||"Registrar sessão"} onClose={onClose} maxW={500}>
        <div className="preview-row">
          {movie.poster
            ? <img src={`${TMDB_IMG}${movie.poster}`} alt="" className="preview-poster"/>
            : <div className="preview-poster preview-poster--fallback"><Ic n="film" s={22} className="icon-muted"/></div>}
          <div className="preview-meta">
              <div className="preview-title">{movie.title}</div>
              <div className="preview-meta__line">{movie.type==="tv"?"Série":"Filme"} • {movie.year}</div>
              {movie.genres?.length>0 && <div className="preview-meta__line preview-meta__line--muted">{movie.genres.slice(0,3).join(" - ")}</div>}
            </div>
          {!initial && (
            <button onClick={()=>setStep(0)} className="edit-switch">trocar</button>
          )}
        </div>

        {movie.type==="tv" && movie.numberOfSeasons>0 && (
          <div className="field-block">
            <Label>Temporadas assistidas</Label>
            <SeasonPills count={movie.numberOfSeasons} selected={seasonsWatched} onChange={setSeasonsWatched}/>
          </div>
        )}

        <div className="field-block">
          <Label>Onde assistiram?</Label>
          <SegBtn options={[["cinema","🎬 Cinema"],["streaming","📺 Streaming"]]}
            value={where} onChange={setWhere} colorMap={{cinema:"#d97706",streaming:"#0284c7"}}/>
        </div>

        <div className="field-block field-block--wide">
          <Label>Data</Label>
          <Input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
        </div>

        <div className="field-block field-block--wide">
          <Label>Críticas individuais</Label>
          <div className="review-list">
            {users.map(u => (
              <div key={u} className="review-card">
                <div className="review-card__header">
                  <Avatar name={u} size={26}/>
                  <span className="review-card__name">{u}</span>
                  <div className="ml-auto">
                    <Stars val={reviews[u]?.rating} onChange={v=>setReview(u,"rating",v)} size={20}/>
                  </div>
                </div>
                <textarea value={reviews[u]?.text} onChange={e=>setReview(u,"text",e.target.value)}
                  placeholder={`O que ${u} achou?`} rows={2}
                  className="review-card__textarea" />
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleSave} className="cta-button cta-button--primary">
          Salvar sessão
        </button>
      </Modal>
    </Overlay>
  );
};

// watchlist form
const AddWatchlistModal = ({ currentUser, onSave, onClose }) => {
  const [step, setStep] = useState(0);
  const [movie, setMovie] = useState(null);
  const [priority, setPriority] = useState("normal");
  const [note, setNote] = useState("");

  if (step===0) return <SearchModal onSelect={m=>{ setMovie(m); setStep(1); }} onClose={onClose}/>;

  return (
    <Overlay onClose={onClose}>
      <Modal title="Adicionar à watchlist" onClose={onClose} maxW={460}>
        <div className="watchlist-row">
          {movie.poster
            ? <img src={`${TMDB_IMG}${movie.poster}`} alt="" className="preview-poster"/>
            : <div className="preview-poster preview-poster--fallback" />}
          <div>
            <div className="watchlist-title">{movie.title}</div>
            <div className="preview-meta__line">{movie.type==="tv"?"Série":"Filme"} • {movie.year}</div>
          </div>
        </div>
        <div className="field-block">
          <Label>Prioridade</Label>
          <SegBtn options={[["baixa","🟢 Baixa"],["normal","🟡 Normal"],["alta","🔴 Alta"]]}
            value={priority} onChange={setPriority} colorMap={{baixa:"#059669",normal:"#d97706",alta:"#e63946"}}/>
        </div>
        <div className="field-block field-block--wide">
          <Label>Por que indicar?</Label>
          <textarea value={note} onChange={e=>setNote(e.target.value)}
            placeholder="Conta por que querem assistir..." rows={2}
            className="note-textarea" />
        </div>
        <div className="inline-meta">
          <Avatar name={currentUser} size={18}/> Sugerido por {currentUser}
        </div>
        <button onClick={()=>onSave({id:Date.now().toString(),...movie,priority,note,suggestedBy:currentUser,addedAt:new Date().toISOString()})}
          className="cta-button cta-button--violet">
          Adicionar à lista
        </button>
      </Modal>
    </Overlay>
  );
};

// detail modal
const DetailModal = ({ entry, users, onClose, onMarkWatched, onEdit, onSaveReview, currentUser, fromWatchlist }) => {
  const [inlineRating, setInlineRating] = useState(0);
  const [inlineText, setInlineText] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  const poster   = entry.poster   ? `${TMDB_IMG}${entry.poster}` : null;
  const backdrop = entry.backdrop ? `${TMDB_BG}${entry.backdrop}` : null;
  const myReview = entry.reviews?.[currentUser];
  const hasMyReview = myReview?.rating || myReview?.text;

  const ratings = users.map(u=>entry.reviews?.[u]?.rating||0).filter(Boolean);
  const isDiscord = !fromWatchlist && ratings.length===2 && Math.abs(ratings[0]-ratings[1])>=2;

  const handleInlineSave = async () => {
    setSavingReview(true);
    await onSaveReview(entry.id, currentUser, { rating:inlineRating, text:inlineText });
    setSavingReview(false);
    onClose();
  };

  const seasonLabel = () => {
    if (!entry.seasonsWatched?.length) return null;
    const s = entry.seasonsWatched;
    if (s.length===1) return `T${s[0]}`;
    const seq = s.every((v,i)=>i===0||v===s[i-1]+1);
    return seq ? `T${s[0]}→T${s[s.length-1]}` : s.map(x=>`T${x}`).join(", ");
  };

  return (
    <Overlay onClose={onClose}>
      <Modal title="" onClose={onClose} maxW={560}
        banner={backdrop ? (
          <div className="detail-banner">
            <img src={backdrop} alt="" className="detail-banner__image"/>
            <div className="detail-banner__overlay"/>
          </div>
        ) : null}
      >
        <div className={`detail-hero ${backdrop?"":"detail-hero--compact"}`}>
          {poster
            ? <img src={poster} alt="" className={`detail-poster ${backdrop?"detail-poster--floating":""}`} />
            : <div className="detail-poster detail-poster--fallback"><Ic n="film" s={36} className="icon-muted"/></div>}
          <div className={`detail-hero__content ${backdrop?"":"detail-hero__content--compact"}`}>
            <div className={`detail-eyebrow ${entry.type==="tv"?"detail-eyebrow--tv":"detail-eyebrow--movie"}`}>
              {entry.type==="tv"?"SÉRIE":"FILME"}{entry.year?` • ${entry.year}`:""}
              {entry.runtime ? ` • ${Math.floor(entry.runtime/60)}h${entry.runtime%60>0?` ${entry.runtime%60}min`:""}` : ""}
            </div>
            <h2 className="detail-title detail-title--small">{entry.title}</h2>
            {entry.where && (
              <div className={`detail-meta ${entry.where==="cinema"?"detail-meta--cinema":"detail-meta--streaming"}`}>
                {entry.where==="cinema"?"🎬 Cinema":"📺 Streaming"}
                {entry.date && " • "+new Date(entry.date+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"})}
              </div>
            )}
            <div className="detail-badges">
              {isDiscord && <span className="detail-badge detail-badge--discord">⚡ Discordaram</span>}
              {seasonLabel() && <span className="detail-badge detail-badge--season">{seasonLabel()}</span>}
              {entry.tmdbRating && <span className="detail-badge detail-badge--rating">TMDB ★ {entry.tmdbRating}</span>}
            </div>
          </div>
          {onEdit && (
            <button onClick={onEdit} className={`icon-button icon-button--soft ${backdrop?"":"icon-button--floating"}`}>
              <Ic n="edit" s={16}/>
            </button>
          )}
        </div>

        {/* genres */}
        {entry.genres?.length>0 && (
          <div className="detail-tags">
            {entry.genres.map(g=>(
              <span key={g} className="detail-tag">{g}</span>
            ))}
          </div>
        )}

        {/* seasons detail */}
        {entry.type==="tv" && entry.seasonsWatched?.length>0 && entry.numberOfSeasons && (
          <div className="detail-note">
            Temporadas assistidas: {entry.seasonsWatched.join(", ")} de {entry.numberOfSeasons}
          </div>
        )}

        {/* director + cast */}
        {entry.director && (
          <div className="field-block">
            <Label>Direção</Label>
            <span className="detail-text">{entry.director}</span>
          </div>
        )}
        {entry.cast?.length>0 && (
          <div className="field-block">
            <Label>Elenco</Label>
            <div className="detail-tags">
              {entry.cast.map(c=>(
                <span key={c} className="detail-tag detail-tag--muted">{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* IMDB link */}
        {entry.imdbId && (
          <div className="field-block field-block--wide">
            <a href={`https://www.imdb.com/title/${entry.imdbId}`} target="_blank" rel="noopener noreferrer"
              className="imdb-link">
              <Ic n="link" s={14}/> Ver no IMDB
            </a>
          </div>
        )}

        {/* reviews */}
        {!fromWatchlist && entry.reviews && (
          <div className="field-block field-block--wide">
            <Label>Críticas do casal</Label>
            <div className="review-list">
              {Object.entries(entry.reviews).map(([user,rev]) => (
                (rev.rating||rev.text) ? (
                  <div key={user} className="review-card review-card--compact">
                    <div className={`review-card__header ${rev.text?"":"review-card__header--no-text"}`}>
                      <Avatar name={user} size={22}/>
                      <span className="review-card__name review-card__name--flex">{user}</span>
                      {rev.rating>0 && <Stars val={rev.rating} size={16}/>}
                      {rev.rating>0 && <span className="review-rating">{rev.rating}/5</span>}
                    </div>
                    {rev.text && <p className="review-card__quote">“{rev.text}”</p>}
                  </div>
                ) : null
              ))}
            </div>
          </div>
        )}

        {/* awaiting reviews */}
        {!fromWatchlist && users.map(u => {
          const r = entry.reviews?.[u];
          if (r?.rating||r?.text) return null;
          if (u===currentUser) return null;
          return (
            <div key={u} className="awaiting-card">
              <Avatar name={u} size={20}/>
              <span className="awaiting-card__text">Aguardando crítica de {u}</span>
            </div>
          );
        })}

        {/* inline review if currentUser hasn't rated */}
        {!fromWatchlist && !hasMyReview && onSaveReview && (
          <div className="inline-review">
            <div className="inline-review__title">Você ainda não avaliou esse filme</div>
            <div className="inline-review__rating-row">
              <Avatar name={currentUser} size={24}/>
              <Stars val={inlineRating} onChange={setInlineRating} size={22}/>
            </div>
            <textarea value={inlineText} onChange={e=>setInlineText(e.target.value)}
              placeholder="Sua crítica..." rows={2}
              className="review-inline__textarea" />
            <button onClick={handleInlineSave} disabled={savingReview||!inlineRating}
              className="review-inline__button">
              {savingReview?"Salvando...":"Salvar avaliação"}
            </button>
          </div>
        )}

        {/* overview */}
        {entry.overview && (
          <div className="field-block field-block--wide">
            <Label>Sinopse</Label>
            <p className="detail-copy">{entry.overview}</p>
          </div>
        )}

        {/* watchlist extras */}
        {fromWatchlist && (
          <>
            {entry.note && (
              <div className="field-block">
                <Label>Por que assistir</Label>
                <p className="detail-copy detail-copy--italic">"{entry.note}"</p>
              </div>
            )}
            <div className="detail-meta-row">
              <div>
                <Label>Sugerido por</Label>
                <div className="detail-inline-person">
                  <Avatar name={entry.suggestedBy} size={20}/>
                  <span className="detail-text detail-text--muted">{entry.suggestedBy}</span>
                </div>
              </div>
              <div>
                <Label>Prioridade</Label>
                <span className={`detail-priority ${entry.priority==="alta"?"priority--alta":entry.priority==="normal"?"priority--normal":"priority--baixa"}`}>
                  {entry.priority?.charAt(0).toUpperCase()+entry.priority?.slice(1)||"Normal"}
                </span>
              </div>
            </div>
            {onMarkWatched && (
              <button onClick={()=>onMarkWatched(entry)}
                className="cta-button cta-button--primary">
                Marcar como assistido
              </button>
            )}
          </>
        )}
      </Modal>
    </Overlay>
  );
};

// login screen
const LoginScreen = ({ onLogin, loading }) => (
  <div className="auth-screen">
    <div className="auth-card">
      <div className="auth-icon">🎞️</div>
      <h1 className="auth-title">
        Sessão <span className="auth-brand-accent">❤️</span>
      </h1>
      <p className="auth-subtitle auth-subtitle--wide">O diário cinematográfico do casal</p>
      <button onClick={onLogin} disabled={loading}
        className="auth-google-btn">
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        {loading ? "Entrando..." : "Entrar com Google"}
      </button>
    </div>
  </div>
);

// couple setup (create or join)
const CoupleSetup = ({ authUser, onCreate, onJoin }) => {
  const [tab, setTab] = useState("create");
  const [myName, setMyName] = useState(authUser?.displayName || "");
  const [since, setSince] = useState("");
  const [code, setCode] = useState("");
  const [joinName, setJoinName] = useState(authUser?.displayName || "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleCreate = async () => {
    if (!myName.trim()) return;
    setLoading(true);
    setErr("");
    try {
      await onCreate(myName.trim(), since);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!code.trim() || !joinName.trim()) return;
    setLoading(true);
    setErr("");
    try {
      await onJoin(code.trim().toUpperCase(), joinName.trim());
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inp = {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid var(--border-default)",
    borderRadius: 12,
    padding: "13px 18px",
    color: "var(--text-primary)",
    fontSize: 15,
    outline: "none",
    textAlign: "center",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-icon">🎞️</div>
        <h1 className="auth-title auth-title--large">
          Sessão <span className="days-highlight">❤️</span>
        </h1>
        <p className="auth-subtitle">Olá, {authUser?.displayName?.split(" ")[0]}! Configure seu diário.</p>

        <div className="auth-tabs">
          {[["create", "Criar casal"], ["join", "Tenho um convite"]].map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setTab(value);
                setErr("");
              }}
              className="auth-tab"
              data-active={tab === value}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "create" && (
          <div className="auth-stack">
            <input value={myName} onChange={e => setMyName(e.target.value)} placeholder="Seu nome" style={inp} />
            <p className="auth-note">Você receberá um código para convidar sua pessoa</p>
            <p className="auth-note auth-note--compact">Desde quando juntos? (opcional)</p>
            <input type="date" value={since} onChange={e => setSince(e.target.value)} style={inp} />
            {err && <p className="error-text">{err}</p>}
            <button
              onClick={handleCreate}
              disabled={loading || !myName.trim()}
              className="auth-btn auth-btn--accent"
              type="button"
            >
              {loading ? "Criando..." : "Criar nosso diário"}
            </button>
          </div>
        )}

        {tab === "join" && (
          <div className="auth-stack">
            <input value={joinName} onChange={e => setJoinName(e.target.value)} placeholder="Seu nome" style={inp} />
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="Código de convite (ex: ABC123)"
              style={{ ...inp, letterSpacing: 3, fontWeight: 700, fontSize: 20 }}
              maxLength={6}
            />
            {err && <p className="error-text">{err}</p>}
            <button
              onClick={handleJoin}
              disabled={loading || code.length < 6 || !joinName.trim()}
              className="auth-btn auth-btn--violet"
              type="button"
            >
              {loading ? "Entrando..." : "Entrar no diário"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// invite code display (after creating couple)
const InviteScreen = ({ inviteCode, couple }) => (
  <div className="auth-screen">
    <div className="auth-card">
      <div className="auth-icon">🎞️</div>
      <h2 className="auth-title" style={{ fontSize: "clamp(28px, 4.4vw, 32px)", marginBottom: 8 }}>Diário criado!</h2>
      <p className="auth-subtitle auth-callout">
        Compartilhe o código abaixo com {couple.name1 === "?" ? "sua pessoa" : couple.name2 || "sua pessoa"} para ela entrar no diário.
      </p>
      <div className="invite-box">
        <p className="invite-code-title">CÓDIGO DE CONVITE</p>
        <div className="invite-box__code">{inviteCode}</div>
      </div>
      <p className="auth-note">Aguardando sua pessoa entrar — assim que ela usar o código, o diário abrirá automaticamente.</p>
    </div>
  </div>
);

// home page
const HomePage = ({ watched, watchlist, couple, currentUser }) => {
  const totMovies = watched.filter(w => w.type === "movie").length;
  const totSeries = watched.filter(w => w.type === "tv").length;
  const totCinema = watched.filter(w => w.where === "cinema").length;
  const allRatings = watched.flatMap(w => Object.values(w.reviews || {}).map(r => r.rating).filter(Boolean));
  const avgR = allRatings.length ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1) : null;
  const totalMins = watched.reduce((s, w) => s + (w.runtime || 0), 0);
  const recent = [...watched].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);
  const days = couple.since ? Math.floor((new Date() - new Date(couple.since)) / 86400000) : null;
  const nextWatch = [...watchlist].sort((a, b) => {
    const p = { alta: 0, normal: 1, baixa: 2 };
    return (p[a.priority] ?? 1) - (p[b.priority] ?? 1);
  })[0];

  return (
    <div>
      <div className="hero-panel">
        <div className="hero-panel__eyebrow">BEM-VINDO DE VOLTA</div>
        <h2 className="hero-panel__title">Olá, {currentUser}!</h2>
        {days !== null && <p className="hero-panel__meta">{couple.name1} & {couple.name2} • {days} dias juntos</p>}
      </div>

      <div className="stat-grid">
        {[
          { v: totMovies + totSeries, l: "Total assistidos", icon: "film" },
          { v: totCinema, l: "No cinema", icon: "star" },
          { v: totMovies, l: "Filmes", icon: "film" },
          { v: avgR ? `${avgR}  ★` : "—", l: "Nota média", icon: "star" },
        ].map(s => (
          <div key={s.l} className="stat-card">
            <div className="stat-card__icon icon--info"><Ic n={s.icon} s={20} /></div>
            <div className="stat-card__value">{s.v}</div>
            <div className="stat-card__label">{s.l}</div>
          </div>
        ))}
      </div>

      {totalMins > 0 && (
        <div className="info-card">
          <span className="icon--info"><Ic n="clock" s={22} /></span>
          <div>
            <div className="value-large">{Math.floor(totalMins / 60)}h {totalMins % 60}min</div>
            <div className="muted-small">assistidos juntos</div>
          </div>
        </div>
      )}

      {nextWatch && (
        <div className="surface-card surface-card--violet mb-22">
          {nextWatch.poster
            ? <img src={`${TMDB_IMG}${nextWatch.poster}`} alt="" className="poster-img" />
            : <div className="poster-placeholder" />}
          <div className="list-fill">
            <div className="nextwatch__eyebrow">PRÓXIMA SESSÃO</div>
            <div className="nextwatch__title">{nextWatch.title}</div>
            <div className="nextwatch__sub">Sugerido por {nextWatch.suggestedBy}</div>
          </div>
          <div className={`${nextWatch.priority==="alta"?"priority--alta":nextWatch.priority==="normal"?"priority--normal":"priority--baixa"} priority-pill`}> {nextWatch.priority?.toUpperCase()}</div>
        </div>
      )}

      {recent.length > 0 && (
        <>
          <div className="section-heading">ASSISTIDOS RECENTEMENTE</div>
          <div className="recent-list">
            {recent.map(e => {
              const rs = Object.values(e.reviews || {}).map(r => r.rating).filter(Boolean);
              const avg = rs.length ? (rs.reduce((a, b) => a + b, 0) / rs.length).toFixed(1) : null;
              return (
                <div key={e.id} className="surface-card list-item">
                  {e.poster
                    ? <img src={`${TMDB_IMG}${e.poster}`} alt="" className="poster-small" />
                    : <div className="poster-placeholder--small" />}
                  <div className="list-fill">
                    <div className="list-title">{e.title}</div>
                    <div className="list-meta">{e.date && new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} • {e.where === "cinema" ? "Cinema" : "Streaming"}</div>
                    <div className="list-avatars">{Object.keys(e.reviews || {}).map(u => <Avatar key={u} name={u} size={16} />)}</div>
                  </div>
                  {avg && <span className="avg-highlight">★ {avg}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {watched.length === 0 && (
        <div className="empty-state">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="empty-svg">
            <rect x="10" y="10" width="60" height="60" rx="8" stroke="var(--accent)" strokeWidth="2" />
            <line x1="25" y1="10" x2="25" y2="70" stroke="var(--accent)" strokeWidth="2" />
            <line x1="55" y1="10" x2="55" y2="70" stroke="var(--accent)" strokeWidth="2" />
            <line x1="10" y1="40" x2="70" y2="40" stroke="var(--accent)" strokeWidth="2" />
            <line x1="10" y1="25" x2="25" y2="25" stroke="var(--accent)" strokeWidth="2" />
            <line x1="55" y1="25" x2="70" y2="25" stroke="var(--accent)" strokeWidth="2" />
          </svg>
          <div className="empty-state__text">Registrem a primeira sessão de vocês!</div>
        </div>
      )}
    </div>
  );
};

// diary page
const DiaryPage = ({ watched, users, currentUser, onDelete, onEdit, onSaveReview }) => {
  const [sel, setSel] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ type:"all", where:"all", rating:"all", genre:"all", sort:"recent" });
  const [showFilters, setShowFilters] = useState(false);

  const allGenres = [...new Set(watched.flatMap(w=>w.genres||[]))].sort();
  const setF = (k,v) => setFilters(f=>({...f,[k]:v}));

  const avgRating = w => {
    const rs=Object.values(w.reviews||{}).map(r=>r.rating).filter(Boolean);
    return rs.length?rs.reduce((a,b)=>a+b,0)/rs.length:0;
  };

  let items = [...watched];
  if (search) items = items.filter(w=>w.title.toLowerCase().includes(search.toLowerCase()));
  if (filters.type!=="all") items = items.filter(w=>w.type===(filters.type==="movie"?"movie":"tv"));
  if (filters.where!=="all") items = items.filter(w=>w.where===filters.where);
  if (filters.genre!=="all") items = items.filter(w=>(w.genres||[]).includes(filters.genre));
  if (filters.rating!=="all") items = items.filter(w=>{
    const avg=avgRating(w);
    if(filters.rating==="5") return avg===5;
    if(filters.rating==="4") return avg>=4;
    if(filters.rating==="3") return avg>=3;
    if(filters.rating==="low") return avg>0&&avg<3;
    return true;
  });
  if (filters.sort==="recent")  items.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  if (filters.sort==="oldest")  items.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  if (filters.sort==="rated")   items.sort((a,b)=>avgRating(b)-avgRating(a));
  if (filters.sort==="az")      items.sort((a,b)=>a.title.localeCompare(b.title));

  const hasActive = search||filters.type!=="all"||filters.where!=="all"||filters.rating!=="all"||filters.genre!=="all"||filters.sort!=="recent";
  const clearAll = () => { setSearch(""); setFilters({type:"all",where:"all",rating:"all",genre:"all",sort:"recent"}); };

  return (
    <div>
      {sel && (
        <DetailModal entry={sel} users={users} currentUser={currentUser}
          onClose={()=>setSel(null)}
          onEdit={()=>{ setEditing(sel); setSel(null); }}
          onSaveReview={onSaveReview}/>
      )}
      {editing && (
        <WatchedForm users={users} currentUser={currentUser}
          initial={{ ...editing, movie:editing }}
          title="Editar registro"
          onSave={e=>{ onEdit(e); setEditing(null); }}
          onClose={()=>setEditing(null)}/>
      )}

      {/* search bar */}
      <div className="search-row">
        <input className="text-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título..." />
        <div className="search-row__icon">
          <Ic n="search" s={16} />
        </div>
      </div>

      {/* filter toggle */}
      <div className="filters-row">
        <button onClick={()=>setShowFilters(f=>!f)} className={`segmented-button ${showFilters||hasActive?"segmented-button--active":""}`}>
          <Ic n="filter" s={14}/> Filtros {hasActive?" •":""}
        </button>
        {hasActive && (
          <button onClick={clearAll} className="segmented-button">Limpar</button>
        )}
        <span className="filters-count">{items.length} título{items.length!==1?"s":""}</span>
      </div>

      {showFilters && (
        <div className="filters-panel">
          <div className="filters-grid">
            <div>
              <Label>Tipo</Label>
              <select value={filters.type} onChange={e=>setF("type",e.target.value)} className="form-select">
                <option value="all">Todos</option>
                <option value="movie">Filmes</option>
                <option value="tv">Séries</option>
              </select>
            </div>
            <div>
              <Label>Onde</Label>
              <select value={filters.where} onChange={e=>setF("where",e.target.value)} className="form-select">
                <option value="all">Todos</option>
                <option value="cinema">Cinema</option>
                <option value="streaming">Streaming</option>
              </select>
            </div>
            <div>
              <Label>Nota mínima</Label>
              <select value={filters.rating} onChange={e=>setF("rating",e.target.value)} className="form-select">
                <option value="all">Todos</option>
                <option value="5">⭐⭐⭐⭐⭐</option>
                <option value="4">⭐⭐⭐⭐+</option>
                <option value="3">⭐⭐⭐+</option>
                <option value="low">Abaixo de ⭐⭐⭐</option>
              </select>
            </div>
            <div>
              <Label>Gênero</Label>
              <select value={filters.genre} onChange={e=>setF("genre",e.target.value)} className="form-select">
                <option value="all">Todos</option>
                {allGenres.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-12">
            <Label>Ordenar por</Label>
            <div className="row" style={{ flexWrap: "wrap" }}>
              {[ ["recent","Mais recentes"],["oldest","Mais antigos"],["rated","Melhor avaliados"],["az","A→Z"] ].map(([v,l])=>(
                <button key={v} onClick={()=>setF("sort",v)} className={`segmented-button ${filters.sort===v?"segmented-button--active":""}`}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {items.length===0 ? (
        <div className="empty-state">
          <svg width="70" height="70" viewBox="0 0 70 70" fill="none" className="empty-svg">
            <circle cx="35" cy="35" r="30" stroke="var(--accent)" strokeWidth="2"/>
            <line x1="20" y1="35" x2="50" y2="35" stroke="var(--accent)" strokeWidth="2"/>
            <line x1="35" y1="20" x2="35" y2="50" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 4"/>
          </svg>
          <div className="text-muted">
            {watched.length===0?"Nenhum filme registrado ainda":"Nenhum título encontrado com esses filtros"}
          </div>
        </div>
      ) : (
        <div className="card-grid">
            {items.map(e=>{
            const rs=Object.values(e.reviews||{}).map(r=>r.rating).filter(Boolean);
            const avg=rs.length?(rs.reduce((a,b)=>a+b,0)/rs.length).toFixed(1):null;
            const ratings=users.map(u=>e.reviews?.[u]?.rating||0).filter(Boolean);
            const isDiscord=ratings.length===2&&Math.abs(ratings[0]-ratings[1])>=2;
            const pendingUsers=users.filter(u=>!e.reviews?.[u]?.rating&&!e.reviews?.[u]?.text);
            return (
              <div key={e.id} onClick={()=>setSel(e)} className="card-inner card-inner--clickable">
                <div className="poster-wrap">
                  {e.poster
                    ? <img src={`${TMDB_IMG}${e.poster}`} alt="" className="poster-img" />
                    : <PosterFallback type={e.type} h={210}/>}
                  <div className="poster-gradient"/>
                  <div className={`poster-badge ${e.type==="tv"?"poster-badge--tv":"poster-badge--movie"}`}>
                    {e.type==="tv"?"SÉRIE":"FILME"}
                  </div>
                  {avg && <div className="poster-avg"><span className="avg-highlight">★ {avg}</span></div>}
                  {isDiscord && (
                    <div className="poster-flag">
                      <span className="poster-flag__label">Discordaram</span>
                    </div>
                  )}
                  <div className="poster-avatar"><Avatar name={e.addedBy} size={22}/></div>
                  <button onClick={ev=>{ev.stopPropagation();onDelete(e);}} className="poster-delete">
                    <Ic n="trash" s={13}/>
                  </button>
                </div>
                <div className="card-inner__body">
                  <div className="card-title">{e.title}</div>
                  <div className="card-meta-line">
                    <Ic n={e.where==="cinema"?"film":"tv"} s={10}/>
                    {e.where==="cinema"?"Cinema":"Streaming"}
                    {e.date && " • " + new Date(e.date+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"})}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// watchlist page
const WatchlistPage = ({ watchlist, users, currentUser, onDelete, onMarkWatched }) => {
  const [sel, setSel] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("priority");
  const priOrder = { alta:0, normal:1, baixa:2 };

  let items = [...watchlist];
  if (search) items = items.filter(w=>w.title.toLowerCase().includes(search.toLowerCase()));
  if (filter==="movie") items = items.filter(w=>w.type==="movie");
  else if (filter==="tv") items = items.filter(w=>w.type==="tv");
  else if (filter==="alta") items = items.filter(w=>w.priority==="alta");

  if (sort==="priority") items.sort((a,b)=>(priOrder[a.priority]??1)-(priOrder[b.priority]??1));
  else if (sort==="recent") items.sort((a,b)=>new Date(b.addedAt)-new Date(a.addedAt));
  else if (sort==="az") items.sort((a,b)=>a.title.localeCompare(b.title));
  else if (sort==="who") items.sort((a,b)=>a.suggestedBy.localeCompare(b.suggestedBy));

  return (
    <div>
      {sel && (
        <DetailModal entry={sel} users={users} fromWatchlist currentUser={currentUser}
          onClose={()=>setSel(null)}
          onMarkWatched={e=>{onMarkWatched(e);setSel(null);}}/>
      )}

      <div className="search-row">
        <input className="text-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar na watchlist..." />
        <div className="search-row__icon">
          <Ic n="search" s={16} />
        </div>
      </div>

      <div className="filters-row">
        {[ ["all","Todos"],["movie","Filmes"],["tv","SÉries"],["alta","Alta prioridade"] ].map(([v,l])=>(
          <button key={v} onClick={() => setFilter(v)} className={`segmented-button ${filter === v ? "segmented-button--active" : ""} ${v==='tv'?'segmented-button--tv':v==='movie'?'segmented-button--movie':''}`}>{l}</button>
        ))}
          <div className="ml-auto">
          <span className="label-muted">Ordenar:</span>
          <select value={sort} onChange={e=>setSort(e.target.value)} className="form-select">
            <option value="priority">Prioridade</option>
            <option value="recent">Mais recentes</option>
            <option value="az">A→Z</option>
            <option value="who">Quem sugeriu</option>
          </select>
        </div>
      </div>

      {items.length===0 ? (
        <div className="empty-state">
          <svg width="70" height="70" viewBox="0 0 70 70" fill="none" className="empty-svg" style={{ opacity:.25 }}>
            <path d="M15 10h40v50l-20-14-20 14V10z" stroke="#7c3aed" strokeWidth="2" fill="none"/>
            <line x1="25" y1="25" x2="45" y2="25" stroke="#7c3aed" strokeWidth="2"/>
            <line x1="25" y1="33" x2="40" y2="33" stroke="#7c3aed" strokeWidth="2"/>
          </svg>
          <div className="empty-state__text">
            {watchlist.length===0?"Nenhum filme na lista — que tal adicionar algo?":"Nenhum título com esses filtros"}
          </div>
        </div>
      ) : (
        <div className="col-gap-10">
          {items.map(e=>(
            <div key={e.id} onClick={()=>setSel(e)} className="surface-card list-item">
              {e.poster
                ? <img src={`${TMDB_IMG}${e.poster}`} alt="" className="poster-medium" />
                : <div className="poster-placeholder--medium" />}
              <div className="list-fill">
                <div className="list-title">{e.title}</div>
                <div className="list-meta">{e.type==="tv"?"Série":"Filme"} • {e.year}</div>
                <div className="list-avatars">
                  <Avatar name={e.suggestedBy} size={16}/>
                  <span className="card-meta">{e.suggestedBy}</span>
                </div>
              </div>
              <div className="card-right">
                <span className={`${e.priority? (e.priority==="alta"?"priority--alta":e.priority==="normal"?"priority--normal":"priority--baixa") : ""} priority-pill`}>• {e.priority?.charAt(0).toUpperCase()+e.priority?.slice(1)}</span>
                <button onClick={ev=>{ev.stopPropagation();onDelete(e);}} className="icon-button">
                  <Ic n="trash" s={15}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// profile page
const ProfilePage = ({ watched, watchlist, couple, users }) => {
  const days = couple.since?Math.floor((new Date()-new Date(couple.since))/86400000):null;
  const first = watched.length?watched.reduce((a,b)=>new Date(a.createdAt)<new Date(b.createdAt)?a:b):null;

  const totalMins = watched.reduce((s,w)=>s+(w.runtime||0),0);
  const cinemaCount = watched.filter(w=>w.where==="cinema").length;
  const streamCount = watched.filter(w=>w.where==="streaming").length;

  // genre frequency
  const genreCount = {};
  watched.forEach(w=>(w.genres||[]).forEach(g=>{ genreCount[g]=(genreCount[g]||0)+1; }));
  const topGenres = Object.entries(genreCount).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxGenre = topGenres[0]?.[1]||1;

  // month most active
  const monthCount = {};
  watched.forEach(w=>{
    const m=w.date?.slice(0,7)||w.createdAt?.slice(0,7);
    if(m) monthCount[m]=(monthCount[m]||0)+1;
  });
  const topMonth = Object.entries(monthCount).sort((a,b)=>b[1]-a[1])[0];

  // best rated
  const avgR = w => { const rs=Object.values(w.reviews||{}).map(r=>r.rating).filter(Boolean); return rs.length?rs.reduce((a,b)=>a+b,0)/rs.length:0; };
  const bestRated = watched.length?[...watched].sort((a,b)=>avgR(b)-avgR(a))[0]:null;
  const globalAvg = (() => { const all=watched.flatMap(w=>Object.values(w.reviews||{}).map(r=>r.rating).filter(Boolean)); return all.length?(all.reduce((a,b)=>a+b,0)/all.length).toFixed(1):null; })();

  // discordômetro
  const discordEntries = watched.filter(w=>{
    const rs=users.map(u=>w.reviews?.[u]?.rating||0).filter(Boolean);
    return rs.length===2&&Math.abs(rs[0]-rs[1])>=2;
  });
  const biggestDiscord = discordEntries.length
    ? discordEntries.reduce((a,b)=>{
        const da=Math.abs((a.reviews?.[users[0]]?.rating||0)-(a.reviews?.[users[1]]?.rating||0));
        const db=Math.abs((b.reviews?.[users[0]]?.rating||0)-(b.reviews?.[users[1]]?.rating||0));
        return db>da?b:a;
      }) : null;

  // most seasons
  const mostSeasons = watched.filter(w=>w.type==="tv"&&w.seasonsWatched?.length>0)
    .sort((a,b)=>b.seasonsWatched.length-a.seasonsWatched.length)[0];

  // per-user stats
  const userStats = users.map(u=>{
    const myRatings=watched.flatMap(w=>{const r=w.reviews?.[u];return r?.rating?[r.rating]:[];});
    const avg=myRatings.length?(myRatings.reduce((a,b)=>a+b,0)/myRatings.length).toFixed(1):null;
    const suggested=watchlist.filter(w=>w.suggestedBy===u).length;
    const registered=watched.filter(w=>w.addedBy===u).length;
    // favorite genre
    const ug={};
    watched.forEach(w=>{ if(w.reviews?.[u]?.rating)(w.genres||[]).forEach(g=>{ug[g]=(ug[g]||0)+1;}); });
    const favGenre=Object.entries(ug).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
    return {name:u,avg,suggested,registered,total:myRatings.length,favGenre};
  });

  const monthName = m => { if(!m) return null; const [y,mo]=m.split("-"); return new Date(+y,+mo-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"}); };

  return (
    <div>
      <div className="hero-accent">
        <div className="avatar-row">
          {users.map((u,i)=>(
            <div key={u} style={{ zIndex:i }} className={i===0?"":"avatar-stack"}>
              <Avatar name={u} size={52}/>
            </div>
          ))}
        </div>
        <h2 className="profile-heading">{couple.name1} & {couple.name2}</h2>
        {days!==null&&<p className="days-highlight">{days} dias juntos</p>}
        {couple.since&&<p className="text-muted text-muted--compact">Desde {new Date(couple.since+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"})}</p>}
      </div>

      {/* couple stats */}
      <div className="grid-3">
        {[
          {v:watched.length,l:"Total"},
          {v:watched.filter(w=>w.type==="movie").length,l:"Filmes"},
          {v:watched.filter(w=>w.type==="tv").length,l:"Séries"},
        ].map(s=>(
          <div key={s.l} className="stat-card">
            <div className="stat-card__value">{s.v}</div>
            <div className="stat-card__label">{s.l}</div>
          </div>
        ))}
      </div>

      {/* hours + avg */}
      <div className="grid-2">
        {totalMins>0 && (
            <div className="panel--info">
            <div className="panel-label--info">HORAS</div>
            <div className="stat-value">{Math.floor(totalMins/60)}h {totalMins%60}min</div>
            <div className="stat-meta">assistidos juntos</div>
          </div>
        )}
        {globalAvg && (
          <div className="panel--warning">
            <div className="panel-label--warning">MÉDIA</div>
            <div className="stat-value">{globalAvg}</div>
            <div className="stat-meta">nota do casal</div>
          </div>
        )}
      </div>

      {/* cinema vs streaming */}
      {watched.length>0 && (
        <div className="card-inner card-inner--padded">
          <div className="section-eyebrow">CINEMA vs STREAMING</div>
            <div className="bar-row">
              <div style={{ flex:cinemaCount }} className="bar--cinema" />
              <div style={{ flex:streamCount }} className="bar--stream" />
            </div>
          <div className="space-between">
            <span>🎬 {cinemaCount} ({watched.length?Math.round(cinemaCount/watched.length*100):0}%)</span>
            <span>📺 {streamCount} ({watched.length?Math.round(streamCount/watched.length*100):0}%)</span>
          </div>
        </div>
      )}

      {/* top genres */}
      {topGenres.length>0 && (
          <div className="card-inner card-inner--padded">
          <div className="section-eyebrow">TOP GÊNEROS</div>
          <div className="col-gap-10">
            {topGenres.map(([g,c])=>(
              <div key={g}>
                <div className="space-between" style={{ marginBottom:4 }}>
                  <span className="genre-label">{g}</span>
                  <span className="genre-count">{c}</span>
                </div>
                <div className="genre-track">
                  <div style={{ height:"100%",width:`${c/maxGenre*100}%` }} className="genre-fill" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* month most active */}
      {topMonth && (
        <div className="card-inner card-inner--compact">
          <span className="icon--violet"><Ic n="clock" s={24} /></span>
          <div>
            <div className="section-eyebrow">MÊS MAIS ATIVO</div>
            <div className="stat-title">{monthName(topMonth[0])}</div>
            <div className="muted">{topMonth[1]} títulos assistidos</div>
          </div>
        </div>
      )}

      {/* per-user stats */}
      <div className="per-user-section">
        <div className="section-eyebrow">PERFIL DE CADA UM</div>
        <div className="col-gap-12">
          {userStats.map(u=>(
            <div key={u.name} className="card-inner card-inner--padded">
              <div className="row align-center" style={{ marginBottom:14 }}>
                <Avatar name={u.name} size={36}/>
                <div style={{ flex:1 }}>
                  <span className="profile-name">{u.name}</span>
                  {u.favGenre && <div className="muted small">— {u.favGenre}</div>}
                </div>
                {u.avg && <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                  <Stars val={Math.round(parseFloat(u.avg))} size={14}/>
                  <span className="avg-small">{u.avg}</span>
                </div>}
              </div>
              <div className="grid-3" style={{ gap:8 }}>
                {[{v:u.registered,l:"Registrou"},{v:u.suggested,l:"Sugeriu"},{v:u.total,l:"Avaliou"}].map(s=>(
                  <div key={s.l} className="stat-pill">
                    <div className="stat-value">{s.v}</div>
                    <div className="stat-meta">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* marcos */}
      <div style={{ fontSize:11,color:"#666",fontWeight:700,letterSpacing:1.2,marginBottom:12 }}>MARCOS</div>
      <div className="col-gap-10" style={{ marginBottom:18 }}>
        {[
          first&&{ label:"Primeiro juntos", item:first },
          bestRated&&avgR(bestRated)>0&&{ label:`Melhor avaliado (★ ${avgR(bestRated).toFixed(1)})`, item:bestRated },
          biggestDiscord&&{ label:`Maior discordância (${Math.abs((biggestDiscord.reviews?.[users[0]]?.rating||0)-(biggestDiscord.reviews?.[users[1]]?.rating||0))} estrelas)`, item:biggestDiscord },
          mostSeasons&&{ label:`Mais temporadas assistidas (${mostSeasons.seasonsWatched?.length})`, item:mostSeasons },
        ].filter(Boolean).map(({label,item})=>(
          <div key={label} className="card-inner" style={{ display:"flex",gap:12,padding:12,alignItems:"center" }}>
            {item.poster&&<img src={`${TMDB_IMG}${item.poster}`} alt="" style={{ width:38,height:56,borderRadius:7,objectFit:"cover",flexShrink:0 }}/>}
            <div>
              <div style={{ fontSize:11,color:"#777",marginBottom:4 }}>{label}</div>
              <div style={{ fontFamily:"'Playfair Display',serif",fontWeight:700,color:"#f0f0f0",fontSize:14 }}>{item.title}</div>
            </div>
          </div>
        ))}
      </div>

      {/* discordômetro */}
      {discordEntries.length>0 && (
        <div style={{ background:"rgba(230,57,70,.06)",border:"1px solid rgba(230,57,70,.15)",borderRadius:16,padding:"16px 18px" }}>
          <div style={{ fontSize:11,color:"#f87171",fontWeight:700,letterSpacing:1.2,marginBottom:12 }}>
            • DISCORDÔMETRO — {discordEntries.length} título{discordEntries.length!==1?"s":""}
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {discordEntries.slice(0,5).map(e=>{
              const r0=e.reviews?.[users[0]]?.rating||0, r1=e.reviews?.[users[1]]?.rating||0;
              return (
                <div key={e.id} style={{ display:"flex",gap:10,alignItems:"center" }}>
                  {e.poster&&<img src={`${TMDB_IMG}${e.poster}`} alt="" style={{ width:32,height:46,borderRadius:5,objectFit:"cover",flexShrink:0 }}/>}
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:700,color:"#f0f0f0",fontSize:13,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{e.title}</div>
                    <div style={{ fontSize:11,color:"#888",marginTop:2 }}>
                      {users[0]}: ★{r0} · {users[1]}: ★{r1}
                    </div>
                  </div>
                  <span style={{ fontSize:13,color:"#f87171",fontWeight:700,flexShrink:0 }}>+{Math.abs(r0-r1)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// nav
const NAV = [
  { id:"home",      icon:"home",     label:"Início" },
  { id:"diary",     icon:"book",     label:"Diário" },
  { id:"watchlist", icon:"bookmark", label:"Watchlist" },
  { id:"profile",   icon:"heart",    label:"Casal" },
];

// root
export default function App() {
  // auth + couple state
  const [authUser,   setAuthUser]   = useState(null);
  const [couple,     setCouple]     = useState(null);   // Firestore couple doc data
  const [coupleId,   setCoupleId]   = useState(null);   // Firestore doc id
  const [authLoading,setAuthLoading]= useState(true);
  const [loginLoading,setLoginLoading]=useState(false);

  // app state
  const [watched,   setWatched]   = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [page,      setPage]      = useState("home");
  const [addModal,  setAddModal]  = useState(null);
  const [toasts,    setToasts]    = useState([]);
  const [confirm,   setConfirm]   = useState(null);

  // derived
  // currentUser remains a name string for UI compatibility
  const currentUser = couple
    ? (couple.uid1 === authUser?.uid ? couple.name1 : couple.name2)
    : null;
  const users = couple ? [couple.name1, couple.name2].filter(Boolean) : [];

  // auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      setAuthUser(user);
      if (!user) { setWatched([]); setWatchlist([]); setCouple(null); setCoupleId(null); setAuthLoading(false); return; }
      // look for existing couple (as uid1 or uid2)
      const [s1, s2] = await Promise.all([
        getDocs(query(collection(db,"couples"), where("uid1","==",user.uid))),
        getDocs(query(collection(db,"couples"), where("uid2","==",user.uid))),
      ]);
      const snap = !s1.empty ? s1 : s2;
      if (!snap.empty) {
        setCoupleId(snap.docs[0].id);
        setCouple(snap.docs[0].data());
      } else {
        setWatched([]);
        setWatchlist([]);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Firestore real-time listeners
  useEffect(() => {
    if (!coupleId) return;
    const unW  = onSnapshot(collection(db,"couples",coupleId,"watched"),
      snap => setWatched(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const unWL = onSnapshot(collection(db,"couples",coupleId,"watchlist"),
      snap => setWatchlist(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return () => { unW(); unWL(); };
  }, [coupleId]);

  // auth actions
  const handleLogin = async () => {
    setLoginLoading(true);
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch(e) { console.error(e); }
    finally { setLoginLoading(false); }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setWatched([]);
    setWatchlist([]);
    setCouple(null); setCoupleId(null);
  };

  // couple actions
  const handleCreateCouple = async (name1, since) => {
    const inviteCode = Math.random().toString(36).slice(2,8).toUpperCase();
    const ref = await addDoc(collection(db,"couples"), {
      name1, name2: null, uid1: authUser.uid, uid2: null,
      since: since||null, inviteCode, createdAt: new Date().toISOString(),
    });
    setCoupleId(ref.id);
    setCouple({ name1, name2:null, uid1:authUser.uid, uid2:null, since:since||null, inviteCode });
  };

  const handleJoinCouple = async (code, name2) => {
    const snap = await getDocs(query(collection(db,"couples"), where("inviteCode","==",code)));
    if (snap.empty) throw new Error("Código inválido — verifique e tente de novo.");
    const coupleDoc = snap.docs[0];
    const data = coupleDoc.data();
    if (data.uid2 && data.uid2 !== authUser.uid) throw new Error("Esse código já foi usado por outra pessoa.");
    await updateDoc(doc(db,"couples",coupleDoc.id), { name2, uid2: authUser.uid });
    setCoupleId(coupleDoc.id);
    setCouple({ ...data, name2, uid2: authUser.uid });
  };

  // toast helper
  const addToast = (message, type="success", undoFn=null) => {
    const id = Date.now().toString();
    setToasts(t=>[...t,{id,message,type,undoFn}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)), type==="error"?5000:3000);
  };
  const dismissToast = id => setToasts(t=>t.filter(x=>x.id!==id));

  // data operations (Firestore)
  const addWatched = async entry => {
    const { ...data } = entry;
    await addDoc(collection(db,"couples",coupleId,"watched"), data);
    setAddModal(null);
    addToast("Sessão salva! 🎉");
  };

  const editWatched = async entry => {
    const { id, ...data } = entry;
    await setDoc(doc(db,"couples",coupleId,"watched",id), data);
    addToast("Registro atualizado","info");
  };

  const saveReview = async (id, user, review) => {
    await updateDoc(doc(db,"couples",coupleId,"watched",id), { [`reviews.${user}`]: review });
    addToast("Avaliação salva!","success");
  };

  const addWatchlist = async entry => {
    const { ...data } = entry;
    await addDoc(collection(db,"couples",coupleId,"watchlist"), data);
    setAddModal(null);
    addToast("Adicionado à lista","info");
  };

  const requestDelete = (item, type) => {
    setConfirm({
      message: "Tem certeza? Essa ação não pode ser desfeita.",
      onConfirm: async () => {
        setConfirm(null);
        const coll = type==="watched" ? "watched" : "watchlist";
        const { id, ...data } = item;
        await deleteDoc(doc(db,"couples",coupleId,coll,id));
        addToast("Removido","error", async () => {
          await setDoc(doc(db,"couples",coupleId,coll,id), data);
        });
      },
    });
  };

  const markWatched = async e => {
    const { id, ...data } = e;
    await deleteDoc(doc(db,"couples",coupleId,"watchlist",id));
    setAddModal({ type:"watched", movie:data });
  };

  // render guards
  if (authLoading) return (
    <div style={{ minHeight:"100vh",background:"#08080f",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div className="text-muted">Carregando...</div>
    </div>
  );

  if (!authUser) return <LoginScreen onLogin={handleLogin} loading={loginLoading}/>;

  if (!couple) return (
    <CoupleSetup authUser={authUser} onCreate={handleCreateCouple} onJoin={handleJoinCouple}/>
  );

  // First user created couple but partner hasn't joined yet (name2 is null)
  if (!couple.name2) return (
    <InviteScreen inviteCode={couple.inviteCode} couple={couple}/>
  );

  return (
    <>
      <style>{`
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(1) opacity(.4);}
        select option{background:#1a1a2e;color:#f0f0f0;}
        @keyframes slideUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
      `}</style>

      {confirm && (
        <ConfirmModal message={confirm.message} onConfirm={confirm.onConfirm} onCancel={()=>setConfirm(null)}/>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast}/>

      <div className="app-shell">

        {/* modals */}
        {addModal==="watchlist" && (
          <AddWatchlistModal users={users} currentUser={currentUser} onSave={addWatchlist} onClose={()=>setAddModal(null)}/>
        )}
        {(addModal==="watched"||(addModal?.type==="watched")) && (
          <WatchedForm users={users} currentUser={currentUser}
            initial={addModal?.movie?{movie:addModal.movie}:null}
            onSave={addWatched} onClose={()=>setAddModal(null)}/>
        )}

        {/* header */}
        <div className="app-shell__header">
          <span className="app-shell__brand">
            Sessão <span className="app-shell__brand-accent">❤️</span>
          </span>
          <div className="app-shell__actions">
            <button onClick={handleSignOut} className="avatar-pill" title="Sair">
              <Avatar name={currentUser} size={22}/>
              <span className="avatar-pill__name">{currentUser}</span>
            </button>
            <button onClick={()=>setAddModal("watchlist")} className="action-btn action-btn--ghost">
              <Ic n="bookmark" s={14}/> Lista
            </button>
            <button onClick={()=>setAddModal("watched")} className="action-btn action-btn--primary">
              <Ic n="plus" s={14}/> Registrar
            </button>
          </div>
        </div>

        {/* pages */}
        <div className="app-shell__content">
          {page==="home"      && <HomePage      watched={watched} watchlist={watchlist} couple={couple} currentUser={currentUser} users={users}/>}
          {page==="diary"     && <DiaryPage     watched={watched} users={users} currentUser={currentUser}
                                   onDelete={e=>requestDelete(e,"watched")} onEdit={editWatched} onSaveReview={saveReview}/>}
          {page==="watchlist" && <WatchlistPage watchlist={watchlist} users={users} currentUser={currentUser}
                                   onDelete={e=>requestDelete(e,"watchlist")} onMarkWatched={markWatched}/>}
          {page==="profile"   && <ProfilePage   watched={watched} watchlist={watchlist} couple={couple} users={users}/>}
        </div>

        {/* bottom nav */}
        <div className="app-shell__nav">
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setPage(n.id)} className={`nav-item ${page===n.id?"nav-item--active":""}`}>
              <Ic n={n.icon} s={21}/>
              <span className="app-shell__nav-label">{n.label.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
