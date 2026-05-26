import { useState, useEffect, useRef } from "react";
import { auth, db } from "./firebase";
import {
  onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider,
} from "firebase/auth";
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, getDocs,
} from "firebase/firestore";

const TMDB_KEY = "4f6e2b1d9a3c5e7f0b2d4e6a8c0d2f4a";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_BG   = "https://image.tmdb.org/t/p/w1280";

async function tmdbSearch(q) {
  try {
    const d = await fetch(`${TMDB_BASE}/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&language=pt-BR`).then(r=>r.json());
    return (d.results||[]).filter(x=>x.media_type==="movie"||x.media_type==="tv").slice(0,8);
  } catch { return []; }
}

async function tmdbFetch(id, type) {
  try {
    const ep = type==="tv" ? "tv" : "movie";
    const d = await fetch(`${TMDB_BASE}/${ep}/${id}?api_key=${TMDB_KEY}&language=pt-BR&append_to_response=credits,external_ids`).then(r=>r.json());
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
  } catch { return {}; }
}

// ── icons ─────────────────────────────────────────────────────────────────────
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
  <div style={{ display:"flex", gap:3 }}>
    {[1,2,3,4,5].map(i => (
      <span key={i} onClick={() => onChange?.(i===val?0:i)}
        style={{ fontSize:size, cursor:onChange?"pointer":"default",
          color:i<=val?"#f59e0b":"rgba(255,255,255,0.15)", lineHeight:1, transition:"color .15s" }}>★</span>
    ))}
  </div>
);

const Avatar = ({ name, size=28, active=false }) => {
  const initials = name?.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()||"?";
  const colors = ["#e63946","#7c3aed","#0284c7","#059669","#d97706"];
  const color = colors[name?.charCodeAt(0)%colors.length]||"#888";
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:color,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*0.38, fontWeight:700, color:"#fff", flexShrink:0,
      border:active?"2px solid #fff":"2px solid transparent", boxSizing:"border-box" }}>
      {initials}
    </div>
  );
};

const PosterFallback = ({ type, h=220 }) => (
  <div style={{ height:h, background:"linear-gradient(135deg,#1a1a2e,#16213e)", display:"flex", alignItems:"center", justifyContent:"center", color:"#2a2a4a" }}>
    <Ic n={type==="tv"?"tv":"film"} s={48}/>
  </div>
);

// ── toast ─────────────────────────────────────────────────────────────────────
const ToastContainer = ({ toasts, onDismiss }) => (
  <div style={{ position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)",
    zIndex:9999, display:"flex", flexDirection:"column", gap:8, width:"min(380px,92vw)", pointerEvents:"none" }}>
    {toasts.map(t => (
      <div key={t.id} style={{ background:t.type==="error"?"#7f1d1d":t.type==="info"?"#1e3a5f":t.type==="warn"?"#78350f":"#14532d",
          border:`1px solid ${t.type==="error"?"#dc2626":t.type==="info"?"#3b82f6":t.type==="warn"?"#d97706":"#16a34a"}`,
          borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", gap:10,
          color:"#f0f0f0", fontSize:13, fontWeight:600, pointerEvents:"all",
          boxShadow:"0 8px 24px rgba(0,0,0,.5)", animation:"slideUp .25s ease-out" }}>
        <span style={{ flex:1 }}>{t.message}</span>
        {t.undoFn && (
          <button onClick={() => { t.undoFn(); onDismiss(t.id); }}
            style={{ background:"rgba(255,255,255,0.18)", border:"none", borderRadius:7,
              padding:"4px 10px", color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700 }}>
            Desfazer
          </button>
        )}
        <button onClick={() => onDismiss(t.id)}
          style={{ background:"none", border:"none", color:"rgba(255,255,255,0.45)", cursor:"pointer", padding:2 }}>
          <Ic n="x" s={14}/>
        </button>
      </div>
    ))}
  </div>
);

// ── confirm modal ─────────────────────────────────────────────────────────────
const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <div onClick={e=>e.target===e.currentTarget&&onCancel()}
    style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:300,
      display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
    <div style={{ background:"#0e0e1c",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,
      padding:"28px 28px",width:"100%",maxWidth:360,textAlign:"center" }}>
      <div style={{ fontSize:36,marginBottom:14 }}>🗑️</div>
      <p style={{ color:"#ccc",fontSize:15,lineHeight:1.55,marginBottom:24 }}>{message}</p>
      <div style={{ display:"flex",gap:10 }}>
        <button onClick={onCancel}
          style={{ flex:1,background:"rgba(255,255,255,0.07)",border:"none",borderRadius:12,
            padding:"12px 0",color:"#aaa",fontWeight:700,fontSize:14,cursor:"pointer" }}>
          Cancelar
        </button>
        <button onClick={onConfirm}
          style={{ flex:1,background:"linear-gradient(135deg,#dc2626,#991b1b)",border:"none",borderRadius:12,
            padding:"12px 0",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer" }}>
          Deletar
        </button>
      </div>
    </div>
  </div>
);

// ── overlay / modal helpers ───────────────────────────────────────────────────
const Overlay = ({ children, onClose }) => (
  <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
    style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:200,
      display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
    {children}
  </div>
);

const Modal = ({ title, onClose, children, maxW=480 }) => (
  <div style={{ background:"#0e0e1c",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,
    padding:"26px 28px",width:"100%",maxWidth:maxW,maxHeight:"90vh",overflowY:"auto" }}>
    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22 }}>
      <h3 style={{ fontFamily:"'Playfair Display',serif",fontSize:21,color:"#f0f0f0",margin:0 }}>{title}</h3>
      <button onClick={onClose} style={{ background:"none",border:"none",color:"#666",cursor:"pointer",padding:4 }}>
        <Ic n="x" s={20}/>
      </button>
    </div>
    {children}
  </div>
);

const Label = ({ children }) => (
  <div style={{ fontSize:12,color:"#777",fontWeight:600,letterSpacing:.8,marginBottom:8,textTransform:"uppercase" }}>{children}</div>
);

const SegBtn = ({ options, value, onChange, colorMap={} }) => (
  <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
    {options.map(([v,l]) => (
      <button key={v} onClick={() => onChange(v)}
        style={{ flex:1,minWidth:80,padding:"9px 0",borderRadius:10,border:"none",cursor:"pointer",
          fontWeight:600,fontSize:13,transition:"all .2s",
          background:value===v?(colorMap[v]||"#e63946"):"rgba(255,255,255,0.06)",
          color:value===v?"#fff":"#888" }}>{l}</button>
    ))}
  </div>
);

const Input = ({ style={}, ...p }) => (
  <input {...p} style={{ background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",
    borderRadius:10,padding:"10px 14px",color:"#f0f0f0",fontSize:14,outline:"none",
    width:"100%",boxSizing:"border-box",...style }}/>
);

