import { useState, useEffect, useRef, Component } from "react";
import { createPortal } from "react-dom";
import { auth, db } from "./firebase";
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut, GoogleAuthProvider,
} from "firebase/auth";
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, getDocs,
} from "firebase/firestore";
import { toPng } from "html-to-image";
import "./App.css";
import { Lumi, lumiSrc } from "./lumi.jsx";
import { buildReviewPayload, canWriteReview, getReviewOwnerName } from "./reviewPermissions.js";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const TMDB_BG   = "https://image.tmdb.org/t/p/w1280";

// Compartilhar como arte — card de designer do canvas v3
// (gradiente roxo-escuro, borda dourada, tipografia Cormorant, marca do Lumi)
async function generateSharePng(entry, users, format, shareNum = null) {
  await document.fonts.ready;
  const isStory = format === "story";
  const W = 1080, H = isStory ? 1920 : 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  const tryLoad = url => new Promise(resolve => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    const t = setTimeout(() => resolve(null), 5000);
    img.onload  = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); resolve(null); };
    img.src = url;
  });

  const [poster, lumiMark] = await Promise.all([
    tryLoad(entry.poster ? `${TMDB_IMG}${entry.poster}` : null),
    tryLoad("/assets/kit/ui_simplificado.png"),
  ]);

  const rr = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  };

  // fundo do app (roxo profundo)
  ctx.fillStyle = "#0d0a17";
  ctx.fillRect(0, 0, W, H);

  // card central
  const cw = isStory ? 760 : 700;
  const ch = isStory ? 1360 : 900;
  const cx0 = (W - cw) / 2, cy0 = (H - ch) / 2;

  ctx.save();
  rr(cx0, cy0, cw, ch, 72);
  const cg = ctx.createLinearGradient(cx0, cy0, cx0 + cw * 0.4, cy0 + ch);
  cg.addColorStop(0, "#1c1428"); cg.addColorStop(1, "#0a0710");
  ctx.fillStyle = cg;
  ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 90; ctx.shadowOffsetY = 40;
  ctx.fill();
  ctx.restore();
  rr(cx0, cy0, cw, ch, 72);
  ctx.strokeStyle = "rgba(201,153,58,0.45)"; ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = "center";
  let y = cy0 + (isStory ? 110 : 96);

  // eyebrow dourado
  ctx.font = "800 30px 'Inter', Arial, sans-serif";
  ctx.fillStyle = "#c9993a";
  const eyebrow = (shareNum ? `SESSÃO Nº ${shareNum}` : "SESSÃO ✦").split("").join("  ");
  ctx.fillText(eyebrow, W / 2, y);
  y += isStory ? 70 : 58;

  // pôster
  const ph = isStory ? 520 : 380;
  const pw = Math.round(ph * 2 / 3);
  const px = W / 2 - pw / 2;
  ctx.save();
  rr(px, y, pw, ph, 42);
  ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 60; ctx.shadowOffsetY = 26;
  ctx.fillStyle = "#2a1810";
  ctx.fill();
  ctx.restore();
  if (poster) {
    ctx.save();
    rr(px, y, pw, ph, 42);
    ctx.clip();
    const s = Math.max(pw / poster.naturalWidth, ph / poster.naturalHeight);
    ctx.drawImage(poster, px + (pw - poster.naturalWidth * s) / 2, y + (ph - poster.naturalHeight * s) / 2, poster.naturalWidth * s, poster.naturalHeight * s);
    ctx.restore();
  }
  y += ph + (isStory ? 84 : 70);

  // título em Cormorant (com quebra)
  const fs = isStory ? 76 : 64;
  ctx.font = `600 ${fs}px 'Cormorant Garamond', Georgia, serif`;
  ctx.fillStyle = "#f0ede8";
  const maxW2 = cw - 140;
  const lh = Math.round(fs * 1.08);
  const words = entry.title.split(" ");
  let linesArr = [], curLine = "";
  for (const w of words) {
    const t = curLine ? `${curLine} ${w}` : w;
    if (ctx.measureText(t).width > maxW2 && curLine) { linesArr.push(curLine); curLine = w; } else curLine = t;
  }
  if (curLine) linesArr.push(curLine);
  linesArr = linesArr.slice(0, 2);
  linesArr.forEach((l, i) => ctx.fillText(l, W / 2, y + i * lh));
  y += linesArr.length * lh + (isStory ? 8 : 4);

  // casal · data
  const dateLabel = entry.date
    ? new Date(entry.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "")
    : "";
  ctx.font = "500 32px 'Inter', Arial, sans-serif";
  ctx.fillStyle = "#9b98a3";
  ctx.fillText([users.join(" & "), dateLabel].filter(Boolean).join(" · "), W / 2, y + 30);
  y += isStory ? 92 : 78;

  // nota do casal (escala 10)
  const rs = users.map(u => entry.reviews?.[u]?.rating || 0).filter(Boolean);
  if (rs.length) {
    const avg = rs.reduce((a, b) => a + b, 0) / rs.length;
    ctx.font = "600 52px 'Inter', Arial, sans-serif";
    ctx.fillStyle = "#c9993a";
    ctx.fillText(`★ ${(avg * 2).toFixed(1).replace(".", ",")}`, W / 2, y);
    y += isStory ? 90 : 76;
  }

  // marca do Lumi
  if (lumiMark) {
    const ms = isStory ? 92 : 78;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(lumiMark, W / 2 - ms / 2, cy0 + ch - ms - (isStory ? 70 : 56), ms, ms);
    ctx.globalAlpha = 1;
  }

  try { return canvas.toDataURL("image/png"); }
  catch { return null; }
}

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
    // temporadas reais (sem "especiais" season 0) com contagem de episódios
    seasons: type==="tv"
      ? (d.seasons||[]).filter(s=>s.season_number>0).map(s=>({ season:s.season_number, episodeCount:s.episode_count, name:s.name }))
      : null,
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

// Lista de temporadas (com contagem) — usada quando o registro antigo não tem `seasons`
async function tmdbSeasonsList(id) {
  const d = await tmdbRequest(`/tv/${id}`, { language: "pt-BR" });
  return (d.seasons||[])
    .filter(s=>s.season_number>0)
    .map(s=>({ season:s.season_number, episodeCount:s.episode_count, name:s.name }));
}

// Episódios reais de uma temporada
async function tmdbSeason(id, seasonNumber) {
  const d = await tmdbRequest(`/tv/${id}/season/${seasonNumber}`, { language: "pt-BR" });
  return (d.episodes||[]).map(e=>({
    season: e.season_number,
    episode: e.episode_number,
    name: e.name || `Episódio ${e.episode_number}`,
    airDate: e.air_date || null,
    still: e.still_path || null,
    overview: e.overview || null,
    runtime: e.runtime || null,
  }));
}

// Um episódio (s,e) foi assistido se está em qualquer ponto ATÉ o marcador —
// temporadas anteriores completas + a temporada atual até o episódio marcado.
function episodeWatched(s, e, marker) {
  if (!marker) return false;
  return s < marker.season || (s === marker.season && e <= marker.episode);
}

// Total de episódios assistidos ATÉ o marcador (temporadas anteriores completas + atual)
function episodesWatchedCount(marker, seasons) {
  if (!marker || !seasons?.length) return marker ? marker.episode : 0;
  let n = 0;
  for (const s of seasons) {
    if (s.season < marker.season) n += s.episodeCount || 0;
    else if (s.season === marker.season) n += Math.min(marker.episode, s.episodeCount || marker.episode);
  }
  return n;
}
function episodesTotal(seasons) {
  return (seasons || []).reduce((a, s) => a + (s.episodeCount || 0), 0);
}

// Próximo episódio disponível a partir do marcador atual (usa temporadas reais)
function nextEpisodeOf(last, seasons) {
  if (!seasons?.length) {
    if (!last) return { season: 1, episode: 1 };
    return { season: last.season, episode: (last.episode || 0) + 1 };
  }
  if (!last) return { season: seasons[0].season, episode: 1 };
  const s = seasons.find(x => x.season === last.season);
  if (s && last.episode < s.episodeCount) return { season: last.season, episode: last.episode + 1 };
  const idx = seasons.findIndex(x => x.season === last.season);
  const nextS = seasons[idx + 1];
  if (nextS) return { season: nextS.season, episode: 1 };
  return null; // maratonaram tudo
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
    play:     "M5 3l14 9-14 9V3z",
    grid4:    "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    list:     "M9 6h11 M9 12h11 M9 18h11 M4 6h.01 M4 12h.01 M4 18h.01",
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
const Overlay = ({ children, onClose }) => createPortal(
  <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }} className="modal-backdrop">
    {children}
  </div>,
  document.body
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
// busca premium — "Nova sessão · o que vocês assistiram hoje?" (v3)
const SearchModal = ({ onSelect, onClose, headTitle = "Nova sessão", headSub = "o que vocês assistiram hoje?", headLumi = "tooltip" }) => {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [picked, setPicked] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef();

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);
  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.length < 2) { setRes([]); setError(""); return; }
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
              ? "TMDB recusou a credencial. Verifique o token no .env."
              : "Não foi possível buscar agora."
        );
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const pick = async r => {
    setPicked(r.id);
    setFetching(true);
    setError("");
    try {
      const full = await tmdbFetch(r.id, r.media_type);
      onSelect({
        tmdbId: r.id, type: r.media_type,
        title: full.title || r.title || r.name,
        poster: full.poster || r.poster_path || null,
        backdrop: full.backdrop || r.backdrop_path || null,
        overview: full.overview || r.overview || null,
        year: full.year || (r.release_date || r.first_air_date || "").slice(0, 4),
        tmdbRating: full.tmdbRating || (r.vote_average?.toFixed(1)) || null,
        genres: full.genres || [],
        runtime: full.runtime || null,
        numberOfSeasons: full.numberOfSeasons || null,
        cast: full.cast || [],
        director: full.director || null,
        imdbId: full.imdbId || null,
      });
    } catch (error) {
      setError(
        error.message === "TMDB_AUTH_MISSING"
          ? "Defina VITE_TMDB_READ_TOKEN ou VITE_TMDB_API_KEY no arquivo .env."
          : "Não foi possível carregar os detalhes do título."
      );
      setPicked(null);
    } finally {
      setFetching(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <Modal title="" onClose={onClose} maxW={520}>
        <div className="ns-head">
          <img src={lumiSrc(headLumi)} alt=""/>
          <div>
            <div className="ns-head__t">{headTitle}</div>
            <div className="ns-head__s">{headSub}</div>
          </div>
        </div>

        <div className="search-pill" style={{ marginTop: 14 }}>
          <span className="search-pill__icon"><Ic n="search" s={16}/></span>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="nome do filme ou série..." disabled={fetching}/>
          {loading && <span className="quick-add-card__spin"/>}
          {q && !loading && (
            <button className="search-pill__clear" onClick={() => { setQ(""); setRes([]); }} aria-label="Limpar">
              <Ic n="x" s={14}/>
            </button>
          )}
        </div>

        {error && <div className="search-error">{error}</div>}

        {res.length > 0 && (
          <div className="ns-grid">
            {res.slice(0, 6).map(r => (
              <button key={r.id} onClick={() => !fetching && pick(r)}
                className={`ns-result ${picked === r.id ? "ns-result--sel" : ""}`}>
                {r.poster_path
                  ? <img src={`${TMDB_IMG}${r.poster_path}`} alt="" className="ns-result__img"/>
                  : <div className="ns-result__img"/>}
                <span className="ns-result__label">
                  {(r.title || r.name)}{(r.release_date || r.first_air_date) ? ` (${(r.release_date || r.first_air_date).slice(0, 4)})` : ""}
                </span>
              </button>
            ))}
          </div>
        )}

        {fetching && <div className="search-loading">O Lumi está buscando os detalhes...</div>}
        {!fetching && q.length >= 2 && !loading && res.length === 0 && !error && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>
            <img src={lumiSrc("confuso")} alt="" style={{ width: 54, height: 54, objectFit: "contain" }}/>
            <div className="lumi-note__text">"Hmm, não achei esse. Confere o nome?"</div>
          </div>
        )}
      </Modal>
    </Overlay>
  );
};

// season pills
const SeasonPills = ({ count, selected, onChange }) => {
  const toggle = s => onChange(selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s].sort((a, b) => a - b));
  return (
    <div className="season-group">
      {Array.from({ length: count }, (_, i) => i + 1).map(s => (
        <button key={s} onClick={() => toggle(s)}
          className={`season-pill ${selected.includes(s) ? "season-pill--active" : ""}`}>
          T{s}
        </button>
      ))}
    </div>
  );
};

// watched form — bottom sheet premium "A nota do casal" (v3, shared Add + Edit)
const WatchedForm = ({ users, currentUser, initial, onSave, onClose, title }) => {
  const [step, setStep] = useState(initial?.movie ? 1 : 0);
  const [movie, setMovie] = useState(initial?.movie || null);
  const [where, setWhere] = useState(initial?.where || "streaming");
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10));
  const [reviews, setReviews] = useState(() => ({
    [currentUser]: {
      rating: initial?.reviews?.[currentUser]?.rating || 0,
      text: initial?.reviews?.[currentUser]?.text || "",
    },
  }));
  const [seasonsWatched, setSeasonsWatched] = useState(initial?.seasonsWatched || []);
  const [seriesStatus, setSeriesStatus] = useState(initial?.status || "completed");
  const [together, setTogether] = useState(initial?.watchedTogether !== false);

  const setReview = (user, field, val) => setReviews(r => ({ ...r, [user]: { ...r[user], [field]: val } }));

  // nota do casal ao vivo (média das notas dadas)
  const given = [reviews[currentUser]?.rating || 0].filter(Boolean);
  const liveAvg = given.length ? given.reduce((a, b) => a + b, 0) / given.length : 0;

  const handleSave = () => {
    if (!movie) return;
    const ownerName = currentUser;
    const reviewPayload = {
      [ownerName]: {
        rating: reviews[ownerName]?.rating || 0,
        text: reviews[ownerName]?.text || "",
      },
    };
    const allowed = canWriteReview({ currentUserName: ownerName, reviewData: reviewPayload, previousReviews: initial?.reviews || {} });
    if (!allowed) return;
    onSave({
      id: initial?.id || Date.now().toString(),
      ...movie,
      where, date, reviews: buildReviewPayload({ currentUserName: ownerName, previousReviews: initial?.reviews || {}, nextReview: reviewPayload[ownerName] }),
      seasonsWatched,
      status: movie.type === "tv" ? seriesStatus : "completed",
      watchedTogether: together,
      // séries em andamento: o marcador de episódio é definido no navegador real
      // (TMDB) pelo botão "Escolher onde pararam" — sem contador manual aqui.
      addedBy: initial?.addedBy || currentUser,
      createdAt: initial?.createdAt || new Date().toISOString(),
    });
  };

  if (step === 0) return <SearchModal onSelect={m => { setMovie(m); setStep(1); }} onClose={onClose}/>;

  return (
    <Overlay onClose={onClose}>
      <Modal title="" onClose={onClose} maxW={520}>
        <div className="ns-head">
          <img src={lumiSrc("tooltip")} alt=""/>
          <div>
            <div className="ns-head__t">{title || "Nova sessão"}</div>
            <div className="ns-head__s">{movie.title}{movie.year ? ` · ${movie.year}` : ""}</div>
          </div>
          {!initial && (
            <button onClick={() => setStep(0)} className="edit-switch" style={{ marginLeft: "auto" }}>trocar</button>
          )}
        </div>

        <div className="preview-row" style={{ marginTop: 14 }}>
          {movie.poster
            ? <img src={`${TMDB_IMG}${movie.poster}`} alt="" className="preview-poster"/>
            : <div className="preview-poster preview-poster--fallback"><Ic n="film" s={22} className="icon-muted"/></div>}
          <div className="preview-meta">
            <div className="preview-title">{movie.title}</div>
            <div className="preview-meta__line">{movie.type === "tv" ? "Série" : "Filme"} · {movie.year}</div>
            {movie.genres?.length > 0 && <div className="preview-meta__line preview-meta__line--muted">{movie.genres.slice(0, 3).join(" · ")}</div>}
          </div>
        </div>

        {movie.type === "tv" && (
          <div className="field-block">
            <Label>Status da série</Label>
            <SegBtn options={[["watching", "Assistindo"], ["completed", "Concluída"], ["dropped", "Abandonada"]]}
              value={seriesStatus} onChange={setSeriesStatus}
              colorMap={{ watching: "#8fd0c0", completed: "#22c55e", dropped: "#c9394a" }}/>
          </div>
        )}

        {movie.type === "tv" && movie.numberOfSeasons > 0 && (
          <div className="field-block">
            <Label>{seriesStatus === "watching" ? "Até onde chegaram?" : seriesStatus === "dropped" ? "Até onde foram?" : "Temporadas assistidas"}</Label>
            <SeasonPills count={movie.numberOfSeasons} selected={seasonsWatched} onChange={setSeasonsWatched}/>
          </div>
        )}

        {movie.type === "tv" && seriesStatus === "watching" && (
          <div className="field-block field-block--wide">
            <div className="ep-add-note">
              <img src={lumiSrc("tooltip")} alt=""/>
              <span>Depois de salvar, marquem <strong>onde vocês pararam</strong> pelos episódios reais da série, na tela dela.</span>
            </div>
          </div>
        )}

        <div className="field-block field-block--wide">
          <button type="button" onClick={() => setTogether(t => !t)}
            className={`together-toggle ${together ? "together-toggle--on" : ""}`}>
            <span className="together-toggle__check">{together ? "❤" : "○"}</span>
            <span className="together-toggle__body">
              <span className="together-toggle__title">Assistimos juntos</span>
              <span className="together-toggle__sub">Só conta o que vocês viram como casal</span>
            </span>
          </button>
        </div>

        <div className="field-block">
          <Label>Onde assistiram?</Label>
          <SegBtn options={[["cinema", "🎟 Cinema"], ["streaming", "Em casa"]]}
            value={where} onChange={setWhere} colorMap={{ cinema: "#c9993a", streaming: "#8fd0c0" }}/>
        </div>

        <div className="field-block field-block--wide">
          <Label>Data</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)}/>
        </div>

        {/* bottom sheet: a nota do casal */}
        <div className="ns-sheet">
          <img src={lumiSrc("bottomSheet")} alt="" className="ns-sheet__lumi" aria-hidden="true"/>
          <div className="ns-sheet__handle"/>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>A nota do casal</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            <div className="critica-card">
              <div className="critica-card__head">
                <AvaGrad name={currentUser} users={users}/>
                <span className="critica-card__name">Sua avaliação</span>
                <div className="ml-auto">
                  <Stars val={reviews[currentUser]?.rating} onChange={v => setReview(currentUser, "rating", v)} size={22}/>
                </div>
              </div>
              <textarea value={reviews[currentUser]?.text} onChange={e => setReview(currentUser, "text", e.target.value)}
                placeholder={`O que ${currentUser} achou?`} rows={2}
                className="review-card__textarea"/>
            </div>
          </div>

          <div className="ns-chips">
            <div className="ns-chip">
              <div className="ns-chip__who">{currentUser}</div>
              <div className="ns-chip__val">{reviews[currentUser]?.rating ? nota10(reviews[currentUser].rating) : "—"}</div>
            </div>
            <div className="ns-chip ns-chip--juntos">
              <div className="ns-chip__who">Juntos</div>
              <div className="ns-chip__val">{liveAvg ? nota10(liveAvg) : "—"}</div>
            </div>
          </div>

          <button onClick={handleSave} className="pill pill--primary pill--block" style={{ marginTop: 14 }}>
            Guardar memória
          </button>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", marginTop: 10 }}>
            um toque, e a memória está guardada
          </div>
        </div>
      </Modal>
    </Overlay>
  );
};

// watchlist form — "Lista a dois" (v3)
const AddWatchlistModal = ({ currentUser, onSave, onClose }) => {
  const [step, setStep] = useState(0);
  const [movie, setMovie] = useState(null);
  const [priority, setPriority] = useState("normal");
  const [note, setNote] = useState("");

  if (step === 0) return (
    <SearchModal onSelect={m => { setMovie(m); setStep(1); }} onClose={onClose}
      headTitle="Lista a dois" headSub="o que vocês querem ver juntos?" headLumi="pointing"/>
  );

  return (
    <Overlay onClose={onClose}>
      <Modal title="" onClose={onClose} maxW={460}>
        <div className="ns-head">
          <img src={lumiSrc("pointing")} alt=""/>
          <div>
            <div className="ns-head__t">Lista a dois</div>
            <div className="ns-head__s">guardar pra uma próxima noite</div>
          </div>
        </div>
        <div className="preview-row" style={{ marginTop: 14 }}>
          {movie.poster
            ? <img src={`${TMDB_IMG}${movie.poster}`} alt="" className="preview-poster"/>
            : <div className="preview-poster preview-poster--fallback"/>}
          <div>
            <div className="watchlist-title">{movie.title}</div>
            <div className="preview-meta__line">{movie.type === "tv" ? "Série" : "Filme"} · {movie.year}</div>
          </div>
        </div>
        <div className="field-block">
          <Label>Vontade de ver</Label>
          <SegBtn options={[["baixa", "Um dia"], ["normal", "Em breve"], ["alta", "❤ Muita"]]}
            value={priority} onChange={setPriority} colorMap={{ baixa: "#8fd0c0", normal: "#c9993a", alta: "#c9394a" }}/>
        </div>
        <div className="field-block field-block--wide">
          <Label>Por que indicar?</Label>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="conta por que querem assistir..." rows={2}
            className="note-textarea"/>
        </div>
        <button onClick={() => onSave({ id: Date.now().toString(), ...movie, priority, note, suggestedBy: currentUser, wantedBy: [currentUser], addedAt: new Date().toISOString() })}
          className="pill pill--primary pill--block" style={{ marginTop: 6 }}>
          Adicionar à lista ✦
        </button>
      </Modal>
    </Overlay>
  );
};

// roulette modal
const ROULETTE_COLORS = ["#c9394a", "#8b7ec8", "#c9993a", "#2a2050"];

