import { useEffect, useState } from "react";
import { TMDB_LOGO, tmdbCached } from "../tmdb.js";

/**
 * "Nossos streamings": os serviços que o casal assina, na lista do Brasil do TMDB
 * (os mais populares primeiro). Os IDs vêm do próprio TMDB, nada fixo no código.
 */
export default function Streamings({ inicial = [], onSalvar, salvarLabel = "Salvar", request = tmdbCached }) {
  const [provedores, setProvedores] = useState(null);
  const [erro, setErro] = useState(false);
  const [marcados, setMarcados] = useState(() => new Set(inicial));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    request("/watch/providers/movie", { watch_region: "BR", language: "pt-BR" })
      .then(d => {
        if (!vivo) return;
        const lista = (d.results || [])
          // só assinaturas: lojas de aluguel/compra não entram na sugestão
          .filter(p => !/store|amazon video|google play|youtube|microsoft/i.test(p.provider_name))
          .sort((a, b) => (a.display_priorities?.BR ?? a.display_priority ?? 99) - (b.display_priorities?.BR ?? b.display_priority ?? 99))
          .slice(0, 18);
        setProvedores(lista);
      })
      .catch(() => vivo && setErro(true));
    return () => { vivo = false; };
  }, [request]);

  const alternar = id => setMarcados(m => {
    const n = new Set(m);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const salvar = async () => {
    setSalvando(true);
    try { await onSalvar([...marcados]); } finally { setSalvando(false); }
  };

  if (erro) return <p className="stm__aviso">Não consegui carregar a lista de streamings. Confira a internet e tente de novo.</p>;
  if (!provedores) return <div className="stm__grade" aria-busy="true">{Array.from({ length: 9 }, (_, i) => <span key={i} className="stm__opcao stm__opcao--skel"/>)}</div>;

  return (
    <div className="stm">
      <div className="stm__grade" role="group" aria-label="Streamings que vocês assinam">
        {provedores.map(p => {
          const on = marcados.has(p.provider_id);
          return (
            <button key={p.provider_id} type="button" className={`stm__opcao ${on ? "stm__opcao--on" : ""}`}
              aria-pressed={on} onClick={() => alternar(p.provider_id)}>
              <img src={`${TMDB_LOGO}${p.logo_path}`} alt="" loading="lazy"/>
              <span>{p.provider_name}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="pill pill--primary pill--block" disabled={!marcados.size || salvando} onClick={salvar}>
        {salvando ? "Salvando…" : marcados.size ? salvarLabel : "Escolha pelo menos um"}
      </button>
    </div>
  );
}