// ── search modal ──────────────────────────────────────────────────────────────
const SearchModal = ({ onSelect, onClose }) => {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const inputRef = useRef();

  useEffect(() => { setTimeout(()=>inputRef.current?.focus(),50); }, []);
  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.length<2) { setRes([]); return; }
      setLoading(true);
      setRes(await tmdbSearch(q));
      setLoading(false);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const pick = async r => {
    setFetching(true);
    const full = await tmdbFetch(r.id, r.media_type);
    setFetching(false);
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
  };

  return (
    <Overlay onClose={onClose}>
      <Modal title="Buscar título" onClose={onClose} maxW={520}>
        {fetching ? (
          <div style={{ textAlign:"center",padding:"40px 0",color:"#666",fontSize:14 }}>Carregando detalhes...</div>
        ) : (
          <>
            <div style={{ display:"flex",gap:8,marginBottom:16 }}>
              <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)}
                placeholder="Nome do filme ou série..."
                style={{ flex:1,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",
                  borderRadius:10,padding:"10px 14px",color:"#f0f0f0",fontSize:15,outline:"none" }}/>
              <div style={{ display:"flex",alignItems:"center",padding:"0 12px",color:"#888" }}><Ic n="search" s={18}/></div>
            </div>
            {loading && <p style={{ color:"#666",fontSize:14,textAlign:"center",margin:"20px 0" }}>Buscando...</p>}
            <div style={{ display:"flex",flexDirection:"column",gap:8,maxHeight:380,overflowY:"auto" }}>
              {res.map(r => (
                <div key={r.id} onClick={()=>pick(r)}
                  style={{ display:"flex",gap:12,padding:12,borderRadius:12,cursor:"pointer",
                    background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",transition:"background .15s" }}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.09)"}
                  onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}>
                  {r.poster_path
                    ? <img src={`${TMDB_IMG}${r.poster_path}`} alt="" style={{ width:44,height:64,borderRadius:6,objectFit:"cover",flexShrink:0 }}/>
                    : <div style={{ width:44,height:64,borderRadius:6,background:"#1a1a2e",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center" }}><Ic n="film" s={18} style={{color:"#444"}}/></div>}
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:700,color:"#f0f0f0",fontSize:14,marginBottom:3 }}>{r.title||r.name}</div>
                    <div style={{ fontSize:12,color:"#777",marginBottom:4 }}>
                      {r.media_type==="tv"?"Série":"Filme"} • {(r.release_date||r.first_air_date||"").slice(0,4)}
                      {r.vote_average?` • ★ ${r.vote_average.toFixed(1)}`:""}
                    </div>
                    <div style={{ fontSize:12,color:"#666",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" }}>
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

// ── season pills ──────────────────────────────────────────────────────────────
const SeasonPills = ({ count, selected, onChange }) => {
  const toggle = s => onChange(selected.includes(s) ? selected.filter(x=>x!==s) : [...selected,s].sort((a,b)=>a-b));
  return (
    <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
      {Array.from({length:count},(_,i)=>i+1).map(s => (
        <button key={s} onClick={()=>toggle(s)}
          style={{ padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,
            background:selected.includes(s)?"#7c3aed":"rgba(255,255,255,0.07)",
            color:selected.includes(s)?"#fff":"#888" }}>
          T{s}
        </button>
      ))}
    </div>
  );
};

// ── watched form (shared by Add + Edit) ───────────────────────────────────────
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
        <div style={{ display:"flex",gap:12,background:"rgba(255,255,255,0.05)",borderRadius:12,padding:12,marginBottom:22,alignItems:"center" }}>
          {movie.poster
            ? <img src={`${TMDB_IMG}${movie.poster}`} alt="" style={{ width:46,height:68,borderRadius:8,objectFit:"cover" }}/>
            : <div style={{ width:46,height:68,borderRadius:8,background:"#1a1a2e",display:"flex",alignItems:"center",justifyContent:"center" }}><Ic n="film" s={22} style={{color:"#444"}}/></div>}
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Playfair Display',serif",fontWeight:700,color:"#f0f0f0",fontSize:16 }}>{movie.title}</div>
            <div style={{ fontSize:12,color:"#777",marginTop:2 }}>{movie.type==="tv"?"Série":"Filme"} • {movie.year}</div>
            {movie.genres?.length>0 && <div style={{ fontSize:11,color:"#555",marginTop:2 }}>{movie.genres.slice(0,3).join(" · ")}</div>}
          </div>
          {!initial && (
            <button onClick={()=>setStep(0)} style={{ background:"rgba(255,255,255,0.07)",border:"none",borderRadius:8,padding:"5px 10px",color:"#aaa",cursor:"pointer",fontSize:12 }}>trocar</button>
          )}
        </div>

        {movie.type==="tv" && movie.numberOfSeasons>0 && (
          <div style={{ marginBottom:18 }}>
            <Label>Temporadas assistidas</Label>
            <SeasonPills count={movie.numberOfSeasons} selected={seasonsWatched} onChange={setSeasonsWatched}/>
          </div>
        )}

        <div style={{ marginBottom:18 }}>
          <Label>Onde assistiram?</Label>
          <SegBtn options={[["cinema","🎭 Cinema"],["streaming","🏠 Streaming"]]}
            value={where} onChange={setWhere} colorMap={{cinema:"#d97706",streaming:"#0284c7"}}/>
        </div>

        <div style={{ marginBottom:22 }}>
          <Label>Data</Label>
          <Input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
        </div>

        <div style={{ marginBottom:22 }}>
          <Label>Críticas individuais</Label>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            {users.map(u => (
              <div key={u} style={{ background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"14px 16px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                  <Avatar name={u} size={26}/>
                  <span style={{ fontSize:14,fontWeight:600,color:"#ccc" }}>{u}</span>
                  <div style={{ marginLeft:"auto" }}>
                    <Stars val={reviews[u]?.rating} onChange={v=>setReview(u,"rating",v)} size={20}/>
                  </div>
                </div>
                <textarea value={reviews[u]?.text} onChange={e=>setReview(u,"text",e.target.value)}
                  placeholder={`O que ${u} achou?`} rows={2}
                  style={{ width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",
                    borderRadius:8,padding:"8px 12px",color:"#ccc",fontSize:13,outline:"none",
                    resize:"none",fontFamily:"inherit",boxSizing:"border-box" }}/>
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleSave}
          style={{ width:"100%",background:"linear-gradient(135deg,#e63946,#c1121f)",border:"none",
            borderRadius:12,padding:"13px 0",color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer" }}>
          Salvar sessão ✦
        </button>
      </Modal>
    </Overlay>
  );
};

// ── watchlist form ────────────────────────────────────────────────────────────
const AddWatchlistModal = ({ users, currentUser, onSave, onClose }) => {
  const [step, setStep] = useState(0);
  const [movie, setMovie] = useState(null);
  const [priority, setPriority] = useState("normal");
  const [note, setNote] = useState("");

  if (step===0) return <SearchModal onSelect={m=>{ setMovie(m); setStep(1); }} onClose={onClose}/>;

  return (
    <Overlay onClose={onClose}>
      <Modal title="Adicionar à watchlist" onClose={onClose} maxW={460}>
        <div style={{ display:"flex",gap:12,background:"rgba(255,255,255,0.05)",borderRadius:12,padding:12,marginBottom:22,alignItems:"center" }}>
          {movie.poster
            ? <img src={`${TMDB_IMG}${movie.poster}`} alt="" style={{ width:46,height:68,borderRadius:8,objectFit:"cover" }}/>
            : <div style={{ width:46,height:68,borderRadius:8,background:"#1a1a2e" }}/>}
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif",fontWeight:700,color:"#f0f0f0",fontSize:16 }}>{movie.title}</div>
            <div style={{ fontSize:12,color:"#777",marginTop:2 }}>{movie.type==="tv"?"Série":"Filme"} • {movie.year}</div>
          </div>
        </div>
        <div style={{ marginBottom:18 }}>
          <Label>Prioridade</Label>
          <SegBtn options={[["baixa","🟢 Baixa"],["normal","🟡 Normal"],["alta","🔴 Alta"]]}
            value={priority} onChange={setPriority} colorMap={{baixa:"#059669",normal:"#d97706",alta:"#e63946"}}/>
        </div>
        <div style={{ marginBottom:22 }}>
          <Label>Por que indicar?</Label>
          <textarea value={note} onChange={e=>setNote(e.target.value)}
            placeholder="Conta por que querem assistir..." rows={2}
            style={{ width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",
              borderRadius:10,padding:"10px 12px",color:"#ccc",fontSize:13,outline:"none",
              resize:"none",fontFamily:"inherit",boxSizing:"border-box" }}/>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#666",marginBottom:18 }}>
          <Avatar name={currentUser} size={18}/> Sugerido por {currentUser}
        </div>
        <button onClick={()=>onSave({id:Date.now().toString(),...movie,priority,note,suggestedBy:currentUser,addedAt:new Date().toISOString()})}
          style={{ width:"100%",background:"linear-gradient(135deg,#7c3aed,#5b21b6)",border:"none",
            borderRadius:12,padding:"13px 0",color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer" }}>
          Adicionar à lista ✦
        </button>
      </Modal>
    </Overlay>
  );
};

// ── detail modal ──────────────────────────────────────────────────────────────
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
    return seq ? `T${s[0]}–T${s[s.length-1]}` : s.map(x=>`T${x}`).join(", ");
  };

  return (
    <Overlay onClose={onClose}>
      <Modal title="" onClose={onClose} maxW={560}>
        {backdrop && (
          <div style={{ margin:"-26px -28px 0",height:160,position:"relative",overflow:"hidden",borderRadius:"20px 20px 0 0" }}>
            <img src={backdrop} alt="" style={{ width:"100%",height:"100%",objectFit:"cover",filter:"brightness(.35)" }}/>
            <div style={{ position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent,#0e0e1c)" }}/>
          </div>
        )}

        <div style={{ display:"flex",gap:16,marginBottom:20,marginTop:backdrop?0:-26 }}>
          {poster
            ? <img src={poster} alt="" style={{ width:90,height:134,borderRadius:12,objectFit:"cover",flexShrink:0,
                boxShadow:"0 8px 24px rgba(0,0,0,.6)",marginTop:backdrop?-50:0,position:"relative" }}/>
            : <div style={{ width:90,height:134,borderRadius:12,background:"#1a1a2e",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center" }}><Ic n="film" s={36} style={{color:"#333"}}/></div>}
          <div style={{ paddingTop:backdrop?6:0,flex:1 }}>
            <div style={{ fontSize:11,color:entry.type==="tv"?"#a78bfa":"#f87171",fontWeight:700,letterSpacing:1.2,marginBottom:5 }}>
              {entry.type==="tv"?"SÉRIE":"FILME"}{entry.year?` • ${entry.year}`:""}
              {entry.runtime ? ` • ${Math.floor(entry.runtime/60)}h${entry.runtime%60>0?` ${entry.runtime%60}min`:""}` : ""}
            </div>
            <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:22,color:"#f0f0f0",margin:"0 0 6px" }}>{entry.title}</h2>
            {entry.where && (
              <div style={{ fontSize:13,color:entry.where==="cinema"?"#f59e0b":"#60a5fa" }}>
                {entry.where==="cinema"?"🎭 Cinema":"🏠 Streaming"}
                {entry.date && " • "+new Date(entry.date+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"})}
              </div>
            )}
            <div style={{ display:"flex",gap:8,marginTop:8,flexWrap:"wrap",alignItems:"center" }}>
              {isDiscord && <span style={{ fontSize:11,fontWeight:700,color:"#f87171",background:"rgba(230,57,70,.15)",borderRadius:20,padding:"3px 10px" }}>💥 Discordaram</span>}
              {seasonLabel() && <span style={{ fontSize:11,fontWeight:700,color:"#a78bfa",background:"rgba(124,58,237,.15)",borderRadius:20,padding:"3px 10px" }}>{seasonLabel()}</span>}
              {entry.tmdbRating && <span style={{ fontSize:11,color:"#f59e0b",fontWeight:700 }}>TMDB ★ {entry.tmdbRating}</span>}
            </div>
          </div>
          {onEdit && (
            <button onClick={onEdit} style={{ background:"rgba(255,255,255,0.07)",border:"none",borderRadius:10,
              padding:8,color:"#aaa",cursor:"pointer",height:"fit-content",marginTop:backdrop?-44:0 }}>
              <Ic n="edit" s={16}/>
            </button>
          )}
        </div>

        {/* genres */}
        {entry.genres?.length>0 && (
          <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:16 }}>
            {entry.genres.map(g=>(
              <span key={g} style={{ fontSize:11,fontWeight:600,color:"#a78bfa",background:"rgba(124,58,237,.12)",
                borderRadius:20,padding:"3px 10px" }}>{g}</span>
            ))}
          </div>
        )}

        {/* seasons detail */}
        {entry.type==="tv" && entry.seasonsWatched?.length>0 && entry.numberOfSeasons && (
          <div style={{ marginBottom:16,fontSize:13,color:"#888" }}>
            Temporadas assistidas: {entry.seasonsWatched.join(", ")} de {entry.numberOfSeasons}
          </div>
        )}

        {/* director + cast */}
        {entry.director && (
          <div style={{ marginBottom:12 }}>
            <Label>Direção</Label>
            <span style={{ fontSize:14,color:"#ccc",fontWeight:600 }}>{entry.director}</span>
          </div>
        )}
        {entry.cast?.length>0 && (
          <div style={{ marginBottom:16 }}>
            <Label>Elenco</Label>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {entry.cast.map(c=>(
                <span key={c} style={{ fontSize:12,color:"#bbb",background:"rgba(255,255,255,0.07)",borderRadius:20,padding:"4px 10px" }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* IMDB link */}
        {entry.imdbId && (
          <div style={{ marginBottom:18 }}>
            <a href={`https://www.imdb.com/title/${entry.imdbId}`} target="_blank" rel="noopener noreferrer"
              style={{ display:"inline-flex",alignItems:"center",gap:6,background:"#f5c518",
                color:"#000",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,textDecoration:"none" }}>
              <Ic n="link" s={14}/> Ver no IMDB
            </a>
          </div>
        )}

        {/* reviews */}
        {!fromWatchlist && entry.reviews && (
          <div style={{ marginBottom:18 }}>
            <Label>Críticas do casal</Label>
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              {Object.entries(entry.reviews).map(([user,rev]) => (
                (rev.rating||rev.text) ? (
                  <div key={user} style={{ background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"12px 14px" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:rev.text?8:0 }}>
                      <Avatar name={user} size={22}/>
                      <span style={{ fontSize:13,fontWeight:600,color:"#bbb",flex:1 }}>{user}</span>
                      {rev.rating>0 && <Stars val={rev.rating} size={16}/>}
                      {rev.rating>0 && <span style={{ fontSize:13,color:"#f59e0b",fontWeight:700 }}>{rev.rating}/5</span>}
                    </div>
                    {rev.text && <p style={{ margin:0,fontSize:13,color:"#999",lineHeight:1.55,fontStyle:"italic" }}>"{rev.text}"</p>}
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
            <div key={u} style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
              borderRadius:12,padding:"10px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:8 }}>
              <Avatar name={u} size={20}/>
              <span style={{ fontSize:12,color:"#666",fontStyle:"italic" }}>Aguardando crítica de {u}</span>
            </div>
          );
        })}

        {/* inline review if currentUser hasn't rated */}
        {!fromWatchlist && !hasMyReview && onSaveReview && (
          <div style={{ background:"rgba(230,57,70,.08)",border:"1px solid rgba(230,57,70,.2)",borderRadius:14,padding:"16px",marginBottom:18 }}>
            <div style={{ fontSize:13,color:"#f87171",fontWeight:700,marginBottom:12 }}>Você ainda não avaliou esse filme</div>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10 }}>
              <Avatar name={currentUser} size={24}/>
              <Stars val={inlineRating} onChange={setInlineRating} size={22}/>
            </div>
            <textarea value={inlineText} onChange={e=>setInlineText(e.target.value)}
              placeholder="Sua crítica..." rows={2}
              style={{ width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:8,padding:"8px 12px",color:"#ccc",fontSize:13,outline:"none",
                resize:"none",fontFamily:"inherit",boxSizing:"border-box",marginBottom:10 }}/>
            <button onClick={handleInlineSave} disabled={savingReview||!inlineRating}
              style={{ background:"linear-gradient(135deg,#e63946,#c1121f)",border:"none",borderRadius:10,
                padding:"9px 20px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",
                opacity:inlineRating?1:.5 }}>
              {savingReview?"Salvando...":"Salvar avaliação"}
            </button>
          </div>
        )}

        {/* overview */}
        {entry.overview && (
          <div style={{ marginBottom:18 }}>
            <Label>Sinopse</Label>
            <p style={{ margin:0,fontSize:13,color:"#888",lineHeight:1.6 }}>{entry.overview}</p>
          </div>
        )}

        {/* watchlist extras */}
        {fromWatchlist && (
          <>
            {entry.note && (
              <div style={{ marginBottom:16 }}>
                <Label>Por que assistir</Label>
                <p style={{ margin:0,fontSize:13,color:"#999",fontStyle:"italic" }}>"{entry.note}"</p>
              </div>
            )}
            <div style={{ display:"flex",gap:16,marginBottom:20 }}>
              <div>
                <Label>Sugerido por</Label>
                <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                  <Avatar name={entry.suggestedBy} size={20}/>
                  <span style={{ color:"#ccc",fontSize:13 }}>{entry.suggestedBy}</span>
                </div>
              </div>
              <div>
                <Label>Prioridade</Label>
                <span style={{ fontSize:13,fontWeight:600,
                  color:entry.priority==="alta"?"#ef4444":entry.priority==="normal"?"#f59e0b":"#22c55e" }}>
                  {entry.priority?.charAt(0).toUpperCase()+entry.priority?.slice(1)||"Normal"}
                </span>
              </div>
            </div>
            {onMarkWatched && (
              <button onClick={()=>onMarkWatched(entry)}
                style={{ width:"100%",background:"linear-gradient(135deg,#e63946,#c1121f)",border:"none",
                  borderRadius:12,padding:"12px 0",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer" }}>
                ✓ Marcar como assistido
              </button>
            )}
          </>
        )}
      </Modal>
    </Overlay>
  );
};

// ── login screen ──────────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin, loading }) => (
  <div style={{ minHeight:"100vh",background:"#08080f",display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
    <div style={{ maxWidth:380,width:"100%",textAlign:"center" }}>
      <div style={{ fontSize:60,marginBottom:16 }}>🎬</div>
      <h1 style={{ fontFamily:"'Playfair Display',serif",fontSize:38,color:"#f0f0f0",margin:"0 0 6px",letterSpacing:-1 }}>
        Sessão<span style={{ color:"#e63946" }}> ✦</span>
      </h1>
      <p style={{ color:"#666",fontSize:14,marginBottom:48 }}>O diário cinematográfico do casal</p>
      <button onClick={onLogin} disabled={loading}
        style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:12,width:"100%",
          background:"#fff",border:"none",borderRadius:14,padding:"14px 0",
          color:"#111",fontWeight:700,fontSize:15,cursor:loading?"not-allowed":"pointer",
          opacity:loading?.7:1,transition:"opacity .2s" }}>
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

// ── couple setup (create or join) ─────────────────────────────────────────────
const CoupleSetup = ({ authUser, onCreate, onJoin }) => {
  const [tab, setTab] = useState("create");
  const [myName, setMyName] = useState(authUser?.displayName||"");
  const [since, setSince] = useState("");
  const [code, setCode] = useState("");
  const [joinName, setJoinName] = useState(authUser?.displayName||"");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleCreate = async () => {
    if (!myName.trim()) return;
    setLoading(true); setErr("");
    try { await onCreate(myName.trim(), since); }
    catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const handleJoin = async () => {
    if (!code.trim()||!joinName.trim()) return;
    setLoading(true); setErr("");
    try { await onJoin(code.trim().toUpperCase(), joinName.trim()); }
    catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const inp = { background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,
    padding:"13px 18px",color:"#f0f0f0",fontSize:15,outline:"none",textAlign:"center",width:"100%",boxSizing:"border-box" };

  return (
    <div style={{ minHeight:"100vh",background:"#08080f",display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
      <div style={{ maxWidth:400,width:"100%",textAlign:"center" }}>
        <div style={{ fontSize:48,marginBottom:12 }}>🎬</div>
        <h1 style={{ fontFamily:"'Playfair Display',serif",fontSize:32,color:"#f0f0f0",margin:"0 0 6px",letterSpacing:-1 }}>
          Sessão<span style={{ color:"#e63946" }}> ✦</span>
        </h1>
        <p style={{ color:"#666",fontSize:13,marginBottom:28 }}>Olá, {authUser?.displayName?.split(" ")[0]}! Configure seu diário.</p>

        {/* tabs */}
        <div style={{ display:"flex",gap:8,marginBottom:28 }}>
          {[["create","Criar casal"],["join","Tenho um convite"]].map(([v,l])=>(
            <button key={v} onClick={()=>{setTab(v);setErr("");}}
              style={{ flex:1,padding:"10px 0",borderRadius:12,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,
                background:tab===v?"#e63946":"rgba(255,255,255,0.07)",color:tab===v?"#fff":"#888" }}>{l}</button>
          ))}
        </div>

        {tab==="create" && (
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <input value={myName} onChange={e=>setMyName(e.target.value)} placeholder="Seu nome" style={inp}/>
            <p style={{ color:"#555",fontSize:13,margin:"4px 0" }}>Você receberá um código para convidar sua pessoa ❤️</p>
            <p style={{ color:"#666",fontSize:12,margin:0 }}>Desde quando juntos? (opcional)</p>
            <input type="date" value={since} onChange={e=>setSince(e.target.value)} style={inp}/>
            {err && <p style={{ color:"#f87171",fontSize:13 }}>{err}</p>}
            <button onClick={handleCreate} disabled={loading||!myName.trim()}
              style={{ background:"linear-gradient(135deg,#e63946,#c1121f)",border:"none",borderRadius:12,
                padding:"13px 0",color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer",opacity:myName.trim()?1:.5 }}>
              {loading?"Criando...":"Criar nosso diário ✦"}
            </button>
          </div>
        )}

        {tab==="join" && (
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <input value={joinName} onChange={e=>setJoinName(e.target.value)} placeholder="Seu nome" style={inp}/>
            <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Código de convite (ex: ABC123)"
              style={{ ...inp, letterSpacing:3, fontWeight:700, fontSize:20 }} maxLength={6}/>
            {err && <p style={{ color:"#f87171",fontSize:13 }}>{err}</p>}
            <button onClick={handleJoin} disabled={loading||code.length<6||!joinName.trim()}
              style={{ background:"linear-gradient(135deg,#7c3aed,#5b21b6)",border:"none",borderRadius:12,
                padding:"13px 0",color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer",opacity:code.length===6&&joinName.trim()?1:.5 }}>
              {loading?"Entrando...":"Entrar no diário ✦"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── invite code display (after creating couple) ───────────────────────────────
const InviteScreen = ({ inviteCode, couple }) => (
  <div style={{ minHeight:"100vh",background:"#08080f",display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
    <div style={{ maxWidth:380,width:"100%",textAlign:"center" }}>
      <div style={{ fontSize:48,marginBottom:16 }}>🎉</div>
      <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:28,color:"#f0f0f0",margin:"0 0 8px" }}>Diário criado!</h2>
      <p style={{ color:"#888",fontSize:14,marginBottom:32 }}>Compartilhe o código abaixo com {couple.name1==="?"?"sua pessoa":couple.name2||"sua pessoa"} para ela entrar no diário.</p>
      <div style={{ background:"rgba(230,57,70,.1)",border:"2px dashed rgba(230,57,70,.4)",borderRadius:20,
        padding:"28px 24px",marginBottom:24 }}>
        <p style={{ color:"#888",fontSize:12,fontWeight:700,letterSpacing:2,marginBottom:10 }}>CÓDIGO DE CONVITE</p>
        <div style={{ fontFamily:"'Playfair Display',serif",fontSize:44,fontWeight:900,color:"#e63946",letterSpacing:10 }}>
          {inviteCode}
        </div>
      </div>
      <p style={{ color:"#555",fontSize:13 }}>Aguardando sua pessoa entrar… assim que ela usar o código, o diário abrirá automaticamente.</p>
    </div>
  </div>
);

// ── home page ─────────────────────────────────────────────────────────────────
const HomePage = ({ watched, watchlist, couple, currentUser, users }) => {
  const totMovies = watched.filter(w=>w.type==="movie").length;
  const totSeries = watched.filter(w=>w.type==="tv").length;
  const totCinema = watched.filter(w=>w.where==="cinema").length;
  const allRatings = watched.flatMap(w=>Object.values(w.reviews||{}).map(r=>r.rating).filter(Boolean));
  const avgR = allRatings.length?(allRatings.reduce((a,b)=>a+b,0)/allRatings.length).toFixed(1):null;
  const totalMins = watched.reduce((s,w)=>s+(w.runtime||0),0);
  const recent = [...watched].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,4);
  const days = couple.since?Math.floor((new Date()-new Date(couple.since))/86400000):null;
  const nextWatch = [...watchlist].sort((a,b)=>{const p={alta:0,normal:1,baixa:2};return(p[a.priority]??1)-(p[b.priority]??1);})[0];

  return (
    <div>
      <div style={{ background:"linear-gradient(135deg,#14040b,#090915)",borderRadius:20,padding:"24px 26px",marginBottom:22,position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:-30,right:-30,width:180,height:180,background:"radial-gradient(circle,rgba(230,57,70,.12),transparent 70%)",borderRadius:"50%",pointerEvents:"none" }}/>
        <div style={{ fontSize:12,color:"#e63946",fontWeight:700,letterSpacing:2,marginBottom:6 }}>✦ BEM-VINDO DE VOLTA</div>
        <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:26,color:"#f0f0f0",margin:"0 0 4px" }}>Olá, {currentUser} ❤️</h2>
        {days!==null && <p style={{ color:"#666",fontSize:13,margin:0 }}>{couple.name1} & {couple.name2} • {days} dias juntos</p>}
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:22 }}>
        {[
          {v:totMovies+totSeries,l:"Total assistidos",icon:"film",c:"#e63946"},
          {v:totCinema,l:"No cinema",icon:"star",c:"#f59e0b"},
          {v:totMovies,l:"Filmes",icon:"film",c:"#7c3aed"},
          {v:avgR?`${avgR} ★`:"—",l:"Nota média",icon:"star",c:"#f59e0b"},
        ].map(s=>(
          <div key={s.l} style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"16px 18px" }}>
            <div style={{ color:s.c,marginBottom:8,opacity:.85 }}><Ic n={s.icon} s={20}/></div>
            <div style={{ fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:"#f0f0f0" }}>{s.v}</div>
            <div style={{ fontSize:12,color:"#777",marginTop:2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {totalMins>0 && (
        <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"14px 18px",marginBottom:22,display:"flex",alignItems:"center",gap:12 }}>
          <Ic n="clock" s={22} style={{color:"#60a5fa"}}/>
          <div>
            <div style={{ fontSize:18,fontWeight:700,color:"#f0f0f0" }}>{Math.floor(totalMins/60)}h {totalMins%60}min</div>
            <div style={{ fontSize:12,color:"#777" }}>assistidos juntos</div>
          </div>
        </div>
      )}

      {nextWatch && (
        <div style={{ display:"flex",gap:14,background:"rgba(124,58,237,.08)",border:"1px solid rgba(124,58,237,.2)",borderRadius:16,padding:"14px 18px",marginBottom:22,alignItems:"center" }}>
          {nextWatch.poster
            ? <img src={`${TMDB_IMG}${nextWatch.poster}`} alt="" style={{ width:42,height:60,borderRadius:8,objectFit:"cover" }}/>
            : <div style={{ width:42,height:60,borderRadius:8,background:"#1a1a2e" }}/>}
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:11,color:"#a78bfa",fontWeight:700,letterSpacing:1,marginBottom:4 }}>PRÓXIMA SESSÃO</div>
            <div style={{ fontWeight:700,color:"#f0f0f0",fontSize:15,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{nextWatch.title}</div>
            <div style={{ fontSize:12,color:"#888",marginTop:2 }}>Sugerido por {nextWatch.suggestedBy}</div>
          </div>
          <div style={{ fontSize:11,color:nextWatch.priority==="alta"?"#ef4444":nextWatch.priority==="normal"?"#f59e0b":"#22c55e",fontWeight:700 }}>
            {nextWatch.priority?.toUpperCase()}
          </div>
        </div>
      )}

      {recent.length>0 && (
        <>
          <div style={{ fontSize:11,color:"#666",fontWeight:700,letterSpacing:1.2,marginBottom:12 }}>ASSISTIDOS RECENTEMENTE</div>
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {recent.map(e=>{
              const rs=Object.values(e.reviews||{}).map(r=>r.rating).filter(Boolean);
              const avg=rs.length?(rs.reduce((a,b)=>a+b,0)/rs.length).toFixed(1):null;
              return (
                <div key={e.id} style={{ display:"flex",gap:12,background:"rgba(255,255,255,0.03)",borderRadius:12,padding:12,alignItems:"center" }}>
                  {e.poster
                    ? <img src={`${TMDB_IMG}${e.poster}`} alt="" style={{ width:40,height:58,borderRadius:7,objectFit:"cover" }}/>
                    : <div style={{ width:40,height:58,borderRadius:7,background:"#1a1a2e" }}/>}
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:700,color:"#f0f0f0",fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{e.title}</div>
                    <div style={{ fontSize:11,color:"#777",marginTop:2 }}>
                      {e.date&&new Date(e.date+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})} • {e.where==="cinema"?"Cinema":"Streaming"}
                    </div>
                    <div style={{ display:"flex",gap:4,marginTop:5 }}>
                      {Object.keys(e.reviews||{}).map(u=><Avatar key={u} name={u} size={16}/>)}
                    </div>
                  </div>
                  {avg && <span style={{ color:"#f59e0b",fontWeight:700,fontSize:14 }}>★ {avg}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {watched.length===0 && (
        <div style={{ textAlign:"center",padding:"60px 20px" }}>
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ marginBottom:16,opacity:.3 }}>
            <rect x="10" y="10" width="60" height="60" rx="8" stroke="#e63946" strokeWidth="2"/>
            <line x1="25" y1="10" x2="25" y2="70" stroke="#e63946" strokeWidth="2"/>
            <line x1="55" y1="10" x2="55" y2="70" stroke="#e63946" strokeWidth="2"/>
            <line x1="10" y1="40" x2="70" y2="40" stroke="#e63946" strokeWidth="2"/>
            <line x1="10" y1="25" x2="25" y2="25" stroke="#e63946" strokeWidth="2"/>
            <line x1="55" y1="25" x2="70" y2="25" stroke="#e63946" strokeWidth="2"/>
          </svg>
          <div style={{ color:"#555",fontSize:15,fontWeight:600 }}>Registrem a primeira sessão de vocês!</div>
        </div>
      )}
    </div>
  );
};

// ── diary page ────────────────────────────────────────────────────────────────
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
      <div style={{ position:"relative",marginBottom:12 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Buscar por título..."
          style={{ width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:12,padding:"10px 44px 10px 14px",color:"#f0f0f0",fontSize:14,outline:"none",boxSizing:"border-box" }}/>
        <div style={{ position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",color:"#555" }}>
          <Ic n="search" s={16}/>
        </div>
      </div>

      {/* filter toggle */}
      <div style={{ display:"flex",gap:8,marginBottom:12,alignItems:"center" }}>
        <button onClick={()=>setShowFilters(f=>!f)}
          style={{ display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:10,border:"none",cursor:"pointer",
            fontWeight:600,fontSize:12,
            background:showFilters||hasActive?"#e63946":"rgba(255,255,255,0.07)",
            color:showFilters||hasActive?"#fff":"#888" }}>
          <Ic n="filter" s={14}/> Filtros {hasActive?"●":""}
        </button>
        {hasActive && (
          <button onClick={clearAll}
            style={{ padding:"7px 14px",borderRadius:10,border:"none",cursor:"pointer",
              fontWeight:600,fontSize:12,background:"rgba(255,255,255,0.07)",color:"#888" }}>
            Limpar
          </button>
        )}
        <span style={{ marginLeft:"auto",fontSize:12,color:"#555" }}>{items.length} título{items.length!==1?"s":""}</span>
      </div>

      {showFilters && (
        <div style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"16px",marginBottom:14 }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <div>
              <Label>Tipo</Label>
              <select value={filters.type} onChange={e=>setF("type",e.target.value)}
                style={{ width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",
                  borderRadius:8,padding:"8px 10px",color:"#f0f0f0",fontSize:13,outline:"none" }}>
                <option value="all">Todos</option>
                <option value="movie">Filmes</option>
                <option value="tv">Séries</option>
              </select>
            </div>
            <div>
              <Label>Onde</Label>
              <select value={filters.where} onChange={e=>setF("where",e.target.value)}
                style={{ width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",
                  borderRadius:8,padding:"8px 10px",color:"#f0f0f0",fontSize:13,outline:"none" }}>
                <option value="all">Todos</option>
                <option value="cinema">Cinema</option>
                <option value="streaming">Streaming</option>
              </select>
            </div>
            <div>
              <Label>Nota mínima</Label>
              <select value={filters.rating} onChange={e=>setF("rating",e.target.value)}
                style={{ width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",
                  borderRadius:8,padding:"8px 10px",color:"#f0f0f0",fontSize:13,outline:"none" }}>
                <option value="all">Todos</option>
                <option value="5">★★★★★</option>
                <option value="4">★★★★+</option>
                <option value="3">★★★+</option>
                <option value="low">Abaixo de ★★★</option>
              </select>
            </div>
            <div>
              <Label>Gênero</Label>
              <select value={filters.genre} onChange={e=>setF("genre",e.target.value)}
                style={{ width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",
                  borderRadius:8,padding:"8px 10px",color:"#f0f0f0",fontSize:13,outline:"none" }}>
                <option value="all">Todos</option>
                {allGenres.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop:12 }}>
            <Label>Ordenar por</Label>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
              {[["recent","Mais recentes"],["oldest","Mais antigos"],["rated","Melhor avaliados"],["az","A–Z"]].map(([v,l])=>(
                <button key={v} onClick={()=>setF("sort",v)}
                  style={{ padding:"6px 14px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:600,fontSize:12,
                    background:filters.sort===v?"#e63946":"rgba(255,255,255,0.07)",
                    color:filters.sort===v?"#fff":"#888" }}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {items.length===0 ? (
        <div style={{ textAlign:"center",padding:"60px 0" }}>
          <svg width="70" height="70" viewBox="0 0 70 70" fill="none" style={{ marginBottom:16,opacity:.25 }}>
            <circle cx="35" cy="35" r="30" stroke="#e63946" strokeWidth="2"/>
            <line x1="20" y1="35" x2="50" y2="35" stroke="#e63946" strokeWidth="2"/>
            <line x1="35" y1="20" x2="35" y2="50" stroke="#e63946" strokeWidth="2" strokeDasharray="4 4"/>
          </svg>
          <div style={{ color:"#555",fontSize:14 }}>
            {watched.length===0?"Nenhum filme registrado ainda":"Nenhum título encontrado com esses filtros"}
          </div>
        </div>
      ) : (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(148px,1fr))",gap:14 }}>
          {items.map(e=>{
            const rs=Object.values(e.reviews||{}).map(r=>r.rating).filter(Boolean);
            const avg=rs.length?(rs.reduce((a,b)=>a+b,0)/rs.length).toFixed(1):null;
            const ratings=users.map(u=>e.reviews?.[u]?.rating||0).filter(Boolean);
            const isDiscord=ratings.length===2&&Math.abs(ratings[0]-ratings[1])>=2;
            const pendingUsers=users.filter(u=>!e.reviews?.[u]?.rating&&!e.reviews?.[u]?.text);
            return (
              <div key={e.id} onClick={()=>setSel(e)}
                style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,
                  overflow:"hidden",cursor:"pointer",position:"relative",transition:"transform .2s,box-shadow .2s" }}
                onMouseEnter={ev=>{ev.currentTarget.style.transform="translateY(-4px)";ev.currentTarget.style.boxShadow="0 18px 36px rgba(0,0,0,.5)";}}
                onMouseLeave={ev=>{ev.currentTarget.style.transform="none";ev.currentTarget.style.boxShadow="none";}}>
                <div style={{ height:200,position:"relative",overflow:"hidden" }}>
                  {e.poster
                    ? <img src={`${TMDB_IMG}${e.poster}`} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
                    : <PosterFallback type={e.type} h={200}/>}
                  <div style={{ position:"absolute",top:8,left:8,background:e.type==="tv"?"#7c3aed":"#e63946",
                    borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:700,color:"#fff",letterSpacing:1 }}>
                    {e.type==="tv"?"SÉRIE":"FILME"}
                  </div>
                  {avg && <div style={{ position:"absolute",top:8,right:8,background:"rgba(0,0,0,.8)",
                    borderRadius:7,padding:"2px 7px",fontSize:12,fontWeight:700,color:"#f59e0b" }}>★ {avg}</div>}
                  {isDiscord && (
                    <div style={{ position:"absolute",bottom:36,left:8,background:"rgba(0,0,0,.82)",
                      borderRadius:20,padding:"3px 8px",fontSize:9,color:"#f87171",fontWeight:700,
                      display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap" }}>
                      💥 Discordaram
                    </div>
                  )}
                  {pendingUsers.length>0 && (
                    <div style={{ position:"absolute",bottom:36,right:8,background:"rgba(0,0,0,.82)",
                      borderRadius:20,padding:"3px 8px",fontSize:9,color:"#f59e0b",fontWeight:700,
                      display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap" }}>
                      ⏳ {pendingUsers[0].split(" ")[0]}{pendingUsers.length>1?` +${pendingUsers.length-1}`:""}
                    </div>
                  )}
                  <div style={{ position:"absolute",bottom:8,left:8 }}><Avatar name={e.addedBy} size={22}/></div>
                  <button onClick={ev=>{ev.stopPropagation();onDelete(e);}}
                    style={{ position:"absolute",bottom:8,right:8,background:"rgba(220,38,38,.8)",
                      border:"none",borderRadius:7,padding:"3px 7px",cursor:"pointer",color:"#fff" }}>
                    <Ic n="trash" s={13}/>
                  </button>
                </div>
                <div style={{ padding:"10px 12px" }}>
                  <div style={{ fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:"#f0f0f0",
                    whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginBottom:3 }}>{e.title}</div>
                  <div style={{ fontSize:11,color:e.where==="cinema"?"#f59e0b":"#60a5fa" }}>
                    {e.where==="cinema"?"🎭 Cinema":"🏠 Streaming"}
                  </div>
                  {e.date && <div style={{ fontSize:11,color:"#666",marginTop:2 }}>
                    {new Date(e.date+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"})}
                  </div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── watchlist page ────────────────────────────────────────────────────────────
const WatchlistPage = ({ watchlist, users, currentUser, onDelete, onMarkWatched }) => {
  const [sel, setSel] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("priority");
  const priColor = { alta:"#ef4444", normal:"#f59e0b", baixa:"#22c55e" };
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

      <div style={{ position:"relative",marginBottom:12 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Buscar na watchlist..."
          style={{ width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:12,padding:"10px 44px 10px 14px",color:"#f0f0f0",fontSize:14,outline:"none",boxSizing:"border-box" }}/>
        <div style={{ position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",color:"#555" }}>
          <Ic n="search" s={16}/>
        </div>
      </div>

      <div style={{ display:"flex",gap:8,marginBottom:16,flexWrap:"wrap" }}>
        {[["all","Todos"],["movie","Filmes"],["tv","Séries"],["alta","Alta prioridade"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)}
            style={{ padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:600,fontSize:12,
              background:filter===v?"#7c3aed":"rgba(255,255,255,0.07)",color:filter===v?"#fff":"#888" }}>{l}</button>
        ))}
        <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:6 }}>
          <span style={{ fontSize:11,color:"#555" }}>Ordenar:</span>
          <select value={sort} onChange={e=>setSort(e.target.value)}
            style={{ background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:8,padding:"4px 8px",color:"#ccc",fontSize:12,outline:"none" }}>
            <option value="priority">Prioridade</option>
            <option value="recent">Mais recentes</option>
            <option value="az">A–Z</option>
            <option value="who">Quem sugeriu</option>
          </select>
        </div>
      </div>

      {items.length===0 ? (
        <div style={{ textAlign:"center",padding:"60px 0" }}>
          <svg width="70" height="70" viewBox="0 0 70 70" fill="none" style={{ marginBottom:16,opacity:.25 }}>
            <path d="M15 10h40v50l-20-14-20 14V10z" stroke="#7c3aed" strokeWidth="2" fill="none"/>
            <line x1="25" y1="25" x2="45" y2="25" stroke="#7c3aed" strokeWidth="2"/>
            <line x1="25" y1="33" x2="40" y2="33" stroke="#7c3aed" strokeWidth="2"/>
          </svg>
          <div style={{ color:"#555",fontSize:14 }}>
            {watchlist.length===0?"Nenhum filme na lista — que tal adicionar algo?":"Nenhum título com esses filtros"}
          </div>
        </div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {items.map(e=>(
            <div key={e.id} onClick={()=>setSel(e)}
              style={{ display:"flex",gap:14,background:"rgba(255,255,255,0.04)",
                border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:14,
                cursor:"pointer",transition:"background .15s",alignItems:"center" }}
              onMouseEnter={ev=>ev.currentTarget.style.background="rgba(255,255,255,0.08)"}
              onMouseLeave={ev=>ev.currentTarget.style.background="rgba(255,255,255,0.04)"}>
              {e.poster
                ? <img src={`${TMDB_IMG}${e.poster}`} alt="" style={{ width:46,height:66,borderRadius:8,objectFit:"cover",flexShrink:0 }}/>
                : <div style={{ width:46,height:66,borderRadius:8,background:"#1a1a2e",flexShrink:0 }}/>}
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontWeight:700,color:"#f0f0f0",fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{e.title}</div>
                <div style={{ fontSize:11,color:"#777",marginTop:2 }}>{e.type==="tv"?"Série":"Filme"} • {e.year}</div>
                <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:5 }}>
                  <Avatar name={e.suggestedBy} size={16}/>
                  <span style={{ fontSize:11,color:"#666" }}>{e.suggestedBy}</span>
                </div>
              </div>
              <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8 }}>
                <span style={{ fontSize:11,fontWeight:700,color:priColor[e.priority]||"#888" }}>
                  ● {e.priority?.charAt(0).toUpperCase()+e.priority?.slice(1)}
                </span>
                <button onClick={ev=>{ev.stopPropagation();onDelete(e);}}
                  style={{ background:"none",border:"none",color:"#555",cursor:"pointer",padding:2 }}>
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

// ── profile page ──────────────────────────────────────────────────────────────
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
      <div style={{ background:"linear-gradient(135deg,#14040b,#090915)",border:"1px solid rgba(230,57,70,.18)",
        borderRadius:20,padding:"26px 28px",marginBottom:22,textAlign:"center" }}>
        <div style={{ display:"flex",justifyContent:"center",marginBottom:14 }}>
          {users.map((u,i)=><div key={u} style={{ marginLeft:i===0?0:-8,zIndex:i }}><Avatar name={u} size={52}/></div>)}
        </div>
        <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:24,color:"#f0f0f0",margin:"0 0 4px" }}>
          {couple.name1} & {couple.name2}
        </h2>
        {days!==null&&<p style={{ color:"#e63946",fontWeight:600,margin:"0 0 2px" }}>{days} dias juntos</p>}
        {couple.since&&<p style={{ color:"#555",fontSize:12,margin:0 }}>
          Desde {new Date(couple.since+"T12:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"})}
        </p>}
      </div>

      {/* couple stats */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:18 }}>
        {[
          {v:watched.length,l:"Total"},
          {v:watched.filter(w=>w.type==="movie").length,l:"Filmes"},
          {v:watched.filter(w=>w.type==="tv").length,l:"Séries"},
        ].map(s=>(
          <div key={s.l} style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",
            borderRadius:14,padding:"14px 16px",textAlign:"center" }}>
            <div style={{ fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:"#f0f0f0" }}>{s.v}</div>
            <div style={{ fontSize:12,color:"#777",marginTop:2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* hours + avg */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18 }}>
        {totalMins>0 && (
          <div style={{ background:"rgba(96,165,250,.08)",border:"1px solid rgba(96,165,250,.2)",borderRadius:14,padding:"14px 16px" }}>
            <div style={{ fontSize:11,color:"#60a5fa",fontWeight:700,letterSpacing:1,marginBottom:6 }}>⏱ HORAS</div>
            <div style={{ fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#f0f0f0" }}>
              {Math.floor(totalMins/60)}h {totalMins%60}min
            </div>
            <div style={{ fontSize:11,color:"#555",marginTop:2 }}>assistidos juntos</div>
          </div>
        )}
        {globalAvg && (
          <div style={{ background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.2)",borderRadius:14,padding:"14px 16px" }}>
            <div style={{ fontSize:11,color:"#f59e0b",fontWeight:700,letterSpacing:1,marginBottom:6 }}>★ MÉDIA</div>
            <div style={{ fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#f0f0f0" }}>{globalAvg}</div>
            <div style={{ fontSize:11,color:"#555",marginTop:2 }}>nota do casal</div>
          </div>
        )}
      </div>

      {/* cinema vs streaming */}
      {watched.length>0 && (
        <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"16px 18px",marginBottom:18 }}>
          <div style={{ fontSize:11,color:"#666",fontWeight:700,letterSpacing:1.2,marginBottom:12 }}>🎭 CINEMA vs 🏠 STREAMING</div>
          <div style={{ display:"flex",gap:8,height:12,borderRadius:6,overflow:"hidden",marginBottom:8 }}>
            <div style={{ flex:cinemaCount,background:"#d97706" }}/>
            <div style={{ flex:streamCount,background:"#0284c7" }}/>
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,color:"#888" }}>
            <span>🎭 {cinemaCount} ({watched.length?Math.round(cinemaCount/watched.length*100):0}%)</span>
            <span>🏠 {streamCount} ({watched.length?Math.round(streamCount/watched.length*100):0}%)</span>
          </div>
        </div>
      )}

      {/* top genres */}
      {topGenres.length>0 && (
        <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"16px 18px",marginBottom:18 }}>
          <div style={{ fontSize:11,color:"#666",fontWeight:700,letterSpacing:1.2,marginBottom:14 }}>TOP GÊNEROS</div>
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {topGenres.map(([g,c])=>(
              <div key={g}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <span style={{ fontSize:13,color:"#ccc" }}>{g}</span>
                  <span style={{ fontSize:12,color:"#777" }}>{c}</span>
                </div>
                <div style={{ height:6,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden" }}>
                  <div style={{ height:"100%",width:`${c/maxGenre*100}%`,background:"linear-gradient(90deg,#7c3aed,#a78bfa)",borderRadius:3 }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* month most active */}
      {topMonth && (
        <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"14px 18px",marginBottom:18,display:"flex",gap:14,alignItems:"center" }}>
          <Ic n="clock" s={24} style={{color:"#a78bfa"}}/>
          <div>
            <div style={{ fontSize:11,color:"#777",fontWeight:700,letterSpacing:1,marginBottom:2 }}>MÊS MAIS ATIVO</div>
            <div style={{ fontWeight:700,color:"#f0f0f0",fontSize:15,textTransform:"capitalize" }}>{monthName(topMonth[0])}</div>
            <div style={{ fontSize:12,color:"#666" }}>{topMonth[1]} títulos assistidos</div>
          </div>
        </div>
      )}

      {/* per-user stats */}
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:11,color:"#666",fontWeight:700,letterSpacing:1.2,marginBottom:12 }}>PERFIL DE CADA UM</div>
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          {userStats.map(u=>(
            <div key={u.name} style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"16px 18px" }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
                <Avatar name={u.name} size={36}/>
                <div style={{ flex:1 }}>
                  <span style={{ fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#f0f0f0" }}>{u.name}</span>
                  {u.favGenre && <div style={{ fontSize:11,color:"#777",marginTop:2 }}>❤ {u.favGenre}</div>}
                </div>
                {u.avg && <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                  <Stars val={Math.round(parseFloat(u.avg))} size={14}/>
                  <span style={{ color:"#f59e0b",fontWeight:700,fontSize:13 }}>{u.avg}</span>
                </div>}
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8 }}>
                {[{v:u.registered,l:"Registrou"},{v:u.suggested,l:"Sugeriu"},{v:u.total,l:"Avaliou"}].map(s=>(
                  <div key={s.l} style={{ background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"10px 0",textAlign:"center" }}>
                    <div style={{ fontSize:20,fontWeight:700,color:"#f0f0f0" }}>{s.v}</div>
                    <div style={{ fontSize:11,color:"#777" }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* marcos */}
      <div style={{ fontSize:11,color:"#666",fontWeight:700,letterSpacing:1.2,marginBottom:12 }}>✦ MARCOS</div>
      <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:18 }}>
        {[
          first&&{ label:"Primeiro juntos", item:first },
          bestRated&&avgR(bestRated)>0&&{ label:`Melhor avaliado (★ ${avgR(bestRated).toFixed(1)})`, item:bestRated },
          biggestDiscord&&{ label:`Maior discordância (${Math.abs((biggestDiscord.reviews?.[users[0]]?.rating||0)-(biggestDiscord.reviews?.[users[1]]?.rating||0))} estrelas)`, item:biggestDiscord },
          mostSeasons&&{ label:`Mais temporadas assistidas (${mostSeasons.seasonsWatched?.length})`, item:mostSeasons },
        ].filter(Boolean).map(({label,item})=>(
          <div key={label} style={{ display:"flex",gap:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:12,alignItems:"center" }}>
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
            💥 DISCORDÔMETRO — {discordEntries.length} título{discordEntries.length!==1?"s":""}
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
                  <span style={{ fontSize:13,color:"#f87171",fontWeight:700,flexShrink:0 }}>Δ{Math.abs(r0-r1)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── nav ───────────────────────────────────────────────────────────────────────
const NAV = [
  { id:"home",      icon:"home",     label:"Início" },
  { id:"diary",     icon:"book",     label:"Diário" },
  { id:"watchlist", icon:"bookmark", label:"Watchlist" },
  { id:"profile",   icon:"heart",    label:"Casal" },
];

// ── root ──────────────────────────────────────────────────────────────────────
export default function App() {
  // ── auth + couple state ──
  const [authUser,   setAuthUser]   = useState(null);
  const [couple,     setCouple]     = useState(null);   // Firestore couple doc data
  const [coupleId,   setCoupleId]   = useState(null);   // Firestore doc id
  const [authLoading,setAuthLoading]= useState(true);
  const [loginLoading,setLoginLoading]=useState(false);

  // ── app state ──
  const [watched,   setWatched]   = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [page,      setPage]      = useState("home");
  const [addModal,  setAddModal]  = useState(null);
  const [toasts,    setToasts]    = useState([]);
  const [confirm,   setConfirm]   = useState(null);

  // ── derived ──
  // currentUser remains a name string for UI compatibility
  const currentUser = couple
    ? (couple.uid1 === authUser?.uid ? couple.name1 : couple.name2)
    : null;
  const users = couple ? [couple.name1, couple.name2].filter(Boolean) : [];

  // ── auth listener ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      setAuthUser(user);
      if (!user) { setCouple(null); setCoupleId(null); setAuthLoading(false); return; }
      // look for existing couple (as uid1 or uid2)
      const [s1, s2] = await Promise.all([
        getDocs(query(collection(db,"couples"), where("uid1","==",user.uid))),
        getDocs(query(collection(db,"couples"), where("uid2","==",user.uid))),
      ]);
      const snap = !s1.empty ? s1 : s2;
      if (!snap.empty) {
        setCoupleId(snap.docs[0].id);
        setCouple(snap.docs[0].data());
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Firestore real-time listeners ──
  useEffect(() => {
    if (!coupleId) { setWatched([]); setWatchlist([]); return; }
    const unW  = onSnapshot(collection(db,"couples",coupleId,"watched"),
      snap => setWatched(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const unWL = onSnapshot(collection(db,"couples",coupleId,"watchlist"),
      snap => setWatchlist(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return () => { unW(); unWL(); };
  }, [coupleId]);

  // ── auth actions ──
  const handleLogin = async () => {
    setLoginLoading(true);
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch(e) { console.error(e); }
    finally { setLoginLoading(false); }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setCouple(null); setCoupleId(null);
  };

  // ── couple actions ──
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

  // ── toast helper ──
  const addToast = (message, type="success", undoFn=null) => {
    const id = Date.now().toString();
    setToasts(t=>[...t,{id,message,type,undoFn}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)), type==="error"?5000:3000);
  };
  const dismissToast = id => setToasts(t=>t.filter(x=>x.id!==id));

  // ── data operations (Firestore) ──
  const addWatched = async entry => {
    const { id, ...data } = entry;
    await addDoc(collection(db,"couples",coupleId,"watched"), data);
    setAddModal(null);
    addToast("Sessão salva! 🎬");
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
    const { id, ...data } = entry;
    await addDoc(collection(db,"couples",coupleId,"watchlist"), data);
    setAddModal(null);
    addToast("Adicionado à lista ✦","info");
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

  // ── render guards ──
  if (authLoading) return (
    <div style={{ minHeight:"100vh",background:"#08080f",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ color:"#555",fontSize:14 }}>Carregando...</div>
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
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#08080f;font-family:'DM Sans',sans-serif;color:#f0f0f0;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:2px;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(1) opacity(.4);}
        select option{background:#1a1a2e;color:#f0f0f0;}
        @keyframes slideUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
      `}</style>

      {confirm && (
        <ConfirmModal message={confirm.message} onConfirm={confirm.onConfirm} onCancel={()=>setConfirm(null)}/>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast}/>

      <div style={{ minHeight:"100vh",background:"#08080f",maxWidth:680,margin:"0 auto",paddingBottom:88 }}>

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
        <div style={{ padding:"22px 22px 0",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22 }}>
          <span style={{ fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:900,color:"#f0f0f0" }}>
            Sessão<span style={{ color:"#e63946" }}> ✦</span>
          </span>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <button onClick={handleSignOut}
              style={{ display:"flex",alignItems:"center",gap:7,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:20,padding:"5px 12px 5px 6px",cursor:"pointer" }}
              title="Sair">
              <Avatar name={currentUser} size={22}/>
              <span style={{ fontSize:12,color:"#ccc",fontWeight:600 }}>{currentUser}</span>
            </button>
            <button onClick={()=>setAddModal("watchlist")}
              style={{ background:"rgba(124,58,237,.2)",border:"1px solid rgba(124,58,237,.3)",borderRadius:10,
                padding:"7px 13px",color:"#a78bfa",cursor:"pointer",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:5 }}>
              <Ic n="bookmark" s={14}/> Lista
            </button>
            <button onClick={()=>setAddModal("watched")}
              style={{ background:"linear-gradient(135deg,#e63946,#c1121f)",border:"none",borderRadius:10,
                padding:"7px 13px",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:5 }}>
              <Ic n="plus" s={14}/> Registrar
            </button>
          </div>
        </div>

        {/* pages */}
        <div style={{ padding:"0 22px" }}>
          {page==="home"      && <HomePage      watched={watched} watchlist={watchlist} couple={couple} currentUser={currentUser} users={users}/>}
          {page==="diary"     && <DiaryPage     watched={watched} users={users} currentUser={currentUser}
                                   onDelete={e=>requestDelete(e,"watched")} onEdit={editWatched} onSaveReview={saveReview}/>}
          {page==="watchlist" && <WatchlistPage watchlist={watchlist} users={users} currentUser={currentUser}
                                   onDelete={e=>requestDelete(e,"watchlist")} onMarkWatched={markWatched}/>}
          {page==="profile"   && <ProfilePage   watched={watched} watchlist={watchlist} couple={couple} users={users}/>}
        </div>

        {/* bottom nav */}
        <div style={{ position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:680,
          background:"rgba(8,8,15,0.96)",borderTop:"1px solid rgba(255,255,255,0.07)",
          backdropFilter:"blur(20px)",display:"flex",justifyContent:"space-around",padding:"10px 0 14px" }}>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setPage(n.id)}
              style={{ background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",
                alignItems:"center",gap:4,color:page===n.id?"#e63946":"#555",transition:"color .2s",padding:"2px 16px" }}>
              <Ic n={n.icon} s={21}/>
              <span style={{ fontSize:10,fontWeight:700,letterSpacing:.5 }}>{n.label.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