const RouletteModal = ({ watchlist, onClose, onWatchNow }) => {
  const [typeFilter, setTypeFilter] = useState("all");
  const [rotation, setRotation]     = useState(0);
  const [spinning,  setSpinning]    = useState(false);
  const [result,    setResult]      = useState(null);

  const filtered = watchlist.filter(w =>
    typeFilter === "movie" ? w.type === "movie" :
    typeFilter === "tv"    ? w.type === "tv"    : true
  );

  // shuffle for variety if >12; keep stable per filter change via useMemo
  const wheelItems = filtered.length > 12
    ? [...filtered].sort(() => Math.random() - 0.5).slice(0, 12)
    : filtered;

  const numItems   = wheelItems.length;
  const SVG_SIZE   = 300;
  const cx = SVG_SIZE / 2, cy = SVG_SIZE / 2, r = SVG_SIZE / 2 - 2;

  const truncate = (s, max = 14) => s.length > max ? s.slice(0, max) + "…" : s;

  const spin = () => {
    if (spinning || numItems < 2) return;
    const sliceAngle  = 360 / numItems;
    const targetIndex = Math.floor(Math.random() * numItems);
    const currentMod  = ((rotation % 360) + 360) % 360;
    const targetAngle = ((360 - targetIndex * sliceAngle - sliceAngle / 2) % 360 + 360) % 360;
    const delta       = ((targetAngle - currentMod) + 360) % 360;
    const finalRot    = rotation + 5 * 360 + delta;
    setResult(null);
    setSpinning(true);
    setRotation(finalRot);
    setTimeout(() => { setSpinning(false); setResult(wheelItems[targetIndex]); }, 4100);
  };

  return createPortal(
    <div className="roulette-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="roulette-modal">
        <button className="roulette-close" onClick={onClose}><Ic n="x" s={20}/></button>

        <p className="roulette-subtitle" style={{ marginBottom: 2 }}>Não sabem o que ver?</p>
        <h2 className="roulette-title" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>Roleta da noite</h2>
        <Lumi name="roulette" size={120} breathe className="roulette-lumi" alt="Lumi girando a roleta" />

        <div className="roulette-pills">
          {[["all","Tudo"],["movie","Só filmes"],["tv","Só séries"]].map(([v,l]) => (
            <button key={v} onClick={() => { if (!spinning) { setTypeFilter(v); setResult(null); } }}
              className={`roulette-pill${typeFilter===v?" roulette-pill--active":""}`}>{l}</button>
          ))}
        </div>

        {numItems < 2 ? (
          <div className="roulette-empty">Poucos títulos com esse filtro</div>
        ) : (
          <>
            <div className={`roulette-wheel-wrap${result?" roulette-wheel-wrap--done":""}`}>
              <div className="roulette-pointer"/>
              <svg
                viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
                className="roulette-wheel"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? "transform 4s cubic-bezier(0.17,0.67,0.12,0.99)" : "none",
                }}
              >
                {wheelItems.map((item, i) => {
                  const sliceAngle = 360 / numItems;
                  const sa = (i * sliceAngle - 90) * Math.PI / 180;
                  const ea = ((i + 1) * sliceAngle - 90) * Math.PI / 180;
                  const x1 = cx + r * Math.cos(sa), y1 = cy + r * Math.sin(sa);
                  const x2 = cx + r * Math.cos(ea), y2 = cy + r * Math.sin(ea);
                  const large = sliceAngle > 180 ? 1 : 0;
                  const pathD = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`;
                  const ma = ((i + 0.5) * sliceAngle - 90) * Math.PI / 180;
                  const tr = r * 0.62;
                  const tx = cx + tr * Math.cos(ma), ty = cy + tr * Math.sin(ma);
                  const trot = (i + 0.5) * sliceAngle - 90;
                  return (
                    <g key={item.id || i}>
                      <path d={pathD} fill={ROULETTE_COLORS[i % 4]} stroke="#0d0d1a" strokeWidth="2"/>
                      <text
                        x={tx} y={ty}
                        transform={`rotate(${trot},${tx},${ty})`}
                        textAnchor="middle" dominantBaseline="middle"
                        fill="white" fontSize="11"
                        fontFamily="Inter,sans-serif" fontWeight="600"
                      >{truncate(item.title)}</text>
                    </g>
                  );
                })}
                <circle cx={cx} cy={cy} r={25} fill="#0d0d1a" stroke="#f0ede8" strokeWidth="3"/>
                <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle" fill="#c9394a" fontSize="18">♥</text>
              </svg>
            </div>

            {!result && (
              <button onClick={spin} disabled={spinning} className={`roulette-spin-btn${spinning?" roulette-spin-btn--spinning":""}`}>
                {spinning ? "Girando…" : "GIRAR"}
              </button>
            )}

            {result && (
              <div className="roulette-result">
                <div className="rl-result-card">
                  <div className="rl-result-card__label">a sorte escolheu</div>
                  <div className="rl-result-card__title">{result.title}</div>
                  <div className="rl-result-card__sub">
                    {result.type === "tv" ? "série" : "filme"}
                    {result.runtime ? ` · cabe em ${Math.floor(result.runtime/60)}h${result.runtime%60 ? String(result.runtime%60).padStart(2,"0") : ""} da noite de vocês` : result.year ? ` · ${result.year}` : ""}
                  </div>
                </div>
                <div className="roulette-result__actions" style={{ display: "flex", gap: 10, width: "100%", marginTop: 14 }}>
                  <button onClick={() => onWatchNow(result)} className="pill pill--primary" style={{ flex: 1 }}>Aceitar destino ✦</button>
                  <button onClick={() => setResult(null)} className="pill pill--outline pill--sm">Girar de novo</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

// ---------- helpers do design v3 ----------
// Notas exibidas na escala 0–10 do design (média das estrelas ×2, vírgula pt-BR)
const nota10 = v => (v * 2).toFixed(1).replace(".", ",");
// Saudação contextual do header da Home ("Quarta à noite ✦")
const contextGreeting = () => {
  const d = new Date();
  const dias = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  const h = d.getHours();
  const periodo = h < 6 ? "de madrugada" : h < 12 ? "de manhã" : h < 18 ? "à tarde" : "à noite";
  return `${dias[d.getDay()]} ${periodo}`;
};
// Compatibilidade do casal: 100% - diferença média de notas (em % de 5 estrelas)
const coupleCompat = (watched, users) => {
  if (users.length < 2) return null;
  const diffs = watched
    .map(w => users.map(u => w.reviews?.[u]?.rating || 0))
    .filter(r => r.every(x => x > 0))
    .map(([a, b]) => Math.abs(a - b));
  if (!diffs.length) return null;
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  return Math.round(100 - (avgDiff / 5) * 100);
};
const mediaEntry = e => {
  const rs = Object.values(e.reviews || {}).map(r => r.rating).filter(Boolean);
  return rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0;
};
// avatar gradiente do design: 1º nome = vermelho, 2º = azul-petróleo
const AvaGrad = ({ name, users, size = 26 }) => (
  <div className={`critica-card__ava ${users?.[0] === name ? "critica-card__ava--a" : "critica-card__ava--b"}`}
    style={{ width: size, height: size, fontSize: size * 0.46, fontFamily: size >= 40 ? "var(--font-display)" : undefined }}>
    {name?.[0]?.toUpperCase() || "?"}
  </div>
);

// Veredito fofo do casal conforme a diferença entre as duas notas (0 a 4+)
const COUPLE_VERDICTS = [
  { emoji:"💞", label:"Em perfeita sintonia" },
  { emoji:"💕", label:"Quase a mesma vibe" },
  { emoji:"🍿", label:"Gostos diferentes" },
  { emoji:"🎭", label:"Opiniões opostas" },
  { emoji:"🙃", label:"Polos opostos" },
];
const coupleVerdict = diff => COUPLE_VERDICTS[Math.min(diff,4)];
// detail modal — "Detalhe do filme · crítica do casal" + série (v3)
const DetailModal = ({ entry, users, onClose, onMarkWatched, onEdit, onSaveReview, currentUser, fromWatchlist, onUpdateStatus, onContinueEpisode, onToggleTogether, onDelete, onAlsoWant, prefs }) => {
  const [inlineRating, setInlineRating] = useState(0);
  const [inlineText, setInlineText] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [editingMine, setEditingMine] = useState(false);
  const [statusDropdown, setStatusDropdown] = useState(false);
  const statusRef = useRef(null);
  const [shareFormat, setShareFormat] = useState("story");
  const [shareLoading, setShareLoading] = useState(false);
  const [capturedDataUrl, setCapturedDataUrl] = useState(null);
  const [providers, setProviders] = useState(null);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    if (!statusDropdown) return;
    const close = e => { if (statusRef.current && !statusRef.current.contains(e.target)) setStatusDropdown(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [statusDropdown]);

  useEffect(() => {
    if (!entry.tmdbId) { setProviders({ flatrate:[], link:null }); return; }
    const ep = entry.type === "tv" ? "tv" : "movie";
    tmdbRequest(`/${ep}/${entry.tmdbId}/watch/providers`)
      .then(data => {
        const br = data.results?.BR;
        setProviders({ flatrate: br?.flatrate||[], link: br?.link||null });
      })
      .catch(() => setProviders({ flatrate:[], link:null }));
  }, []);

  const poster   = entry.poster   ? `${TMDB_IMG}${entry.poster}` : null;
  const backdrop = entry.backdrop ? `${TMDB_BG}${entry.backdrop}` : null;
  const myReview = entry.reviews?.[currentUser];
  const hasMyReview = myReview?.rating || myReview?.text;

  // nota do casal (escala 10 do design)
  const coupleRatings = users.map(u => entry.reviews?.[u]?.rating || 0);
  const bothRated = !fromWatchlist && users.length === 2 && coupleRatings.every(r => r > 0);
  const anyRated = !fromWatchlist && coupleRatings.some(r => r > 0);
  const coupleAvg = anyRated ? coupleRatings.filter(Boolean).reduce((a, b) => a + b, 0) / coupleRatings.filter(Boolean).length : null;
  const ratingDiff = bothRated ? Math.abs(coupleRatings[0] - coupleRatings[1]) : 0;
  const verdict = bothRated ? coupleVerdict(ratingDiff) : null;

  const startEditMine = () => {
    setInlineRating(myReview?.rating || 0);
    setInlineText(myReview?.text || "");
    setEditingMine(true);
  };

  const handleInlineSave = async () => {
    setSavingReview(true);
    try {
      await onSaveReview(entry.id, currentUser, { rating: inlineRating, text: inlineText });
    } finally {
      setSavingReview(false);
      setEditingMine(false);
    }
  };

  const handleFormatChange = v => {
    setShareFormat(v);
    if (capturedDataUrl) setCapturedDataUrl(null);
  };
  const handleShare = async () => {
    setShareLoading(true);
    setCapturedDataUrl(null);
    const url = await generateSharePng(entry, users, shareFormat);
    setCapturedDataUrl(url);
    setShareLoading(false);
  };
  const handleDownload = () => {
    if (!capturedDataUrl) return;
    const a = document.createElement("a");
    a.href = capturedDataUrl;
    a.download = `sessao-${entry.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.png`;
    a.click();
  };
  const handleWebShare = async () => {
    if (!capturedDataUrl) return;
    try {
      const res = await fetch(capturedDataUrl);
      const blob = await res.blob();
      const file = new File([blob], `sessao-${entry.title.slice(0, 20).replace(/\s+/g, "-")}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: entry.title });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  const fmtDur = m => m ? `${Math.floor(m / 60)}h${m % 60 > 0 ? String(m % 60).padStart(2, "0") : ""}` : null;
  const fmtRevDate = () => entry.date ? new Date(entry.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "") : "";

  // insight contextual do Lumi: maior nota do casal no gênero?
  const lumiInsight = (() => {
    if (prefs?.lumiComments === false || fromWatchlist || !coupleAvg) return null;
    const g = entry.genres?.[0];
    return { lumi: coupleAvg >= 4.5 ? "chorando_emocao" : coupleAvg >= 3.5 ? "feliz" : "pensativo",
      text: coupleAvg >= 4.5 && g ? `"Uma das maiores notas de vocês em ${g.toLowerCase()}."`
        : verdict ? `"${verdict.label}${verdict.emoji === "💞" ? ". Que sintonia." : "."}"` : null };
  })();

  // frase do Lumi no rodapé da série (ritmo)
  const serieQuote = (() => {
    if (prefs?.lumiComments === false || entry.type !== "tv" || fromWatchlist) return null;
    const hist = entry.episodeHistory || [];
    if (hist.length < 2) return null;
    const days = [...new Set(hist.slice(-5).map(h => h.date))];
    if (days.length >= 3) return `"${days.length} noites seguidas. Que maratona ✦"`;
    return `"Vocês têm um ritmo bom. Continuem."`;
  })();

  // idade na watchlist (badge do design)
  const wlMonths = fromWatchlist && entry.addedAt ? Math.floor((new Date() - new Date(entry.addedAt)) / 2592000000) : 0;

  return (
    <Overlay onClose={onClose}>
      <Modal title="" onClose={onClose} maxW={560}
        banner={(
          <div className="mdetail-banner">
            {backdrop && <img src={backdrop} alt="" className="mdetail-banner__bg"/>}
            <div className="mdetail-banner__fade"/>
            <div className="mdetail-banner__row">
              {poster
                ? <img src={poster} alt="" className="mdetail-banner__poster"/>
                : <div className="mdetail-banner__poster"/>}
              <div style={{ paddingBottom: 4, minWidth: 0 }}>
                {entry.type === "tv" && !fromWatchlist && (
                  <div className="mdetail-banner__eyebrow">Série{entry.status === "watching" ? " · assistindo juntos" : ""}</div>
                )}
                {fromWatchlist && wlMonths >= 1 && (
                  <span className="wl-age-badge">na watchlist há {wlMonths === 1 ? "1 mês" : `${wlMonths} meses`}</span>
                )}
                <div className="mdetail-banner__title">{entry.title}</div>
                <div className="mdetail-banner__meta">
                  {[entry.year, entry.genres?.[0], fmtDur(entry.runtime)].filter(Boolean).join(" · ")}
                </div>
              </div>
            </div>
          </div>
        )}
      >
        {/* nota do casal */}
        {anyRated && (
          <div className="nota-pair">
            <div className="nota-casal">
              <div className="nota-casal__label">NOTA DO CASAL</div>
              <div className="nota-casal__value">{nota10(coupleAvg)}</div>
            </div>
            <div className="nota-users">
              {users.map(u => {
                const r = entry.reviews?.[u]?.rating;
                return (
                  <div key={u} className="nota-users__row">
                    <span>{u}</span><span>{r ? nota10(r) : "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* série: continuar assistindo */}
        {entry.type === "tv" && !fromWatchlist && onContinueEpisode && (() => {
          const last = entry.lastEpisode;
          const next = last ? nextEpisodeOf(last, entry.seasons) : null;
          const hist = [...(entry.episodeHistory || [])].slice(-3).reverse();
          const relDay = ds => {
            if (!ds) return "";
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const d = new Date(ds + "T12:00:00"); d.setHours(0, 0, 0, 0);
            const diff = Math.round((today - d) / 86400000);
            if (diff <= 0) return "Hoje";
            if (diff === 1) return "Ontem";
            if (diff < 7) return `${diff} dias atrás`;
            return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
          };
          const together = entry.watchedTogether !== false;
          return (
            <div className="field-block field-block--wide">
              <div className="ep-tracker">
                <div className="ep-tracker__eyebrow">{last ? "Vocês pararam em" : "Progresso da série"}</div>
                <div className="ep-tracker__stopped">{last ? `T${last.season} · Episódio ${last.episode}` : "Ainda sem marcador"}</div>
                {last?.name && <div className="ep-tracker__epname">{last.name}</div>}
                {last?.date && <div className="ep-tracker__date">Assistido {relDay(last.date)}</div>}
                {next && <div className="ep-tracker__next">▶ A seguir: T{next.season} · Episódio {next.episode}</div>}
                <button className="ep-tracker__btn" onClick={() => onContinueEpisode(entry)}>
                  {last ? "Continuar assistindo" : "Escolher onde pararam"}
                </button>
                {onToggleTogether && (
                  <button className={`ep-toggle ${together ? "ep-toggle--on" : ""}`} onClick={() => onToggleTogether(entry)}>
                    {together ? "❤ Assistimos juntos" : "○ Marcar como assistido juntos"}
                  </button>
                )}
                <div className="ep-toggle__hint">Só conta o que vocês viram como casal</div>
              </div>

              {hist.length > 0 && (
                <>
                  <Label>O ritmo de vocês</Label>
                  <div className="ep-history">
                    {hist.map((h, i) => (
                      <div key={i} className="ep-history__row" style={{ animationDelay: `${i * 60}ms` }}>
                        <span className="ep-history__check">✔</span>
                        <span className="ep-history__label">T{h.season}E{h.episode}</span>
                        <span className="ep-history__when">{relDay(h.date)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {serieQuote && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                  <img src={lumiSrc("sitting")} alt="" style={{ width: 54, height: 54, objectFit: "contain" }}/>
                  <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 17, color: "#c9b8c0" }}>{serieQuote}</div>
                </div>
              )}
            </div>
          );
        })()}

        {/* status da série */}
        {entry.type === "tv" && !fromWatchlist && onUpdateStatus && (
          <div className="status-update-wrap" ref={statusRef}>
            <button onClick={() => setStatusDropdown(d => !d)} className="status-update-link">
              {entry.status === "watching" ? "● Assistindo" : entry.status === "dropped" ? "● Abandonada" : "● Concluída"} · atualizar →
            </button>
            {statusDropdown && (
              <div className="status-mini-dropdown">
                {[["watching", "Assistindo"], ["completed", "Concluída"], ["dropped", "Abandonada"]].map(([v, l]) => (
                  <button key={v}
                    className={`status-mini-item ${(entry.status || "completed") === v ? "status-mini-item--active" : ""}`}
                    onClick={async () => { await onUpdateStatus(entry.id, v); setStatusDropdown(false); }}>
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* a crítica do casal */}
        {!fromWatchlist && entry.reviews && Object.values(entry.reviews).some(r => r.rating || r.text) && (
          <div className="field-block field-block--wide">
            <Label>A crítica do casal</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
              {users.map(u => {
                const rev = entry.reviews?.[u];
                if (!rev || (!rev.rating && !rev.text) || (u === currentUser && editingMine)) return null;
                return (
                  <div key={u} className="critica-card">
                    <div className="critica-card__head">
                      <AvaGrad name={u} users={users}/>
                      <span className="critica-card__name">{u}</span>
                      {rev.rating > 0 && <span className="critica-card__stars"><Stars val={rev.rating} size={13}/></span>}
                      <span className="critica-card__date">{fmtRevDate()}</span>
                      {u === currentUser && onSaveReview && (
                        <button className="review-edit-btn" onClick={startEditMine}>editar</button>
                      )}
                    </div>
                    {rev.text && <p className="critica-card__text">"{rev.text}"</p>}
                  </div>
                );
              })}
            </div>
            {lumiInsight?.text && (
              <div className="lumi-insight">
                <img src={lumiSrc(lumiInsight.lumi)} alt="Lumi"/>
                <div className="lumi-insight__text">{lumiInsight.text}</div>
              </div>
            )}
          </div>
        )}

        {/* aguardando crítica */}
        {!fromWatchlist && users.map(u => {
          const r = entry.reviews?.[u];
          if (r?.rating || r?.text) return null;
          if (u === currentUser) return null;
          return (
            <div key={u} className="awaiting-card">
              <AvaGrad name={u} users={users} size={20}/>
              <span className="awaiting-card__text">Aguardando a crítica de {u}</span>
            </div>
          );
        })}

        {/* sua avaliação (inline) */}
        {!fromWatchlist && onSaveReview && (!hasMyReview || editingMine) && (
          <div className="inline-review">
            <div className="inline-review__title">{editingMine ? "Editar sua crítica" : "Vocês assistiram — qual foi a sua nota?"}</div>
            <div className="inline-review__rating-row">
              <AvaGrad name={currentUser} users={users} size={24}/>
              <Stars val={inlineRating} onChange={setInlineRating} size={22}/>
            </div>
            <textarea value={inlineText} onChange={e => setInlineText(e.target.value)}
              placeholder="Sua crítica..." rows={2}
              className="review-inline__textarea"/>
            <div className="inline-review__actions">
              {editingMine && (
                <button onClick={() => setEditingMine(false)} className="review-inline__button review-inline__button--ghost">
                  Cancelar
                </button>
              )}
              <button onClick={handleInlineSave} disabled={savingReview || !inlineRating}
                className="review-inline__button">
                {savingReview ? "Salvando..." : (editingMine ? "Salvar alterações" : "Salvar crítica")}
              </button>
            </div>
          </div>
        )}

        {/* onde assistir */}
        {entry.tmdbId && (
          <div className="field-block field-block--wide">
            <Label>Onde assistir</Label>
            {providers === null ? (
              <p className="providers-loading">Verificando...</p>
            ) : (
              <>
                {providers.flatrate.length > 0 ? (
                  <div className="providers-row">
                    {providers.flatrate.slice(0, 6).map(p => (
                      <div key={p.provider_id} className="provider-chip" title={p.provider_name}>
                        <img src={`https://image.tmdb.org/t/p/w92${p.logo_path}`} alt={p.provider_name} className="provider-logo"/>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="providers-empty">Não disponível em streaming no Brasil</p>
                )}
                {providers.link && (
                  <a href={providers.link} target="_blank" rel="noopener noreferrer" className="justwatch-link">
                    <Ic n="link" s={11}/> Ver no JustWatch
                  </a>
                )}
              </>
            )}
          </div>
        )}

        {/* sinopse */}
        {entry.overview && (
          <div className="field-block field-block--wide">
            <Label>Sinopse</Label>
            <p className="detail-copy">{entry.overview}</p>
          </div>
        )}

        {/* elenco + imdb */}
        {entry.cast?.length > 0 && (
          <div className="field-block field-block--wide">
            <Label>Elenco{entry.director ? ` · direção de ${entry.director}` : ""}</Label>
            <div className="detail-tags">
              {entry.cast.map(c => <span key={c} className="detail-tag detail-tag--muted">{c}</span>)}
            </div>
            {entry.imdbId && (
              <a href={`https://www.imdb.com/title/${entry.imdbId}`} target="_blank" rel="noopener noreferrer" className="imdb-link" style={{ marginTop: 10 }}>
                <Ic n="link" s={12}/> IMDB{entry.tmdbRating ? ` · TMDB ★ ${entry.tmdbRating}` : ""}
              </a>
            )}
          </div>
        )}

        {/* compartilhar como arte */}
        {!fromWatchlist && showShare && (
          <div className="share-section">
            <Label>Compartilhar como arte</Label>
            <div className="share-format-row">
              {[["story", "Stories 9:16"], ["square", "Feed 1:1"]].map(([v, l]) => (
                <button key={v} onClick={() => handleFormatChange(v)}
                  className={`chip ${shareFormat === v ? "chip--active" : ""}`}>
                  {l}
                </button>
              ))}
            </div>
            {!capturedDataUrl && !shareLoading && (
              <button onClick={handleShare} className="pill pill--light pill--block" style={{ marginTop: 12 }}>Gerar a arte ✦</button>
            )}
            {shareLoading && <div className="share-loading">O Lumi está caprichando na arte...</div>}
            {capturedDataUrl && !shareLoading && (
              <div className="share-done">
                <img src={capturedDataUrl} alt="" className="share-preview"/>
                <div className="share-actions">
                  <button onClick={handleWebShare} className="pill pill--light" style={{ flex: 1 }}>Compartilhar nos stories ✦</button>
                  <button onClick={handleDownload} className="pill pill--outline pill--sm">Salvar</button>
                </div>
                <button onClick={handleShare} className="share-reset">↺ Gerar de novo</button>
              </div>
            )}
          </div>
        )}

        {/* watchlist: quem adicionou + virar memória */}
        {fromWatchlist && (
          <>
            {prefs?.lumiComments !== false && (
              <div className="lumi-insight" style={{ marginTop: 16 }}>
                <img src={lumiSrc("pointing")} alt="Lumi"/>
                <div className="lumi-insight__text">
                  {wlMonths >= 2 ? `"Esse está esperando faz tempo. Hoje é a noite?"` : `"Boa escolha pra próxima sessão de vocês."`}
                </div>
              </div>
            )}
            {entry.note && (
              <div className="field-block field-block--wide">
                <Label>Por que assistir</Label>
                <p className="detail-copy detail-copy--italic">"{entry.note}"</p>
              </div>
            )}
            {(() => {
              const wanted = entry.wantedBy?.length ? entry.wantedBy : [entry.suggestedBy].filter(Boolean);
              const both = users.length === 2 && users.every(u => wanted.includes(u));
              const iWant = wanted.includes(currentUser);
              return (
                <div className="field-block field-block--wide">
                  <Label>{both ? "❤️ Os dois querem ver" : "Quem quer ver"}</Label>
                  <div className="wl-who">
                    {users.map(u => (
                      <div key={u} className={`wl-who__chip ${wanted.includes(u) ? "wl-who__chip--on" : ""}`}>
                        <AvaGrad name={u} users={users}/>
                        <span>{u}{wanted.includes(u) ? " quer" : <span style={{ color: "var(--text-tertiary)" }}> ainda não</span>}</span>
                      </div>
                    ))}
                  </div>
                  {!both && !iWant && onAlsoWant && (
                    <button className="pill pill--gold-outline pill--block" style={{ marginTop: 10 }}
                      onClick={() => onAlsoWant(entry)}>
                      ❤ Eu também quero ver
                    </button>
                  )}
                  {both && (
                    <div className="ep-toggle__hint" style={{ marginTop: 8 }}>vontade combinada — sessão marcada no coração ✦</div>
                  )}
                </div>
              );
            })()}
            {onMarkWatched && (
              <div className="wl-swipe" onClick={() => onMarkWatched(entry)} role="button" tabIndex={0}>
                <div className="wl-swipe__hint">toque para marcar como assistido</div>
                <div className="wl-swipe__track">
                  <div className="wl-swipe__knob">✔</div>
                  <span className="wl-swipe__label">Assistimos juntos →</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ações */}
        <div className="detail-actions">
          {fromWatchlist ? (
            <>
              {onMarkWatched && <button className="pill pill--primary" onClick={() => onMarkWatched(entry)}>Registrar sessão</button>}
              {onDelete && <button className="pill pill--outline pill--sm" onClick={onDelete}>Remover</button>}
            </>
          ) : (
            <>
              <button className="pill pill--primary" onClick={() => setShowShare(s => !s)}>Compartilhar ✦</button>
              {onEdit && <button className="pill pill--outline pill--sm" onClick={onEdit}>Editar</button>}
              {onDelete && <button className="pill pill--outline pill--sm" onClick={onDelete} aria-label="Excluir"><Ic n="trash" s={15}/></button>}
            </>
          )}
        </div>
      </Modal>
    </Overlay>
  );
};


// ============================================================
// V3 — Lumi identity components
// ============================================================

// Splash — premium first-paint while auth resolves
const SplashScreen = ({ leaving }) => (
  <div className={`splash ${leaving ? "splash--out" : ""}`}>
    <div className="splash__glow" aria-hidden="true" />
    <Lumi name="projector" size={186} breathe glow className="splash__lumi" alt="Sessão" />
    <div className="splash__logo">Sessão</div>
    <div className="splash__tagline">o álbum de vocês</div>
    <div className="splash__dots" aria-hidden="true"><span/><span/><span/></div>
  </div>
);

// Content skeleton — shown while the couple's data streams in
const ContentSkeleton = () => (
  <div className="v3-loading">
    <div className="v3-loading__lumi">
      <Lumi name="popcornFlying" size={140} breathe />
      <div className="v3-loading__caption">"Preparando a sessão..."</div>
    </div>
    <div className="skel-stack">
      <div className="skel" style={{ height: 150 }} />
      <div className="skel-row">
        <div className="skel" style={{ flex: 1, height: 86 }} />
        <div className="skel" style={{ flex: 1, height: 86 }} />
      </div>
      {[0, 1, 2].map(i => (
        <div key={i} className="skel-row" style={{ alignItems: "center" }}>
          <div className="skel" style={{ width: 48, height: 68, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="skel skel-line" style={{ width: "70%" }} />
            <div className="skel skel-line" style={{ width: "45%" }} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Generic Lumi state — empty / offline / error
const LumiState = ({ lumi = "empty", title, text, quote, cta, onCta, breathe = true, ctaVariant = "primary" }) => (
  <div className="lumi-state">
    <Lumi name={lumi} size={196} breathe={breathe} />
    {title && <div className="lumi-state__title">{title}</div>}
    {text && <p className="lumi-state__text">{text}</p>}
    {quote && <div className="lumi-state__quote">{quote}</div>}
    {cta && (
      ctaVariant === "primary"
        ? <button className="lumi-state__cta" onClick={onCta}>{cta}</button>
        : <button className={`pill pill--${ctaVariant}`} style={{ marginTop: 24 }} onClick={onCta}>{cta}</button>
    )}
  </div>
);

// Confetti burst layer — peças geradas no module scope pra manter o render puro
const CONFETTI_COLORS = ["#c9394a", "#c9993a", "#8fd0c0", "#8b7ec8", "#dcb464"];
const CONFETTI_PIECES = Array.from({ length: 44 }, () => ({
  left: Math.random() * 100,
  delay: Math.random() * 0.6,
  dur: 2.6 + Math.random() * 1.8,
  color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
  rot: Math.random() * 360,
}));
const Confetti = ({ count = 44 }) => {
  const pieces = CONFETTI_PIECES.slice(0, count);
  return createPortal(
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i key={i} style={{
          left: `${p.left}%`,
          background: p.color,
          transform: `rotate(${p.rot}deg)`,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.dur}s`,
        }} />
      ))}
    </div>,
    document.body
  );
};

// Celebration modal — episode completed & milestones
const CelebrateModal = ({ variant = "episode", lumi, eyebrow, title, quote, nextLabel, nextValue,
  primaryLabel = "Salvar", onPrimary, secondaryLabel, onSecondary, hint, onClose, confetti = false }) => (
  createPortal(
    <div className="celebrate-backdrop" onClick={e => e.target === e.currentTarget && onClose?.()}>
      {confetti && <Confetti />}
      <div className={`celebrate ${variant === "milestone" ? "celebrate--gold" : ""}`}>
        <div className="celebrate__glow" aria-hidden="true" />
        {lumi && <Lumi name={lumi} size={variant === "milestone" ? 210 : 130} breathe className="celebrate__lumi" />}
        {eyebrow && <div className="celebrate__eyebrow">{eyebrow}</div>}
        {variant === "episode" && <div className="celebrate__check">✔</div>}
        <div className="celebrate__title">{title}</div>
        {quote && <div className="celebrate__quote">{quote}</div>}
        {nextValue && (
          <div className="celebrate__next">
            <div className="celebrate__next-label">{nextLabel || "Próximo"}</div>
            <div className="celebrate__next-value">{nextValue}</div>
          </div>
        )}
        <div className="celebrate__actions">
          {secondaryLabel && (
            <button className="celebrate__btn celebrate__btn--ghost" onClick={onSecondary}>{secondaryLabel}</button>
          )}
          <button
            className={`celebrate__btn ${variant === "milestone" ? "celebrate__btn--light" : "celebrate__btn--primary"}`}
            onClick={onPrimary}
          >{primaryLabel}</button>
        </div>
        {hint && <div className="celebrate__hint">{hint}</div>}
      </div>
    </div>,
    document.body
  )
);

// EpisodeSheet — navegador de episódios estilo streaming (dados reais da TMDB).
// Dois modos:
//  • "continue": abre direto no próximo episódio marcado. "Concluímos" salva no
//    histórico e sugere o próximo automaticamente (sem reabrir a seleção).
//  • "browse": lista real de temporadas/episódios; toque = definir o marcador.
//    Usado ao ajustar o marcador ou quando a série ainda não tem progresso.
const EpisodeSheet = ({ entry, coupleId, onClose, addToast }) => {
  const hasMarker = !!entry.lastEpisode;
  const [mode, setMode] = useState(hasMarker ? "continue" : "browse");
  const [seasons, setSeasons] = useState(entry.seasons || null);
  const [activeSeason, setActiveSeason] = useState(entry.lastEpisode?.season || entry.seasons?.[0]?.season || 1);
  const [episodesBySeason, setEpisodesBySeason] = useState({});
  const [nextInfo, setNextInfo] = useState(null); // {season, episode, name, still, overview, airDate}
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const together = entry.watchedTogether !== false;

  const marker = entry.lastEpisode || null;

  // 1) garante a lista de temporadas
  useEffect(() => {
    if (seasons?.length) return;
    if (!entry.tmdbId) { setSeasons([]); return; }
    let alive = true;
    tmdbSeasonsList(entry.tmdbId)
      .then(s => { if (alive) { setSeasons(s); if (s[0] && !s.find(x => x.season === activeSeason)) setActiveSeason(s[0].season); } })
      .catch(() => alive && setSeasons([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // helper: busca episódios de uma temporada (com cache local)
  const loadSeason = async sNum => {
    if (episodesBySeason[sNum]) return episodesBySeason[sNum];
    if (!entry.tmdbId) return [];
    const eps = await tmdbSeason(entry.tmdbId, sNum);
    setEpisodesBySeason(prev => ({ ...prev, [sNum]: eps }));
    return eps;
  };

  // 2) modo browse: carrega a temporada ativa
  useEffect(() => {
    if (mode !== "browse" || seasons === null) return;
    setLoading(true);
    loadSeason(activeSeason).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeSeason, seasons]);

  // 3) modo continue: resolve o próximo episódio (nome real via TMDB)
  useEffect(() => {
    if (mode !== "continue" || seasons === null) return;
    const nxt = nextEpisodeOf(marker, seasons);
    if (!nxt) { setNextInfo("finished"); return; }
    setLoading(true);
    loadSeason(nxt.season)
      .then(eps => {
        const found = eps.find(e => e.episode === nxt.episode);
        setNextInfo(found || { season: nxt.season, episode: nxt.episode, name: `Episódio ${nxt.episode}`, still: null, overview: null, airDate: null });
      })
      .catch(() => setNextInfo({ season: nxt.season, episode: nxt.episode, name: `Episódio ${nxt.episode}`, still: null }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, seasons, entry.lastEpisode]);

  const persist = payload =>
    updateDoc(doc(db, "couples", coupleId, "watched", entry.id), payload)
      .catch(e => { console.error(e); addToast?.("Não foi possível salvar o episódio", "error"); });

  // "Concluímos este episódio": avança o marcador e registra no ritmo (log)
  const completeEpisode = async ep => {
    setSaving(true);
    const rec = { season: ep.season, episode: ep.episode, name: ep.name, date: new Date().toISOString().slice(0, 10), together };
    // ritmo = log recente das sessões, mantido consistente com o marcador (nada depois de ep)
    const history = (entry.episodeHistory || [])
      .filter(h => episodeWatched(h.season, h.episode, ep) && !(h.season === ep.season && h.episode === ep.episode));
    await persist({ lastEpisode: rec, episodeHistory: [...history, rec].slice(-60), status: "watching" });
    setSaving(false);
    addToast?.(`Até T${ep.season} E${ep.episode} guardado ✦`, "success");
    // o próximo é recalculado pelo efeito (entry.lastEpisode muda via snapshot)
  };

  // browse: define o marcador no episódio tocado.
  // Tudo ATÉ ele conta como assistido; episódios posteriores ficam desmarcados.
  const setMarkerTo = async ep => {
    const rec = { season: ep.season, episode: ep.episode, name: ep.name, date: new Date().toISOString().slice(0, 10), together };
    const history = (entry.episodeHistory || [])
      .filter(h => episodeWatched(h.season, h.episode, ep) && !(h.season === ep.season && h.episode === ep.episode));
    await persist({ lastEpisode: rec, episodeHistory: [...history, rec].slice(-60), status: "watching" });
    const wasBack = marker && !episodeWatched(marker.season, marker.episode, ep);
    addToast?.(wasBack ? `Marcador recuado para T${ep.season} E${ep.episode}` : `Assistido até T${ep.season} E${ep.episode} ✦`, "info");
    setMode("continue");
  };

  const stillUrl = p => p ? `https://image.tmdb.org/t/p/w300${p}` : null;
  const fmtAir = d => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "") : "";

  return (
    <Overlay onClose={onClose}>
      <Modal title="" onClose={onClose} maxW={480}>
        <div className="ns-head">
          <img src={lumiSrc("holdingPopcorn")} alt=""/>
          <div>
            <div className="ns-head__t">Continuar assistindo</div>
            <div className="ns-head__s">{entry.title}</div>
          </div>
        </div>

        {/* CONTINUE — hero do próximo episódio */}
        {mode === "continue" && (
          <>
            {marker && (
              <div className="ep-marker">
                <span className="ep-marker__check">✔</span>
                Vocês pararam em <strong>T{marker.season} · E{marker.episode}</strong>
                {marker.name ? ` — ${marker.name}` : ""}
              </div>
            )}

            {loading && <div className="ep-hero ep-hero--loading"><div className="skel" style={{ height: 150 }}/></div>}

            {!loading && nextInfo === "finished" && (
              <div className="ep-finished">
                <Lumi name="celebrating" size={140} breathe/>
                <div className="ep-finished__title">Vocês maratonaram tudo ✦</div>
                <div className="ep-finished__sub">Acabou a série. Que jornada a dois.</div>
                <button className="pill pill--outline pill--block" style={{ marginTop: 18 }} onClick={() => setMode("browse")}>
                  Rever os episódios
                </button>
              </div>
            )}

            {!loading && nextInfo && nextInfo !== "finished" && (
              <>
                <div className="ep-hero">
                  <div className="ep-hero__still">
                    {stillUrl(nextInfo.still)
                      ? <img src={stillUrl(nextInfo.still)} alt=""/>
                      : <div className="ep-hero__still-fallback"><Ic n="play" s={30}/></div>}
                    <span className="ep-hero__badge">Próximo · a seguir</span>
                  </div>
                  <div className="ep-hero__body">
                    <div className="ep-hero__eyebrow">T{nextInfo.season} · Episódio {nextInfo.episode}</div>
                    <div className="ep-hero__title">{nextInfo.name}</div>
                    {nextInfo.airDate && <div className="ep-hero__air">{fmtAir(nextInfo.airDate)}</div>}
                    {nextInfo.overview && <p className="ep-hero__overview">{nextInfo.overview}</p>}
                  </div>
                </div>

                <button className="pill pill--primary pill--block" style={{ marginTop: 16 }} disabled={saving}
                  onClick={() => completeEpisode(nextInfo)}>
                  {saving ? "Guardando..." : "Concluímos este episódio ✦"}
                </button>
                <button className="pill pill--outline pill--block" style={{ marginTop: 10 }} onClick={() => setMode("browse")}>
                  Alterar marcador
                </button>
                <div className="ep-toggle__hint" style={{ marginTop: 10 }}>
                  {together ? "❤ contando como assistido juntos" : "marcado como sessão individual"}
                </div>
              </>
            )}

            {/* ritmo recente */}
            {(entry.episodeHistory || []).length > 0 && (
              <>
                <Label>O ritmo de vocês</Label>
                <div className="ep-history">
                  {[...(entry.episodeHistory || [])].slice(-4).reverse().map((h, i) => (
                    <div key={i} className="ep-history__row">
                      <span className="ep-history__check">✔</span>
                      <span className="ep-history__label">T{h.season}E{h.episode}{h.name ? ` · ${h.name}` : ""}</span>
                      <span className="ep-history__when">{h.date ? fmtAir(h.date) : ""}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* BROWSE — lista real de temporadas/episódios */}
        {mode === "browse" && (
          <>
            <div className="ep-browse-hint">
              {marker
                ? "Toque no último episódio que vocês assistiram — tudo antes dele conta como visto"
                : "Onde vocês estão na série? Toque no episódio — os anteriores contam como vistos."}
            </div>

            {seasons === null ? (
              <div className="search-loading">Buscando temporadas...</div>
            ) : seasons.length === 0 ? (
              <div className="ep-browse-hint">Não encontramos os episódios dessa série na TMDB.</div>
            ) : (
              <>
                <div className="chip-row ep-season-tabs">
                  {seasons.map(s => (
                    <button key={s.season} className={`chip ${activeSeason === s.season ? "chip--active" : ""}`}
                      onClick={() => setActiveSeason(s.season)}>
                      {s.name?.toLowerCase().startsWith("temporada") ? s.name : `T${s.season}`}
                    </button>
                  ))}
                </div>

                {loading ? (
                  <div className="ep-list">
                    {[0, 1, 2, 3].map(i => <div key={i} className="skel" style={{ height: 64, borderRadius: 16 }}/>)}
                  </div>
                ) : (
                  <div className="ep-list">
                    {(episodesBySeason[activeSeason] || []).map(ep => {
                      const isMarker = marker && marker.season === ep.season && marker.episode === ep.episode;
                      const done = episodeWatched(ep.season, ep.episode, marker);
                      return (
                        <button key={ep.episode} className={`ep-row ${isMarker ? "ep-row--marker" : ""} ${done && !isMarker ? "ep-row--done" : ""}`}
                          onClick={() => setMarkerTo(ep)}>
                          <div className="ep-row__num">{isMarker ? "◉" : done ? "✔" : ep.episode}</div>
                          {stillUrl(ep.still)
                            ? <img src={stillUrl(ep.still)} alt="" className="ep-row__still" loading="lazy"/>
                            : <div className="ep-row__still ep-row__still--fallback"><Ic n="tv" s={16}/></div>}
                          <div className="ep-row__body">
                            <div className="ep-row__name">{ep.name}</div>
                            <div className="ep-row__meta">
                              {isMarker ? "◉ pararam aqui" : done ? "assistido · toque p/ recuar até aqui" : ep.airDate ? fmtAir(ep.airDate) : `Episódio ${ep.episode}`}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {marker && (
                  <button className="pill pill--outline pill--block" style={{ marginTop: 14 }} onClick={() => setMode("continue")}>
                    ← Voltar para continuar
                  </button>
                )}
              </>
            )}
          </>
        )}
      </Modal>
    </Overlay>
  );
};


// Dev-only gallery (?v3demo) — valida os componentes V3 sem precisar de login.
// ?v3demo&p=home|acervo|watchlist|perfil renderiza as páginas reais com dados mock.
// Removido do bundle de produção pelo tree-shaking do import.meta.env.DEV.
const DEMO_COUPLE = { name1: "Ana", name2: "Léo", since: "2025-03-10", createdAt: "2025-03-10T12:00:00.000Z", inviteCode: "PIPOCA-42" };
const DEMO_USERS = ["Ana", "Léo"];
const demoEntry = (i, over = {}) => ({
  id: `d${i}`, type: "movie", title: `Filme ${i}`, year: "2024", poster: null, backdrop: null,
  where: i % 3 === 0 ? "cinema" : "streaming",
  date: `2026-0${(i % 6) + 1}-1${i % 3}`, createdAt: `2026-0${(i % 6) + 1}-1${i % 3}T21:0${i}:00.000Z`,
  genres: ["Drama", "Romance"], runtime: 120 + i * 9,
  reviews: { Ana: { rating: 4 + (i % 2), text: i % 2 ? "Chorei no final e você sabe." : "" }, Léo: { rating: 3 + (i % 3), text: "" } },
  watchedTogether: true, addedBy: "Ana", ...over,
});
const DEMO_WATCHED = [
  demoEntry(1, { title: "Duna: Parte II", genres: ["Ficção científica"] }),
  demoEntry(2, { title: "La La Land", genres: ["Romance", "Musical"] }),
  demoEntry(3, { title: "Interestelar", genres: ["Ficção científica"] }),
  demoEntry(4, { title: "Oppenheimer" }),
  demoEntry(5, { title: "Retrato de uma Jovem em Chamas" }),
  demoEntry(6, {
    title: "The Last of Us", type: "tv", status: "watching", tmdbId: 100088, numberOfSeasons: 2, seasonsWatched: [1],
    seasons: [{ season: 1, episodeCount: 9, name: "Temporada 1" }, { season: 2, episodeCount: 7, name: "Temporada 2" }],
    lastEpisode: { season: 2, episode: 4, name: "Day One", date: new Date().toISOString().slice(0, 10) },
    episodeHistory: [
      { season: 2, episode: 2, name: "Through the Valley", date: "2026-07-13", together: true },
      { season: 2, episode: 3, name: "The Path", date: "2026-07-15", together: true },
      { season: 2, episode: 4, name: "Day One", date: new Date().toISOString().slice(0, 10), together: true },
    ],
  }),
];
const DEMO_WATCHLIST = [
  { id: "w1", title: "Interestelar", type: "movie", year: "2014", poster: null, runtime: 169, tmdbRating: "8.4", genres: ["Ficção científica", "Drama"], overview: "Um grupo de exploradores atravessa um buraco de minhoca em busca de um novo lar para a humanidade.", priority: "alta", suggestedBy: "Ana", wantedBy: ["Ana", "Léo"], addedAt: "2026-02-02T12:00:00.000Z", note: "os dois querem faz tempo" },
  { id: "w2", title: "Mad Max: Estrada da Fúria", type: "movie", year: "2015", poster: null, runtime: 120, tmdbRating: "7.6", genres: ["Ação", "Ficção científica"], overview: "Numa terra devastada, Max une forças com Furiosa para fugir de um tirano.", priority: "normal", suggestedBy: "Léo", wantedBy: ["Léo"], addedAt: "2026-06-20T12:00:00.000Z" },
  { id: "w3", title: "Fleabag", type: "tv", year: "2016", poster: null, tmdbRating: "8.7", genres: ["Comédia", "Drama"], overview: "Uma mulher irreverente navega a vida e o amor em Londres enquanto quebra a quarta parede.", priority: "baixa", suggestedBy: "Ana", wantedBy: ["Ana"], addedAt: "2026-07-01T12:00:00.000Z" },
];
const noop = () => {};

const V3Demo = () => {
  const [celeb, setCeleb] = useState(null);
  const pageParam = new URLSearchParams(window.location.search).get("p");
  const demoPrefs = { lumiComments: true, fridayReminders: true, onThisDay: true };

  if (pageParam) {
    const pages = {
      home: <HomePage watched={DEMO_WATCHED} watchlist={DEMO_WATCHLIST} couple={DEMO_COUPLE} currentUser="Ana" users={DEMO_USERS}
        onRoulette={noop} onAdd={noop} onSaveReview={noop} onUpdateStatus={noop} onContinueEpisode={noop} onToggleTogether={noop}
        onOpenSettings={noop} onOpenCinema={noop} onEdit={noop} prefs={demoPrefs}/>,
      acervo: <DiaryPage watched={DEMO_WATCHED} users={DEMO_USERS} currentUser="Ana" onDelete={noop} onEdit={noop}
        onSaveReview={noop} onUpdateStatus={noop} onContinueEpisode={noop} onToggleTogether={noop} onAddToWatchlist={noop} prefs={demoPrefs}/>,
      watchlist: <WatchlistPage watchlist={DEMO_WATCHLIST} users={DEMO_USERS} currentUser="Ana" compat={87} onDelete={noop}
        onMarkWatched={noop} onRoulette={noop} onAlsoWant={noop} prefs={demoPrefs}/>,
      perfil: <ProfilePage watched={DEMO_WATCHED} watchlist={DEMO_WATCHLIST} couple={DEMO_COUPLE} users={DEMO_USERS}
        prefs={demoPrefs} onOpenSettings={noop}/>,
      episodio: <EpisodeSheet entry={DEMO_WATCHED[5]} coupleId={null} onClose={noop} addToast={noop}/>,
    };
    return (
      <div className="v3-shell">
        <div className="app-shell__content">{pages[pageParam] || <div style={{ padding: 40 }}>página desconhecida</div>}</div>
        <nav className="v3-nav">
          <span className="v3-nav__item v3-nav__item--active"><Ic n="home" s={21}/></span>
          <span className="v3-nav__item"><Ic n="book" s={21}/></span>
          <span className="v3-nav__fab"><Ic n="plus" s={22}/></span>
          <span className="v3-nav__item"><Ic n="bookmark" s={21}/></span>
          <span className="v3-nav__item v3-nav__item--gold"><img src={lumiSrc("headNeutral")} alt="" className="v3-nav__lumi"/></span>
        </nav>
      </div>
    );
  }
  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "24px 16px 80px" }}>
      <h2 style={{ fontFamily: "var(--font-display)" }}>V3 demo</h2>

      <div className="v3-eyebrow">Continue hero</div>
      <button className="continue-hero">
        <div className="continue-hero__eyebrow">Continue de onde pararam</div>
        <div className="continue-hero__title">The Last of Us</div>
        <div className="continue-hero__meta">T2 · Episódio 4 assistido · próximo: E5</div>
        <div className="continue-hero__bar"><span style={{ width: "38%" }}/></div>
        <span className="continue-hero__btn">▶ Continuar</span>
        <img src={lumiSrc("peeking")} alt="" className="continue-hero__peek"/>
      </button>

      <div className="v3-eyebrow">Episode tracker</div>
      <div className="ep-tracker">
        <div className="ep-tracker__eyebrow">Vocês pararam em</div>
        <div className="ep-tracker__stopped">T2 · Episódio 4</div>
        <div className="ep-tracker__date">Assistido Ontem</div>
        <div className="ep-tracker__next">▶ Próximo: T2 · Episódio 5</div>
        <button className="ep-tracker__btn">Continuar assistindo</button>
        <button className="ep-toggle ep-toggle--on">❤ Assistimos juntos</button>
        <div className="ep-toggle__hint">Só conta o que vocês viram como casal</div>
      </div>
      <div className="ep-history">
        {[["T2E4","Hoje"],["T2E3","Ontem"],["T2E2","Domingo"]].map(([l,w])=>(
          <div key={l} className="ep-history__row">
            <span className="ep-history__check">✔</span>
            <span className="ep-history__label">{l}</span>
            <span className="ep-history__when">{w}</span>
          </div>
        ))}
      </div>

      <div className="v3-eyebrow">Lumi note</div>
      <div className="lumi-note">
        <img src={lumiSrc("pointing")} alt="Lumi"/>
        <div className="lumi-note__text">"Interestelar está aí há 3 meses. Hoje é a noite dele?"</div>
      </div>

      <div className="v3-eyebrow">Celebrations</div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button className="lumi-state__cta" onClick={()=>setCeleb("episode")}>Episódio</button>
        <button className="lumi-state__cta" onClick={()=>setCeleb("milestone")}>Marco</button>
      </div>
      {celeb === "episode" && (
        <CelebrateModal variant="episode" lumi="holdingPopcorn" title="Episódio concluído"
          quote={`"Mais um episódio para a coleção de vocês."`} nextLabel="Próximo" nextValue="T2 · E5"
          primaryLabel="Salvar" hint="um toque, e a memória está guardada"
          onPrimary={()=>setCeleb(null)} onClose={()=>setCeleb(null)}/>
      )}
      {celeb === "milestone" && (
        <CelebrateModal variant="milestone" lumi="milestone100" eyebrow="Conquista desbloqueada"
          title="100 filmes" quote={`"Cem histórias vividas juntos. Que coleção linda."`}
          primaryLabel="Continuar" secondaryLabel="Compartilhar ✦" confetti
          onPrimary={()=>setCeleb(null)} onSecondary={()=>setCeleb(null)} onClose={()=>setCeleb(null)}/>
      )}

      <div className="v3-eyebrow">Empty state</div>
      <LumiState lumi="empty" title="Nenhuma sessão ainda"
        text={<>Toda grande história começa<br/>com um primeiro filme.</>}
        cta="Guardar a primeira memória"/>

      <div className="v3-eyebrow">Skeleton</div>
      <ContentSkeleton/>

      <div className="v3-eyebrow">Offline bar</div>
      <div className="offline-bar" style={{ position: "static", transform: "none", margin: "10px 0" }}>
        <img src={lumiSrc("offline")} alt="" className="offline-bar__lumi"/>
        <span className="offline-bar__text">"Sem internet. Guardo tudo até vocês voltarem."</span>
      </div>

      <div className="v3-eyebrow">Home pair + pills</div>
      <div className="home-pair">
        <div className="home-pair__card">
          <div className="home-pair__label">Compatibilidade</div>
          <div className="home-pair__big">94%</div>
        </div>
        <div className="home-pair__card">
          <div className="home-pair__label">Próximo marco</div>
          <div className="home-pair__mid">100 filmes</div>
          <img src={lumiSrc("headSmiling")} alt="" className="home-pair__head"/>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <button className="pill pill--primary">Continuar assistindo</button>
        <button className="pill pill--light">Compartilhar ✦</button>
        <button className="pill pill--outline">Editar</button>
        <button className="pill pill--gold-outline">＋ Watchlist</button>
      </div>
      <div className="chip-row" style={{ marginBottom: 18 }}>
        <span className="chip chip--active">Tudo</span><span className="chip">Filmes</span>
        <span className="chip">Séries</span><span className="chip chip--gold">no cinema 🎟</span>
      </div>

      <div className="v3-eyebrow">Acervo grid</div>
      <div className="acervo-grid" style={{ marginBottom: 18 }}>
        {[["Duna: Parte II", "8,8"], ["The Last of Us", "9,1"], ["La La Land", "9,4"]].map(([t, n]) => (
          <div key={t} className="acervo-item">
            <div className="acervo-item__poster"><span className="acervo-item__nota">{n}</span></div>
            <span className="acervo-item__title">{t}</span>
          </div>
        ))}
      </div>

      <div className="v3-eyebrow">Nota do casal + chips</div>
      <div className="nota-pair" style={{ marginBottom: 12 }}>
        <div className="nota-casal">
          <div className="nota-casal__label">NOTA DO CASAL</div>
          <div className="nota-casal__value">8,8</div>
        </div>
        <div className="nota-users">
          <div className="nota-users__row"><span>Ana</span><span>9,0</span></div>
          <div className="nota-users__row"><span>Léo</span><span>8,5</span></div>
        </div>
      </div>
      <div className="ns-chips" style={{ marginBottom: 18 }}>
        <div className="ns-chip"><div className="ns-chip__who">Ana</div><div className="ns-chip__val">9,0</div></div>
        <div className="ns-chip"><div className="ns-chip__who">Léo</div><div className="ns-chip__val">8,5</div></div>
        <div className="ns-chip ns-chip--juntos"><div className="ns-chip__who">Juntos</div><div className="ns-chip__val">8,8</div></div>
      </div>

      <div className="v3-eyebrow">Virar memória (swipe)</div>
      <div className="wl-swipe" style={{ marginBottom: 18 }}>
        <div className="wl-swipe__hint">toque para marcar como assistido</div>
        <div className="wl-swipe__track">
          <div className="wl-swipe__knob">✔</div>
          <span className="wl-swipe__label">Assistimos juntos →</span>
        </div>
      </div>

      <div className="v3-eyebrow">Ingresso (modo cinema)</div>
      <div className="ticket" style={{ marginBottom: 24 }}>
        <div className="ticket__top">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="ticket__brand">Sessão · admit two</span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--accent)" }}>❤</span>
          </div>
          <div className="ticket__title">Superman</div>
          <div className="ticket__venue">Cinemark Iguatemi · Sala 6</div>
          <div className="ticket__fields">
            <div><div className="ticket__f-label">data</div><div className="ticket__f-value">sáb 19 jul</div></div>
            <div><div className="ticket__f-label">horário</div><div className="ticket__f-value">21h40</div></div>
            <div><div className="ticket__f-label">lugares</div><div className="ticket__f-value">H7 · H8</div></div>
          </div>
        </div>
        <div className="ticket__perf"><i/><i/></div>
        <div className="ticket__bottom">
          <div style={{ flex: 1 }}>
            <div className="ticket__f-label">casal</div>
            <div className="ticket__couple">Ana & Léo</div>
          </div>
          <div className="ticket__barcode"/>
        </div>
        <img src={lumiSrc("peeking")} alt="" className="ticket__lumi"/>
      </div>

      <div className="v3-eyebrow">Estatísticas</div>
      <div className="stats-chart" style={{ marginBottom: 18 }}>
        <div className="stats-chart__head">
          <span className="stats-chart__title">Sessões por mês</span>
          <span className="stats-chart__year">2026</span>
        </div>
        <div className="stats-bars">
          {[34, 50, 42, 58, 46, 64, 80].map((h, i) => (
            <div key={i} className={`stats-bar ${i === 6 ? "stats-bar--hot" : ""}`}>
              <i style={{ height: h }}/>
              <span>{"JFMAMJJ"[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="v3-eyebrow">Nav v3 (estática)</div>
      <div className="v3-nav" style={{ position: "static", borderRadius: 20, border: "1px solid var(--border-subtle)", height: 74, padding: 0 }}>
        <span className="v3-nav__item v3-nav__item--active"><Ic n="home" s={21}/></span>
        <span className="v3-nav__item"><Ic n="book" s={21}/></span>
        <span className="v3-nav__fab">+</span>
        <span className="v3-nav__item"><Ic n="bookmark" s={21}/></span>
        <span className="v3-nav__item v3-nav__item--gold"><img src={lumiSrc("headNeutral")} alt="" className="v3-nav__lumi"/></span>
      </div>
    </div>
  );
};

// login + onboarding — "Oi! Eu sou o Lumi" → "Como funciona" → login (v3)
const LoginScreen = ({ onLogin, loading }) => {
  const [slide, setSlide] = useState(() => localStorage.getItem("sessao-onboarded") ? 2 : 0);
  const finishOnb = () => { localStorage.setItem("sessao-onboarded", "1"); setSlide(2); };

  if (slide === 0) return (
    <div className="onb">
      <Lumi name="waving" size={210} breathe alt="Lumi acenando"/>
      <div className="onb__title">Oi! Eu sou o Lumi</div>
      <p className="onb__text">Eu guardo as memórias de cinema<br/>de vocês dois. Cada filme, cada série,<br/>cada noite no sofá.</p>
      <div className="onb__dots"><span className="onb__dot onb__dot--on"/><span className="onb__dot"/><span className="onb__dot"/></div>
      <div className="onb__cta">
        <button className="pill pill--primary pill--block" onClick={() => setSlide(1)}>Começar</button>
      </div>
    </div>
  );

  if (slide === 1) return (
    <div className="onb" style={{ background: "var(--bg-base)" }}>
      <div className="onb__title" style={{ fontSize: 34, marginTop: 0 }}>Como funciona</div>
      <div className="onb__steps">
        <div className="onb__step">
          <img src={lumiSrc("clapper")} alt=""/>
          <div>
            <div className="onb__step-t">Assistam juntos</div>
            <div className="onb__step-s">Filme ou série, no sofá ou no cinema.</div>
          </div>
        </div>
        <div className="onb__step">
          <img src={lumiSrc("holdingStar")} alt=""/>
          <div>
            <div className="onb__step-t">Deem a nota do casal</div>
            <div className="onb__step-s">Cada um avalia, e nasce a nota de vocês.</div>
          </div>
        </div>
        <div className="onb__step">
          <img src={lumiSrc("hugHeart")} alt=""/>
          <div>
            <div className="onb__step-t">Eu guardo tudo</div>
            <div className="onb__step-s">A memória vira parte da história de vocês.</div>
          </div>
        </div>
      </div>
      <div className="onb__dots"><span className="onb__dot"/><span className="onb__dot onb__dot--on"/><span className="onb__dot"/></div>
      <div className="onb__cta">
        <button className="pill pill--primary pill--block" onClick={finishOnb}>Continuar</button>
      </div>
    </div>
  );

  return (
    <div className="onb" style={{ background: "var(--bg-base)" }}>
      <Lumi name="hugHeart" size={170} breathe alt="Lumi"/>
      <div className="onb__title" style={{ fontSize: 32, marginTop: 18 }}>Chame sua pessoa</div>
      <p className="onb__text" style={{ fontSize: 14, marginTop: 10 }}>O Sessão é a dois. Convide quem<br/>divide o sofá com você.</p>
      <div className="onb__dots"><span className="onb__dot"/><span className="onb__dot"/><span className="onb__dot onb__dot--on"/></div>
      <div className="onb__cta" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={onLogin} disabled={loading} className="pill pill--light pill--block">
          {loading
            ? <span className="login-google__spinner" aria-hidden="true"/>
            : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
          {loading ? "Entrando..." : "Continuar com Google"}
        </button>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", marginTop: 4 }}>
          🔒 privado — só entre vocês dois · já tem um convite? entre e <span style={{ color: "var(--gold)", fontWeight: 600 }}>insira o código</span>
        </div>
        <button onClick={() => setSlide(0)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 12, marginTop: 2, cursor: "pointer" }}>
          rever a apresentação do Lumi
        </button>
      </div>
    </div>
  );
};

// couple setup (create or join)
const CoupleSetup = ({ authUser, onCreate, onJoin, onSignOut }) => {
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
        <Lumi name="waving" size={120} breathe style={{ margin: "0 auto 6px" }} alt="Lumi acenando" />
        <h1 className="auth-title auth-title--large">
          Sessão <span className="days-highlight">❤️</span>
        </h1>
        <p className="auth-subtitle">Olá, {authUser?.displayName?.split(" ")[0]}! Configure seu diário.</p>
        {onSignOut && (
          <button type="button" onClick={onSignOut} className="auth-signout">
            Sair / trocar de conta
          </button>
        )}

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
            <input className="auth-input" value={myName} onChange={e => setMyName(e.target.value)} placeholder="Seu nome" style={inp} />
            <p className="auth-note">Você receberá um código para convidar sua pessoa</p>
            <p className="auth-note auth-note--compact">Desde quando juntos? (opcional)</p>
            <input type="date" className="auth-input" value={since} onChange={e => setSince(e.target.value)} style={inp} />
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
            <input className="auth-input" value={joinName} onChange={e => setJoinName(e.target.value)} placeholder="Seu nome" style={inp} />
            <input
              className="auth-input"
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
const InviteScreen = ({ inviteCode, couple, onSignOut }) => (
  <div className="auth-screen">
    <div className="auth-card">
      <Lumi name="celebrating" size={120} breathe style={{ margin: "0 auto 6px" }} alt="Lumi comemorando" />
      <h2 className="auth-title" style={{ fontSize: "clamp(28px, 4.4vw, 32px)", marginBottom: 8 }}>Diário criado!</h2>
      <p className="auth-subtitle auth-callout">
        Compartilhe o código abaixo com {couple.name1 === "?" ? "sua pessoa" : couple.name2 || "sua pessoa"} para ela entrar no diário.
      </p>
      <div className="invite-dash">
        <div>
          <div className="invite-dash__label">seu código de casal</div>
          <div className="invite-dash__code">{inviteCode}</div>
        </div>
        <button type="button" className="invite-dash__copy"
          onClick={() => { navigator.clipboard?.writeText(inviteCode).catch(() => {}); }}>
          Copiar
        </button>
      </div>
      <p className="auth-note">Aguardando sua pessoa entrar — assim que ela usar o código, o diário abrirá automaticamente.</p>
      {onSignOut && (
        <button type="button" onClick={onSignOut} className="auth-signout">
          Sair / trocar de conta
        </button>
      )}
    </div>
  </div>
);

// home page — v3, fiel ao canvas "Home · Continue de onde pararam"
const HomePage = ({ watched, watchlist, couple, currentUser, users, onRoulette, onAdd,
  onSaveReview, onUpdateStatus, onContinueEpisode, onToggleTogether, onOpenSettings, onOpenCinema,
  onEdit, prefs }) => {
  const [sel, setSel] = useState(null);
  const [editing, setEditing] = useState(null);

  const totMovies = watched.filter(w => w.type === "movie").length;
  const total = watched.length;
  const watching = watched.filter(w => w.type === "tv" && w.status === "watching");
  const compat = coupleCompat(watched, users);

  // Continuar assistindo — série em andamento mais recente (só o que foi visto juntos)
  const continueEntry = watching
    .filter(w => w.watchedTogether !== false)
    .sort((a, b) => new Date(b.lastEpisode?.date || b.date || b.createdAt) - new Date(a.lastEpisode?.date || a.date || a.createdAt))[0] || null;
  const contLast = continueEntry?.lastEpisode || null;
  const contNext = contLast ? nextEpisodeOf(contLast, continueEntry.seasons) : null;
  const contProgress = continueEntry ? (() => {
    // progresso real: episódios até o marcador / total (usa temporadas da TMDB)
    const total = episodesTotal(continueEntry.seasons);
    if (total > 0 && contLast) return Math.max(4, Math.min(100, Math.round(episodesWatchedCount(contLast, continueEntry.seasons) / total * 100)));
    // fallback quando não há dados de temporada
    const seasons = continueEntry.numberOfSeasons || Math.max(contLast?.season || 1, 1);
    const done = contLast ? (contLast.season - 1) + Math.min((contLast.episode || 0) / 10, 0.95) : 0;
    return Math.max(6, Math.min(96, Math.round(done / seasons * 100)));
  })() : 0;

  // próximo marco
  const nextMilestone = (() => {
    if (total < 1)  return { label: "Primeira sessão", value: "memória nº 1" };
    if (total < 10) return { label: "Próximo marco", value: "10 sessões" };
    if (total < 50) return { label: "Próximo marco", value: "50 sessões" };
    if (totMovies < 100) return { label: "Próximo marco", value: "100 filmes" };
    return { label: "Clube dos 100", value: "✦ lendários" };
  })();

  // última sessão
  const last = [...watched].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))[0] || null;
  const lastAvg = last ? mediaEntry(last) : 0;
  const relDay = ds => {
    if (!ds) return "";
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(ds + "T12:00:00"); d.setHours(0, 0, 0, 0);
    const diff = Math.round((today - d) / 86400000);
    if (diff <= 0) return "Hoje";
    if (diff === 1) return "Ontem";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  // nesse dia
  const today = new Date();
  const todayMMDD = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const thisYear = today.getFullYear();
  const onThisDay = prefs?.onThisDay === false ? [] : watched
    .filter(w => {
      const d = w.date || (w.createdAt || "").slice(0, 10);
      return d && d.slice(5, 10) === todayMMDD && parseInt(d.slice(0, 4)) < thisYear;
    })
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

  return (
    <div>
      {sel && (() => {
        const liveEntry = watched.find(w => w.id === sel.id) || sel;
        return (
          <DetailModal entry={liveEntry} users={users} currentUser={currentUser}
            onClose={() => setSel(null)}
            onEdit={() => { setEditing(liveEntry); setSel(null); }}
            onSaveReview={onSaveReview}
            onUpdateStatus={onUpdateStatus}
            onContinueEpisode={onContinueEpisode}
            onToggleTogether={onToggleTogether}
            prefs={prefs}/>
        );
      })()}
      {editing && (
        <WatchedForm users={users} currentUser={currentUser}
          initial={{ ...editing, movie: editing }}
          title="Editar registro"
          onSave={e => { onEdit(e); setEditing(null); }}
          onClose={() => setEditing(null)}/>
      )}

      {/* header contextual do design */}
      <div className="home-head">
        <div>
          <div className="home-head__ctx">{contextGreeting()} ✦</div>
          <div className="home-head__names">{couple.name1} & {couple.name2}</div>
        </div>
        <button className="home-head__lumi" onClick={onOpenSettings} aria-label="Configurações">
          <img src={lumiSrc("avatar")} alt="Lumi"/>
        </button>
      </div>

      {/* hero: continue de onde pararam */}
      {continueEntry && (
        <button className="continue-hero" onClick={() => setSel(continueEntry)} style={{ marginTop: 14 }}>
          <div className="continue-hero__eyebrow">Continue de onde pararam</div>
          <div className="continue-hero__title">{continueEntry.title}</div>
          <div className="continue-hero__meta">
            {contLast
              ? <>T{contLast.season} · Episódio {contLast.episode} assistido{contNext ? ` · próximo: E${contNext.episode}` : ""}</>
              : "Marquem o primeiro episódio de vocês"}
          </div>
          <div className="continue-hero__bar"><span style={{ width: `${contProgress}%` }}/></div>
          <span className="continue-hero__btn" role="button"
            onClick={e => { e.stopPropagation(); onContinueEpisode?.(continueEntry); }}>
            ▶ Continuar
          </span>
          <img src={lumiSrc("peeking")} alt="" className="continue-hero__peek" aria-hidden="true"/>
        </button>
      )}

      {/* compatibilidade + próximo marco */}
      {total > 0 && (
        <div className="home-pair" style={{ marginTop: continueEntry ? 0 : 14 }}>
          <div className="home-pair__card">
            <div className="home-pair__label">Compatibilidade</div>
            <div className="home-pair__big">{compat !== null ? `${compat}%` : "—"}</div>
          </div>
          <div className="home-pair__card">
            <div className="home-pair__label">{nextMilestone.label}</div>
            <div className="home-pair__mid">{nextMilestone.value}</div>
            <img src={lumiSrc("headSmiling")} alt="" className="home-pair__head"/>
          </div>
        </div>
      )}

      {/* última sessão */}
      {last && (
        <>
          <div className="home-last-label">Última sessão</div>
          <button className="home-last" onClick={() => setSel(last)}>
            {last.poster
              ? <img src={`${TMDB_IMG}${last.poster}`} alt="" className="home-last__poster"/>
              : <div className="home-last__poster"/>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="home-last__title">{last.title}</div>
              <div className="home-last__meta">{relDay(last.date || (last.createdAt || "").slice(0, 10))} · {last.where === "cinema" ? "no cinema" : "em casa"}</div>
            </div>
            {lastAvg > 0 && <span className="home-last__nota">★ {nota10(lastAvg)}</span>}
          </button>
        </>
      )}

      {/* nesse dia, há N anos */}
      {onThisDay.length > 0 && (
        <>
          <div className="home-last-label">Nesse dia</div>
          {onThisDay.map(e => {
            const d = e.date || (e.createdAt || "").slice(0, 10);
            const yearsAgo = thisYear - parseInt(d.slice(0, 4));
            const avg = mediaEntry(e);
            return (
              <button key={e.id} className="home-last" onClick={() => setSel(e)} style={{ marginBottom: 10 }}>
                {e.poster
                  ? <img src={`${TMDB_IMG}${e.poster}`} alt="" className="home-last__poster"/>
                  : <div className="home-last__poster"/>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="home-last__title">{e.title}</div>
                  <div className="home-last__meta">{yearsAgo === 1 ? "há 1 ano" : `há ${yearsAgo} anos`} · a primeira vez que viram</div>
                </div>
                {avg > 0 && <span className="home-last__nota">★ {nota10(avg)}</span>}
              </button>
            );
          })}
        </>
      )}

      {/* atalhos: roleta + modo cinema */}
      {watchlist.length >= 2 && (
        <button className="home-strip" onClick={onRoulette}>
          <img src={lumiSrc("roulette")} alt=""/>
          <span>
            <span className="home-strip__t">Roleta da noite</span>
            <div className="home-strip__s">não sabem o que ver? a sorte decide</div>
          </span>
          <span className="home-strip__arrow">→</span>
        </button>
      )}
      <button className="home-strip home-strip--amber" onClick={onOpenCinema}>
        <img src={lumiSrc("cinemaSign")} alt=""/>
        <span>
          <span className="home-strip__t">Modo cinema 🎟</span>
          <div className="home-strip__s">quando a sessão é fora de casa</div>
        </span>
        <span className="home-strip__arrow">→</span>
      </button>

      {/* empty state acolhedor */}
      {total === 0 && (
        <LumiState
          lumi="empty"
          title="Nenhuma sessão ainda"
          text={<>Toda grande história começa<br/>com um primeiro filme.</>}
          cta="Guardar a primeira memória"
          onCta={onAdd}
        />
      )}
    </div>
  );
};

// timeline view
const TimelineView = ({ items, users, onSelect, onDelete }) => {
  const avgRating = w => {
    const rs = Object.values(w.reviews||{}).map(r=>r.rating).filter(Boolean);
    return rs.length ? (rs.reduce((a,b)=>a+b,0)/rs.length).toFixed(1) : null;
  };

  const fmtMonth = key => {
    if (!key) return "Sem data";
    const [y, m] = key.split("-");
    const names = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return `${names[parseInt(m)-1]} ${y}`;
  };

  const grouped = {};
  for (const e of items) {
    const key = (e.date || (e.createdAt||"").slice(0,10)).slice(0,7);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }
  const months = Object.keys(grouped).sort((a,b)=>b.localeCompare(a));

  return (
    <div className="timeline">
      {months.map(month => (
        <div key={month} className="timeline-month">
          <div className="timeline-month__header">{fmtMonth(month)}</div>
          <div className="timeline-track">
            {grouped[month].map(e => {
              const avg = avgRating(e);
              return (
                <div key={e.id} className="tl-entry" onClick={()=>onSelect(e)}>
                  <div className="tl-entry__poster">
                    {e.poster
                      ? <img src={`${TMDB_IMG}${e.poster}`} alt=""/>
                      : <PosterFallback type={e.type} h={54}/>}
                  </div>
                  <div className="tl-entry__body">
                    <div className="tl-entry__title">{e.title}</div>
                    <div className="tl-entry__meta">
                      <Ic n={e.where==="cinema"?"film":"tv"} s={10}/>
                      {e.where==="cinema"?"Cinema":"Streaming"}
                      {e.date && " • "+new Date(e.date+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})}
                      {avg && <span className="tl-entry__avg">★ {avg}</span>}
                    </div>
                    {(e.genres||[]).length>0 && (
                      <div className="tl-entry__tags">
                        {(e.genres||[]).slice(0,2).map(g=><span key={g} className="tl-entry__tag">{g}</span>)}
                      </div>
                    )}
                  </div>
                  <button className="tl-entry__del" onClick={ev=>{ev.stopPropagation();onDelete(e);}}>
                    <Ic n="trash" s={12}/>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// diary page — "O acervo de vocês" (v3)
const DiaryPage = ({ watched, users, currentUser, onDelete, onEdit, onSaveReview, onUpdateStatus, onContinueEpisode, onToggleTogether, onAddToWatchlist, prefs }) => {
  const [sel, setSel] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState("all"); // all | movie | tv | top | cinema | <ano>
  const [view, setView] = useState("grid");

  const years = [...new Set(watched.map(w => (w.date || (w.createdAt || "").slice(0, 10)).slice(0, 4)).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a)).slice(0, 2);

  let items = [...watched];
  if (search) items = items.filter(w => w.title.toLowerCase().includes(search.toLowerCase()));
  if (chip === "movie") items = items.filter(w => w.type === "movie");
  else if (chip === "tv") items = items.filter(w => w.type === "tv");
  else if (chip === "top") items = items.filter(w => mediaEntry(w) >= 4.5);
  else if (chip === "cinema") items = items.filter(w => w.where === "cinema");
  else if (/^\d{4}$/.test(chip)) items = items.filter(w => (w.date || (w.createdAt || "").slice(0, 10)).startsWith(chip));
  items.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

  return (
    <div>
      {sel && (() => {
        const liveEntry = watched.find(w => w.id === sel.id) || sel;
        return (
          <DetailModal entry={liveEntry} users={users} currentUser={currentUser}
            onClose={() => setSel(null)}
            onEdit={() => { setEditing(liveEntry); setSel(null); }}
            onSaveReview={onSaveReview}
            onUpdateStatus={onUpdateStatus}
            onContinueEpisode={onContinueEpisode}
            onToggleTogether={onToggleTogether}
            onDelete={() => { setSel(null); onDelete(liveEntry); }}
            prefs={prefs}/>
        );
      })()}
      {editing && (
        <WatchedForm users={users} currentUser={currentUser}
          initial={{ ...editing, movie: editing }}
          title="Editar registro"
          onSave={e => { onEdit(e); setEditing(null); }}
          onClose={() => setEditing(null)}/>
      )}

      {/* header do acervo */}
      <div className="acervo-head">
        <div>
          <div className="acervo-head__sub">O acervo de vocês</div>
          <div className="acervo-head__title">{watched.length} memória{watched.length !== 1 ? "s" : ""}</div>
        </div>
        <img src={lumiSrc("headSmiling")} alt="" className="acervo-head__lumi"/>
      </div>

      {/* busca pílula */}
      <div className="search-pill">
        <span className="search-pill__icon"><Ic n="search" s={16}/></span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="buscar nas memórias..."/>
        {search && (
          <button className="search-pill__clear" onClick={() => setSearch("")} aria-label="Limpar">
            <Ic n="x" s={14}/>
          </button>
        )}
      </div>

      {/* chips de filtro */}
      <div className="chip-row" style={{ marginTop: 12 }}>
        {[["all", "Tudo"], ["movie", "Filmes"], ["tv", "Séries"], ["top", "★ 9+"]].map(([v, l]) => (
          <button key={v} className={`chip ${chip === v ? "chip--active" : ""}`} onClick={() => setChip(v)}>{l}</button>
        ))}
        {years.map(y => (
          <button key={y} className={`chip ${chip === y ? "chip--active" : ""}`} onClick={() => setChip(chip === y ? "all" : y)}>{y}</button>
        ))}
        <button className={`chip chip--gold ${chip === "cinema" ? "chip--active" : ""}`} onClick={() => setChip(chip === "cinema" ? "all" : "cinema")}>no cinema 🎟</button>
        <button className={`chip ${view === "timeline" ? "chip--active" : ""}`} style={{ marginLeft: "auto" }}
          onClick={() => setView(v => v === "grid" ? "timeline" : "grid")} title="Linha do tempo">
          <Ic n={view === "grid" ? "list" : "grid4"} s={13}/>
        </button>
      </div>

      {items.length === 0 ? (
        watched.length === 0 ? (
          <LumiState
            lumi="empty"
            title="Nenhuma sessão ainda"
            text={<>Toda grande história começa<br/>com um primeiro filme.</>}
          />
        ) : search ? (
          <LumiState
            lumi="confuso"
            title={<>Hmm, ainda não<br/>assistiram esse</>}
            text={<>Nenhuma memória com "{search}".<br/>Que tal marcar pra sexta?</>}
            cta="＋ Adicionar à watchlist"
            ctaVariant="gold-outline"
            onCta={onAddToWatchlist}
          />
        ) : (
          <LumiState
            lumi="thinking"
            title="Nada por aqui"
            text="Nenhum título com esse filtro."
            cta="Limpar filtros"
            ctaVariant="outline"
            onCta={() => { setChip("all"); setSearch(""); }}
          />
        )
      ) : view === "timeline" ? (
        <TimelineView items={items} users={users} onSelect={setSel} onDelete={onDelete}/>
      ) : (
        <>
          <div className="acervo-grid">
            {items.map(e => {
              const avg = mediaEntry(e);
              return (
                <button key={e.id} className="acervo-item" onClick={() => setSel(e)}>
                  <div className="acervo-item__poster">
                    {e.poster && <img src={`${TMDB_IMG}${e.poster}`} alt="" loading="lazy"/>}
                    {avg > 0 && <span className="acervo-item__nota">{nota10(avg)}</span>}
                    {e.type === "tv" && e.status === "watching" && <span className="acervo-item__flag">● JUNTOS</span>}
                  </div>
                  <span className="acervo-item__title">{e.title}</span>
                </button>
              );
            })}
          </div>
          <div className="acervo-tip">
            <img src={lumiSrc("curioso")} alt=""/>
            dica: toque num pôster para rever a crítica de vocês
          </div>
        </>
      )}
    </div>
  );
};

// watchlist page — "Lista a dois · Queremos ver" (v3)
// quem quer um título: usa wantedBy[], com fallback pro suggestedBy (registros antigos)
// watchlist page — o planejador das próximas noites de cinema (v3)
// quem quer um título: usa wantedBy[], com fallback pro suggestedBy (registros antigos)
const wantedByOf = e => (e.wantedBy?.length ? e.wantedBy : [e.suggestedBy].filter(Boolean));
const fmtDur = m => m ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : null;
const waitingDays = e => e.addedAt ? Math.floor((new Date() - new Date(e.addedAt)) / 86400000) : 0;
const waitingCopy = d => {
  if (d <= 0) return "adicionado hoje";
  if (d === 1) return "esperando há 1 dia";
  if (d < 30) return `esperando há ${d} dias`;
  if (d < 90) return `esperando há ${Math.round(d / 30)} meses`;
  if (d < 200) return `esperando há ${Math.round(d / 30)} meses 😅`;
  return `esperando há ${Math.round(d / 30)} meses — já passou da hora 😂`;
};

// cartão rico + expansão in-place (sinopse, onde assistir, quem quer, quick actions)
const WatchlistCard = ({ e, users, currentUser, both, compat, onAlsoWant, onMarkWatched, onDelete, prefs }) => {
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState(null);
  const wanted = wantedByOf(e);
  const iWant = wanted.includes(currentUser);
  const days = waitingDays(e);
  const rating = e.tmdbRating ? parseFloat(e.tmdbRating) : null;
  const genre = e.genres?.[0];

  useEffect(() => {
    if (!open || providers !== null || !e.tmdbId) return;
    const ep = e.type === "tv" ? "tv" : "movie";
    tmdbRequest(`/${ep}/${e.tmdbId}/watch/providers`)
      .then(d => setProviders({ flatrate: d.results?.BR?.flatrate || [], link: d.results?.BR?.link || null }))
      .catch(() => setProviders({ flatrate: [], link: null }));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`wl-card ${both ? "wl-card--perfect" : ""} ${open ? "wl-card--open" : ""}`}>
      <button className="wl-card__main" onClick={() => setOpen(o => !o)}>
        <div className="wl-card__poster-wrap">
          {e.poster
            ? <img src={`${TMDB_IMG}${e.poster}`} alt="" className="wl-card__poster"/>
            : <div className="wl-card__poster wl-card__poster--fallback"><Ic n={e.type === "tv" ? "tv" : "film"} s={22}/></div>}
          {e.priority === "alta" && <span className="wl-card__flame" title="Prioridade alta">🔥</span>}
        </div>

        <div className="wl-card__body">
          {both
            ? <div className="wl-card__perfect-tag">❤️ Escolha perfeita — os dois querem</div>
            : <div className="wl-card__who">{wanted[0]?.split(" ")[0] || "alguém"} quer ver</div>}

          <div className="wl-card__title">{e.title}</div>

          <div className="wl-card__badges">
            {rating != null && <span className="wl-badge wl-badge--imdb">⭐ {rating.toFixed(1)}</span>}
            {e.runtime ? <span className="wl-badge">⏱️ {fmtDur(e.runtime)}</span> : e.type === "tv" && <span className="wl-badge">📺 série</span>}
            {genre && <span className="wl-badge">{genre}</span>}
            {e.year && <span className="wl-badge wl-badge--muted">{e.year}</span>}
          </div>

          {both ? (
            <div className="wl-compat">
              <div className="wl-compat__label">❤️ Compatibilidade do casal</div>
              <div className="wl-compat__bar"><span style={{ width: `${compat ?? 80}%` }}/></div>
              <div className="wl-compat__pct">{compat != null ? `${compat}%` : "alta"}</div>
            </div>
          ) : (
            <div className="wl-card__wait">🕒 {waitingCopy(days)}</div>
          )}
        </div>

        <span className={`wl-card__chevron ${open ? "wl-card__chevron--open" : ""}`}><Ic n="chev" s={16}/></span>
      </button>

      {/* expansão in-place */}
      {open && (
        <div className="wl-card__expand">
          {e.overview && <p className="wl-card__overview">{e.overview}</p>}

          {/* quem quer */}
          <div className="wl-card__wanted">
            {users.map(u => (
              <span key={u} className={`wl-who__chip ${wanted.includes(u) ? "wl-who__chip--on" : ""}`}>
                <AvaGrad name={u} users={users} size={20}/>
                <span>{u.split(" ")[0]}{wanted.includes(u) ? " quer" : " ainda não"}</span>
              </span>
            ))}
          </div>

          {/* onde assistir */}
          {e.tmdbId && (
            <div className="wl-card__providers">
              <span className="wl-card__providers-label">Onde assistir</span>
              {providers === null ? (
                <span className="wl-card__providers-loading">verificando…</span>
              ) : providers.flatrate.length ? (
                <div className="wl-card__providers-row">
                  {providers.flatrate.slice(0, 5).map(p => (
                    <img key={p.provider_id} src={`https://image.tmdb.org/t/p/w92${p.logo_path}`} alt={p.provider_name} title={p.provider_name} className="wl-card__provider"/>
                  ))}
                </div>
              ) : (
                <span className="wl-card__providers-loading">não está em streaming no Brasil</span>
              )}
            </div>
          )}

          {/* quick actions */}
          <div className="wl-card__actions">
            {onMarkWatched && (
              <button className="pill pill--primary" onClick={e2 => { e2.stopPropagation(); onMarkWatched(e); }}>
                🍿 Registrar sessão
              </button>
            )}
            {!both && !iWant && onAlsoWant && (
              <button className="pill pill--gold-outline" onClick={e2 => {
                e2.stopPropagation();
                e2.currentTarget.classList.add("heart-pop");
                onAlsoWant(e);
              }}>❤ Também quero</button>
            )}
            {onDelete && (
              <button className="pill pill--outline pill--sm" onClick={e2 => { e2.stopPropagation(); onDelete(e); }} aria-label="Remover">
                <Ic n="trash" s={15}/>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const WatchlistPage = ({ watchlist, users, currentUser, compat, onDelete, onMarkWatched, onRoulette, onAlsoWant, prefs }) => {
  const [who, setWho] = useState("all"); // all | both | <nome>
  const [refine, setRefine] = useState("all"); // all | high | imdb | recent | <genre>

  const bothWant = e => users.length === 2 && users.every(u => wantedByOf(e).includes(u));

  // gêneros presentes na watchlist (para filtros inteligentes)
  const genrePool = [...new Set(watchlist.flatMap(w => (w.genres || []).slice(0, 1)))].slice(0, 3);

  let items = [...watchlist];
  if (who === "both") items = items.filter(bothWant);
  else if (who !== "all") items = items.filter(w => wantedByOf(w).includes(who));
  if (refine === "high") items = items.filter(w => w.priority === "alta");
  else if (refine === "imdb") items = items.filter(w => parseFloat(w.tmdbRating) >= 8);
  else if (refine === "recent") items.sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));
  else if (genrePool.includes(refine)) items = items.filter(w => (w.genres || []).includes(refine));

  if (refine !== "recent") {
    const priOrder = { alta: 0, normal: 1, baixa: 2 };
    // os "dois querem" primeiro, depois prioridade, depois mais antigos no topo (já passou da hora)
    items.sort((a, b) =>
      (bothWant(b) - bothWant(a)) ||
      ((priOrder[a.priority] ?? 1) - (priOrder[b.priority] ?? 1)) ||
      (new Date(a.addedAt || 0) - new Date(b.addedAt || 0))
    );
  }

  const bothCount = watchlist.filter(bothWant).length;

  const filters = [
    { key: "all", emoji: "❤️", label: "Todos", count: watchlist.length },
    { key: "both", emoji: "🤝", label: "Ambos", count: bothCount },
    ...users.map(u => ({ key: u, avatar: u, label: u.split(" ")[0], count: watchlist.filter(w => wantedByOf(w).includes(u)).length })),
  ];

  return (
    <div>
      {/* header humano */}
      <div className="wl-hero-head">
        <div className="acervo-head__sub">Nossa Watchlist</div>
        <div className="acervo-head__title">
          {watchlist.length === 0 ? "Nenhuma sessão planejada" : `${watchlist.length} ${watchlist.length === 1 ? "filme esperando" : "filmes esperando"} 🍿`}
        </div>
      </div>

      {/* planejador + roleta como CTA de destaque */}
      {watchlist.length >= 2 && (
        <button className="wl-planner" onClick={onRoulette}>
          <img src={lumiSrc("roulette")} alt="" className="wl-planner__lumi"/>
          <div className="wl-planner__body">
            <div className="wl-planner__eyebrow">Não conseguem decidir?</div>
            <div className="wl-planner__title">Deixem o Lumi escolher a sessão de hoje</div>
            <span className="wl-planner__cta">🎲 Girar a roleta</span>
          </div>
        </button>
      )}

      {watchlist.length === 0 ? (
        <LumiState
          lumi="pointing"
          title="Lista a dois, ainda vazia"
          text="Guardem aqui as próximas memórias que vocês querem criar juntos."
        />
      ) : (
        <>
          {/* filtros quem quer — chips estilo Apple Music */}
          <div className="wl-chiprow">
            {filters.map(f => (
              <button key={f.key} className={`wl-chip ${who === f.key ? "wl-chip--active" : ""}`} onClick={() => setWho(f.key)}>
                {f.avatar ? <AvaGrad name={f.avatar} users={users} size={18}/> : <span>{f.emoji}</span>}
                <span>{f.label}</span>
                <b>{f.count}</b>
              </button>
            ))}
          </div>

          {/* filtros inteligentes */}
          <div className="wl-chiprow wl-chiprow--refine">
            {[["all", "Tudo"], ["high", "🔥 Alta"], ["imdb", "⭐ 8+"], ["recent", "🕒 Recentes"]].map(([k, l]) => (
              <button key={k} className={`wl-chip wl-chip--sm ${refine === k ? "wl-chip--active" : ""}`}
                onClick={() => setRefine(refine === k ? "all" : k)}>{l}</button>
            ))}
            {genrePool.map(g => (
              <button key={g} className={`wl-chip wl-chip--sm ${refine === g ? "wl-chip--active" : ""}`}
                onClick={() => setRefine(refine === g ? "all" : g)}>{g}</button>
            ))}
          </div>

          {items.length === 0 ? (
            <LumiState lumi="confuso" title="Nada por aqui" text="Nenhum título com esse filtro." />
          ) : (
            <div className="wl-cards">
              {items.map(e => (
                <WatchlistCard key={e.id} e={e} users={users} currentUser={currentUser}
                  both={bothWant(e)} compat={compat}
                  onAlsoWant={onAlsoWant} onMarkWatched={onMarkWatched} onDelete={onDelete} prefs={prefs}/>
              ))}
            </div>
          )}

          {/* Lumi sugere o mais antigo */}
          {(() => {
            const oldest = [...watchlist].filter(w => w.addedAt).sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt))[0];
            const d = oldest ? waitingDays(oldest) : 0;
            return prefs?.lumiComments !== false && oldest && d >= 30 ? (
              <div className="lumi-note" style={{ marginTop: 16 }} role="note">
                <img src={lumiSrc("pointing")} alt="Lumi"/>
                <div className="lumi-note__text">
                  "{oldest.title} está esperando há {d < 60 ? `${d} dias` : `${Math.round(d / 30)} meses`}. Que tal hoje?"
                </div>
              </div>
            ) : null;
          })()}
        </>
      )}
    </div>
  );
};


// ---------- conquistas do casal (12 medalhas do design) ----------
const coupleAchievements = (watched, users, couple) => {
  const total = watched.length;
  const movies = watched.filter(w => w.type === "movie").length;
  const cinema = watched.filter(w => w.where === "cinema").length;
  const totalRuntime = watched.reduce((s, w) => s + (w.runtime || 0), 0);
  const dates = watched.map(w => w.date || (w.createdAt || "").slice(0, 10)).filter(Boolean).sort();
  const dias365 = couple?.since ? (new Date() - new Date(couple.since)) / 86400000 >= 365 : false;
  const virada = dates.some(d => d.slice(5) === "12-31" || d.slice(5) === "01-01");
  const epDays = {};
  watched.forEach(w => (w.episodeHistory || []).forEach(h => { if (h.date) epDays[h.date] = (epDays[h.date] || 0) + 1; }));
  const maratona = Object.values(epDays).some(n => n >= 4);
  const choramos = watched.some(w => {
    const rs = users.map(u => w.reviews?.[u]?.rating || 0);
    return rs.length === 2 && rs.every(r => r === 5) && (w.genres || []).some(g => /romance|drama/i.test(g));
  });
  const coruja = watched.some(w => { const h = new Date(w.createdAt || 0).getHours(); return h >= 0 && h < 5; });
  const semana3 = (() => {
    const ds = dates.map(d => new Date(d + "T12:00:00").getTime()).sort((a, b) => a - b);
    for (let i = 0; i + 2 < ds.length; i++) if (ds[i + 2] - ds[i] <= 7 * 86400000) return true;
    return false;
  })();
  const criticas = watched.reduce((n, w) => n + Object.values(w.reviews || {}).filter(r => r.text?.trim()).length, 0);
  const commonFavorite = watched.some(w => {
    const a = w.reviews?.[users[0]]?.rating || 0;
    const b = w.reviews?.[users[1]]?.rating || 0;
    return a >= 4 && b >= 4;
  });
  const rewatch = watched.some(w => watched.filter(x => x.title === w.title).length > 1);
  const equalRating = watched.some(w => {
    const a = w.reviews?.[users[0]]?.rating || 0;
    const b = w.reviews?.[users[1]]?.rating || 0;
    return a > 0 && b > 0 && a === b;
  });
  const saga = watched.some(w => w.type === "tv" && w.status === "completed");
  return [
    { id: "primeira", label: "Primeira sessão", lumi: "medal", done: total >= 1, progress: total, target: 1 },
    { id: "primeiro-filme", label: "Primeiro filme juntos", lumi: "holdingStar", done: movies >= 1, progress: movies, target: 1 },
    { id: "cinema1", label: "Primeiro no cinema", lumi: "camera", done: cinema >= 1, progress: cinema, target: 1 },
    { id: "dezena", label: "10 filmes juntos", lumi: "aplaudindo", done: movies >= 10, progress: movies, target: 10 },
    { id: "cinema10", label: "10 no cinema", lumi: "camera", done: cinema >= 10, progress: cinema, target: 10 },
    { id: "meio", label: "50 filmes juntos", lumi: "achievement", done: movies >= 50, progress: movies, target: 50 },
    { id: "semana3", label: "3 dias seguidos", lumi: "correndo", done: semana3, progress: 3, target: 3 },
    { id: "maratona", label: "Primeira maratona", lumi: "popcornFlying", done: maratona, progress: 1, target: 1 },
    { id: "favorito", label: "Favorito em comum", lumi: "inLove", done: commonFavorite, progress: commonFavorite ? 1 : 0, target: 1 },
    { id: "rewatch", label: "Reassistir especial", lumi: "holdingStar", done: rewatch, progress: rewatch ? 1 : 0, target: 1 },
    { id: "horas100", label: "100 horas juntos", lumi: "milestone365", done: totalRuntime >= 6000, progress: Math.min(Math.round(totalRuntime / 60), 100), target: 100 },
    { id: "anos365", label: "1 ano usando o Sessão", lumi: "milestone365", done: dias365, progress: dias365 ? 1 : 0, target: 1 },
    { id: "igual", label: "Nota igual no mesmo filme", lumi: "stars", done: equalRating, progress: equalRating ? 1 : 0, target: 1 },
    { id: "saga", label: "Completar uma saga", lumi: "holdingPopcorn", done: saga, progress: saga ? 1 : 0, target: 1 },
    { id: "choramos", label: "Choramos juntos", lumi: "chorando_emocao", done: choramos, progress: choramos ? 1 : 0, target: 1 },
    { id: "critico", label: "Críticos do sofá", lumi: "laptop", done: criticas >= 20, progress: criticas, target: 20 },
    { id: "virada", label: "Virada a dois", lumi: "fireworks", done: virada, progress: virada ? 1 : 0, target: 1 },
    { id: "cem", label: "100 filmes", lumi: "milestone100", done: movies >= 100, progress: movies, target: 100 },
  ];
};

// conquistas — galeria completa (v3)
const AchievementsPage = ({ watched, users, couple, onClose, prefs }) => {
  const list = coupleAchievements(watched, users, couple);
  const done = list.filter(a => a.done).length;
  const movies = watched.filter(w => w.type === "movie").length;
  const faltam100 = Math.max(0, 100 - movies);
  return createPortal(
    <div className="subpage">
      <div className="subpage__inner">
        <div className="cfg-head">
          <button className="cfg-back" onClick={onClose} aria-label="Voltar">←</button>
          <div>
            <div className="cfg-title" style={{ lineHeight: 1 }}>Conquistas</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{done} de {list.length} desbloqueadas</div>
          </div>
        </div>
        <div className="aw-progress"><i style={{ width: `${Math.round(done / list.length * 100)}%` }}/></div>
        <div className="aw-grid">
          {list.map(a => (
            <div key={a.id} className={`medal ${a.done ? "" : "medal--locked"}`}>
              <img src={lumiSrc(a.lumi)} alt=""/>
              <span>{a.label}</span>
              {a.target && <div className="medal__meta">{a.done ? "desbloqueada" : `${a.progress || 0}/${a.target}`}</div>}
            </div>
          ))}
        </div>
        {prefs?.lumiComments !== false && faltam100 > 0 && faltam100 <= 20 && (
          <div className="lumi-note" style={{ marginTop: 14 }}>
            <img src={lumiSrc("proud")} alt="Lumi"/>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold-soft)" }}>Faltam {faltam100} filme{faltam100 !== 1 ? "s" : ""} para "100 filmes"</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>a maior medalha de todas. tô torcendo.</div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

// ---------- Retrospectiva story-mode (6 slides do design) ----------
const RetroStory = ({ watched, users, couple, onClose }) => {
  const [idx, setIdx] = useState(0);
  const [yearIdx, setYearIdx] = useState(0);
  const cardRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  const currentYear = String(new Date().getFullYear());
  const years = [...new Set(watched.map(w => {
    const ds = w.date || (w.createdAt || "").slice(0, 10);
    return ds ? ds.slice(0, 4) : null;
  }).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const availableYears = years.filter(y => new Date(`${y}-12-31T23:59:59`) <= new Date());
  const year = availableYears[Math.min(yearIdx, Math.max(0, availableYears.length - 1))] || null;

  const items = year ? watched.filter(w => (w.date || (w.createdAt || "").slice(0, 10)).startsWith(year)) : [];
  const count = items.length;
  const totalMins = items.reduce((s, w) => s + (w.runtime || 0), 0);
  const allR = items.flatMap(w => Object.values(w.reviews || {}).map(r => r.rating).filter(Boolean));
  const media = allR.length ? allR.reduce((a, b) => a + b, 0) / allR.length : 0;

  const genreCount = {};
  items.forEach(w => (w.genres || []).forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; }));
  const topGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const genreItems = topGenres[0] ? items.filter(w => (w.genres || []).includes(topGenres[0][0])) : [];
  const genreAvgArr = genreItems.flatMap(w => Object.values(w.reviews || {}).map(r => r.rating).filter(Boolean));
  const genreAvg = genreAvgArr.length ? genreAvgArr.reduce((a, b) => a + b, 0) / genreAvgArr.length : 0;

  const best = [...items].filter(w => mediaEntry(w) > 0).sort((a, b) => mediaEntry(b) - mediaEntry(a))[0] || null;
  const bestQuote = best ? (() => {
    for (const u of users) { const t = best.reviews?.[u]?.text?.trim(); if (t) return { t, u }; }
    return null;
  })() : null;

  // recordes
  const epDays = {};
  items.forEach(w => (w.episodeHistory || []).forEach(h => { if (h.date?.startsWith(year)) epDays[h.date] = { n: (epDays[h.date]?.n || 0) + 1, title: w.title }; }));
  const marathon = Object.values(epDays).sort((a, b) => b.n - a.n)[0];
  const discord = items.filter(w => {
    const rs = users.map(u => w.reviews?.[u]?.rating || 0);
    return rs.length === 2 && rs.every(Boolean) && Math.abs(rs[0] - rs[1]) >= 2;
  }).sort((a, b) => {
    const d = w => Math.abs((w.reviews?.[users[0]]?.rating || 0) - (w.reviews?.[users[1]]?.rating || 0));
    return d(b) - d(a);
  })[0];
  const monthCount = {};
  items.forEach(w => { const m = (w.date || w.createdAt || "").slice(0, 7); if (m) monthCount[m] = (monthCount[m] || 0) + 1; });
  const topMonth = Object.entries(monthCount).sort((a, b) => b[1] - a[1])[0];
  const fmtMonth = m => m ? new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1).toLocaleDateString("pt-BR", { month: "long" }) : "";
  const records = [
    marathon && marathon.n >= 2 && { lumi: "popcornFlying", t: "Maior maratona", s: `${marathon.n} episódios numa noite · ${marathon.title}` },
    discord && { lumi: "bravo_fofo", t: "Maior discordância", s: `${users[0]} ${nota10(discord.reviews[users[0]].rating)} × ${users[1]} ${nota10(discord.reviews[users[1]].rating)} · ${discord.title}` },
    topMonth && { lumi: "stars", t: "Mês mais cinéfilo", s: `${fmtMonth(topMonth[0])} · ${topMonth[1]} sessõ${topMonth[1] === 1 ? "e" : "es"} juntos` },
    best && { lumi: "holdingStar", t: "Nota máxima", s: `${best.title} · ★ ${nota10(mediaEntry(best))}` },
  ].filter(Boolean).slice(0, 4);

  const slides = [
    "open",
    count > 0 && "count",
    topGenres.length > 0 && "genre",
    best && "movie",
    records.length > 0 && "records",
    "poster",
  ].filter(Boolean);
  const cur = slides[idx];
  const next = () => setIdx(i => Math.min(i + 1, slides.length - 1));
  const prev = () => setIdx(i => Math.max(i - 1, 0));

  const shareCard = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const url = await toPng(cardRef.current, { pixelRatio: 3 });
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], `retrospectiva-${year}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Retrospectiva ${year}` });
      } else {
        const a = document.createElement("a");
        a.href = url; a.download = `retrospectiva-${year}.png`; a.click();
      }
    } catch (e) { console.error(e); }
    setSharing(false);
  };

  const bg = { open: "s0", count: "s1", genre: "s2", movie: "s3", records: "s4", poster: "s5" }[cur];

  if (!year) return createPortal(
    <div className="retro-story retro-story--s5">
      <button className="retro-story__close" onClick={onClose} aria-label="Fechar">✕</button>
      <div className="retro-story__slide" style={{ justifyContent: "center" }}>
        <div className="retro-story__eyebrow" style={{ color: "var(--gold)" }}>Retrospectiva anual</div>
        <div className="retro-story__title" style={{ fontSize: 38, marginTop: 18 }}>A retrospectiva de {currentYear} ainda não foi liberada</div>
        <p className="retro-story__sub" style={{ maxWidth: 320 }}>
          O calendário de vocês merece uma abertura especial no fim do ano. Enquanto isso, os anos já concluídos aparecem aqui automaticamente.
        </p>
        <div className="retro-story__cta-stack">
          <button className="pill pill--light pill--block" onClick={onClose}>Voltar para o perfil</button>
        </div>
      </div>
    </div>,
    document.body
  );

  return createPortal(
    <div className={`retro-story retro-story--${bg}`}>
      <div className="retro-story__bars">
        {slides.map((s, i) => (
          <div key={s} className={`retro-story__bar ${i <= idx ? "retro-story__bar--done" : ""}`}/>
        ))}
      </div>
      {availableYears.length > 1 && (
        <div className="retro-year-switch">
          <button className="retro-year-switch__btn" onClick={() => { setYearIdx(i => Math.max(0, i - 1)); setIdx(0); }} disabled={yearIdx === 0}>←</button>
          <div className="retro-year-switch__label">{year}</div>
          <button className="retro-year-switch__btn" onClick={() => { setYearIdx(i => Math.min(availableYears.length - 1, i + 1)); setIdx(0); }} disabled={yearIdx === availableYears.length - 1}>→</button>
        </div>
      )}
      <button className="retro-story__close" onClick={onClose} aria-label="Fechar">✕</button>
      <div className="retro-story__tap" onClick={e => {
        const x = e.clientX / window.innerWidth;
        if (x < 0.35) prev(); else next();
      }}><i/><i/><i/></div>

      {cur === "open" && (
        <div className="retro-story__slide" key="open">
          <div className="retro-story__glow" style={{ background: "radial-gradient(circle,rgba(180,138,208,.2),transparent 65%)" }}/>
          <Lumi name="hiddenCurtain" size={230} breathe style={{ marginTop: 30, position: "relative" }}/>
          <div className="retro-story__eyebrow" style={{ color: "var(--lilac-retro)", marginTop: 26 }}>Sessão Wrapped {year}</div>
          <div className="retro-story__title" style={{ fontSize: 42, marginTop: 10 }}>O ano de vocês<br/>em cinema</div>
          <p className="retro-story__sub" style={{ maxWidth: 320, marginTop: 12 }}>
            Filmes, memórias, noites especiais e aquele gosto de querer repetir tudo de novo.
          </p>
          <div className="retro-story__cta-stack">
            <button className="pill pill--light pill--block" onClick={e => { e.stopPropagation(); next(); }} style={{ position: "relative", zIndex: 3 }}>Abrir as cortinas ✦</button>
          </div>
        </div>
      )}

      {cur === "count" && (
        <div className="retro-story__slide" key="count">
          <Lumi name="retrospective" size={200} breathe style={{ marginTop: 14, position: "relative" }}/>
          <div className="retro-story__giant">{count}</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 500, color: "#c9b8d8", marginTop: 4, position: "relative" }}>
            noite{count !== 1 ? "s" : ""} juntos este ano
          </div>
          <p className="retro-story__sub">
            {count >= 40 ? <>quase uma sessão por semana.<br/>vocês são oficialmente um cineclube.</>
              : count >= 12 ? <>uma por mês, no mínimo.<br/>o sofá agradece.</>
              : <>cada uma delas virou memória.<br/>ano que vem tem mais.</>}
          </p>
        </div>
      )}

      {cur === "genre" && (
        <div className="retro-story__slide" key="genre">
          <div className="retro-story__eyebrow" style={{ color: "var(--pink-genre)" }}>o gênero de vocês</div>
          <Lumi name="inLove" size={190} breathe style={{ marginTop: 20, position: "relative" }}/>
          <div className="retro-story__title" style={{ fontSize: 44, marginTop: 18 }}>{topGenres[0][0]}</div>
          <p className="retro-story__sub">
            {topGenres[0][1]} sessõ{topGenres[0][1] === 1 ? "e" : "es"}{genreAvg ? ` · nota média ${nota10(genreAvg)}` : ""}
          </p>
          <div className="retro-genrebars">
            {topGenres.map(([g, c]) => (
              <div key={g}>
                <i style={{ height: `${Math.max(24, Math.round(c / topGenres[0][1] * 96))}px` }}/>
                <span>{g.length > 9 ? g.slice(0, 8) + "…" : g}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cur === "movie" && (
        <div className="retro-story__slide" key="movie">
          <div className="retro-story__eyebrow" style={{ color: "var(--gold)" }}>o filme do ano de vocês</div>
          <div className="retro-poster-frame">
            {best.poster && <img src={`${TMDB_IMG}${best.poster}`} alt="" className="poster"/>}
            <img src={lumiSrc("holdingStar")} alt="" className="lumi-star"/>
          </div>
          <div className="retro-story__title" style={{ fontSize: 36, marginTop: 24 }}>{best.title}</div>
          <div style={{ fontSize: 15, color: "var(--gold)", marginTop: 8, position: "relative" }}>★ {nota10(mediaEntry(best))} · a maior nota do ano</div>
          {bestQuote && <p className="retro-story__sub">"{bestQuote.t.length > 60 ? bestQuote.t.slice(0, 60) + "…" : bestQuote.t}" — {bestQuote.u}</p>}
        </div>
      )}

      {cur === "records" && (
        <div className="retro-story__slide" key="records">
          <div className="retro-story__eyebrow" style={{ color: "var(--teal)" }}>os recordes de vocês</div>
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12, width: "100%", position: "relative" }}>
            {records.map(r => (
              <div key={r.t} className="retro-record">
                <img src={lumiSrc(r.lumi)} alt=""/>
                <div>
                  <div className="retro-record__t">{r.t}</div>
                  <div className="retro-record__s">{r.s}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="retro-story__hint" style={{ gap: 10 }}>
            <img src={lumiSrc("rindo")} alt="" style={{ width: 44, height: 44, objectFit: "contain" }}/>
            <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 16, color: "var(--teal)" }}>"eu vi tudo. cada sessão."</span>
          </div>
        </div>
      )}

      {cur === "poster" && (
        <div className="retro-story__slide" key="poster">
          <div ref={cardRef} className="retro-share-card">
            <div className="retro-story__eyebrow" style={{ color: "var(--lilac-retro)", letterSpacing: "2.5px", fontSize: 10 }}>Retrospectiva {year}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, marginTop: 10, lineHeight: 1.1 }}>
              {couple.name1} & {couple.name2}
            </div>
            <div className="retro-share-card__stats">
              <div><div>{count}</div><div>noite{count !== 1 ? "s" : ""}</div></div>
              {totalMins > 0 && <div><div>{Math.round(totalMins / 60)}h</div><div>de sofá</div></div>}
              {media > 0 && <div><div>{nota10(media)}</div><div>nota média</div></div>}
            </div>
            {best && <div style={{ fontSize: 12, color: "#c9b8d8", marginTop: 14 }}>filme do ano · {best.title}</div>}
            <Lumi name="celebrating" size={130} breathe style={{ margin: "12px auto 0" }}/>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
              <img src={lumiSrc("ui_silhueta")} alt="" style={{ width: 24, height: 24, objectFit: "contain", opacity: 0.7 }}/>
            </div>
          </div>
          <div className="retro-story__cta-stack">
            <button className="pill pill--light pill--block" disabled={sharing}
              onClick={e => { e.stopPropagation(); shareCard(); }}>
              {sharing ? "Gerando..." : "Compartilhar nos stories ✦"}
            </button>
            <button className="pill pill--outline pill--block" onClick={e => { e.stopPropagation(); setIdx(0); }}>Rever do início</button>
          </div>
        </div>
      )}

      {cur !== "poster" && cur !== "open" && (
        <div className="retro-story__hint">toque para continuar <span style={{ color: "var(--lilac-retro)" }}>→</span></div>
      )}
    </div>,
    document.body
  );
};

function exportToPdf(watched, users, couple) {
  const sorted = [...watched].sort((a,b)=>new Date(b.date||b.createdAt)-new Date(a.date||a.createdAt));
  const avgR = w => { const rs=Object.values(w.reviews||{}).map(r=>r.rating).filter(Boolean); return rs.length?(rs.reduce((a,b)=>a+b,0)/rs.length).toFixed(1):null; };
  const fmtDate = d => d?new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"}):"";
  const totalMins = watched.reduce((s,w)=>s+(w.runtime||0),0);
  const cinemaCount = watched.filter(w=>w.where==="cinema").length;
  const all = watched.flatMap(w=>Object.values(w.reviews||{}).map(r=>r.rating).filter(Boolean));
  const globalAvg = all.length?(all.reduce((a,b)=>a+b,0)/all.length).toFixed(1):null;

  const rows = sorted.map(e => {
    const avg = avgR(e);
    const stars = avg ? "★".repeat(Math.round(parseFloat(avg)))+"☆".repeat(5-Math.round(parseFloat(avg))) : "";
    const uRatings = users.map(u=>{ const r=e.reviews?.[u]?.rating; return r?`${u}: ${"★".repeat(r)}`:null; }).filter(Boolean).join(" · ");
    return `<tr>
      <td class="t">${e.title}</td>
      <td>${e.type==="tv"?"Série":"Filme"}</td>
      <td>${e.year||""}</td>
      <td>${e.where==="cinema"?"Cinema":"Streaming"}</td>
      <td class="nowrap">${fmtDate(e.date)}</td>
      <td class="nowrap">${avg?`${avg} <span class="stars">${stars}</span>`:"—"}</td>
      <td class="small">${uRatings}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="UTF-8">
<title>Sessão — ${couple.name1} &amp; ${couple.name2}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;background:#fff;padding:32px 28px;font-size:13px}
h1{font-size:26px;color:#c9394a;margin-bottom:3px}
.sub{font-size:13px;color:#777;margin-bottom:20px}
.stats{display:flex;gap:20px;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #f0f0f0;flex-wrap:wrap}
.stat{text-align:center}.stat b{display:block;font-size:18px;font-family:Arial,sans-serif;color:#1a1a1a}
.stat span{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:7px 6px;border-bottom:2px solid #c9394a;font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#c9394a;font-family:Arial,sans-serif}
td{padding:6px 6px;border-bottom:1px solid #f0f0f0;vertical-align:top}
tr:nth-child(even) td{background:#fafafa}
td.t{font-weight:600;max-width:210px}
td.nowrap{white-space:nowrap}
td.small{font-size:11px;color:#666}
.stars{color:#c9993a}
.footer{margin-top:20px;font-size:11px;color:#bbb;text-align:right}
@media print{body{padding:0}@page{margin:14mm}}
</style></head><body>
<h1>Sessão ❤️</h1>
<div class="sub">${couple.name1} &amp; ${couple.name2} — Diário cinematográfico</div>
<div class="stats">
  <div class="stat"><b>${watched.length}</b><span>Títulos</span></div>
  <div class="stat"><b>${watched.filter(w=>w.type==="movie").length}</b><span>Filmes</span></div>
  <div class="stat"><b>${watched.filter(w=>w.type==="tv").length}</b><span>Séries</span></div>
  <div class="stat"><b>${cinemaCount}</b><span>No cinema</span></div>
  ${totalMins>0?`<div class="stat"><b>${Math.floor(totalMins/60)}h ${totalMins%60}min</b><span>Assistidos</span></div>`:""}
  ${globalAvg?`<div class="stat"><b>${globalAvg} ★</b><span>Nota média</span></div>`:""}
</div>
<table><thead><tr>
  <th>Título</th><th>Tipo</th><th>Ano</th><th>Onde</th><th>Data</th><th>Nota</th><th>Avaliações</th>
</tr></thead><tbody>${rows}</tbody></table>
<div class="footer">Gerado pelo Sessão • ${new Date().toLocaleDateString("pt-BR")}</div>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

const AnnualWrappedPrompt = ({ couple, onOpen, onClose }) => {
  const year = String(new Date().getFullYear());
  return createPortal(
    <div className="retro-story retro-story--s5" style={{ justifyContent: "center" }}>
      <button className="retro-story__close" onClick={onClose} aria-label="Fechar">✕</button>
      <div className="retro-story__slide" style={{ justifyContent: "center" }}>
        <Lumi name="celebrating" size={180} breathe style={{ position: "relative" }}/>
        <div className="retro-story__eyebrow" style={{ color: "var(--gold)", marginTop: 18 }}>Surpresa anual</div>
        <div className="retro-story__title" style={{ fontSize: 34, marginTop: 10 }}>{couple.name1} e {couple.name2}, preparei algo especial para vocês... ✨</div>
        <p className="retro-story__sub" style={{ maxWidth: 340 }}>
          Hoje é o dia de abrir o Sessão Wrapped {year}. Uma homenagem ao ano de vocês, em filmes, memórias e noites especiais.
        </p>
        <div className="retro-story__cta-stack">
          <button className="pill pill--light pill--block" onClick={() => { onOpen(); onClose(); }}>Abrir Sessão Wrapped {year}</button>
          <button className="pill pill--outline pill--block" onClick={onClose}>Guardar para depois</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const WrappedIntroOverlay = ({ year, couple, onClose }) => {
  useEffect(() => {
    const t = window.setTimeout(onClose, 1800);
    return () => window.clearTimeout(t);
  }, [onClose]);

  return createPortal(
    <div className="wrapped-intro">
      <div className="wrapped-intro__halo"/>
      <div className="wrapped-intro__badge">SESSÃO WRAPPED</div>
      <div className="wrapped-intro__title">{year}</div>
      <div className="wrapped-intro__name">{couple.name1} & {couple.name2}</div>
      <div className="wrapped-intro__text">Seu ano em filmes, memórias e noites especiais.</div>
    </div>,
    document.body
  );
};

const StoryTimelinePage = ({ watched, users, couple, retroYears = [], onOpenRetro, onClose }) => {
  const dateOf = e => e.date || (e.createdAt || "").slice(0, 10);
  const sorted = [...watched].filter(e => dateOf(e)).sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

  // agrupa por ano → mês, marcando capítulos especiais (1ª sessão, 1º cinema)
  const firstEver = sorted.length ? sorted[sorted.length - 1].id : null;
  const firstCinemaId = [...sorted].reverse().find(e => e.where === "cinema")?.id || null;
  const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const byYear = {};
  sorted.forEach(e => {
    const y = dateOf(e).slice(0, 4);
    (byYear[y] = byYear[y] || []).push(e);
  });
  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));

  const quoteOf = e => {
    for (const u of users) { const t = e.reviews?.[u]?.text?.trim(); if (t) return t; }
    return null;
  };
  const chapterIcon = e => e.id === firstEver ? "❤️" : e.id === firstCinemaId ? "🍿" : e.where === "cinema" ? "🎟️" : e.type === "tv" ? "📺" : "🏠";
  const chapterTag = e => e.id === firstEver ? "O primeiro filme juntos" : e.id === firstCinemaId ? "Primeira ida ao cinema" : null;

  return createPortal(
    <div className="subpage">
      <div className="subpage__inner">
        <div className="cfg-head">
          <button className="cfg-back" onClick={onClose} aria-label="Voltar">←</button>
          <div className="cfg-title">Nossa História</div>
        </div>
        <div className="retro-story__eyebrow" style={{ color: "var(--gold)", marginTop: 8 }}>🎞️ A linha do tempo do casal</div>
        <p className="retro-story__sub" style={{ textAlign: "left", marginTop: 8 }}>
          Cada sessão virou um capítulo. Aqui, o nosso cinema ganha forma.
        </p>

        {sorted.length === 0 ? (
          <div className="v3-card" style={{ padding: 16, marginTop: 18 }}>
            <div style={{ fontWeight: 700 }}>Ainda não há capítulos registrados</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>Quando vocês marcarem as primeiras sessões, a história aparece aqui.</div>
          </div>
        ) : years.map(y => (
          <div key={y} style={{ marginTop: 22 }}>
            <div className="story-year">{y}</div>

            {/* retrospectiva do ano (só anos concluídos) vive aqui dentro */}
            {retroYears.includes(y) && onOpenRetro && (
              <button className="story-wrapped" onClick={() => onOpenRetro(y)}>
                <img src={lumiSrc("retrospective")} alt=""/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="story-wrapped__eyebrow">✦ Sessão Wrapped</div>
                  <div className="story-wrapped__title">A retrospectiva de {y}</div>
                  <div className="story-wrapped__text">reviva o ano de vocês em filmes</div>
                </div>
                <span className="retro-cta__arrow">→</span>
              </button>
            )}

            <div className="story-timeline">
              {byYear[y].map(e => {
                const media = mediaEntry(e);
                const month = MONTHS[parseInt(dateOf(e).slice(5, 7)) - 1] || "";
                const quote = quoteOf(e);
                const tag = chapterTag(e);
                return (
                  <div key={e.id || `${e.title}-${dateOf(e)}`} className="story-chapter">
                    <div className="story-chapter__rail"><span className="story-chapter__icon">{chapterIcon(e)}</span></div>
                    <div className="story-chapter__body">
                      <div className="story-chapter__month">{month}{tag ? ` · ${tag}` : ""}</div>
                      <div className="story-chapter__title">{e.title}</div>
                      <div className="story-chapter__meta">
                        {e.where === "cinema" ? "No cinema" : "Em casa"} · {e.type === "tv" ? "série" : "filme"}{media > 0 ? ` · ★ ${nota10(media)}` : ""}
                      </div>
                      {quote && <div className="story-chapter__quote">"{quote.length > 90 ? quote.slice(0, 90) + "…" : quote}"</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="profile-lumi-footer" style={{ marginTop: 24 }}>
          <img src={lumiSrc("headHappy")} alt=""/> o Lumi guarda cada capítulo de vocês
        </div>
      </div>
    </div>,
    document.body
  );
};

// profile page — "Perfil do casal · conquistas" + estatísticas (v3)
const ProfilePage = ({ watched, watchlist, couple, users, prefs, onOpenSettings }) => {
  const [showRetro, setShowRetro] = useState(false);
  const [showAwards, setShowAwards] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAnnualSurprise, setShowAnnualSurprise] = useState(false);
  const [showWrappedIntro, setShowWrappedIntro] = useState(false);
  const statsRef = useRef(null);

  const total = watched.length;
  const totalMins = watched.reduce((s, w) => s + (w.runtime || 0), 0);
  const compat = coupleCompat(watched, users);
  const since = couple.since || couple.createdAt;
  const sinceLabel = since ? new Date(since.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "") : null;
  const days = couple.since ? Math.floor((new Date() - new Date(couple.since)) / 86400000) : null;

  const allR = watched.flatMap(w => Object.values(w.reviews || {}).map(r => r.rating).filter(Boolean));
  const mediaCasal = allR.length ? allR.reduce((a, b) => a + b, 0) / allR.length : 0;

  // Retrospectiva: só anos já concluídos ficam disponíveis (estilo Wrapped)
  const retroYears = [...new Set(watched.map(w => (w.date || (w.createdAt || "").slice(0, 10)).slice(0, 4)).filter(Boolean))]
    .filter(y => new Date(`${y}-12-31T23:59:59`) <= new Date())
    .sort((a, b) => b.localeCompare(a));
  const retroAvailable = retroYears.length > 0;

  // conquistas (3 em destaque: 2 últimas desbloqueadas + próxima bloqueada)
  const awards = coupleAchievements(watched, users, couple);
  const unlocked = awards.filter(a => a.done);
  const lockedNext = awards.find(a => !a.done);
  const featured = [...unlocked.slice(-2), ...(lockedNext ? [lockedNext] : [])].slice(0, 3);

  // gênero favorito
  const genreStats = {};
  watched.forEach(w => (w.genres || []).forEach(g => {
    if (!genreStats[g]) genreStats[g] = { n: 0, r: [] };
    genreStats[g].n++;
    Object.values(w.reviews || {}).forEach(rv => rv.rating && genreStats[g].r.push(rv.rating));
  }));
  const favGenre = Object.entries(genreStats).sort((a, b) => b[1].n - a[1].n)[0] || null;
  const favAvg = favGenre?.[1].r.length ? favGenre[1].r.reduce((a, b) => a + b, 0) / favGenre[1].r.length : 0;

  // sessões por mês (ano corrente)
  const yearNow = String(new Date().getFullYear());
  const monthNow = new Date().getMonth();
  const perMonth = Array.from({ length: monthNow + 1 }, (_, m) => {
    const key = `${yearNow}-${String(m + 1).padStart(2, "0")}`;
    return watched.filter(w => (w.date || (w.createdAt || "").slice(0, 10)).startsWith(key)).length;
  });
  const maxMonth = Math.max(1, ...perMonth);
  const monthLetters = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

  // per-user + insight do Lumi
  const userAvgs = users.map(u => {
    const rs = watched.flatMap(w => { const r = w.reviews?.[u]; return r?.rating ? [r.rating] : []; });
    return { name: u, avg: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null, n: rs.length };
  });
  const insight = (() => {
    if (prefs?.lumiComments === false) return null;
    const [a, b] = userAvgs;
    if (!a?.avg || !b?.avg) return null;
    if (Math.abs(a.avg - b.avg) < 0.15) return `${a.name} e ${b.name} avaliam quase igual. Sintonia rara.`;
    const alto = a.avg > b.avg ? a : b, baixo = a.avg > b.avg ? b : a;
    return `${alto.name} dá notas mais altas. ${baixo.name} é o crítico severo do sofá.`;
  })();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const now = new Date();
    const isDec31 = now.getMonth() === 11 && now.getDate() === 31;
    const key = `sessao-wrapped-${now.getFullYear()}-seen`;
    if (!isDec31) return;
    const seen = window.sessionStorage.getItem(key);
    if (!seen) {
      window.sessionStorage.setItem(key, "1");
      setShowAnnualSurprise(true);
    }
  }, []);

  return (
    <div>
      {showRetro && <RetroStory watched={watched} users={users} couple={couple} onClose={() => setShowRetro(false)}/>} 
      {showAwards && <AchievementsPage watched={watched} users={users} couple={couple} prefs={prefs} onClose={() => setShowAwards(false)}/>} 
      {showHistory && <StoryTimelinePage watched={watched} users={users} couple={couple}
        retroYears={retroYears} onOpenRetro={() => setShowRetro(true)} onClose={() => setShowHistory(false)}/>}
      {showAnnualSurprise && <AnnualWrappedPrompt couple={couple} onOpen={() => { setShowRetro(true); setShowWrappedIntro(true); }} onClose={() => setShowAnnualSurprise(false)}/>} 
      {showWrappedIntro && <WrappedIntroOverlay year={yearNow} couple={couple} onClose={() => setShowWrappedIntro(false)} />}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 26 }}>
        <div className="pf-avatars">
          <div className="pf-ava pf-ava--a">{couple.name1?.[0]?.toUpperCase()}</div>
          <div className="pf-ava pf-ava--b">{couple.name2?.[0]?.toUpperCase()}</div>
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, marginTop: 12 }}>
          {couple.name1} & {couple.name2}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
          {sinceLabel ? `juntos no Sessão desde ${sinceLabel}` : "juntos no Sessão"}{days !== null ? ` · ${days} dias` : ""}
        </div>
      </div>

      <div className="pf-stats">
        <div className="pf-stat"><div className="pf-stat__v">{total}</div><div className="pf-stat__l">sessões</div></div>
        <div className="pf-stat"><div className="pf-stat__v">{Math.round(totalMins / 60)}h</div><div className="pf-stat__l">no sofá</div></div>
        <div className="pf-stat"><div className="pf-stat__v">{compat !== null ? `${compat}%` : "—"}</div><div className="pf-stat__l">compatíveis</div></div>
      </div>

      <div className="home-last-label" style={{ marginTop: 18 }}>Nosso Cinema</div>
      <div className="profile-nav">
        <button className="profile-nav__card" onClick={() => setShowHistory(true)}>
          <div className="profile-nav__icon">📖</div>
          <div>
            <div className="profile-nav__title">Nossa História</div>
            <div className="profile-nav__text">
              {retroAvailable ? `Timeline · e a retrospectiva de ${retroYears[0]}` : "A linha do tempo das noites de vocês"}
            </div>
          </div>
        </button>
        <button className="profile-nav__card" onClick={() => statsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
          <div className="profile-nav__icon">📊</div>
          <div>
            <div className="profile-nav__title">Estatísticas</div>
            <div className="profile-nav__text">Filmes, horas e compatibilidade do casal</div>
          </div>
        </button>
        <button className="profile-nav__card" onClick={() => setShowAwards(true)}>
          <div className="profile-nav__icon">🏆</div>
          <div>
            <div className="profile-nav__title">Conquistas</div>
            <div className="profile-nav__text">Marcos que vocês conquistam juntos</div>
          </div>
        </button>
      </div>

      <div className="home-last-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Conquistas</span>
        <button onClick={() => setShowAwards(true)}
          style={{ background: "none", border: "none", color: "var(--gold)", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>
          VER TODAS →
        </button>
      </div>
      <div className="pf-medals">
        {featured.map(a => (
          <div key={a.id} className={`medal ${a.done ? "" : "medal--locked"}`} onClick={() => setShowAwards(true)} role="button">
            <img src={lumiSrc(a.lumi)} alt=""/>
            <span>{a.label}</span>
          </div>
        ))}
      </div>

      {favGenre && (
        <>
          <div className="home-last-label">Gênero favorito de vocês</div>
          <div className="v3-card" style={{ display: "flex", alignItems: "center", gap: 14, padding: 14 }}>
            <img src={lumiSrc("inLove")} alt="" style={{ width: 48, height: 48, objectFit: "contain" }}/>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{favGenre[0]}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                {favGenre[1].n} sessõ{favGenre[1].n === 1 ? "e" : "es"}{favAvg ? ` · nota média ${nota10(favAvg)}` : ""}
              </div>
            </div>
          </div>
        </>
      )}

      {total > 0 && (
        <div ref={statsRef}>
          <div className="home-last-label" style={{ marginTop: 22 }}>Números de vocês</div>
          <div className="stats-cardgrid" style={{ marginTop: 0 }}>
            <div className="stats-card"><div className="stats-card__v">{total}</div><div className="stats-card__l">sessões guardadas</div></div>
            <div className="stats-card"><div className="stats-card__v">{Math.round(totalMins / 60)}h</div><div className="stats-card__l">no sofá juntos</div></div>
            <div className="stats-card"><div className="stats-card__v">{mediaCasal ? nota10(mediaCasal) : "—"}</div><div className="stats-card__l">nota média do casal</div></div>
            <div className="stats-card"><div className="stats-card__v">{watchlist.length}</div><div className="stats-card__l">na lista a dois</div></div>
          </div>

          <div className="stats-chart">
            <div className="stats-chart__head">
              <span className="stats-chart__title">Sessões por mês</span>
              <span className="stats-chart__year">{yearNow}</span>
            </div>
            <div className="stats-bars">
              {perMonth.map((n, m) => (
                <div key={m} className={`stats-bar ${m === monthNow ? "stats-bar--hot" : ""}`}>
                  <i style={{ height: `${n === 0 ? 3 : Math.max(10, Math.round(n / maxMonth * 78))}px` }}/>
                  <span>{monthLetters[m]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="stats-userpair">
            {userAvgs.map(u => (
              <div key={u.name} className="stats-user">
                <AvaGrad name={u.name} users={users}/>
                <div>
                  <div className="stats-user__l">{u.name} avalia</div>
                  <div className="stats-user__v">{u.avg ? nota10(u.avg) : "—"}</div>
                </div>
              </div>
            ))}
          </div>

          {insight && (
            <div className="lumi-insight" style={{ marginTop: 14 }}>
              <img src={lumiSrc("thinking")} alt="Lumi"/>
              <div style={{ fontSize: 12, color: "#c9b8a3", lineHeight: 1.4 }}>{insight}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// configurações — "Lumi ajustável" (v3)
const SettingsPage = ({ couple, users, watched, prefs, onPref, onClose, onSignOut }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(couple.inviteCode || "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  };
  return createPortal(
    <div className="subpage">
      <div className="subpage__inner">
        <div className="cfg-head">
          <button className="cfg-back" onClick={onClose} aria-label="Voltar">←</button>
          <div className="cfg-title">Configurações</div>
        </div>

        <div className="cfg-couple">
          <div className="pf-avatars" style={{ justifyContent: "flex-start" }}>
            <div className="pf-ava pf-ava--a" style={{ width: 44, height: 44, fontSize: 18, borderWidth: 2 }}>{couple.name1?.[0]?.toUpperCase()}</div>
            <div className="pf-ava pf-ava--b" style={{ width: 44, height: 44, fontSize: 18, borderWidth: 2, marginLeft: -12 }}>{couple.name2?.[0]?.toUpperCase()}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{couple.name1} & {couple.name2}</div>
            {couple.inviteCode && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>código {couple.inviteCode}</div>}
          </div>
          {couple.inviteCode && (
            <button className="invite-dash__copy" onClick={copy}>{copied ? "Copiado ✔" : "Copiar"}</button>
          )}
        </div>

        <div className="cfg-section">O Lumi</div>
        <div className="cfg-group">
          <div className="cfg-row" style={{ cursor: "default" }}>
            <img src={lumiSrc("headSmiling")} alt=""/>
            <span className="cfg-row__label">Comentários do Lumi</span>
            <button className={`toggle ${prefs.lumiComments ? "toggle--on" : ""}`}
              onClick={() => onPref("lumiComments", !prefs.lumiComments)} aria-label="Comentários do Lumi"><i/></button>
          </div>
          <div className="cfg-row" style={{ cursor: "default" }}>
            <img src={lumiSrc("notification")} alt=""/>
            <span className="cfg-row__label">Lembretes de sexta</span>
            <button className={`toggle ${prefs.fridayReminders ? "toggle--on" : ""}`}
              onClick={() => onPref("fridayReminders", !prefs.fridayReminders)} aria-label="Lembretes de sexta"><i/></button>
          </div>
          <div className="cfg-row" style={{ cursor: "default" }}>
            <img src={lumiSrc("milestone365")} alt=""/>
            <span className="cfg-row__label">"Nesse dia" · memórias</span>
            <button className={`toggle ${prefs.onThisDay ? "toggle--on" : ""}`}
              onClick={() => onPref("onThisDay", !prefs.onThisDay)} aria-label="Nesse dia"><i/></button>
          </div>
        </div>

        <div className="cfg-section">Conta</div>
        <div className="cfg-group">
          <button className="cfg-row" onClick={() => exportToPdf(watched, users, couple)}>
            <span className="cfg-row__label">Exportar memórias</span>
            <span className="cfg-row__chev">›</span>
          </button>
          <button className="cfg-row" onClick={() => window.open("https://www.themoviedb.org/privacy-policy", "_blank", "noopener")}>
            <span className="cfg-row__label">Privacidade</span>
            <span className="cfg-row__chev">›</span>
          </button>
          <button className="cfg-row" onClick={onSignOut}>
            <span className="cfg-row__label cfg-row__label--danger">Sair</span>
          </button>
        </div>

        <div className="cfg-footer">
          <img src={lumiSrc("ui_silhueta")} alt=""/> Sessão · versão 3.0
        </div>
      </div>
    </div>,
    document.body
  );
};

// modo cinema — hub + ingresso + check-in (v3)
const CinemaPage = ({ watched, couple, coupleId, onClose, onRegister, addToast }) => {
  const [view, setView] = useState("hub"); // hub | ticket | checkin | plan
  const [plan, setPlan] = useState(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", time: "", venue: "", seats: "" });

  useEffect(() => {
    if (!coupleId) return;
    const un = onSnapshot(doc(db, "couples", coupleId, "cinema", "plan"), snap => {
      setPlan(snap.exists() ? snap.data() : null);
      setPlanLoaded(true);
    });
    return () => un();
  }, [coupleId]);

  const savePlan = async () => {
    if (!form.title.trim() || !form.date) return;
    await setDoc(doc(db, "couples", coupleId, "cinema", "plan"), form);
    setView("hub");
    addToast?.("Sessão marcada 🎟");
  };
  const clearPlan = async () => {
    await deleteDoc(doc(db, "couples", coupleId, "cinema", "plan")).catch(() => {});
  };

  const cinemaEntries = watched.filter(w => w.where === "cinema")
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  const fmtPlanDate = d => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).replace(/\./g, "") : "";
  const isToday = plan?.date === new Date().toISOString().slice(0, 10);
  const nextMilestone = plan ? "Ingresso pronto" : cinemaEntries.length >= 3 ? "Ritual de cinema consolidado" : "Primeira ida ao cinema";
  const cinemaMood = cinemaEntries.length === 0
    ? "Seu primeiro cinema ainda vai virar uma memória de verdade."
    : cinemaEntries.length < 3
      ? "Cada sessão nova dá mais personalidade à rotina de vocês."
      : "Vocês já têm um ritual cinematográfico digno de destaque.";

  return createPortal(
    <div className="subpage">
      <div className="subpage__inner">
        <div className="cfg-head">
          <button className="cfg-back" onClick={() => view === "hub" ? onClose() : setView("hub")} aria-label="Voltar">←</button>
          <div style={{ flex: 1 }}/>
          {view === "hub" && <Lumi name="cinemaSign" size={74} breathe/>}
        </div>

        {view === "hub" && (
          <div className="cine-wrap" style={{ padding: "0 0 20px" }}>
            <div className="cine-head" style={{ paddingTop: 0 }}>
              <div>
                <div className="cine-head__eyebrow">Modo cinema 🎟</div>
                <div className="cine-head__title">Noite fora de casa</div>
              </div>
            </div>

            <div className="cine-highlight-grid">
              <div className="cine-highlight-card">
                <div className="cine-highlight-card__eyebrow">ritual</div>
                <div className="cine-highlight-card__value">{cinemaEntries.length}</div>
                <div className="cine-highlight-card__text">sessões registradas · cada uma vira uma memória.</div>
              </div>
              <div className="cine-highlight-card">
                <div className="cine-highlight-card__eyebrow">próximo passo</div>
                <div className="cine-highlight-card__value">{plan ? "ingresso" : "marcar"}</div>
                <div className="cine-highlight-card__text">{nextMilestone}</div>
              </div>
              <div className="cine-highlight-card">
                <div className="cine-highlight-card__eyebrow">estado</div>
                <div className="cine-highlight-card__value">{plan ? "feito" : "a abrir"}</div>
                <div className="cine-highlight-card__text">{cinemaMood}</div>
              </div>
            </div>

            {plan ? (
              <div className="cine-next">
                <div className="cine-next__label">próxima sessão marcada</div>
                <div className="cine-next__title">{plan.title}</div>
                <div className="cine-next__meta">
                  {[fmtPlanDate(plan.date), plan.time, plan.venue].filter(Boolean).join(" · ")}
                </div>
                <button className="cine-next__btn" onClick={() => setView(isToday ? "checkin" : "ticket")}>
                  {isToday ? "Fazer check-in 🍿" : "Ver ingresso"}
                </button>
              </div>
            ) : planLoaded && (
              <div className="cine-next" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <div className="cine-next__label">nenhuma sessão marcada</div>
                <div className="cine-next__title" style={{ fontSize: 22 }}>Que tal uma tela grande?</div>
                <button className="cine-next__btn" onClick={() => setView("plan")}>＋ Marcar sessão</button>
              </div>
            )}

            {cinemaEntries.length > 0 && (
              <>
                <div className="home-last-label" style={{ color: "var(--amber-hi)", marginTop: 18 }}>Sessões no cinema</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {cinemaEntries.slice(0, 5).map(e => {
                    const avg = mediaEntry(e);
                    return (
                      <div key={e.id} className="cine-row">
                        {e.poster
                          ? <img src={`${TMDB_IMG}${e.poster}`} alt="" style={{ width: 40, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}/>
                          : <div style={{ width: 40, height: 56, borderRadius: 8, background: "linear-gradient(160deg,#8a5c30,#33200f)", flexShrink: 0 }}/>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{e.title}</div>
                          <div className="cine-row__meta">
                            {e.date ? new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "") : ""}
                          </div>
                        </div>
                        {avg > 0 && <span style={{ fontSize: 12, color: "var(--gold-soft)", flexShrink: 0 }}>★ {nota10(avg)}</span>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="cine-foot">
              <img src={lumiSrc("holdingPopcorn")} alt=""/>
              {cinemaEntries.length > 0
                ? `${cinemaEntries.length} ida${cinemaEntries.length !== 1 ? "s" : ""} ao cinema · vocês amam uma tela grande`
                : "a primeira ida ao cinema vira uma memória especial"}
            </div>
          </div>
        )}

        {view === "plan" && (
          <div style={{ marginTop: 10 }}>
            <div className="cine-head__title" style={{ fontSize: 26 }}>Marcar sessão</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              <input className="auth-input" placeholder="Filme (ex.: Superman)" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}/>
              <div style={{ display: "flex", gap: 10 }}>
                <input className="auth-input" type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}/>
                <input className="auth-input" type="time" value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: e.target.value }))}/>
              </div>
              <input className="auth-input" placeholder="Cinema · sala (ex.: Cinemark Sala 6)" value={form.venue}
                onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}/>
              <input className="auth-input" placeholder="Lugares (ex.: H7 · H8)" value={form.seats}
                onChange={e => setForm(f => ({ ...f, seats: e.target.value }))}/>
              <button className="pill pill--primary pill--block" onClick={savePlan} disabled={!form.title.trim() || !form.date}>
                Marcar 🎟
              </button>
            </div>
          </div>
        )}

        {view === "ticket" && plan && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center" }}>o ingresso de vocês</div>
            <div className="ticket">
              <div className="ticket__top">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="ticket__brand">Sessão · admit two</span>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--accent)" }}>❤</span>
                </div>
                <div className="ticket__title">{plan.title}</div>
                {plan.venue && <div className="ticket__venue">{plan.venue}</div>}
                <div className="ticket__fields">
                  <div><div className="ticket__f-label">data</div><div className="ticket__f-value">{fmtPlanDate(plan.date)}</div></div>
                  {plan.time && <div><div className="ticket__f-label">horário</div><div className="ticket__f-value">{plan.time}</div></div>}
                  {plan.seats && <div><div className="ticket__f-label">lugares</div><div className="ticket__f-value">{plan.seats}</div></div>}
                </div>
              </div>
              <div className="ticket__perf"><i/><i/></div>
              <div className="ticket__bottom">
                <div style={{ flex: 1 }}>
                  <div className="ticket__f-label">casal</div>
                  <div className="ticket__couple">{couple.name1} & {couple.name2}</div>
                </div>
                <div className="ticket__barcode"/>
              </div>
              <img src={lumiSrc("peeking")} alt="" className="ticket__lumi"/>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", margin: "22px 0 0", lineHeight: 1.5 }}>
              depois da sessão, eu transformo<br/>esse ingresso numa memória.
            </p>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, marginTop: 26 }}>
              <button className="pill pill--primary pill--block"
                onClick={() => { clearPlan(); onRegister({ title: plan.title, type: "movie", genres: [], cast: [] }); }}>
                Já assistimos ✦
              </button>
              <button className="pill pill--outline pill--block" onClick={() => setView("plan")}>Editar sessão</button>
            </div>
          </div>
        )}

        {view === "checkin" && plan && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", paddingTop: 10 }}>
            <div className="retro-story__glow" style={{ background: "radial-gradient(circle,rgba(201,153,58,.16),transparent 68%)", top: 0 }}/>
            <div className="cine-head__eyebrow" style={{ position: "relative" }}>Check-in{plan.time ? ` · ${plan.time}` : ""}</div>
            <Lumi name="holdingPopcorn" size={200} breathe style={{ marginTop: 16, position: "relative" }}/>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 600, marginTop: 18, textAlign: "center", lineHeight: 1.15, position: "relative" }}>
              Aproveitem a sessão
            </div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", textAlign: "center", margin: "12px 0 0", lineHeight: 1.55, position: "relative" }}>
              Modo silencioso ativado.<br/>Guardo o lugar de vocês até os créditos.
            </p>
            <div style={{ marginTop: 22, display: "flex", gap: 10, position: "relative" }}>
              <span className="chip">🔕 silencioso</span>
              {plan.seats && <span className="chip">🎟 {plan.seats}</span>}
            </div>
            <div style={{ width: "100%", marginTop: 34, position: "relative" }}>
              <button className="pill pill--primary pill--block"
                onClick={() => { clearPlan(); onRegister({ title: plan.title, type: "movie", genres: [], cast: [] }); }}>
                Avaliar quando acabar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

// error boundary — o Lumi assume quando algo quebra
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error("ErrorBoundary:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen">
          <LumiState
            lumi="error"
            title="Ops, o filme queimou"
            text={<>Algo deu errado, mas as memórias<br/>de vocês estão seguras.</>}
            cta="Tentar de novo"
            ctaVariant="outline"
            onCta={() => window.location.reload()}
          />
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const [dataReadyFor, setDataReadyFor] = useState(null);
  const [bootDelay, setBootDelay] = useState(true);
  const [celebration, setCelebration] = useState(null);
  const [online,    setOnline]    = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [showSettings, setShowSettings] = useState(false);
  const [showCinema,   setShowCinema]   = useState(false);
  const [epSheet,      setEpSheet]      = useState(null);
  // preferências do Lumi (Configurações) — persistidas localmente
  const [prefs, setPrefs] = useState(() => {
    try { return { lumiComments:true, fridayReminders:true, onThisDay:true, ...JSON.parse(localStorage.getItem("sessao-prefs")||"{}") }; }
    catch { return { lumiComments:true, fridayReminders:true, onThisDay:true }; }
  });
  const setPref = (k, v) => setPrefs(p => {
    const next = { ...p, [k]: v };
    localStorage.setItem("sessao-prefs", JSON.stringify(next));
    return next;
  });
  const [page,      setPage]      = useState("home");
  const [addModal,  setAddModal]  = useState(null);
  const [toasts,    setToasts]    = useState([]);
  const [confirm,      setConfirm]      = useState(null);
  const [showRoulette, setShowRoulette] = useState(false);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const menuRef = useRef(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // derived
  // currentUser remains a name string for UI compatibility
  const currentUser = couple
    ? (couple.uid1 === authUser?.uid ? couple.name1 : couple.name2)
    : null;
  const users = couple ? [couple.name1, couple.name2].filter(Boolean) : [];
  const dataReady = !!coupleId && dataReadyFor === coupleId;

  // captura o retorno do login via redirect (mobile/PWA)
  useEffect(() => {
    getRedirectResult(auth).catch(e => console.error(e));
  }, []);

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

  // splash: garante um tempo mínimo de respiro do Lumi antes do conteúdo
  useEffect(() => {
    const t = setTimeout(() => setBootDelay(false), 1600);
    return () => clearTimeout(t);
  }, []);

  // Firestore real-time listeners
  useEffect(() => {
    if (!coupleId) return;
    // IMPORTANTE: id:d.id vem DEPOIS do spread pra que o ID real do documento
    // sempre vença um eventual campo "id" antigo salvo nos dados (registros
    // criados com id gerado no cliente). Sem isso, updateDoc aponta pro doc errado.
    const unW  = onSnapshot(collection(db,"couples",coupleId,"watched"),
      snap => { setWatched(snap.docs.map(d=>({...d.data(),id:d.id}))); setDataReadyFor(coupleId); });
    const unWL = onSnapshot(collection(db,"couples",coupleId,"watchlist"),
      snap => setWatchlist(snap.docs.map(d=>({...d.data(),id:d.id}))));
    return () => { unW(); unWL(); };
  }, [coupleId]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  useEffect(() => {
    const handleOffline = () => { setOnline(false); addToast("Você está offline — salvando localmente", "warning"); };
    const handleOnline  = () => { setOnline(true); addToast("Conexão restaurada — sincronizando...", "success"); };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online",  handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online",  handleOnline);
    };
  }, []);

  useEffect(() => {
    if (localStorage.getItem("pwa-install-dismissed")) return;
    const handler = e => { e.preventDefault(); setInstallPrompt(e); setShowInstallBanner(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setShowInstallBanner(false);
    setInstallPrompt(null);
  };
  const dismissInstall = () => {
    setShowInstallBanner(false);
    localStorage.setItem("pwa-install-dismissed", "1");
  };

  // auth actions — popup primeiro (suave no desktop); se o navegador bloquear
  // o popup (comum em mobile/PWA), cai pro redirect, que é mais robusto.
  const handleLogin = async () => {
    setLoginLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      const fallback = ["auth/popup-blocked","auth/popup-closed-by-user","auth/cancelled-popup-request","auth/operation-not-supported-in-environment"];
      if (fallback.includes(e.code)) {
        try { await signInWithRedirect(auth, provider); return; }
        catch (re) { console.error(re); }
      } else {
        console.error(e);
      }
    } finally {
      setLoginLoading(false);
    }
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
    // descarta o "id" gerado no cliente — o Firestore gera o ID real do documento
    const { id, ...data } = entry;
    const veioDaWatchlist = addModal?.fromWatchlist;
    const watchlistId = addModal?.watchlistId;
    await addDoc(collection(db,"couples",coupleId,"watched"), data);
    // agora que a sessão foi salva, remove o título da watchlist (se veio de lá)
    if (watchlistId) {
      deleteDoc(doc(db,"couples",coupleId,"watchlist",watchlistId))
        .catch(err => { console.error(err); });
    }
    setAddModal(null);
    // marcos: celebra ao cruzar totais especiais (100 filmes, 50 sessões...)
    const total = watched.length + 1;
    const movies = watched.filter(w=>w.type==="movie").length + (data.type==="movie" ? 1 : 0);
    const milestone =
      movies === 100 ? { lumi:"milestone100", title:"100 filmes", quote:'"Cem histórias vividas juntos.\nQue coleção linda."' } :
      total === 50   ? { lumi:"achievement", title:"50 sessões", quote:'"Meio caminho para o clube dos cem."' } :
      total === 10   ? { lumi:"celebrating", title:"10 sessões", quote:'"O cineclube de vocês está pegando no tranco ✦"' } :
      total === 1    ? { lumi:"hugHeart", title:"A primeira memória", quote:'"Toda grande história começa com um primeiro filme."' } :
      null;
    if (milestone) {
      setCelebration({ type:"milestone", eyebrow:"Conquista desbloqueada", primaryLabel:"Continuar",
        secondaryLabel:"Compartilhar ✦", confetti:true, ...milestone });
    } else if (veioDaWatchlist) {
      // saiu da watchlist → virou memória (celebração teal do design)
      const meses = entry.addedAt ? Math.floor((Date.now()-new Date(entry.addedAt))/2592000000) : 0;
      setCelebration({
        type:"episode", lumi:"hugHeart",
        eyebrow:"saiu da watchlist",
        title:"Virou memória ✦",
        quote: meses >= 1 ? `"${meses === 1 ? "1 mês" : meses+" meses"} de espera.\nValeu cada dia."` : `"${data.title} agora é\nparte da história de vocês."`,
        nextLabel:"guardada como", nextValue:`memória nº ${total}`,
        primaryLabel:"Que lindo",
      });
    } else {
      addToast("Sessão salva! 🎉");
    }
  };

  const editWatched = async entry => {
    const { id, ...data } = entry;
    await setDoc(doc(db,"couples",coupleId,"watched",id), data);
    addToast("Registro atualizado","info");
  };

  // Fire-and-forget: com persistentLocalCache, a escrita aplica no cache local
  // na hora e o onSnapshot atualiza a UI imediatamente. A Promise só resolve
  // quando o servidor confirma — então NÃO esperamos por ela (senão a UI trava
  // "Salvando..." pra sempre quando a conexão oscila).
  const saveReview = async (id, user, review) => {
    const allowed = canWriteReview({ currentUserName: user, reviewData: { [user]: review }, previousReviews: watched.find(w => w.id === id)?.reviews || {} });
    if (!allowed) {
      addToast("Você só pode salvar sua própria avaliação","error");
      return;
    }
    updateDoc(doc(db,"couples",coupleId,"watched",id), { [`reviews.${user}`]: review })
      .catch(e => { console.error(e); addToast("Não foi possível salvar a avaliação","error"); });
    addToast("Avaliação salva!","success");
  };

  const saveStatus = async (id, status) => {
    updateDoc(doc(db,"couples",coupleId,"watched",id), { status })
      .catch(e => { console.error(e); addToast("Não foi possível atualizar o status","error"); });
    addToast("Status atualizado","info");
  };

  // Continuar assistindo — abre o navegador de episódios (dados reais da TMDB).
  // O próprio EpisodeSheet salva progresso/histórico no Firestore.
  const continueEpisode = entry => setEpSheet(entry);

  // "Assistimos juntos" — só conta o que o casal viu junto
  const toggleTogether = entry => {
    const next = entry.watchedTogether === false;
    updateDoc(doc(db,"couples",coupleId,"watched",entry.id), { watchedTogether: next })
      .catch(e => { console.error(e); addToast("Não foi possível atualizar","error"); });
    addToast(next ? "Marcado como assistido juntos ❤" : "Removido de 'assistimos juntos'", "info");
  };

  const addWatchlist = async entry => {
    const { id, ...data } = entry;
    if (!data.wantedBy) data.wantedBy = [data.suggestedBy].filter(Boolean);
    await addDoc(collection(db,"couples",coupleId,"watchlist"), data);
    setAddModal(null);
    addToast("Adicionado à lista","info");
  };

  // "Eu também quero" — adiciona a pessoa atual ao wantedBy do título
  const alsoWant = entry => {
    const current = entry.wantedBy?.length ? entry.wantedBy : [entry.suggestedBy].filter(Boolean);
    if (current.includes(currentUser)) return;
    const wantedBy = [...current, currentUser];
    updateDoc(doc(db,"couples",coupleId,"watchlist",entry.id), { wantedBy })
      .catch(e => { console.error(e); addToast("Não foi possível salvar","error"); });
    addToast(wantedBy.length >= 2 ? "Agora é vontade dos dois ❤️" : "Marcado que você quer ✦", "success");
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

  const markWatched = e => {
    // NÃO remove da watchlist aqui — só depois que a sessão for realmente salva.
    // Se o casal cancelar o formulário, o item continua na watchlist.
    const { id, ...data } = e;
    setAddModal({ type:"watched", movie:data, fromWatchlist:true, watchlistId:id });
  };

  // render guards
  if (import.meta.env.DEV && typeof window !== "undefined" && window.location.search.includes("v3demo")) return <V3Demo />;
  if (authLoading || bootDelay) return <SplashScreen />;

  if (!authUser) return <LoginScreen onLogin={handleLogin} loading={loginLoading}/>;

  if (!couple) return (
    <CoupleSetup authUser={authUser} onCreate={handleCreateCouple} onJoin={handleJoinCouple} onSignOut={handleSignOut}/>
  );

  // First user created couple but partner hasn't joined yet (name2 is null)
  if (!couple.name2) return (
    <InviteScreen inviteCode={couple.inviteCode} couple={couple} onSignOut={handleSignOut}/>
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
      {celebration && (
        <CelebrateModal
          {...celebration}
          variant={celebration.type}
          onClose={()=>setCelebration(null)}
          onPrimary={()=>{ celebration.onPrimary?.(); setCelebration(null); }}
          onSecondary={celebration.onSecondary ? ()=>{ celebration.onSecondary(); setCelebration(null); } : undefined}
        />
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast}/>

      <div className="v3-shell">

        {/* modals */}
        {showRoulette && (
          <RouletteModal
            watchlist={watchlist}
            onClose={() => setShowRoulette(false)}
            onWatchNow={item => { setShowRoulette(false); setAddModal({ type: "watched", movie: item, fromWatchlist: true }); }}
          />
        )}
        {addModal==="watchlist" && (
          <AddWatchlistModal users={users} currentUser={currentUser} onSave={addWatchlist} onClose={()=>setAddModal(null)}/>
        )}
        {(addModal==="watched"||(addModal?.type==="watched")) && (
          <WatchedForm users={users} currentUser={currentUser}
            initial={addModal?.movie?{movie:addModal.movie, ...(addModal.cinema?{where:"cinema"}:{})}:null}
            onSave={addWatched} onClose={()=>setAddModal(null)}/>
        )}
        {showSettings && (
          <SettingsPage couple={couple} users={users} watched={watched}
            prefs={prefs} onPref={setPref}
            onClose={()=>setShowSettings(false)} onSignOut={handleSignOut}/>
        )}
        {showCinema && (
          <CinemaPage watched={watched} couple={couple} coupleId={coupleId}
            onClose={()=>setShowCinema(false)}
            onRegister={m=>{ setShowCinema(false); setAddModal({ type:"watched", movie:m, cinema:true }); }}
            addToast={addToast}/>
        )}
        {epSheet && (() => {
          const live = watched.find(w=>w.id===epSheet.id) || epSheet;
          return (
            <EpisodeSheet entry={live} coupleId={coupleId}
              onClose={()=>setEpSheet(null)} addToast={addToast}/>
          );
        })()}

        {/* pages */}
        <div className="app-shell__content">
          {!dataReady ? <ContentSkeleton/> : (
            <div key={page} className="v3-page">
              {page==="home"      && <HomePage      watched={watched} watchlist={watchlist} couple={couple} currentUser={currentUser} users={users}
                                       onRoulette={()=>setShowRoulette(true)} onAdd={()=>setAddModal("watched")}
                                       onSaveReview={saveReview} onUpdateStatus={saveStatus} onContinueEpisode={continueEpisode} onToggleTogether={toggleTogether}
                                       onOpenSettings={()=>setShowSettings(true)} onOpenCinema={()=>setShowCinema(true)}
                                       onEdit={editWatched} onDelete={e=>requestDelete(e,"watched")} prefs={prefs}/>}
              {page==="diary"     && <DiaryPage     watched={watched} users={users} currentUser={currentUser}
                                       onDelete={e=>requestDelete(e,"watched")} onEdit={editWatched} onSaveReview={saveReview} onUpdateStatus={saveStatus}
                                       onContinueEpisode={continueEpisode} onToggleTogether={toggleTogether}
                                       onAddToWatchlist={()=>setAddModal("watchlist")} prefs={prefs}/>}
              {page==="watchlist" && <WatchlistPage watchlist={watchlist} users={users} currentUser={currentUser}
                                       compat={coupleCompat(watched, users)}
                                       onDelete={e=>requestDelete(e,"watchlist")} onMarkWatched={markWatched} onRoulette={()=>setShowRoulette(true)} onAlsoWant={alsoWant} prefs={prefs}/>}
              {page==="profile"   && <ProfilePage   watched={watched} watchlist={watchlist} couple={couple} users={users} prefs={prefs}
                                       onOpenSettings={()=>setShowSettings(true)}/>}
            </div>
          )}
        </div>

        {/* offline — o Lumi guarda tudo até a conexão voltar */}
        {!online && (
          <div className="offline-bar" role="status">
            <img src={lumiSrc("offline")} alt="" className="offline-bar__lumi"/>
            <span className="offline-bar__text">"Sem internet. Guardo tudo até vocês voltarem."</span>
          </div>
        )}

        {/* Install banner */}
        {showInstallBanner && (
          <div className="install-banner">
            <span className="install-banner__text">📱 Instale o Sessão no seu celular</span>
            <button onClick={handleInstall} className="install-banner__btn">Instalar</button>
            <button onClick={dismissInstall} className="install-banner__close"><Ic n="x" s={14}/></button>
          </div>
        )}

        {/* sheet de adicionar (FAB) */}
        {menuOpen && (
          <>
            <div className="add-sheet-backdrop" onClick={()=>setMenuOpen(false)}/>
            <div className="add-sheet" role="dialog" aria-label="Adicionar">
              <img src={lumiSrc("bottomSheet")} alt="" className="add-sheet__lumi" aria-hidden="true"/>
              <div className="add-sheet__handle"/>
              <button className="add-sheet__opt" onClick={()=>{ setAddModal("watched"); setMenuOpen(false); }}>
                <img src={lumiSrc("clapper")} alt=""/>
                <span>
                  <span className="add-sheet__t">Registrar sessão</span>
                  <div className="add-sheet__s">o que vocês assistiram hoje?</div>
                </span>
              </button>
              <button className="add-sheet__opt" onClick={()=>{ setAddModal("watchlist"); setMenuOpen(false); }}>
                <img src={lumiSrc("pointing")} alt=""/>
                <span>
                  <span className="add-sheet__t">Adicionar à lista a dois</span>
                  <div className="add-sheet__s">guardar pra uma próxima noite</div>
                </span>
              </button>
            </div>
          </>
        )}

        {/* bottom nav v3 */}
        <nav className="v3-nav">
          <button onClick={()=>setPage("home")} className={`v3-nav__item ${page==="home"?"v3-nav__item--active":""}`} aria-label="Início">
            <Ic n="home" s={21}/>
          </button>
          <button onClick={()=>setPage("diary")} className={`v3-nav__item ${page==="diary"?"v3-nav__item--active":""}`} aria-label="Acervo">
            <Ic n="book" s={21}/>
          </button>
          <button className="v3-nav__fab" onClick={()=>setMenuOpen(o=>!o)} aria-label="Adicionar"><Ic n="plus" s={22}/></button>
          <button onClick={()=>setPage("watchlist")} className={`v3-nav__item ${page==="watchlist"?"v3-nav__item--active":""}`} aria-label="Lista a dois">
            <Ic n="bookmark" s={21}/>
          </button>
          <button onClick={()=>setPage("profile")} className={`v3-nav__item v3-nav__item--gold ${page==="profile"?"v3-nav__item--active":""}`} aria-label="Casal">
            <img src={lumiSrc(page==="profile"?"headHappy":"headNeutral")} alt="" className="v3-nav__lumi"/>
          </button>
        </nav>
      </div>
    </>
  );
}
